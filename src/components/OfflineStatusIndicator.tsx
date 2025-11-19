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
    <div className="fixed top-4 right-4 z-50">
      <div className="relative">
        {/* Status Indicator - Just a colored dot */}
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className={`relative w-3 h-3 rounded-full shadow-lg transition-all hover:scale-125 ${
            isOnline
              ? 'bg-green-500'
              : 'bg-red-500 animate-pulse'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        >
          {/* Badge for queued count */}
          {queuedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {queuedCount}
            </span>
          )}
        </button>

        {/* Tooltip Card */}
        {showTooltip && (
          <Card className="absolute top-full right-0 mt-2 w-80 shadow-xl">
            <CardContent className="p-4 space-y-3">
              {isOnline ? (
                <>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">You're Online</h4>
                      <p className="text-xs text-muted-foreground">
                        Documents will be processed immediately when you upload them.
                      </p>
                    </div>
                  </div>

                  {queuedCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <p className="text-xs font-medium text-blue-900">
                        📤 Syncing {queuedCount} queued document{queuedCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Your previously queued documents are being uploaded automatically.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      <strong>Offline Mode Available:</strong> If you lose connection, don't worry! Documents will be saved locally and uploaded when you're back online.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0 animate-pulse"></div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">You're Offline</h4>
                      <p className="text-xs text-muted-foreground">
                        No internet connection detected.
                      </p>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded p-3 space-y-2">
                    <p className="text-xs font-semibold text-orange-900">
                      ✅ You can still upload documents!
                    </p>
                    <div className="text-xs text-orange-800 space-y-1">
                      <p><strong>What happens now:</strong></p>
                      <ul className="list-disc list-inside space-y-0.5 ml-2">
                        <li>Documents are saved to your device</li>
                        <li>They're stored securely in local storage</li>
                        <li>Processing happens automatically when you're online</li>
                        <li>No manual action needed from you</li>
                      </ul>
                    </div>
                  </div>

                  {queuedCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-2">
                      <p className="text-xs font-medium text-blue-900">
                        📋 {queuedCount} document{queuedCount !== 1 ? 's' : ''} queued
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Will sync automatically when connection is restored.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <p className="text-xs text-green-700 font-medium">
                      ✓ Your work is safe! Keep uploading as normal.
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
