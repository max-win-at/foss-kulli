/**
 * Foss Kulli - PWA Registration & Update Handler
 * Handles service worker registration and update prompts
 */

class PWAManager {
  constructor() {
    this.swRegistration = null;
    this.updateAvailable = false;
    this.installPromptEvent = null;
  }

  /**
   * Initialize PWA functionality
   */
  async init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await this.registerServiceWorker();
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
      }
    }

    // Handle install prompt
    this.setupInstallPrompt();

    // Handle online/offline status
    this.setupNetworkStatus();
  }

  /**
   * Register the service worker
   */
  async registerServiceWorker() {
    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[PWA] Service worker registered successfully');

      // Check for updates
      this.swRegistration.addEventListener('updatefound', () => {
        const newWorker = this.swRegistration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available
            this.updateAvailable = true;
            this.showUpdateNotification();
          }
        });
      });

      // Handle controller change (when new SW takes over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Optionally reload the page when new SW takes control
        // window.location.reload();
      });

    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Setup install prompt handler (A2HS - Add to Home Screen)
   */
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent the mini-infobar from appearing on mobile
      event.preventDefault();
      
      // Save the event for later use
      this.installPromptEvent = event;
      
      // Show custom install button/prompt
      this.showInstallButton();
    });

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App was installed successfully');
      this.hideInstallButton();
      this.installPromptEvent = null;
    });
  }

  /**
   * Show install button in the UI
   */
  showInstallButton() {
    // Create install button if it doesn't exist
    let installBtn = document.getElementById('pwa-install-btn');
    
    if (!installBtn) {
      installBtn = document.createElement('button');
      installBtn.id = 'pwa-install-btn';
      installBtn.className = 'pwa-install-button';
      installBtn.innerHTML = `
        <span class="material-icons">install_mobile</span>
        <span class="install-text">Install App</span>
      `;
      installBtn.setAttribute('aria-label', 'Install Foss Kulli app');
      
      installBtn.addEventListener('click', () => this.promptInstall());
      
      document.body.appendChild(installBtn);
    }
    
    installBtn.style.display = 'flex';
  }

  /**
   * Hide install button
   */
  hideInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  }

  /**
   * Prompt user to install the app
   */
  async promptInstall() {
    if (!this.installPromptEvent) {
      console.log('[PWA] Install prompt not available');
      return;
    }

    // Show the install prompt
    this.installPromptEvent.prompt();

    // Wait for the user's response
    const { outcome } = await this.installPromptEvent.userChoice;
    
    console.log(`[PWA] User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);
    
    // Clear the saved prompt
    this.installPromptEvent = null;
    this.hideInstallButton();
  }

  /**
   * Show update notification
   */
  showUpdateNotification() {
    let updateBanner = document.getElementById('pwa-update-banner');
    
    if (!updateBanner) {
      updateBanner = document.createElement('div');
      updateBanner.id = 'pwa-update-banner';
      updateBanner.className = 'pwa-update-banner';
      updateBanner.innerHTML = `
        <span class="update-text">A new version is available!</span>
        <button class="update-btn" onclick="pwaManager.applyUpdate()">Update Now</button>
        <button class="dismiss-btn" onclick="pwaManager.dismissUpdate()">
          <span class="material-icons">close</span>
        </button>
      `;
      
      document.body.appendChild(updateBanner);
    }
    
    updateBanner.style.display = 'flex';
  }

  /**
   * Apply the pending update
   */
  applyUpdate() {
    if (this.swRegistration && this.swRegistration.waiting) {
      // Tell the waiting service worker to skip waiting
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Reload the page to get the new version
    window.location.reload();
  }

  /**
   * Dismiss update notification
   */
  dismissUpdate() {
    const updateBanner = document.getElementById('pwa-update-banner');
    if (updateBanner) {
      updateBanner.style.display = 'none';
    }
  }

  /**
   * Setup network status indicators
   */
  setupNetworkStatus() {
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      document.body.classList.toggle('offline', !isOnline);
      
      if (!isOnline) {
        this.showOfflineIndicator();
      } else {
        this.hideOfflineIndicator();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Check initial status
    updateOnlineStatus();
  }

  /**
   * Show offline indicator
   */
  showOfflineIndicator() {
    let indicator = document.getElementById('offline-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offline-indicator';
      indicator.className = 'offline-indicator';
      indicator.innerHTML = `
        <span class="material-icons">cloud_off</span>
        <span>You're offline - changes are saved locally</span>
      `;
      
      document.body.appendChild(indicator);
    }
    
    indicator.style.display = 'flex';
  }

  /**
   * Hide offline indicator
   */
  hideOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Check if app is running in standalone mode (installed)
   */
  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }

  /**
   * Clear all caches (useful for debugging)
   */
  async clearCaches() {
    if (this.swRegistration && this.swRegistration.active) {
      this.swRegistration.active.postMessage({ type: 'CLEAR_CACHE' });
    }
    
    // Also clear from main thread
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    
    console.log('[PWA] All caches cleared');
  }
}

// Create global instance
const pwaManager = new PWAManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => pwaManager.init());
} else {
  pwaManager.init();
}
