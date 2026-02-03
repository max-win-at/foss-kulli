/**
 * VmPwa - PWA ViewModel
 * Handles service worker registration, install prompts, and network status
 * Following architecture guidelines: dependency injection, no DOM creation, Alpine integration
 */
class VmPwa {
  /**
   * @param {Window} windowRef - Window object for events and navigator
   * @param {Navigator} navigatorRef - Navigator for service worker and online status
   * @param {Object} config - Configuration object
   * @param {string} config.swPath - Path to service worker file
   * @param {string} config.swScope - Service worker scope
   */
  constructor(windowRef, navigatorRef, config) {
    this._window = windowRef;
    this._navigator = navigatorRef;
    this._config = config;

    // Reactive state for Alpine bindings
    this.showInstallButton = false;
    this.showUpdateBanner = false;
    this.showOfflineIndicator = false;
    this.updateAvailable = false;

    // Internal state
    this._swRegistration = null;
    this._installPromptEvent = null;
  }

  /**
   * Alpine init method - called automatically
   */
  init() {
    this._registerServiceWorker();
    this._setupInstallPrompt();
    this._setupNetworkStatus();
  }

  /**
   * Register the service worker
   */
  async _registerServiceWorker() {
    if (!("serviceWorker" in this._navigator)) {
      return;
    }

    try {
      this._swRegistration = await this._navigator.serviceWorker.register(
        this._config.swPath,
        { scope: this._config.swScope },
      );

      console.log("[PWA] Service worker registered successfully");

      // Check for updates
      this._swRegistration.addEventListener("updatefound", () => {
        const newWorker = this._swRegistration.installing;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            this._navigator.serviceWorker.controller
          ) {
            this.updateAvailable = true;
            this.showUpdateBanner = true;
          }
        });
      });

      // Handle controller change
      this._navigator.serviceWorker.addEventListener("controllerchange", () => {
        // New SW took control
      });
    } catch (error) {
      console.error("[PWA] Service worker registration failed:", error);
    }
  }

  /**
   * Setup install prompt handler (A2HS - Add to Home Screen)
   */
  _setupInstallPrompt() {
    this._window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this._installPromptEvent = event;
      this.showInstallButton = true;
    });

    this._window.addEventListener("appinstalled", () => {
      console.log("[PWA] App was installed successfully");
      this.showInstallButton = false;
      this._installPromptEvent = null;
    });
  }

  /**
   * Setup network status indicators
   */
  _setupNetworkStatus() {
    const updateOnlineStatus = () => {
      const isOnline = this._navigator.onLine;
      this.showOfflineIndicator = !isOnline;
    };

    this._window.addEventListener("online", updateOnlineStatus);
    this._window.addEventListener("offline", updateOnlineStatus);

    // Check initial status
    updateOnlineStatus();
  }

  /**
   * Prompt user to install the app
   */
  async promptInstall() {
    if (!this._installPromptEvent) {
      console.log("[PWA] Install prompt not available");
      return;
    }

    this._installPromptEvent.prompt();
    const { outcome } = await this._installPromptEvent.userChoice;

    console.log(
      `[PWA] User ${outcome === "accepted" ? "accepted" : "dismissed"} the install prompt`,
    );

    this._installPromptEvent = null;
    this.showInstallButton = false;
  }

  /**
   * Apply the pending update
   */
  applyUpdate() {
    if (this._swRegistration && this._swRegistration.waiting) {
      this._swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    this._window.location.reload();
  }

  /**
   * Dismiss update notification
   */
  dismissUpdate() {
    this.showUpdateBanner = false;
  }

  /**
   * Check if app is running in standalone mode (installed)
   * @returns {boolean}
   */
  isStandalone() {
    return (
      this._window.matchMedia("(display-mode: standalone)").matches ||
      this._navigator.standalone === true
    );
  }

  /**
   * Clear all caches (useful for debugging)
   */
  async clearCaches() {
    if (this._swRegistration && this._swRegistration.active) {
      this._swRegistration.active.postMessage({ type: "CLEAR_CACHE" });
    }

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    console.log("[PWA] All caches cleared");
  }
}
