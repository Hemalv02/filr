/**
 * OfflineNotifications - Toast Notification System for Offline Events
 *
 * Provides user feedback for offline/online transitions and sync events.
 * Uses browser notifications and in-app toasts.
 */

import {
  NetworkStatusManager,
  type NetworkStatus,
} from './NetworkStatusManager';
import { SyncManager, type SyncEvent } from './SyncManager';

/**
 * Toast notification interface
 */
export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number; // Auto-dismiss duration in ms (0 = no auto-dismiss)
  timestamp: Date;
}

/**
 * Toast observer interface
 */
export interface ToastObserver {
  onToast(toast: Toast): void;
}

/**
 * OfflineNotifications - Manages notifications for offline events
 */
export class OfflineNotifications {
  private static instance: OfflineNotifications | null = null;

  private networkManager: NetworkStatusManager;
  private syncManager: SyncManager;
  private toastObservers: Set<ToastObserver> = new Set();
  private toastCounter = 0;

  private unsubscribeNetwork?: () => void;
  private unsubscribeSync?: () => void;

  private constructor() {
    this.networkManager = NetworkStatusManager.getInstance();
    this.syncManager = SyncManager.getInstance();

    this.setupSubscriptions();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OfflineNotifications {
    if (!OfflineNotifications.instance) {
      OfflineNotifications.instance = new OfflineNotifications();
    }
    return OfflineNotifications.instance;
  }

  /**
   * Setup subscriptions to network and sync events
   */
  private setupSubscriptions(): void {
    // Subscribe to network status changes
    this.unsubscribeNetwork = this.networkManager.subscribe({
      onStatusChange: (status: NetworkStatus) => {
        this.handleNetworkStatusChange(status);
      },
    });

    // Subscribe to sync events
    this.unsubscribeSync = this.syncManager.subscribe({
      onSyncEvent: (event: SyncEvent) => {
        this.handleSyncEvent(event);
      },
    });
  }

  /**
   * Handle network status change
   */
  private handleNetworkStatusChange(status: NetworkStatus): void {
    if (status === 'offline') {
      this.showToast({
        type: 'warning',
        title: 'You are offline',
        message:
          'Your documents will be queued for processing when connection is restored.',
        duration: 5000,
      });
    } else {
      this.showToast({
        type: 'success',
        title: 'Connection restored',
        message: 'Checking for queued documents to sync...',
        duration: 3000,
      });
    }
  }

  /**
   * Handle sync events
   */
  private handleSyncEvent(event: SyncEvent): void {
    switch (event.type) {
      case 'sync_started':
        this.showToast({
          type: 'info',
          title: 'Synchronizing documents',
          message: `Processing ${event.total || 0} queued documents...`,
          duration: 3000,
        });
        break;

      case 'sync_completed':
        this.showToast({
          type: 'success',
          title: 'Sync completed',
          message: 'All queued documents have been processed successfully.',
          duration: 5000,
        });
        break;

      case 'sync_failed':
        this.showToast({
          type: 'error',
          title: 'Sync failed',
          message: event.error || 'Failed to sync queued documents.',
          duration: 0, // Don't auto-dismiss errors
        });
        break;

      case 'job_failed':
        if (event.fileName) {
          this.showToast({
            type: 'error',
            title: 'Document processing failed',
            message: `Failed to process "${event.fileName}". ${event.error || ''}`,
            duration: 0, // Don't auto-dismiss errors
          });
        }
        break;

      case 'job_completed':
        // Optionally show success for individual jobs
        // Commented out to avoid spam, but can be enabled
        /*
        if (event.fileName) {
          this.showToast({
            type: 'success',
            title: 'Document processed',
            message: `Successfully processed "${event.fileName}"`,
            duration: 3000,
          });
        }
        */
        break;
    }
  }

  /**
   * Show a toast notification
   */
  public showToast(params: {
    type: Toast['type'];
    title: string;
    message: string;
    duration?: number;
  }): void {
    const toast: Toast = {
      id: `toast-${++this.toastCounter}`,
      type: params.type,
      title: params.title,
      message: params.message,
      duration: params.duration ?? 5000,
      timestamp: new Date(),
    };

    console.log(`[OfflineNotifications] ${toast.type.toUpperCase()}: ${toast.title} - ${toast.message}`);

    // Notify all observers
    this.toastObservers.forEach(observer => {
      try {
        observer.onToast(toast);
      } catch (error) {
        console.error('[OfflineNotifications] Error notifying observer:', error);
      }
    });

    // Optionally show browser notification (requires permission)
    if (params.type === 'error' || params.type === 'warning') {
      this.showBrowserNotification(toast);
    }
  }

  /**
   * Show browser notification (requires permission)
   */
  private async showBrowserNotification(toast: Toast): Promise<void> {
    if (!('Notification' in window)) {
      return; // Browser doesn't support notifications
    }

    if (Notification.permission === 'granted') {
      try {
        new Notification(toast.title, {
          body: toast.message,
          icon: '/icon/128.png', // Assuming extension icon exists
          tag: toast.id,
        });
      } catch (error) {
        console.warn('[OfflineNotifications] Failed to show browser notification:', error);
      }
    } else if (Notification.permission !== 'denied') {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.showBrowserNotification(toast);
      }
    }
  }

  /**
   * Subscribe to toast notifications
   */
  public subscribe(observer: ToastObserver): () => void {
    this.toastObservers.add(observer);
    return () => {
      this.toastObservers.delete(observer);
    };
  }

  /**
   * Unsubscribe from toast notifications
   */
  public unsubscribe(observer: ToastObserver): void {
    this.toastObservers.delete(observer);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
    }
    if (this.unsubscribeSync) {
      this.unsubscribeSync();
    }
    this.toastObservers.clear();
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (OfflineNotifications.instance) {
      OfflineNotifications.instance.cleanup();
      OfflineNotifications.instance = null;
    }
  }
}

/**
 * Hook-friendly wrapper for React components
 */
export function useOfflineNotifications(
  onToast: (toast: Toast) => void
): OfflineNotifications {
  const notifications = OfflineNotifications.getInstance();

  // Subscribe to toasts
  const unsubscribe = notifications.subscribe({ onToast });

  // Cleanup on unmount would be handled by React useEffect
  // This is just a utility function to make it easier to use in React

  return notifications;
}

// Export singleton instance getter as default
export default OfflineNotifications.getInstance;
