import Stripe from "stripe";
import { db } from "./db";
import { jobs, transactions } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";
import { getWebSocketServer } from "./websocket";
import { generateTransactionReference } from "./financialUtils";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export async function checkAndRefundExpiredJobs() {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - FIFTEEN_MINUTES_MS);
    
    // Find all jobs in PAID status that are older than 15 minutes
    const expiredJobs = await db.select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'paid'),
          lt(jobs.createdAt, fifteenMinutesAgo)
        )
      );

    if (expiredJobs.length === 0) {
      return;
    }

    console.log(`Found ${expiredJobs.length} jobs to auto-refund`);

    for (const job of expiredJobs) {
      try {
        if (!job.stripePaymentIntentId) {
          console.error(`Job ${job.id} has no payment intent ID, skipping refund`);
          continue;
        }

        // IMPORTANT: Mark job as 'refunded_unattended' FIRST to prevent cleaners from accepting it
        await db.update(jobs)
          .set({
            status: 'refunded_unattended',
            refundReason: 'No cleaner accepted within 15 minutes',
          })
          .where(eq(jobs.id, job.id));

        console.log(`Job ${job.id} marked as refunded - removed from cleaner availability`);

        // Now issue refund via Stripe
        const refund = await stripe.refunds.create({
          payment_intent: job.stripePaymentIntentId,
          reason: 'requested_by_customer',
        });

        console.log(`Issued Stripe refund ${refund.id} for job ${job.id}`);

        // Update job with refund details
        await db.update(jobs)
          .set({
            stripeRefundId: refund.id,
            refundedAt: new Date(),
          })
          .where(eq(jobs.id, job.id));

        // Create refund transaction record
        await db.insert(transactions).values({
          type: 'refund',
          direction: 'debit',
          amount: job.price,
          currency: 'AED',
          jobId: job.id,
          companyId: job.companyId,
          stripePaymentIntentId: job.stripePaymentIntentId,
          stripeRefundId: refund.id,
          referenceNumber: generateTransactionReference('REFUND', job.id),
          description: `Auto-refund for job ${job.id} - No cleaner accepted within 15 minutes`,
        });

        console.log(`Created refund transaction record for job ${job.id}`);

        // Send WebSocket notification to all clients
        const wss = getWebSocketServer();
        if (wss) {
          wss.clients.forEach((client: any) => {
            if (client.readyState === 1) { // OPEN
              client.send(JSON.stringify({
                type: 'job_cancelled',
                jobId: job.id,
                reason: 'No cleaner accepted within 15 minutes. Full refund issued.',
              }));
            }
          });
        }
      } catch (error) {
        console.error(`Error refunding job ${job.id}:`, error);
        // Continue with other jobs even if one fails
      }
    }
  } catch (error) {
    console.error('Error in auto-refund service:', error);
  }
}

// Run the check every minute
export function startAutoRefundService() {
  console.log('Auto-refund service started - checking every minute');
  
  // Run immediately on startup
  checkAndRefundExpiredJobs();
  
  // Then run every minute
  setInterval(checkAndRefundExpiredJobs, 60 * 1000);
}
