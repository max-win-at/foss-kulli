/**
 * VmWhiteBoard - Main Whiteboard ViewModel
 * Handles note creation, search, and about functionality
 */
class VmWhiteBoard {
  // Timing constants
  static EDITOR_FOCUS_DELAY_MS = 50;
  static BLUR_IGNORE_THRESHOLD_MS = 200;
  static ICON_FADE_DURATION_MS = 200;
  static ICON_CYCLE_DURATION_MS = 1200;
  static ICON_ANIMATION_TOTAL_MS = 6000;
  static DELETE_ANIMATION_MS = 300;
  static STACK_TOP_OFFSET = 24;
  static STACK_HEIGHT = 180;

  /**
   * @param {Function} noteFactory - Factory function to create notes: (text, x, y, id) => MdlStickyNote
   * @param {SrvLocalStorage} srvLocalStorage - Persistence service
   * @param {VmDom} vmDom - DOM ViewModel & Service
   * @param {Object} config - Layout configuration
   * @param {number} config.noteWidth - Width of a sticky note
   * @param {number} config.noteHeight - Height of a sticky note
   * @param {number} config.noteGap - Gap between notes
   * @param {number} config.initialX - Initial X position for notes
   * @param {number} config.initialY - Initial Y position for notes
   */
  constructor(noteFactory, srvLocalStorage, vmDom, config) {
    this._noteFactory = noteFactory;
    this._srvLocalStorage = srvLocalStorage;
    this._vmDom = vmDom;
    this._config = config;

    // Initialize reactive state (direct properties for Alpine reactivity)
    this.hintVisible = true;
    this.viewportWidth = 800; // Default

    // Icon Animation State
    this.deleteIcon = "delete";
    this.dragIcon = "pan_tool";
    this.iconOpacity = 1;
    this.iconInterval = null;
    this.iconTimeout = null;

    // Note: Do NOT bind methods here manually. Alpine proxies the instance.

    this.notes = [];
    this.isSearchOpen = false;
    this.isAboutOpen = false;
    this.searchQuery = "";
    this._originalPositions = null; // Store original positions during search

    // Currently editing note (spawned immediately on typing)
    this.editingNote = null;
    this.isDeleting = false;

    // Timestamp when editing started - used to ignore blur events that fire too soon
    this._editStartTime = 0;
  }

  /**
   * Get computed stack bottom position for smart wrap calculations
   * @returns {number}
   */
  get _stackBottom() {
    return VmWhiteBoard.STACK_TOP_OFFSET + VmWhiteBoard.STACK_HEIGHT;
  }

  /**
   * Calculate start X position for a row based on Y coordinate
   * Used for smart wrap logic - rows below the note stack can start from left edge
   * @param {number} rowY - Y coordinate of the row
   * @returns {number} - Starting X position
   */
  _getStartXForRow(rowY) {
    return rowY > this._stackBottom
      ? this._config.noteGap
      : this._config.initialX;
  }

  /**
   * Focus the note editor and set its content from current editingNote
   * Extracted to avoid duplicate logic in startEditing and editNote
   * IMPORTANT: Reads this.editingNote.text at execution time (not call time)
   * to avoid stale closure references when quickly switching notes
   */
  _focusEditor() {
    this._editStartTime = Date.now();

    setTimeout(() => {
      if (!this.editingNote) return;
      // Read text from current editingNote, not from a closure parameter
      this._vmDom.focusEditorWithContent(this.editingNote.text);
    }, VmWhiteBoard.EDITOR_FOCUS_DELAY_MS);
  }

  /**
   * Get visible (non-deleted) notes
   * @returns {Array<MdlStickyNote>}
   */
  get visibleNotes() {
    return this.notes.filter((n) => !n.deleted);
  }

  /**
   * Check if a note matches the current search query
   * @param {MdlStickyNote} note
   * @returns {boolean}
   */
  matchesSearch(note) {
    // Soft-deleted notes never match
    if (note.deleted) return false;

    if (!this.searchQuery || this.searchQuery.trim() === "") {
      return true;
    }
    if (!note || !note.text) {
      return false;
    }
    const query = this.searchQuery.toLowerCase();
    return note.text.toLowerCase().includes(query);
  }

  /**
   * Apply search filter and reposition matching notes
   * Called when searchQuery changes
   */
  applySearchFilter() {
    if (!this.searchQuery || this.searchQuery.trim() === "") {
      // Restore original positions when clearing search
      this.restorePositions();
      return;
    }

    // Save original positions if not already saved (only for visible notes)
    if (!this._originalPositions) {
      this._originalPositions = new Map();
      for (const note of this.visibleNotes) {
        this._originalPositions.set(note.id, { x: note.x, y: note.y });
      }
    }

    // Get matching notes and sort by date (newest first)
    const matchingNotes = this.visibleNotes
      .filter((note) => this.matchesSearch(note))
      .sort((a, b) => b.createdAt - a.createdAt);

    // Reposition matching notes from the beginning
    const currentViewportWidth = this.viewportWidth;
    let currentX = this._config.initialX;
    let currentY = this._config.initialY;

    for (const note of matchingNotes) {
      // Check if note would overflow current row
      if (
        currentX + this._config.noteWidth >
        currentViewportWidth - this._config.noteGap
      ) {
        // Move to next row
        currentY += this._config.noteHeight + this._config.noteGap;
        currentX = this._getStartXForRow(currentY);
      }

      note.x = currentX;
      note.y = currentY;

      currentX += this._config.noteWidth + this._config.noteGap;
    }
  }

  /**
   * Restore original note positions after search is cleared
   */
  restorePositions() {
    if (!this._originalPositions) return;

    for (const note of this.visibleNotes) {
      const original = this._originalPositions.get(note.id);
      if (original) {
        note.x = original.x;
        note.y = original.y;
      }
    }

    this._originalPositions = null;
  }

  /**
   * Clear the search query
   */
  clearSearch() {
    this.searchQuery = "";
    this.restorePositions();
  }

  /**
   * Alpine.js init method - called automatically
   */
  init() {
    // 1. Subscribe to VmDom property changes
    // Since vmDom is reactive, we can use Alpine.effect to track changes
    Alpine.effect(() => {
      // Accessing the property creates a dependency
      const width = this._vmDom.viewportWidth;
      // Update local state and react
      this.updateViewport(width);
    });

    // 2. Watch for search query changes
    Alpine.effect(() => {
      // Accessing searchQuery creates a dependency
      const query = this.searchQuery;
      this.applySearchFilter();
    });

    // 3. Clean up old trash
    this._srvLocalStorage.cleanupTrash(30);

    // 4. Load persisted notes
    const loadedData = this._srvLocalStorage.loadNotes();
    if (loadedData && loadedData.length > 0) {
      this.notes = loadedData.map(
        (data) =>
          new MdlStickyNote(
            data.id,
            data.text,
            data.x,
            data.y,
            data.createdAt,
            data.deleted || false,
          ),
      );
    }
  }

  /**
   * Update viewport width
   * @param {number} width
   */
  updateViewport(width) {
    this.viewportWidth = width;
    this.rearrangeNotes();
  }

  /**
   * Persist current notes
   */
  save() {
    this._srvLocalStorage.saveNotes(this.notes);
  }

  /**
   * Handle keydown events on the white board
   * @param {KeyboardEvent} event
   */
  onKeyDown(event) {
    // Ignore if popup is open or if it's a modifier key combo
    if (this.isSearchOpen || this.isAboutOpen) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // Ignore special keys
    const ignoredKeys = [
      "Escape",
      "Tab",
      "Shift",
      "Control",
      "Alt",
      "Meta",
      "CapsLock",
    ];
    if (ignoredKeys.includes(event.key)) return;

    // If already editing, let the contenteditable handle input
    if (this.editingNote) return;

    // Handle Escape - cancel editing without saving
    if (event.key === "Escape") {
      this.cancelEditing();
      return;
    }

    // Start editing on first printable character
    if (event.key.length === 1) {
      this.startEditing(event.key);
      event.preventDefault();
    }
  }

  /**
   * Start editing a new note immediately
   * @param {string} initialChar - First character typed
   */
  startEditing(initialChar) {
    const position = this.getNextNotePosition();
    const newNote = this._noteFactory(initialChar, position.x, position.y);

    // Add to array immediately so array order stays stable
    this.notes.push(newNote);
    this.editingNote = newNote;

    // Focus editor - reads text from this.editingNote at execution time
    this._focusEditor();
  }

  /**
   * Start editing an existing note by ID
   * Uses ID lookup to avoid stale object references from Alpine's x-for
   * @param {string} noteId - ID of the note to edit
   */
  editNoteById(noteId) {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note) {
      return;
    }
    this.editNote(note);
  }

  /**
   * Start editing an existing note
   * @param {MdlStickyNote} note
   */
  editNote(note) {
    // If already editing the same note, do nothing
    if (this.editingNote && this.editingNote.id === note.id) {
      return;
    }

    // If editing a different note, save it first before switching
    if (this.editingNote) {
      // Save the current note's text before switching
      this.save();
      this.stopIconAnimation();
    }

    // Set as editing - note stays in the array, we just reference it
    this.editingNote = note;

    this.startIconAnimation(); // Start toggling icons

    // Focus editor - reads text from this.editingNote at execution time
    this._focusEditor();
  }

  /**
   * Helper to get safe styling for the menu
   */
  getMenuPosition() {
    if (!this.editingNote) return "display: none;";
    const x = parseInt(this.editingNote.x) || 0;
    const y = parseInt(this.editingNote.y) || 0;
    return `left: ${x}px; top: ${y + 190}px;`;
  }

  /**
   * Handle blur event from the editor
   * Confirms editing unless blur happened too soon after starting to edit
   */
  onEditorBlur() {
    const timeSinceEditStart = Date.now() - this._editStartTime;

    // Ignore blur events that fire within threshold of starting to edit
    // These are caused by the programmatic focus, not user action
    if (timeSinceEditStart < VmWhiteBoard.BLUR_IGNORE_THRESHOLD_MS) {
      return;
    }

    if (this.isDeleting) {
      return;
    }

    this.confirmEditing();
  }

  /**
   * Confirm the editing note - note stays in array, soft-delete if empty
   */
  confirmEditing() {
    if (this.editingNote) {
      // If text is empty, soft-delete the note (set deleted flag instead of array mutation)
      if (this.editingNote.text.trim().length === 0) {
        this.editingNote.deleted = true;
      }
      this.save(); // Persist
    }
    this.editingNote = null;
    this.stopIconAnimation(); // Stop anims
  }

  /**
   * Cancel editing - for new empty notes, soft-delete. For existing notes, keep.
   */
  cancelEditing() {
    // If the note has no text (new note that was cancelled), soft-delete it
    if (this.editingNote && this.editingNote.text.trim().length === 0) {
      this.editingNote.deleted = true;
    }
    this.editingNote = null;
    this.stopIconAnimation(); // Stop anims
  }

  /**
   * Delete the currently editing note (soft-delete)
   */
  deleteEditingNote() {
    this.isDeleting = true;
    this.stopIconAnimation(); // Stop anims

    // Wait for animation to finish
    setTimeout(() => {
      // Move to trash before soft-deleting
      this._srvLocalStorage.moveToTrash(this.editingNote);

      // Soft-delete: set flag instead of removing from array
      this.editingNote.deleted = true;

      this.editingNote = null;
      this.isDeleting = false;
      this.save();
    }, VmWhiteBoard.DELETE_ANIMATION_MS);
  }

  startIconAnimation() {
    this.stopIconAnimation(); // clear existing

    // Start Interval loop (Fade Out -> Swap -> Fade In)
    this.iconInterval = setInterval(() => {
      // 1. Fade Out
      this.iconOpacity = 0;

      // 2. Wait for fade out, then Swap & Fade In
      setTimeout(() => {
        this.deleteIcon =
          this.deleteIcon === "delete" ? "delete_forever" : "delete";
        this.dragIcon = this.dragIcon === "pan_tool" ? "touch_app" : "pan_tool";

        // 3. Fade In
        this.iconOpacity = 1;
      }, VmWhiteBoard.ICON_FADE_DURATION_MS);
    }, VmWhiteBoard.ICON_CYCLE_DURATION_MS);

    // Stop after configured duration
    this.iconTimeout = setTimeout(() => {
      this.stopIconAnimation();
    }, VmWhiteBoard.ICON_ANIMATION_TOTAL_MS);
  }

  stopIconAnimation() {
    if (this.iconInterval) {
      clearInterval(this.iconInterval);
      this.iconInterval = null;
    }
    if (this.iconTimeout) {
      clearTimeout(this.iconTimeout);
      this.iconTimeout = null;
    }
    // Reset defaults
    this.deleteIcon = "delete";
    this.dragIcon = "pan_tool";
    this.iconOpacity = 1;
  }

  // --- Interactive Icon States ---

  onDeleteEnter() {
    this.stopIconAnimation(); // Interaction stops auto-anim
    this.deleteIcon = "delete_forever";
  }

  onDeleteLeave() {
    this.deleteIcon = "delete";
  }

  onDragStart() {
    this.stopIconAnimation(); // Interaction stops auto-anim
    this.dragIcon = "touch_app";
  }

  onDragEnd() {
    this.dragIcon = "pan_tool";
  }

  /**
   * Update editing note text from contenteditable
   * @param {string} text
   */
  updateEditingText(text) {
    if (this.editingNote) {
      this.editingNote.text = text;
      // No save here (wait for commit)
    }
  }

  /**
   * Handle keydown in the editing note
   * @param {KeyboardEvent} event
   */
  onEditingKeyDown(event) {
    // Ctrl+Enter to confirm
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.confirmEditing();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.cancelEditing();
    }
    // Allow keys to bubble for normal typing (including plain Enter for newlines)
  }

  /**
   * Handle paste events
   * @param {ClipboardEvent} event
   */
  onPaste(event) {
    if (this.isSearchOpen || this.isAboutOpen) return;
    if (this.editingNote) return; // Let contenteditable handle paste during editing

    const text = event.clipboardData?.getData("text");
    if (text && text.trim().length > 0) {
      this.createNote(text.trim());
      event.preventDefault();
    }
  }

  /**
   * Handle input from hidden input element (mobile)
   * @param {InputEvent} event
   */
  onInput(event) {
    const input = event.target;
    const text = input.value;

    if (text && text.length > 0) {
      // Start editing if not already
      if (!this.editingNote) {
        this.startEditing(text);
        input.value = "";
      }
    }
  }

  /**
   * Handle blur from hidden input (mobile)
   * @param {FocusEvent} event
   */
  onInputBlur(event) {
    const input = event.target;
    input.value = "";
  }

  /**
   * Toggle search popup visibility
   */
  toggleSearch() {
    this.isSearchOpen = !this.isSearchOpen;
    this.isAboutOpen = false;
  }

  /**
   * Toggle about popup visibility
   */
  toggleAbout() {
    this.isAboutOpen = !this.isAboutOpen;
    this.isSearchOpen = false;
  }

  /**
   * Close all popups
   */
  closePopups() {
    this.isSearchOpen = false;
    this.isAboutOpen = false;
  }

  /**
   * Handle click on the whiteboard background
   * Confirms editing if clicking outside notes
   * @param {MouseEvent} event
   */
  onWhiteBoardClick(event) {
    // Only act if we have an editing note
    if (!this.editingNote) return;

    // Analyze click target using semantic DOM methods
    const clickAnalysis = this._vmDom.analyzeClickTarget(event.target);

    // If clicked on a non-editing sticky note, let editNoteById handle it
    if (clickAnalysis.isOnStickyNote && !clickAnalysis.isOnEditingStickyNote) {
      return;
    }

    // If clicked on the editing note itself, don't deselect
    if (clickAnalysis.isOnEditingStickyNote) {
      return;
    }

    // If clicked on FABs, popups, stack, or menu - don't deselect
    if (
      clickAnalysis.isOnFab ||
      clickAnalysis.isOnPopup ||
      clickAnalysis.isOnEmptyStateContainer ||
      clickAnalysis.isOnSelectedNoteMenu
    ) {
      return;
    }

    // Otherwise, deselect (clicked on whiteboard background, hidden-input, etc.)
    this.confirmEditing();
  }

  /**
   * Create a new empty note and start editing immediately
   * Called when clicking the note stack/plus icon
   */
  createNewNote() {
    // Prevent creating multiple editing notes if double clicked quickly
    if (this.editingNote) return;
    this.startEditing("");
  }

  /**
   * Create a new sticky note at the calculated position (for paste)
   * @param {string} text - Note content
   */
  createNote(text) {
    const position = this.getNextNotePosition();
    const note = this._noteFactory(text, position.x, position.y);
    this.notes.push(note);
    this.save(); // Persist
  }

  /**
   * Calculate the next note position
   * Places right of rightmost note, or below leftmost if would overflow
   * @returns {{x: number, y: number}}
   */
  getNextNotePosition() {
    // Use visibleNotes to exclude soft-deleted notes
    const allNotes = this.visibleNotes;

    if (allNotes.length === 0) {
      return { x: this._config.initialX, y: this._config.initialY };
    }

    const currentViewportWidth = this.viewportWidth;

    // Use the last note in the list as the reference
    const lastNote = allNotes[allNotes.length - 1];

    // Calculate position to the right of the last note
    const newX = lastNote.x + this._config.noteWidth + this._config.noteGap;
    const newY = lastNote.y;

    // Check if it would overflow
    if (
      newX + this._config.noteWidth <=
      currentViewportWidth - this._config.noteGap
    ) {
      return { x: newX, y: newY };
    }

    // Overflow: Start a new row
    let lowestY = allNotes[0].y;
    for (const note of allNotes) {
      if (note.y > lowestY) {
        lowestY = note.y;
      }
    }

    const nextRowY = lowestY + this._config.noteHeight + this._config.noteGap;
    const startX = this._getStartXForRow(nextRowY);

    return {
      x: startX,
      y: nextRowY,
    };
  }

  /**
   * Rearrange all visible notes to fit the current viewport width
   * Called on window resize
   */
  rearrangeNotes() {
    // Filter deleted notes but maintain original array order
    const visibleNotes = this.notes.filter((n) => !n.deleted);

    if (visibleNotes.length === 0) return;

    const currentViewportWidth = this.viewportWidth;
    let currentX = this._config.initialX;
    let currentY = this._config.initialY;

    for (const note of visibleNotes) {
      // Check if note would overflow current row
      if (
        currentX + this._config.noteWidth >
        currentViewportWidth - this._config.noteGap
      ) {
        // Move to next row
        currentY += this._config.noteHeight + this._config.noteGap;
        currentX = this._getStartXForRow(currentY);
      }

      note.x = currentX;
      note.y = currentY;

      currentX += this._config.noteWidth + this._config.noteGap;
    }
    this.save(); // Persist positions after rearrange
  }
}
