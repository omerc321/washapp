import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import { apiRequest } from '@/lib/queryClient';

interface UsePushNotificationsOptions {
  userId?: number;
  plateNumber?: string;
  autoSubscribe?: boolean;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported in this browser',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast({
          title: 'Permission Denied',
          description: 'Please enable notifications to receive updates',
          variant: 'destructive',
        });
        setIsLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      const publicKeyResponse = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await publicKeyResponse.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subscriptionData = subscription.toJSON();

      await apiRequest('POST', '/api/push/subscribe', {
        endpoint: subscriptionData.endpoint,
        keys: subscriptionData.keys,
        plateNumber: options.plateNumber,
        soundEnabled: soundEnabled ? 1 : 0,
      });

      setIsSubscribed(true);
      toast({
        title: 'Notifications Enabled',
        description: "You'll receive updates about your jobs",
      });

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        title: 'Subscription Failed',
        description: 'Could not enable push notifications',
        variant: 'destructive',
      });
      setIsLoading(false);
      return false;
    }
  }, [options.plateNumber, toast]);

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subscriptionData = subscription.toJSON();
        
        await apiRequest('POST', '/api/push/unsubscribe', {
          endpoint: subscriptionData.endpoint,
        });

        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast({
        title: 'Notifications Disabled',
        description: 'You will no longer receive push notifications',
      });

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: 'Unsubscribe Failed',
        description: 'Could not disable push notifications',
        variant: 'destructive',
      });
      setIsLoading(false);
      return false;
    }
  }, [toast]);

  useEffect(() => {
    if (options.autoSubscribe && permission === 'default' && !isSubscribed) {
      subscribe();
    }
  }, [options.autoSubscribe, permission, isSubscribed, subscribe]);

  const toggleSound = useCallback(async () => {
    if (!isSubscribed) {
      return false;
    }

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subscriptionData = subscription.toJSON();
        const newSoundEnabled = !soundEnabled;
        
        await apiRequest('POST', '/api/push/update-sound', {
          endpoint: subscriptionData.endpoint,
          soundEnabled: newSoundEnabled ? 1 : 0,
        });

        setSoundEnabled(newSoundEnabled);
        toast({
          title: newSoundEnabled ? 'Sound Enabled' : 'Sound Disabled',
          description: newSoundEnabled 
            ? 'You will hear a sound with notifications' 
            : 'Notifications will be silent',
        });
      }

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error toggling sound:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update sound preference',
        variant: 'destructive',
      });
      setIsLoading(false);
      return false;
    }
  }, [isSubscribed, soundEnabled, toast]);

  return {
    permission,
    isSubscribed,
    soundEnabled,
    isLoading,
    subscribe,
    unsubscribe,
    toggleSound,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
