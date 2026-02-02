import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('VmDom', () => {
  describe('constructor', () => {
    it('initializes viewportWidth from window.innerWidth', () => {
      // jsdom sets default window dimensions
      const vmDom = new VmDom();
      expect(vmDom.viewportWidth).toBe(window.innerWidth);
    });

    it('initializes viewportHeight from window.innerHeight', () => {
      const vmDom = new VmDom();
      expect(vmDom.viewportHeight).toBe(window.innerHeight);
    });
  });

  describe('onResize', () => {
    it('updates viewportWidth and viewportHeight from window', () => {
      const vmDom = new VmDom();

      // Simulate a resize by changing jsdom's window dimensions
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 900, writable: true });

      vmDom.onResize();

      expect(vmDom.viewportWidth).toBe(1200);
      expect(vmDom.viewportHeight).toBe(900);
    });
  });

  describe('moveCursorToEnd', () => {
    it('no-ops when element is null', () => {
      const vmDom = new VmDom();

      // Should not throw
      expect(() => vmDom.moveCursorToEnd(null)).not.toThrow();
    });

    it('no-ops when element is undefined', () => {
      const vmDom = new VmDom();

      expect(() => vmDom.moveCursorToEnd(undefined)).not.toThrow();
    });

    it('sets selection to end of contenteditable element', () => {
      const vmDom = new VmDom();
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
      const vmDom = new VmDom();
      expect(() => vmDom.init()).not.toThrow();
    });
  });
});
