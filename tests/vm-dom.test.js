import { describe, it, expect, vi, beforeEach } from "vitest";

// Default selectors config for tests
const TEST_SELECTORS = {
  noteEditor: ".note-editor",
  stickyNote: ".sticky-note",
  fab: ".fab",
  popup: ".popup",
  emptyStateContainer: ".empty-state-container",
  selectedNoteMenu: ".selected-note-menu",
  editingClass: "editing",
};

describe("VmDom", () => {
  // Helper to create VmDom with injected dependencies
  const createVmDom = (
    windowMock = window,
    documentMock = document,
    selectors = TEST_SELECTORS,
  ) => {
    return new VmDom(windowMock, documentMock, selectors);
  };

  describe("constructor", () => {
    it("initializes viewportWidth from injected window.innerWidth", () => {
      const mockWindow = {
        innerWidth: 1024,
        innerHeight: 768,
        getSelection: () => ({ removeAllRanges: vi.fn(), addRange: vi.fn() }),
      };
      const vmDom = createVmDom(mockWindow, document);
      expect(vmDom.viewportWidth).toBe(1024);
    });

    it("initializes viewportHeight from injected window.innerHeight", () => {
      const mockWindow = {
        innerWidth: 1024,
        innerHeight: 768,
        getSelection: () => ({ removeAllRanges: vi.fn(), addRange: vi.fn() }),
      };
      const vmDom = createVmDom(mockWindow, document);
      expect(vmDom.viewportHeight).toBe(768);
    });

    it("stores injected selectors config", () => {
      const vmDom = createVmDom(window, document, TEST_SELECTORS);
      expect(vmDom._selectors).toBe(TEST_SELECTORS);
    });
  });

  describe("onResize", () => {
    it("updates viewportWidth and viewportHeight from injected window", () => {
      const mockWindow = {
        innerWidth: 800,
        innerHeight: 600,
        getSelection: () => ({ removeAllRanges: vi.fn(), addRange: vi.fn() }),
      };
      const vmDom = createVmDom(mockWindow, document);

      // Simulate a resize by changing the mock window dimensions
      mockWindow.innerWidth = 1200;
      mockWindow.innerHeight = 900;

      vmDom.onResize();

      expect(vmDom.viewportWidth).toBe(1200);
      expect(vmDom.viewportHeight).toBe(900);
    });
  });

  describe("getNoteEditor", () => {
    it("returns editor element when found", () => {
      const el = document.createElement("div");
      el.className = "note-editor";
      document.body.appendChild(el);

      const vmDom = createVmDom(window, document);
      expect(vmDom.getNoteEditor()).toBe(el);

      document.body.removeChild(el);
    });

    it("returns null when editor not found", () => {
      const vmDom = createVmDom(window, document);
      expect(vmDom.getNoteEditor()).toBeNull();
    });
  });

  describe("focusEditorWithContent", () => {
    it("returns false when editor not found", () => {
      const vmDom = createVmDom(window, document);
      expect(vmDom.focusEditorWithContent("test")).toBe(false);
    });

    it("sets content and focuses editor when found", () => {
      const el = document.createElement("div");
      el.className = "note-editor";
      el.setAttribute("contenteditable", "true");
      document.body.appendChild(el);

      const vmDom = createVmDom(window, document);
      const result = vmDom.focusEditorWithContent("Hello World");

      expect(result).toBe(true);
      expect(el.textContent).toBe("Hello World");

      document.body.removeChild(el);
    });
  });

  describe("getEditorContent", () => {
    it("returns null when editor not found", () => {
      const vmDom = createVmDom(window, document);
      expect(vmDom.getEditorContent()).toBeNull();
    });

    it("returns text content when editor found", () => {
      const el = document.createElement("div");
      el.className = "note-editor";
      el.textContent = "Test Content";
      document.body.appendChild(el);

      const vmDom = createVmDom(window, document);
      expect(vmDom.getEditorContent()).toBe("Test Content");

      document.body.removeChild(el);
    });
  });

  describe("findClosest* methods", () => {
    it("findClosestStickyNote returns element with sticky-note class", () => {
      const parent = document.createElement("div");
      parent.className = "sticky-note";
      const child = document.createElement("span");
      parent.appendChild(child);
      document.body.appendChild(parent);

      const vmDom = createVmDom(window, document);
      expect(vmDom.findClosestStickyNote(child)).toBe(parent);

      document.body.removeChild(parent);
    });

    it("findClosestStickyNote returns null when not found", () => {
      const el = document.createElement("div");
      document.body.appendChild(el);

      const vmDom = createVmDom(window, document);
      expect(vmDom.findClosestStickyNote(el)).toBeNull();

      document.body.removeChild(el);
    });

    it("findClosestFab returns element with fab class", () => {
      const parent = document.createElement("button");
      parent.className = "fab";
      const child = document.createElement("span");
      parent.appendChild(child);
      document.body.appendChild(parent);

      const vmDom = createVmDom(window, document);
      expect(vmDom.findClosestFab(child)).toBe(parent);

      document.body.removeChild(parent);
    });
  });

  describe("isElementEditing", () => {
    it("returns true when element has editing class", () => {
      const el = document.createElement("div");
      el.classList.add("editing");

      const vmDom = createVmDom(window, document);
      expect(vmDom.isElementEditing(el)).toBe(true);
    });

    it("returns false when element lacks editing class", () => {
      const el = document.createElement("div");

      const vmDom = createVmDom(window, document);
      expect(vmDom.isElementEditing(el)).toBe(false);
    });

    it("returns false for null element", () => {
      const vmDom = createVmDom(window, document);
      expect(vmDom.isElementEditing(null)).toBe(false);
    });
  });

  describe("analyzeClickTarget", () => {
    it("detects sticky note click", () => {
      const note = document.createElement("div");
      note.className = "sticky-note";
      const child = document.createElement("span");
      note.appendChild(child);
      document.body.appendChild(note);

      const vmDom = createVmDom(window, document);
      const result = vmDom.analyzeClickTarget(child);

      expect(result.isOnStickyNote).toBe(true);
      expect(result.isOnEditingStickyNote).toBe(false);
      expect(result.stickyNoteElement).toBe(note);

      document.body.removeChild(note);
    });

    it("detects editing sticky note click", () => {
      const note = document.createElement("div");
      note.className = "sticky-note editing";
      document.body.appendChild(note);

      const vmDom = createVmDom(window, document);
      const result = vmDom.analyzeClickTarget(note);

      expect(result.isOnStickyNote).toBe(true);
      expect(result.isOnEditingStickyNote).toBe(true);

      document.body.removeChild(note);
    });

    it("detects fab click", () => {
      const fab = document.createElement("button");
      fab.className = "fab";
      document.body.appendChild(fab);

      const vmDom = createVmDom(window, document);
      const result = vmDom.analyzeClickTarget(fab);

      expect(result.isOnFab).toBe(true);

      document.body.removeChild(fab);
    });

    it("returns all false for plain element", () => {
      const el = document.createElement("div");
      document.body.appendChild(el);

      const vmDom = createVmDom(window, document);
      const result = vmDom.analyzeClickTarget(el);

      expect(result.isOnStickyNote).toBe(false);
      expect(result.isOnFab).toBe(false);
      expect(result.isOnPopup).toBe(false);
      expect(result.isOnEmptyStateContainer).toBe(false);
      expect(result.isOnSelectedNoteMenu).toBe(false);

      document.body.removeChild(el);
    });
  });

  describe("moveCursorToEnd", () => {
    it("no-ops when element is null", () => {
      const vmDom = createVmDom(window, document);

      // Should not throw
      expect(() => vmDom.moveCursorToEnd(null)).not.toThrow();
    });

    it("no-ops when element is undefined", () => {
      const vmDom = createVmDom(window, document);

      expect(() => vmDom.moveCursorToEnd(undefined)).not.toThrow();
    });

    it("sets selection to end of contenteditable element", () => {
      const vmDom = createVmDom(window, document);
      const el = document.createElement("div");
      el.setAttribute("contenteditable", "true");
      el.textContent = "Hello World";
      document.body.appendChild(el);

      vmDom.moveCursorToEnd(el);

      // Verify that a selection was created
      const sel = window.getSelection();
      expect(sel.rangeCount).toBeGreaterThan(0);

      document.body.removeChild(el);
    });
  });

  describe("init", () => {
    it("exists and can be called without error", () => {
      const vmDom = createVmDom(window, document);
      expect(() => vmDom.init()).not.toThrow();
    });
  });
});
