import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('VmDom', () => {
  // Helper to create VmDom with injected dependencies
  const createVmDom = (windowMock = window, documentMock = document) => {
    return new VmDom(windowMock, documentMock);
  };

  describe('constructor', () => {
    it('initializes viewportWidth from injected window.innerWidth', () => {
      const mockWindow = { innerWidth: 1024, innerHeight: 768, getSelection: () => ({ removeAllRanges: vi.fn(), addRange: vi.fn() }) };
      const vmDom = createVmDom(mockWindow, document);
      expect(vmDom.viewportWidth).toBe(1024);
    });

    it('initializes viewportHeight from injected window.innerHeight', () => {
      const mockWindow = { innerWidth: 1024, innerHeight: 768, getSelection: () => ({ removeAllRanges: vi.fn(), addRange: vi.fn() }) };
      const vmDom = createVmDom(mockWindow, document);
      expect(vmDom.viewportHeight).toBe(768);
    });
  });

  describe('onResize', () => {
    it('updates viewportWidth and viewportHeight from injected window', () => {
      const mockWindow = { innerWidth: 800, innerHeight: 600, getSelection: () => ({ removeAllRanges: vi.fn(), addRange: vi.fn() }) };
      const vmDom = createVmDom(mockWindow, document);

      // Simulate a resize by changing the mock window dimensions
      mockWindow.innerWidth = 1200;
      mockWindow.innerHeight = 900;

      vmDom.onResize();

      expect(vmDom.viewportWidth).toBe(1200);
      expect(vmDom.viewportHeight).toBe(900);
    });
  });

  describe('moveCursorToEnd', () => {
    it('no-ops when element is null', () => {
      const vmDom = createVmDom(window, document);

      // Should not throw
      expect(() => vmDom.moveCursorToEnd(null)).not.toThrow();
    });

    it('no-ops when element is undefined', () => {
      const vmDom = createVmDom(window, document);

      expect(() => vmDom.moveCursorToEnd(undefined)).not.toThrow();
    });

    it('sets selection to end of contenteditable element', () => {
      const vmDom = createVmDom(window, document);
      const el = document.createElement('div');
      el.setAttribute('contenteditable', 'true');
      el.textContent = 'Hello World';
      document.body.appendChild(el);

      vmDom.moveCursorToEnd(el);

      // Verify that a selection was created
      const sel = window.getSelection();
      expect(sel.rangeCount).toBeGreaterThan(0);

      document.body.removeChild(el);
    });
  });

  describe('init', () => {
    it('exists and can be called without error', () => {
      const vmDom = createVmDom(window, document);
      expect(() => vmDom.init()).not.toThrow();
    });
  });
});
