import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadSource } from "./helpers/load-source.js";

// Load VmPwa class
const VmPwa = loadSource("js/viewmodels/vm-pwa.js", "VmPwa");

// Test configuration for PWA
const TEST_PWA_CONFIG = {
  swPath: "/sw.js",
  swScope: "/",
};

/**
 * Helper: creates a VmPwa instance with mock dependencies
 */
function createPwa(opts = {}) {
  const mockWindow = {
    addEventListener: vi.fn(),
    location: { reload: vi.fn() },
    matchMedia: vi.fn().mockReturnValue({ matches: false }),
  };

  const mockServiceWorker = {
    register: vi.fn().mockResolvedValue({
      addEventListener: vi.fn(),
      installing: null,
      waiting: null,
      active: null,
    }),
    addEventListener: vi.fn(),
    controller: null,
  };

  const mockNavigator = {
    serviceWorker: mockServiceWorker,
    onLine: true,
    standalone: undefined,
  };

  const config = opts.config || TEST_PWA_CONFIG;

  const pwa = new VmPwa(
    opts.windowRef || mockWindow,
    opts.navigatorRef || mockNavigator,
    config,
  );

  return { pwa, mockWindow, mockNavigator, mockServiceWorker, config };
}

describe("VmPwa", () => {
  describe("constructor", () => {
    it("initializes with default state values", () => {
      const { pwa } = createPwa();

      expect(pwa.showInstallButton).toBe(false);
      expect(pwa.showUpdateBanner).toBe(false);
      expect(pwa.showOfflineIndicator).toBe(false);
      expect(pwa.updateAvailable).toBe(false);
    });

    it("stores injected dependencies", () => {
      const { pwa, mockWindow, mockNavigator, config } = createPwa();

      expect(pwa._window).toBe(mockWindow);
      expect(pwa._navigator).toBe(mockNavigator);
      expect(pwa._config).toBe(config);
    });
  });

  describe("init", () => {
    it("calls service worker registration method", async () => {
      const { pwa } = createPwa();
      const registerSpy = vi
        .spyOn(pwa, "_registerServiceWorker")
        .mockResolvedValue();
      const installSpy = vi
        .spyOn(pwa, "_setupInstallPrompt")
        .mockImplementation(() => {});
      const networkSpy = vi
        .spyOn(pwa, "_setupNetworkStatus")
        .mockImplementation(() => {});

      pwa.init();

      expect(registerSpy).toHaveBeenCalled();
      expect(installSpy).toHaveBeenCalled();
      expect(networkSpy).toHaveBeenCalled();
    });
  });

  describe("_setupInstallPrompt", () => {
    it("listens for beforeinstallprompt event", () => {
      const { pwa, mockWindow } = createPwa();

      pwa._setupInstallPrompt();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "beforeinstallprompt",
        expect.any(Function),
      );
    });

    it("listens for appinstalled event", () => {
      const { pwa, mockWindow } = createPwa();

      pwa._setupInstallPrompt();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "appinstalled",
        expect.any(Function),
      );
    });

    it("shows install button on beforeinstallprompt", () => {
      const { pwa, mockWindow } = createPwa();
      let beforeInstallHandler;
      mockWindow.addEventListener = vi.fn((event, handler) => {
        if (event === "beforeinstallprompt") {
          beforeInstallHandler = handler;
        }
      });

      pwa._setupInstallPrompt();

      const mockEvent = { preventDefault: vi.fn() };
      beforeInstallHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(pwa._installPromptEvent).toBe(mockEvent);
      expect(pwa.showInstallButton).toBe(true);
    });
  });

  describe("_setupNetworkStatus", () => {
    it("listens for online and offline events", () => {
      const { pwa, mockWindow } = createPwa();

      pwa._setupNetworkStatus();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "online",
        expect.any(Function),
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "offline",
        expect.any(Function),
      );
    });

    it("shows offline indicator when navigator.onLine is false", () => {
      const { pwa, mockWindow, mockNavigator } = createPwa();
      mockNavigator.onLine = false;

      pwa._setupNetworkStatus();

      expect(pwa.showOfflineIndicator).toBe(true);
    });

    it("hides offline indicator when navigator.onLine is true", () => {
      const { pwa, mockNavigator } = createPwa();
      mockNavigator.onLine = true;

      pwa._setupNetworkStatus();

      expect(pwa.showOfflineIndicator).toBe(false);
    });
  });

  describe("promptInstall", () => {
    it("returns early when installPromptEvent is null", async () => {
      const { pwa } = createPwa();
      pwa._installPromptEvent = null;
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await pwa.promptInstall();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[PWA] Install prompt not available",
      );
      consoleSpy.mockRestore();
    });

    it("calls prompt() and clears event after user responds", async () => {
      const { pwa } = createPwa();
      const mockEvent = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: "accepted" }),
      };
      pwa._installPromptEvent = mockEvent;

      await pwa.promptInstall();

      expect(mockEvent.prompt).toHaveBeenCalled();
      expect(pwa._installPromptEvent).toBeNull();
      expect(pwa.showInstallButton).toBe(false);
    });
  });

  describe("applyUpdate", () => {
    it("posts SKIP_WAITING message to waiting service worker", () => {
      const { pwa } = createPwa();
      const mockWaiting = { postMessage: vi.fn() };
      pwa._swRegistration = { waiting: mockWaiting };

      pwa.applyUpdate();

      expect(mockWaiting.postMessage).toHaveBeenCalledWith({
        type: "SKIP_WAITING",
      });
    });

    it("reloads the window", () => {
      const { pwa, mockWindow } = createPwa();
      pwa._swRegistration = { waiting: { postMessage: vi.fn() } };

      pwa.applyUpdate();

      expect(mockWindow.location.reload).toHaveBeenCalled();
    });
  });

  describe("dismissUpdate", () => {
    it("hides the update banner", () => {
      const { pwa } = createPwa();
      pwa.showUpdateBanner = true;

      pwa.dismissUpdate();

      expect(pwa.showUpdateBanner).toBe(false);
    });
  });

  describe("isStandalone", () => {
    it("returns false in normal browser context", () => {
      const { pwa, mockWindow } = createPwa();
      mockWindow.matchMedia = vi.fn().mockReturnValue({ matches: false });

      expect(pwa.isStandalone()).toBe(false);
    });

    it("returns true when display-mode is standalone", () => {
      const { pwa, mockWindow } = createPwa();
      mockWindow.matchMedia = vi.fn().mockReturnValue({ matches: true });

      expect(pwa.isStandalone()).toBe(true);
    });

    it("returns true when navigator.standalone is true (iOS Safari)", () => {
      const { pwa, mockWindow, mockNavigator } = createPwa();
      mockWindow.matchMedia = vi.fn().mockReturnValue({ matches: false });
      mockNavigator.standalone = true;

      expect(pwa.isStandalone()).toBe(true);
    });
  });

  describe("clearCaches", () => {
    it("posts CLEAR_CACHE message to active service worker", async () => {
      const { pwa } = createPwa();
      const mockActive = { postMessage: vi.fn() };
      pwa._swRegistration = { active: mockActive };

      // Mock global caches API
      global.caches = {
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
      };

      await pwa.clearCaches();

      expect(mockActive.postMessage).toHaveBeenCalledWith({
        type: "CLEAR_CACHE",
      });
    });
  });
});
