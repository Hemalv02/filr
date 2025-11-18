/**
 * NetworkStatusBanner Component
 *
 * Displays a prominent banner when user goes offline
 * Shows current network status and queue information
 */

import { useState, useEffect } from 'react';
import { NetworkStatusManager } from '../lib/offline/NetworkStatusManager';
import { LocalDocumentStore } from '../lib/offline/LocalDocumentStore';
import { WifiOff, Wifi, Upload } from 'lucide-react';

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const networkManager = NetworkStatusManager.getInstance();

    // Set initial status
    setIsOnline(networkManager.isOnline());

    // Subscribe to network status changes
    const unsubscribe = networkManager.subscribe({
      onStatusChange: (status) => {
        setIsOnline(status === 'online');
      },
    });

    // Load queued count
    loadQueuedCount();

    // Refresh queued count every 5 seconds
    const interval = setInterval(loadQueuedCount, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const loadQueuedCount = async () => {
    try {
      const store = LocalDocumentStore.getInstance();
      await store.initializeDB();
      const stats = await store.getStorageStats();
      setQueuedCount(stats.queuedJobs);
    } catch (error) {
      console.error('[NetworkStatusBanner] Failed to load queue count:', error);
    }
  };

  // Don't show banner if online and no queued items
  if (isOnline && queuedCount === 0) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${
        isOnline
          ? 'bg-blue-500 text-white'
          : 'bg-orange-500 text-white'
      } shadow-lg`}
    >
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="w-5 h-5 flex-shrink-0" />
            ) : (
              <WifiOff className="w-5 h-5 flex-shrink-0 animate-pulse" />
            )}
            <div className="flex-1">
              {isOnline ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Back Online</span>
                  {queuedCount > 0 && (
                    <>
                      <span>•</span>
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">
                        Syncing {queuedCount} queued document{queuedCount !== 1 ? 's' : ''}...
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <div className="font-medium">You're Offline</div>
                  <div className="text-sm opacity-90">
                    Documents will be saved and uploaded automatically when you're back online
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isOnline && queuedCount > 0 && (
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium">
              <Upload className="w-4 h-4" />
              <span>{queuedCount} queued</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
