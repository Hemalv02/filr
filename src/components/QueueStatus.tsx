/**
 * QueueStatus Component
 *
 * Displays the offline queue status and allows users to manage queued jobs.
 * Shows real-time sync progress and provides retry/cancel actions.
 */

import { useState, useEffect } from 'react';
import { LocalDocumentStore, type StorageStats } from '../lib/offline/LocalDocumentStore';
import { SyncManager, type SyncEvent } from '../lib/offline/SyncManager';
import { NetworkStatusManager } from '../lib/offline/NetworkStatusManager';
import type { DocumentJob } from '../lib/offline/DocumentJob';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from './ui/spinner';

export function QueueStatus() {
  const [jobs, setJobs] = useState<DocumentJob[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Load initial data
  useEffect(() => {
    loadQueueData();
    setupSubscriptions();

    // Refresh every 5 seconds
    const interval = setInterval(loadQueueData, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const loadQueueData = async () => {
    try {
      const localStore = LocalDocumentStore.getInstance();
      await localStore.initializeDB();

      const allJobs = await localStore.getAllJobs({
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      // Filter out completed jobs (they should be auto-deleted)
      const activeJobs = allJobs.filter(j => j.status !== 'completed');

      setJobs(activeJobs);

      const storageStats = await localStore.getStorageStats();
      setStats(storageStats);
    } catch (error) {
      console.error('[QueueStatus] Failed to load queue data:', error);
    }
  };

  const setupSubscriptions = () => {
    // Subscribe to network status
    const networkManager = NetworkStatusManager.getInstance();
    const unsubNetwork = networkManager.subscribe({
      onStatusChange: (status) => {
        setIsOnline(status === 'online');
      },
    });

    // Subscribe to sync events
    const syncManager = SyncManager.getInstance();
    const unsubSync = syncManager.subscribe({
      onSyncEvent: (event: SyncEvent) => {
        handleSyncEvent(event);
      },
    });

    // Cleanup on unmount
    return () => {
      unsubNetwork();
      unsubSync();
    };
  };

  const handleSyncEvent = (event: SyncEvent) => {
    switch (event.type) {
      case 'sync_started':
        setIsSyncing(true);
        setSyncProgress({ current: 0, total: event.total || 0 });
        break;

      case 'job_started':
      case 'job_progress':
        if (event.progress && event.total) {
          setSyncProgress({ current: event.progress, total: event.total });
        }
        break;

      case 'job_completed':
      case 'job_failed':
        loadQueueData(); // Refresh job list
        break;

      case 'sync_completed':
      case 'sync_failed':
        setIsSyncing(false);
        setSyncProgress(null);
        loadQueueData();
        break;
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const syncManager = SyncManager.getInstance();
      await syncManager.retryJob(jobId);
    } catch (error) {
      console.error('[QueueStatus] Failed to retry job:', error);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      const syncManager = SyncManager.getInstance();
      await syncManager.cancelJob(jobId);
      await loadQueueData();
    } catch (error) {
      console.error('[QueueStatus] Failed to cancel job:', error);
    }
  };

  const handleManualSync = async () => {
    try {
      const syncManager = SyncManager.getInstance();
      await syncManager.startSync();
    } catch (error) {
      console.error('[QueueStatus] Failed to start sync:', error);
    }
  };

  const getStatusBadge = (status: DocumentJob['status']) => {
    const variants: Record<DocumentJob['status'], string> = {
      queued: 'bg-blue-500 text-white',
      syncing: 'bg-yellow-500 text-black',
      completed: 'bg-green-500 text-white',
      failed: 'bg-red-500 text-white',
    };

    return (
      <Badge className={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (jobs.length === 0 && !stats) {
    return null; // Don't show if no queue data
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Offline Queue</CardTitle>
            <Badge className={isOnline ? 'bg-green-500' : 'bg-red-500'}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>

          {isOnline && jobs.length > 0 && !isSyncing && (
            <Button onClick={handleManualSync} size="sm">
              Sync Now
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total Jobs</div>
              <div className="font-semibold">{stats.totalJobs}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Queued</div>
              <div className="font-semibold text-blue-600">{stats.queuedJobs}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Failed</div>
              <div className="font-semibold text-red-600">{stats.failedJobs}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Size</div>
              <div className="font-semibold">{formatFileSize(stats.totalSize)}</div>
            </div>
          </div>
        )}

        {isSyncing && syncProgress && (
          <div className="p-3 bg-blue-50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Spinner className="w-4 h-4" />
              <span className="font-medium text-sm">
                Syncing... ({syncProgress.current} / {syncProgress.total})
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{
                  width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {jobs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Jobs</h4>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate text-sm">{job.fileName}</span>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(job.createdAt)} • {formatFileSize(job.fileData.size)}
                    {job.attempts > 0 && ` • ${job.attempts} attempts`}
                  </div>
                  {job.errorMessage && (
                    <div className="text-xs text-destructive mt-1">
                      Error: {job.errorMessage}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  {job.status === 'failed' && (
                    <Button
                      onClick={() => handleRetry(job.id)}
                      size="sm"
                      variant="outline"
                    >
                      Retry
                    </Button>
                  )}
                  {(job.status === 'queued' || job.status === 'failed') && (
                    <Button
                      onClick={() => handleCancel(job.id)}
                      size="sm"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {jobs.length === 0 && stats && stats.totalJobs === 0 && (
          <div className="text-center text-muted-foreground py-4">
            No queued documents
          </div>
        )}
      </CardContent>
    </Card>
  );
}
