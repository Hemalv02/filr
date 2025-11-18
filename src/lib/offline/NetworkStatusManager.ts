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
  private connectivityCheckInterval: number | null = null;

  private constructor() {
    // Initialize with current browser status
    this.currentStatus = navigator.onLine ? 'online' : 'offline';

    // Set up browser event listeners
    this.setupEventListeners();

    // Verify actual internet connectivity (not just local network)
    this.verifyConnectivity();

    // Set up periodic connectivity checks (every 30 seconds)
    // This catches cases where internet drops without browser event
    this.connectivityCheckInterval = window.setInterval(() => {
      this.verifyConnectivity();
    }, 30000); // 30 seconds
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
    console.log('[NetworkStatusManager] Browser reports: ONLINE - verifying...');
    // Verify actual connectivity, don't just trust browser
    this.verifyConnectivity();
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
   * Verify actual internet connectivity by making a lightweight request
   * This catches cases where browser reports online but internet is unavailable
   */
  private async verifyConnectivity(): Promise<void> {
    // If browser says offline, trust it
    if (!navigator.onLine) {
      if (this.currentStatus !== 'offline') {
        console.log('[NetworkStatusManager] Browser offline - updating status');
        this.currentStatus = 'offline';
        this.notifyObservers();
      }
      return;
    }

    // Browser says online, but verify with actual request
    try {
      // Try to fetch a tiny file from Google (fast and reliable)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Successfully connected to internet
        if (this.currentStatus !== 'online') {
          console.log('[NetworkStatusManager] Verified ONLINE - internet accessible');
          this.currentStatus = 'online';
          this.notifyObservers();
        }
      } else {
        // Request failed - probably offline
        if (this.currentStatus !== 'offline') {
          console.log('[NetworkStatusManager] Request failed - updating to OFFLINE');
          this.currentStatus = 'offline';
          this.notifyObservers();
        }
      }
    } catch (error) {
      // Network error - definitely offline
      if (this.currentStatus !== 'offline') {
        console.log('[NetworkStatusManager] Network error - updating to OFFLINE:', error);
        this.currentStatus = 'offline';
        this.notifyObservers();
      }
    }
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
   * Manually refresh connectivity status
   * Call this when you need an immediate check
   */
  public async refreshStatus(): Promise<void> {
    await this.verifyConnectivity();
  }

  /**
   * Cleanup event listeners (for testing or teardown)
   */
  public cleanup(): void {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));

    if (this.connectivityCheckInterval !== null) {
      window.clearInterval(this.connectivityCheckInterval);
      this.connectivityCheckInterval = null;
    }

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
