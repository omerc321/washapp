import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  time?: number;
}

interface UseBackgroundLocationOptions {
  distanceFilter?: number;
  updateInterval?: number;
  onLocationUpdate?: (location: LocationData) => void;
  onError?: (error: string) => void;
}

interface UseBackgroundLocationReturn {
  isNative: boolean;
  isTracking: boolean;
  hasPermission: boolean | null;
  currentLocation: LocationData | null;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationData | null>;
}

export function useBackgroundLocation(
  options: UseBackgroundLocationOptions = {}
): UseBackgroundLocationReturn {
  const {
    distanceFilter = 50,
    updateInterval = 5 * 60 * 1000,
    onLocationUpdate,
    onError,
  } = options;

  const [isNative] = useState(() => Capacitor.isNativePlatform());
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  
  const watcherIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStartingRef = useRef(false);

  const handleLocationUpdate = useCallback((location: LocationData) => {
    setCurrentLocation(location);
    onLocationUpdate?.(location);
  }, [onLocationUpdate]);

  const handleError = useCallback((error: string) => {
    console.error('Location error:', error);
    onError?.(error);
  }, [onError]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isNative) {
      try {
        const watcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'Washapp needs your location to assign nearby jobs',
            backgroundTitle: 'Location Active',
            requestPermissions: true,
            stale: true,
            distanceFilter: 1000000,
          },
          () => {}
        );
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
        setHasPermission(true);
        return true;
      } catch (error: any) {
        if (error?.code === 'NOT_AUTHORIZED') {
          setHasPermission(false);
          return false;
        }
        console.error('Permission request error:', error);
        return false;
      }
    } else {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          setHasPermission(false);
          resolve(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          () => {
            setHasPermission(true);
            resolve(true);
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              setHasPermission(false);
              resolve(false);
            } else {
              setHasPermission(true);
              resolve(true);
            }
          }
        );
      });
    }
  }, [isNative]);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    if (isNative) {
      return new Promise(async (resolve) => {
        let watcherId: string | null = null;
        let resolved = false;
        
        try {
          watcherId = await BackgroundGeolocation.addWatcher(
            {
              backgroundMessage: 'Getting current location',
              backgroundTitle: 'Location',
              requestPermissions: true,
              stale: true,
              distanceFilter: 0,
            },
            (location: any, error: any) => {
              if (resolved) return;
              resolved = true;
              
              if (error) {
                handleError(error.message || 'Failed to get location');
                resolve(null);
                return;
              }

              const locationData: LocationData = {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                altitude: location.altitude,
                speed: location.speed,
                bearing: location.bearing,
                time: location.time,
              };
              
              resolve(locationData);
            }
          );

          setTimeout(async () => {
            if (watcherId) {
              try {
                await BackgroundGeolocation.removeWatcher({ id: watcherId });
              } catch (e) {
                console.error('Error removing temp watcher:', e);
              }
            }
          }, 2000);
        } catch (error: any) {
          handleError(error.message || 'Failed to get location');
          resolve(null);
        }
      });
    } else {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          handleError('Geolocation not supported');
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const locationData: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude ?? undefined,
              speed: position.coords.speed ?? undefined,
              time: position.timestamp,
            };
            resolve(locationData);
          },
          (error) => {
            handleError(error.message);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
        );
      });
    }
  }, [isNative, handleError]);

  const startTracking = useCallback(async () => {
    if (isTracking || isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      if (isNative) {
        try {
          const watcherId = await BackgroundGeolocation.addWatcher(
            {
              backgroundMessage: 'Washapp is tracking your location for job assignments',
              backgroundTitle: 'On Duty - Location Active',
              requestPermissions: true,
              stale: false,
              distanceFilter,
            },
            (location: any, error: any) => {
              if (error) {
                if (error.code === 'NOT_AUTHORIZED') {
                  handleError('Location permission denied. Please enable in settings.');
                  setHasPermission(false);
                  setIsTracking(false);
                  watcherIdRef.current = null;
                } else {
                  handleError(error.message || 'Location error');
                }
                return;
              }

              const locationData: LocationData = {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                altitude: location.altitude,
                speed: location.speed,
                bearing: location.bearing,
                time: location.time,
              };
              
              handleLocationUpdate(locationData);
            }
          );

          watcherIdRef.current = watcherId;
          setIsTracking(true);
          setHasPermission(true);
        } catch (error: any) {
          handleError(error.message || 'Failed to start location tracking');
          setHasPermission(false);
          setIsTracking(false);
        }
      } else {
        if (!navigator.geolocation) {
          handleError('Geolocation not supported in this browser');
          return;
        }

        const getLocation = () => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const locationData: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude ?? undefined,
                speed: position.coords.speed ?? undefined,
                time: position.timestamp,
              };
              handleLocationUpdate(locationData);
            },
            (error) => {
              if (error.code === error.PERMISSION_DENIED) {
                handleError('Location permission denied');
                setHasPermission(false);
                setIsTracking(false);
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                }
              } else {
                handleError(error.message);
              }
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
          );
        };

        getLocation();

        intervalRef.current = setInterval(getLocation, updateInterval);
        setIsTracking(true);
        setHasPermission(true);
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [isNative, isTracking, distanceFilter, updateInterval, handleLocationUpdate, handleError]);

  const stopTracking = useCallback(async () => {
    if (isNative && watcherIdRef.current) {
      try {
        await BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
      } catch (error: any) {
        console.error('Error stopping native location tracking:', error);
      }
      watcherIdRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsTracking(false);
  }, [isNative]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (isNative && watcherIdRef.current) {
        BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current }).catch(console.error);
        watcherIdRef.current = null;
      }
    };
  }, [isNative]);

  return {
    isNative,
    isTracking,
    hasPermission,
    currentLocation,
    startTracking,
    stopTracking,
    requestPermission,
    getCurrentLocation,
  };
}
