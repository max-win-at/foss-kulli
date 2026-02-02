import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadSource } from './helpers/load-source.js';

// PWAManager self-initializes on load (creates global pwaManager, calls init).
// We load it in a controlled way to test the class independently.
const PWAManager = loadSource('js/pwa-register.js', 'PWAManager');

describe('PWAManager', () => {
  let pwa;

  beforeEach(() => {
    pwa = new PWAManager();
    // Clean up any DOM elements created by previous tests
    ['pwa-install-btn', 'pwa-update-banner', 'offline-indicator'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  });

  describe('constructor', () => {
    it('initializes with null/false defaults', () => {
      expect(pwa.swRegistration).toBeNull();
      expect(pwa.updateAvailable).toBe(false);
      expect(pwa.installPromptEvent).toBeNull();
    });
  });

  describe('isStandalone', () => {
    it('returns false in normal browser context', () => {
      // jsdom does not implement matchMedia; mock it to return non-standalone
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      window.navigator.standalone = undefined;

      expect(pwa.isStandalone()).toBe(false);
    });

    it('returns true when display-mode is standalone', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });

      expect(pwa.isStandalone()).toBe(true);
    });
  });

  describe('promptInstall', () => {
    it('returns early when installPromptEvent is null', async () => {
      pwa.installPromptEvent = null;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await pwa.promptInstall();

      expect(consoleSpy).toHaveBeenCalledWith('[PWA] Install prompt not available');
      consoleSpy.mockRestore();
    });

    it('calls prompt() and clears event after user responds', async () => {
      const mockEvent = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      };
      pwa.installPromptEvent = mockEvent;
      // Mock hideInstallButton to avoid DOM issues
      pwa.hideInstallButton = vi.fn();

      await pwa.promptInstall();

      expect(mockEvent.prompt).toHaveBeenCalled();
      expect(pwa.installPromptEvent).toBeNull();
      expect(pwa.hideInstallButton).toHaveBeenCalled();
    });
  });

  describe('showInstallButton', () => {
    it('creates and appends an install button to the DOM', () => {
      pwa.showInstallButton();

      const btn = document.getElementById('pwa-install-btn');
      expect(btn).toBeTruthy();
      expect(btn.style.display).toBe('flex');
    });

    it('reuses existing button on subsequent calls', () => {
      pwa.showInstallButton();
      pwa.showInstallButton();

      const buttons = document.querySelectorAll('#pwa-install-btn');
      expect(buttons.length).toBe(1);
    });
  });

  describe('hideInstallButton', () => {
    it('hides the install button', () => {
      pwa.showInstallButton();
      pwa.hideInstallButton();

      const btn = document.getElementById('pwa-install-btn');
      expect(btn.style.display).toBe('none');
    });

    it('no-ops when button does not exist', () => {
      expect(() => pwa.hideInstallButton()).not.toThrow();
    });
  });

  describe('showUpdateNotification', () => {
    it('creates and shows update banner', () => {
      pwa.showUpdateNotification();

      const banner = document.getElementById('pwa-update-banner');
      expect(banner).toBeTruthy();
      expect(banner.style.display).toBe('flex');
    });
  });

  describe('dismissUpdate', () => {
    it('hides the update banner', () => {
      pwa.showUpdateNotification();
      pwa.dismissUpdate();

      const banner = document.getElementById('pwa-update-banner');
      expect(banner.style.display).toBe('none');
    });

    it('no-ops when banner does not exist', () => {
      expect(() => pwa.dismissUpdate()).not.toThrow();
    });
  });

  describe('applyUpdate', () => {
    it('posts SKIP_WAITING message to waiting service worker', () => {
      const postMessage = vi.fn();
      pwa.swRegistration = { waiting: { postMessage } };

      // Mock location.reload to prevent jsdom errors
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      });

      pwa.applyUpdate();

      expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(reloadMock).toHaveBeenCalled();
    });
  });

  describe('showOfflineIndicator / hideOfflineIndicator', () => {
    it('creates and shows offline indicator', () => {
      pwa.showOfflineIndicator();

      const indicator = document.getElementById('offline-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator.style.display).toBe('flex');
    });

    it('hides offline indicator', () => {
      pwa.showOfflineIndicator();
      pwa.hideOfflineIndicator();

      const indicator = document.getElementById('offline-indicator');
      expect(indicator.style.display).toBe('none');
    });

    it('hideOfflineIndicator no-ops when indicator does not exist', () => {
      expect(() => pwa.hideOfflineIndicator()).not.toThrow();
    });
  });
});
