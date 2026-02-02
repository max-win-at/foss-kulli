/**
 * VmDom - DOM ViewModel & Service
 * Abstracts window/document interactions and provides reactive viewport state
 */
class VmDom {
  /**
   * @param {Window} windowRef - Window object for viewport dimensions
   * @param {Document} documentRef - Document object for DOM operations
   */
  constructor(windowRef, documentRef) {
    this._window = windowRef;
    this._document = documentRef;
    // Direct properties for Alpine reactivity
    this.viewportWidth = this._window.innerWidth;
    this.viewportHeight = this._window.innerHeight;
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
    this.viewportWidth = this._window.innerWidth;
    this.viewportHeight = this._window.innerHeight;
  }

  /**
   * Move cursor to the end of a contenteditable element
   * @param {HTMLElement} element
   */
  moveCursorToEnd(element) {
    if (!element) return;
    const range = this._document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const sel = this._window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}
