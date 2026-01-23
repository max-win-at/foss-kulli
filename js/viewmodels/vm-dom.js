/**
 * VmDom - DOM ViewModel & Service
 * Abstracts window/document interactions and provides reactive viewport state
 */
class VmDom {
  constructor() {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
  }

  /**
   * Alpine init
   */
  init() {
    // Initial sync could go here if needed
  }

  /**
   * Handle resize events
   */
  onResize() {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
  }

  /**
   * Move cursor to the end of a contenteditable element
   * @param {HTMLElement} element
   */
  moveCursorToEnd(element) {
    if (!element) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// Make available globally for non-module scripts (if needed)
window.VmDom = VmDom;
