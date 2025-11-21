import webpush from 'web-push';
import { storage } from './storage';
import { JobStatus } from '@shared/schema';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@carwashpro.com';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
}

export class PushNotificationService {
  static async sendToUser(userId: number, payload: PushNotificationPayload): Promise<void> {
    try {
      const subscriptions = await storage.getUserPushSubscriptions(userId);
      console.log(`[Push] User #${userId} has ${subscriptions.length} subscription(s)`);
      
      if (subscriptions.length === 0) {
        console.log(`[Push] No active subscriptions for user #${userId} - notification not sent`);
        return;
      }
      
      const results = await Promise.allSettled(subscriptions.map(async (sub) => {
        try {
          const payloadWithSound = {
            ...payload,
            playSound: sub.soundEnabled === 1,
          };
          
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            JSON.stringify(payloadWithSound)
          );
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          // Clean up stale subscriptions (410 Gone, 404 Not Found)
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`[Push] Removing stale subscription for user #${userId}: ${error.statusCode}`);
            await storage.deletePushSubscription(sub.endpoint);
            return { success: false, endpoint: sub.endpoint, reason: 'stale', statusCode: error.statusCode };
          }
          
          // Log structured error for other failures (network, rate limits, etc.)
          console.error(`[Push] Failed to send to user #${userId}:`, {
            endpoint: sub.endpoint.substring(0, 50) + '...',
            statusCode: error.statusCode,
            message: error.message,
            type: error.name,
          });
          return { success: false, endpoint: sub.endpoint, reason: 'error', statusCode: error.statusCode };
        }
      }));

      // Log delivery summary
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const staleCount = results.filter(r => r.status === 'fulfilled' && r.value.reason === 'stale').length;
      const errorCount = results.filter(r => r.status === 'fulfilled' && r.value.reason === 'error').length;
      
      console.log(`[Push] Delivery summary for user #${userId}: ${successCount} sent, ${staleCount} stale removed, ${errorCount} failed`);
    } catch (error) {
      console.error('[Push] Critical error sending to user:', error);
    }
  }

  static async sendToCustomer(customerId: number, payload: PushNotificationPayload): Promise<void> {
    try {
      const subscriptions = await storage.getCustomerPushSubscriptions(customerId);
      console.log(`[Push] Customer #${customerId} has ${subscriptions.length} subscription(s)`);
      
      if (subscriptions.length === 0) {
        console.log(`[Push] No active subscriptions for customer #${customerId} - notification not sent`);
        return;
      }
      
      const promises = subscriptions.map(async (sub) => {
        try {
          const payloadWithSound = {
            ...payload,
            playSound: sub.soundEnabled === 1,
          };
          
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            JSON.stringify(payloadWithSound)
          );
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            await storage.deletePushSubscription(sub.endpoint);
          } else {
            console.error(`Failed to send push notification to endpoint ${sub.endpoint}:`, error);
          }
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error sending push notification to customer:', error);
    }
  }

  static async sendToRole(role: string, payload: PushNotificationPayload): Promise<void> {
    try {
      const subscriptions = await storage.getAllPushSubscriptionsByRole(role);
      
      const promises = subscriptions.map(async (sub) => {
        try {
          const payloadWithSound = {
            ...payload,
            playSound: sub.soundEnabled === 1,
          };
          
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            JSON.stringify(payloadWithSound)
          );
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            await storage.deletePushSubscription(sub.endpoint);
          } else {
            console.error(`Failed to send push notification to endpoint ${sub.endpoint}:`, error);
          }
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error sending push notification to role:', error);
    }
  }

  static async notifyJobStatusChange(jobId: number, newStatus: JobStatus, context: {
    carPlateNumber?: string;
    cleanerName?: string;
    companyName?: string;
    customerPhone?: string;
    customerId?: number;
    cleanerId?: number;
    userId?: number;
  }): Promise<void> {
    console.log(`[Push] Job status change: Job #${jobId} → ${newStatus}, customerId: ${context.customerId || 'none'}`);
    
    let payload: PushNotificationPayload | null = null;

    switch (newStatus) {
      case JobStatus.PAID:
        payload = {
          title: 'Payment Received',
          body: `Your payment for ${context.carPlateNumber} has been confirmed. Looking for available cleaners...`,
          icon: '/icon-192.png',
          tag: `job-${jobId}`,
          data: { jobId, type: 'job_status_change', status: newStatus },
        };
        if (context.customerId) {
          console.log(`[Push] Sending PAID notification to customer #${context.customerId}`);
          await this.sendToCustomer(context.customerId, payload);
        } else {
          console.log(`[Push] Skipping PAID notification - no customerId`);
        }
        break;

      case JobStatus.ASSIGNED:
        payload = {
          title: 'Cleaner Assigned!',
          body: `${context.cleanerName} will wash your car ${context.carPlateNumber}`,
          icon: '/icon-192.png',
          tag: `job-${jobId}`,
          data: { jobId, type: 'job_status_change', status: newStatus, url: `/customer/track/${context.carPlateNumber}` },
          requireInteraction: true,
        };
        if (context.customerId) {
          console.log(`[Push] Sending ASSIGNED notification to customer #${context.customerId}`);
          await this.sendToCustomer(context.customerId, payload);
        } else {
          console.log(`[Push] Skipping ASSIGNED notification - no customerId`);
        }
        break;

      case JobStatus.IN_PROGRESS:
        payload = {
          title: 'Wash Started',
          body: `${context.cleanerName} has started washing your car`,
          icon: '/icon-192.png',
          tag: `job-${jobId}`,
          data: { jobId, type: 'job_status_change', status: newStatus, url: `/customer/track/${context.carPlateNumber}` },
        };
        if (context.customerId) {
          console.log(`[Push] Sending IN_PROGRESS notification to customer #${context.customerId}`);
          await this.sendToCustomer(context.customerId, payload);
        } else {
          console.log(`[Push] Skipping IN_PROGRESS notification - no customerId`);
        }
        break;

      case JobStatus.COMPLETED:
        payload = {
          title: 'Wash Complete!',
          body: `Your car ${context.carPlateNumber} is ready! Please rate your experience`,
          icon: '/icon-192.png',
          tag: `job-${jobId}`,
          data: { jobId, type: 'job_status_change', status: newStatus, url: `/customer/track/${context.carPlateNumber}` },
          requireInteraction: true,
        };
        if (context.customerId) {
          console.log(`[Push] Sending COMPLETED notification to customer #${context.customerId}`);
          await this.sendToCustomer(context.customerId, payload);
        } else {
          console.log(`[Push] Skipping COMPLETED notification - no customerId`);
        }
        break;

      case JobStatus.CANCELLED:
        payload = {
          title: 'Job Cancelled',
          body: `Your car wash for ${context.carPlateNumber} has been cancelled`,
          icon: '/icon-192.png',
          tag: `job-${jobId}`,
          data: { jobId, type: 'job_status_change', status: newStatus },
        };
        if (context.customerId) {
          console.log(`[Push] Sending CANCELLED notification to customer #${context.customerId}`);
          await this.sendToCustomer(context.customerId, payload);
        } else {
          console.log(`[Push] Skipping CANCELLED notification - no customerId`);
        }
        break;

      case JobStatus.REFUNDED:
        payload = {
          title: 'Refund Processed',
          body: 'No cleaner was available. Your payment has been refunded',
          icon: '/icon-192.png',
          tag: `job-${jobId}`,
          data: { jobId, type: 'job_status_change', status: newStatus },
        };
        if (context.customerId) {
          console.log(`[Push] Sending REFUNDED notification to customer #${context.customerId}`);
          await this.sendToCustomer(context.customerId, payload);
        } else {
          console.log(`[Push] Skipping REFUNDED notification - no customerId`);
        }
        break;
    }
  }

  static async notifyNewJobAvailable(jobId: number, context: {
    carPlateNumber: string;
    locationAddress: string;
    price: number;
    cleanerId?: number;
    userId?: number;
  }): Promise<void> {
    const payload: PushNotificationPayload = {
      title: 'New Job Available!',
      body: `Car wash needed for ${context.carPlateNumber} - ${context.locationAddress}`,
      icon: '/icon-192.png',
      tag: `new-job-${jobId}`,
      data: { jobId, type: 'new_job', url: '/cleaner' },
      requireInteraction: true,
    };

    if (context.userId) {
      await this.sendToUser(context.userId, payload);
    } else if (context.cleanerId) {
      const cleaner = await storage.getCleaner(context.cleanerId);
      if (cleaner?.userId) {
        await this.sendToUser(cleaner.userId, payload);
      }
    }
  }

  static async notifyOnDutyCleaners(jobId: number, companyId: number, context: {
    carPlateNumber: string;
    locationAddress: string;
    price: number;
    locationLat: number;
    locationLng: number;
  }): Promise<void> {
    try {
      // Validate coordinates server-side to prevent abuse
      // Use Number.isFinite to allow 0.0 while rejecting null/undefined/NaN
      if (!Number.isFinite(context.locationLat) || !Number.isFinite(context.locationLng) ||
          context.locationLat < -90 || context.locationLat > 90 ||
          context.locationLng < -180 || context.locationLng > 180) {
        console.error('[Push] Invalid job coordinates - rejecting notification broadcast:', {
          jobId,
          lat: context.locationLat,
          lng: context.locationLng,
        });
        return;
      }
      
      const { db } = await import('./db');
      const { cleaners, users } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Get all on-duty cleaners for this company
      const onDutyCleaners = await db
        .select({
          id: cleaners.id,
          userId: cleaners.userId,
          displayName: users.displayName,
        })
        .from(cleaners)
        .innerJoin(users, eq(cleaners.userId, users.id))
        .where(
          and(
            eq(cleaners.companyId, companyId),
            eq(cleaners.status, 'on_duty')
          )
        );

      console.log(`[Push] Found ${onDutyCleaners.length} on-duty cleaners for company #${companyId}`);

      // Filter cleaners by geofence assignment in parallel to avoid N+1 queries
      const eligibilityChecks = await Promise.allSettled(
        onDutyCleaners.map(async (cleaner) => {
          try {
            const isAssignedToAll = await storage.isCleanerAssignedToAllGeofences(cleaner.id);
            if (isAssignedToAll) {
              return { cleaner, eligible: true };
            }

            // Check if cleaner is assigned to the geofence containing this job location
            const assignments = await storage.getCleanerGeofenceAssignments(cleaner.id);
            const isInGeofence = assignments.some(geofence => {
              if (!geofence.polygon) return false;
              return this.isPointInPolygon(
                context.locationLat,
                context.locationLng,
                geofence.polygon
              );
            });

            return { cleaner, eligible: isInGeofence };
          } catch (error) {
            console.error(`[Push] Error checking eligibility for cleaner #${cleaner.id}:`, error);
            return { cleaner, eligible: false };
          }
        })
      );

      // Extract eligible cleaners from results
      const eligibleCleaners = eligibilityChecks
        .filter(result => result.status === 'fulfilled' && result.value.eligible)
        .map(result => (result as PromiseFulfilledResult<{ cleaner: any; eligible: boolean }>).value.cleaner);

      console.log(`[Push] ${eligibleCleaners.length}/${onDutyCleaners.length} cleaners are eligible for this job`);

      // Send notifications to eligible cleaners
      const payload: PushNotificationPayload = {
        title: 'New Job Available!',
        body: `Car wash needed for ${context.carPlateNumber}`,
        icon: '/icon-192.png',
        tag: `new-job-${jobId}`,
        data: { jobId, type: 'new_job', url: '/cleaner' },
        requireInteraction: true,
      };

      const notificationPromises = eligibleCleaners.map(cleaner => 
        this.sendToUser(cleaner.userId, payload)
      );

      await Promise.allSettled(notificationPromises);
      
      if (eligibleCleaners.length > 0) {
        console.log(`[Push] Sent new job notifications to ${eligibleCleaners.length} cleaners`);
      }
    } catch (error) {
      console.error('[Push] Error notifying on-duty cleaners:', error);
    }
  }

  private static isPointInPolygon(lat: number, lng: number, polygon: Array<[number, number]>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      const intersect = ((yi > lng) !== (yj > lng))
        && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  static async notifyCleanerShiftChange(userId: number, onDuty: boolean): Promise<void> {
    const payload: PushNotificationPayload = {
      title: onDuty ? "You're On Duty" : 'Shift Ended',
      body: onDuty ? "You'll receive job notifications now" : "You're now off-duty. Great work today!",
      icon: '/icon-192.png',
      tag: 'shift-change',
      data: { type: 'shift_change', onDuty },
    };

    await this.sendToUser(userId, payload);
  }
}

export const pushService = new PushNotificationService();
