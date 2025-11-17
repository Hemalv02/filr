/**
 * NetworkStatusManager - Singleton Pattern + Observer Pattern
 *
 * Monitors browser online/offline status and notifies subscribers.
 * This is the foundation for the offline processing feature.
 *
 * Design Patterns:
 * - Singleton: Only one instance manages network status
 * - Observer: Subscribers get notified of status changes
 */

export type NetworkStatus = 'online' | 'offline';

export interface NetworkStatusObserver {
  onStatusChange(status: NetworkStatus): void;
}

export class NetworkStatusManager {
  private static instance: NetworkStatusManager | null = null;
  private observers: Set<NetworkStatusObserver> = new Set();
  private currentStatus: NetworkStatus;

  private constructor() {
    // Initialize with current browser status
    this.currentStatus = navigator.onLine ? 'online' : 'offline';

    // Set up browser event listeners
    this.setupEventListeners();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): NetworkStatusManager {
    if (!NetworkStatusManager.instance) {
      NetworkStatusManager.instance = new NetworkStatusManager();
    }
    return NetworkStatusManager.instance;
  }

  /**
   * Setup browser online/offline event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    console.log('[NetworkStatusManager] Network status changed: ONLINE');
    this.currentStatus = 'online';
    this.notifyObservers();
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    console.log('[NetworkStatusManager] Network status changed: OFFLINE');
    this.currentStatus = 'offline';
    this.notifyObservers();
  }

  /**
   * Subscribe to network status changes
   */
  public subscribe(observer: NetworkStatusObserver): () => void {
    this.observers.add(observer);

    // Immediately notify the new observer of current status
    observer.onStatusChange(this.currentStatus);

    // Return unsubscribe function
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Unsubscribe an observer
   */
  public unsubscribe(observer: NetworkStatusObserver): void {
    this.observers.delete(observer);
  }

  /**
   * Notify all observers of status change
   */
  private notifyObservers(): void {
    this.observers.forEach(observer => {
      try {
        observer.onStatusChange(this.currentStatus);
      } catch (error) {
        console.error('[NetworkStatusManager] Error notifying observer:', error);
      }
    });
  }

  /**
   * Get current network status
   */
  public getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  /**
   * Check if currently online
   */
  public isOnline(): boolean {
    return this.currentStatus === 'online';
  }

  /**
   * Check if currently offline
   */
  public isOffline(): boolean {
    return this.currentStatus === 'offline';
  }

  /**
   * Cleanup event listeners (for testing or teardown)
   */
  public cleanup(): void {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    this.observers.clear();
  }

  /**
   * Reset singleton (for testing purposes only)
   */
  public static resetInstance(): void {
    if (NetworkStatusManager.instance) {
      NetworkStatusManager.instance.cleanup();
      NetworkStatusManager.instance = null;
    }
  }
}

// Export singleton instance getter as default
export default NetworkStatusManager.getInstance;
