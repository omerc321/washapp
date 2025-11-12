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
      console.error('Error sending push notification to user:', error);
    }
  }

  static async sendToCustomer(customerId: number, payload: PushNotificationPayload): Promise<void> {
    try {
      const subscriptions = await storage.getCustomerPushSubscriptions(customerId);
      
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
          await this.sendToCustomer(context.customerId, payload);
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
          await this.sendToCustomer(context.customerId, payload);
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
          await this.sendToCustomer(context.customerId, payload);
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
          await this.sendToCustomer(context.customerId, payload);
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
          await this.sendToCustomer(context.customerId, payload);
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
          await this.sendToCustomer(context.customerId, payload);
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
