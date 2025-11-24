import { db } from "./db";
import { cleaners, cleanerShifts } from "@shared/schema";
import { eq, and, lt, isNull, or } from "drizzle-orm";

const TEN_MINUTES_MS = 10 * 60 * 1000;

export async function checkAndEndStaleShifts() {
  try {
    const tenMinutesAgo = new Date(Date.now() - TEN_MINUTES_MS);
    
    // Find all ON_DUTY cleaners whose location hasn't been updated in 10+ minutes OR is NULL
    const staleCleaners = await db.select()
      .from(cleaners)
      .where(
        and(
          eq(cleaners.status, 'on_duty'),
          or(
            isNull(cleaners.lastLocationUpdate),
            lt(cleaners.lastLocationUpdate, tenMinutesAgo)
          )
        )
      );

    if (staleCleaners.length === 0) {
      return;
    }

    console.log(`[Auto-Shift-Timeout] Found ${staleCleaners.length} cleaners with stale location (>10 min)`);

    for (const cleaner of staleCleaners) {
      try {
        // Find active shift
        const [activeShift] = await db.select()
          .from(cleanerShifts)
          .where(
            and(
              eq(cleanerShifts.cleanerId, cleaner.id),
              isNull(cleanerShifts.shiftEnd)
            )
          )
          .limit(1);

        if (!activeShift) {
          console.log(`[Auto-Shift-Timeout] Cleaner ${cleaner.id} has no active shift, setting OFF_DUTY`);
          // No active shift but status is ON_DUTY - just fix status
          await db.update(cleaners)
            .set({ status: 'off_duty' })
            .where(eq(cleaners.id, cleaner.id));
          continue;
        }

        // End the shift automatically - use transaction to ensure consistency
        const now = new Date();
        const shiftDuration = Math.floor((now.getTime() - new Date(activeShift.shiftStart).getTime()) / (1000 * 60));
        
        await db.transaction(async (tx) => {
          // Update shift record
          await tx.update(cleanerShifts)
            .set({
              shiftEnd: now,
              durationMinutes: shiftDuration,
              endLatitude: cleaner.currentLatitude,
              endLongitude: cleaner.currentLongitude,
            })
            .where(eq(cleanerShifts.id, activeShift.id));

          // Set cleaner status to OFF_DUTY
          await tx.update(cleaners)
            .set({ status: 'off_duty' })
            .where(eq(cleaners.id, cleaner.id));
        });

        const lastUpdate = cleaner.lastLocationUpdate 
          ? new Date(cleaner.lastLocationUpdate).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })
          : 'never';

        console.log(
          `[Auto-Shift-Timeout] Ended shift ${activeShift.id} for cleaner ${cleaner.id} ` +
          `(last location update: ${lastUpdate})`
        );
      } catch (error) {
        console.error(`[Auto-Shift-Timeout] Error ending shift for cleaner ${cleaner.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Auto-Shift-Timeout] Error in checkAndEndStaleShifts:', error);
  }
}

let intervalId: NodeJS.Timeout | null = null;

export function startAutoShiftTimeoutService() {
  if (intervalId) {
    console.log('[Auto-Shift-Timeout] Service already running');
    return;
  }

  // Run every minute
  intervalId = setInterval(checkAndEndStaleShifts, 60 * 1000);
  console.log('[Auto-Shift-Timeout] Service started - checking every minute');
}

export function stopAutoShiftTimeoutService() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Auto-Shift-Timeout] Service stopped');
  }
}
