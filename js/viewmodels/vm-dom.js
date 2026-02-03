/**
 * VmDom - DOM ViewModel & Service
 * Abstracts window/document interactions and provides reactive viewport state
 * Provides semantic DOM methods to eliminate magic string selectors from clients
 */
class VmDom {
  /**
   * @param {Window} windowRef - Window object for viewport dimensions
   * @param {Document} documentRef - Document object for DOM operations
   * @param {Object} selectors - CSS selector configuration
   * @param {string} selectors.noteEditor - Selector for the note editor element
   * @param {string} selectors.stickyNote - Selector for sticky note elements
   * @param {string} selectors.fab - Selector for FAB buttons
   * @param {string} selectors.popup - Selector for popup elements
   * @param {string} selectors.emptyStateContainer - Selector for empty state container
   * @param {string} selectors.selectedNoteMenu - Selector for selected note menu
   * @param {string} selectors.editingClass - Class name for editing state
   */
  constructor(windowRef, documentRef, selectors) {
    this._window = windowRef;
    this._document = documentRef;
    this._selectors = selectors;
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Semantic DOM Methods - Editor Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the note editor element
   * @returns {HTMLElement|null}
   */
  getNoteEditor() {
    return this._document.querySelector(this._selectors.noteEditor);
  }

  /**
   * Focus the note editor and set its content, moving cursor to end
   * @param {string} text - Text content to set
   * @returns {boolean} - True if editor was found and focused
   */
  focusEditorWithContent(text) {
    const editEl = this.getNoteEditor();
    if (!editEl) return false;

    editEl.textContent = text;
    editEl.focus();
    this.moveCursorToEnd(editEl);
    return true;
  }

  /**
   * Get the current text content from the note editor
   * @returns {string|null} - Text content or null if editor not found
   */
  getEditorContent() {
    const editEl = this.getNoteEditor();
    return editEl ? editEl.textContent : null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Semantic DOM Methods - Element Ancestry & Classification
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Find the closest sticky note ancestor of an element
   * @param {HTMLElement} element - Starting element
   * @returns {HTMLElement|null}
   */
  findClosestStickyNote(element) {
    return element?.closest(this._selectors.stickyNote) ?? null;
  }

  /**
   * Find the closest FAB button ancestor of an element
   * @param {HTMLElement} element - Starting element
   * @returns {HTMLElement|null}
   */
  findClosestFab(element) {
    return element?.closest(this._selectors.fab) ?? null;
  }

  /**
   * Find the closest popup ancestor of an element
   * @param {HTMLElement} element - Starting element
   * @returns {HTMLElement|null}
   */
  findClosestPopup(element) {
    return element?.closest(this._selectors.popup) ?? null;
  }

  /**
   * Find the closest empty state container ancestor of an element
   * @param {HTMLElement} element - Starting element
   * @returns {HTMLElement|null}
   */
  findClosestEmptyStateContainer(element) {
    return element?.closest(this._selectors.emptyStateContainer) ?? null;
  }

  /**
   * Find the closest selected note menu ancestor of an element
   * @param {HTMLElement} element - Starting element
   * @returns {HTMLElement|null}
   */
  findClosestSelectedNoteMenu(element) {
    return element?.closest(this._selectors.selectedNoteMenu) ?? null;
  }

  /**
   * Check if an element is in editing state
   * @param {HTMLElement} element - Element to check
   * @returns {boolean}
   */
  isElementEditing(element) {
    return element?.classList?.contains(this._selectors.editingClass) ?? false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Semantic DOM Methods - Click Target Analysis
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Analyze a click event target to determine what was clicked
   * @param {HTMLElement} target - The event target element
   * @returns {Object} - Analysis result with boolean flags
   */
  analyzeClickTarget(target) {
    const stickyNote = this.findClosestStickyNote(target);
    return {
      isOnStickyNote: !!stickyNote,
      isOnEditingStickyNote: stickyNote
        ? this.isElementEditing(stickyNote)
        : false,
      isOnFab: !!this.findClosestFab(target),
      isOnPopup: !!this.findClosestPopup(target),
      isOnEmptyStateContainer: !!this.findClosestEmptyStateContainer(target),
      isOnSelectedNoteMenu: !!this.findClosestSelectedNoteMenu(target),
      stickyNoteElement: stickyNote,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Low-level DOM Methods
  // ─────────────────────────────────────────────────────────────────────────────

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
