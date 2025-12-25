/**
 * OfflineStatusIndicator Component
 *
 * Persistent network status indicator that's always visible
 * Shows green (online) or red (offline) with helpful tooltips
 */

import { useState, useEffect } from 'react';
import { NetworkStatusManager } from '../lib/offline/NetworkStatusManager';
import { LocalDocumentStore } from '../lib/offline/LocalDocumentStore';
import { Wifi, WifiOff, Info } from 'lucide-react';
import { Card, CardContent } from './ui/card';

export function OfflineStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

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

    // Refresh queued count every 3 seconds
    const interval = setInterval(loadQueuedCount, 3000);

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
      console.error('[OfflineStatusIndicator] Failed to load queue count:', error);
    }
  };

  return (
    <div className="fixed top-2.5 right-2 z-50">
      <div className="relative">
        {/* Status Indicator - Just a colored dot */}
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className={`relative w-2.5 h-2.5 rounded-full shadow-md transition-all hover:scale-125 ${
            isOnline
              ? 'bg-green-500'
              : 'bg-red-500 animate-pulse'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        >
          {/* Badge for queued count */}
          {queuedCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-white text-[7px] font-bold rounded-full w-3 h-3 flex items-center justify-center">
              {queuedCount}
            </span>
          )}
        </button>

        {/* Tooltip Card */}
        {showTooltip && (
          <Card className="absolute top-full right-0 mt-1.5 w-64 shadow-xl">
            <CardContent className="p-2.5 space-y-2">
              {isOnline ? (
                <>
                  <div className="flex items-start gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <h4 className="font-semibold text-xs mb-0.5">You're Online</h4>
                      <p className="text-[10px] text-muted-foreground">
                        Documents processed immediately.
                      </p>
                    </div>
                  </div>

                  {queuedCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-2">
                      <p className="text-[10px] font-medium text-blue-900">
                        📤 Syncing {queuedCount} queued document{queuedCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[9px] text-blue-700 mt-0.5">
                        Uploading automatically.
                      </p>
                    </div>
                  )}

                  <div className="pt-1.5 border-t">
                    <p className="text-[10px] text-muted-foreground">
                      <strong>Offline Mode:</strong> Documents saved locally if connection lost.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-1.5">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1 flex-shrink-0 animate-pulse"></div>
                    <div>
                      <h4 className="font-semibold text-xs mb-0.5">You're Offline</h4>
                      <p className="text-[10px] text-muted-foreground">
                        No internet connection.
                      </p>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded p-2 space-y-1">
                    <p className="text-[10px] font-semibold text-orange-900">
                      ✅ You can still upload!
                    </p>
                    <div className="text-[9px] text-orange-800">
                      <p className="font-medium">Documents will:</p>
                      <ul className="list-disc list-inside space-y-0 ml-1 mt-0.5">
                        <li>Save to your device</li>
                        <li>Process when online</li>
                        <li>Sync automatically</li>
                      </ul>
                    </div>
                  </div>

                  {queuedCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-1.5">
                      <p className="text-[10px] font-medium text-blue-900">
                        📋 {queuedCount} document{queuedCount !== 1 ? 's' : ''} queued
                      </p>
                      <p className="text-[9px] text-blue-700 mt-0.5">
                        Will sync when online.
                      </p>
                    </div>
                  )}

                  <div className="pt-1.5 border-t">
                    <p className="text-[10px] text-green-700 font-medium">
                      ✓ Your work is safe!
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Click outside to close tooltip */}
      {showTooltip && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowTooltip(false)}
        />
      )}
    </div>
  );
}
