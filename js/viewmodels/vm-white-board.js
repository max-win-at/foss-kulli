/**
 * VmWhiteBoard - Main Whiteboard ViewModel
 * Handles note creation, search, and about functionality
 */
class VmWhiteBoard {
  static NOTE_WIDTH = 180;
  static NOTE_HEIGHT = 180;
  static NOTE_GAP = 20;
  static INITIAL_X = 240; // 24px (left) + 180px (width) + 36px (gap)
  static INITIAL_Y = 24; // Align with top of stack

  /**
   * @param {Function} noteFactory - Factory function to create notes: (text, x, y, id) => VmStickyNote
  /**
   * @param {Function} noteFactory - Factory function to create notes: (text, x, y, id) => VmStickyNote
   * @param {SrvLocalStorage} srvLocalStorage - Persistence service
   * @param {VmDom} vmDom - DOM ViewModel & Service
   */
  constructor(noteFactory, srvLocalStorage, vmDom) {
    this._noteFactory = noteFactory;
    this._srvLocalStorage = srvLocalStorage;
    this._vmDom = vmDom;

    // Initialize reactive state
    this.hintVisible = true;
    this.viewportWidth = 800; // Default

    // Icon Animation State
    this.deleteIcon = "delete";
    this.dragIcon = "pan_tool";
    this.iconOpacity = 1;
    this.iconInterval = null;

    // Note: Do NOT bind methods here manually. Alpine proxies the instance.

    this.notes = [];
    this.isSearchOpen = false;
    this.isAboutOpen = false;
    this.searchQuery = "";
    this._originalPositions = null; // Store original positions during search

    // Currently editing note (spawned immediately on typing)
    this.editingNote = null;
    this.isDeleting = false;
  }

  /**
   * Check if a note matches the current search query
   * @param {VmStickyNote} note
   * @returns {boolean}
   */
  matchesSearch(note) {
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

    // Save original positions if not already saved
    if (!this._originalPositions) {
      this._originalPositions = new Map();
      for (const note of this.notes) {
        this._originalPositions.set(note.id, { x: note.x, y: note.y });
      }
    }

    // Get matching notes and sort by date (newest first)
    const matchingNotes = this.notes
      .filter((note) => this.matchesSearch(note))
      .sort((a, b) => b.createdAt - a.createdAt);

    // Reposition matching notes from the beginning
    const currentViewportWidth = this.viewportWidth;
    let currentX = VmWhiteBoard.INITIAL_X;
    let currentY = VmWhiteBoard.INITIAL_Y;

    for (const note of matchingNotes) {
      // Check if note would overflow current row
      if (
        currentX + VmWhiteBoard.NOTE_WIDTH >
        currentViewportWidth - VmWhiteBoard.NOTE_GAP
      ) {
        // Move to next row
        currentY += VmWhiteBoard.NOTE_HEIGHT + VmWhiteBoard.NOTE_GAP;

        // Smart Wrap logic
        const stackBottom = 24 + 180;
        if (currentY > stackBottom) {
          currentX = VmWhiteBoard.NOTE_GAP;
        } else {
          currentX = VmWhiteBoard.INITIAL_X;
        }
      }

      note.x = currentX;
      note.y = currentY;

      currentX += VmWhiteBoard.NOTE_WIDTH + VmWhiteBoard.NOTE_GAP;
    }
  }

  /**
   * Restore original note positions after search is cleared
   */
  restorePositions() {
    if (!this._originalPositions) return;

    for (const note of this.notes) {
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
          new VmStickyNote(data.id, data.text, data.x, data.y, data.createdAt),
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
    this.editingNote = this._noteFactory(initialChar, position.x, position.y);

    // Focus the editing note after Alpine renders it
    this.$nextTick(() => {
      const editEl = this.$refs.noteEditor;
      if (editEl) {
        // Set initial text content directly
        editEl.textContent = initialChar;
        editEl.focus();
        // Move cursor to end using service
        this._vmDom.moveCursorToEnd(editEl);
      }
    });
  }

  /**
   * Start editing an existing note
   * @param {VmStickyNote} note
   */
  editNote(note) {
    // If already editing, confirm previous
    if (this.editingNote) {
      this.confirmEditing();
    }

    // Remove from list (will be re-added on confirm)
    this.notes = this.notes.filter((n) => n.id !== note.id);
    this.save();

    // set as editing
    this.editingNote = note;

    this.startIconAnimation(); // Start toggling icons

    this.$nextTick(() => {
      const editEl = this.$refs.noteEditor;
      if (editEl) {
        editEl.textContent = note.text;
        editEl.focus();
        // Move cursor to end using service
        this._vmDom.moveCursorToEnd(editEl);
      }
    });
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
   * Confirm the editing note and add to notes array
   */
  confirmEditing() {
    if (this.editingNote && this.editingNote.text.trim().length > 0) {
      this.notes.push(this.editingNote);
      this.save(); // Persist
    }
    this.editingNote = null;
    this.stopIconAnimation(); // Stop anims
  }

  /**
   * Cancel editing and discard the note
   */
  cancelEditing() {
    if (this.editingNote && this.editingNote.text.trim().length > 0) {
      this.notes.push(this.editingNote);
    }
    this.editingNote = null;
    this.stopIconAnimation(); // Stop anims
  }

  /**
   * Delete the currently editing note
   */
  deleteEditingNote() {
    this.isDeleting = true;
    this.stopIconAnimation(); // Stop anims

    // Wait for animation to finish
    setTimeout(() => {
      // Move to trash before removing
      this._srvLocalStorage.moveToTrash(this.editingNote);

      this.editingNote = null;
      this.isDeleting = false;
      this.save();
    }, 300);
  }

  startIconAnimation() {
    this.stopIconAnimation(); // clear existing

    // Start Interval loop (Fade Out -> Swap -> Fade In)
    this.iconInterval = setInterval(() => {
      // 1. Fade Out
      this.iconOpacity = 0;

      // 2. Wait for fade out (200ms), then Swap & Fade In
      setTimeout(() => {
        this.deleteIcon =
          this.deleteIcon === "delete" ? "delete_forever" : "delete";
        this.dragIcon = this.dragIcon === "pan_tool" ? "touch_app" : "pan_tool";

        // 3. Fade In
        this.iconOpacity = 1;
      }, 200); // Match CSS transition time
    }, 1200); // 1.2s total cycle to allow for the 200ms pause

    // Stop after 5 seconds roughly (4 cycles)
    this.iconTimeout = setTimeout(() => {
      this.stopIconAnimation();
    }, 6000);
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
    // Include editing note in position calculation
    const allNotes = this.editingNote
      ? [...this.notes, this.editingNote]
      : this.notes;

    if (allNotes.length === 0) {
      return { x: VmWhiteBoard.INITIAL_X, y: VmWhiteBoard.INITIAL_Y };
    }

    const currentViewportWidth = this.viewportWidth;

    // Use the last note in the list as the reference
    const lastNote = allNotes[allNotes.length - 1];

    // Calculate position to the right of the last note
    const newX = lastNote.x + VmWhiteBoard.NOTE_WIDTH + VmWhiteBoard.NOTE_GAP;
    const newY = lastNote.y;

    // Check if it would overflow
    if (
      newX + VmWhiteBoard.NOTE_WIDTH <=
      currentViewportWidth - VmWhiteBoard.NOTE_GAP
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

    const nextRowY = lowestY + VmWhiteBoard.NOTE_HEIGHT + VmWhiteBoard.NOTE_GAP;

    // Smart Wrap: If we are below the note stack (Top 24 + Height 180 = 204),
    // we can start from the left edge (NOTE_GAP) instead of indenting.
    const stackBottom = 24 + 180;
    const startX =
      nextRowY > stackBottom ? VmWhiteBoard.NOTE_GAP : VmWhiteBoard.INITIAL_X;

    return {
      x: startX,
      y: nextRowY,
    };
  }

  /**
   * Rearrange all notes to fit the current viewport width
   * Called on window resize
   */
  rearrangeNotes() {
    // Include editingNote in layout so it flows with the rest
    const allNotes = this.editingNote
      ? [...this.notes, this.editingNote]
      : this.notes;

    if (allNotes.length === 0) return;

    const currentViewportWidth = this.viewportWidth;
    let currentX = VmWhiteBoard.INITIAL_X;
    let currentY = VmWhiteBoard.INITIAL_Y;

    for (const note of allNotes) {
      // Check if note would overflow current row
      if (
        currentX + VmWhiteBoard.NOTE_WIDTH >
        currentViewportWidth - VmWhiteBoard.NOTE_GAP
      ) {
        // Move to next row
        currentY += VmWhiteBoard.NOTE_HEIGHT + VmWhiteBoard.NOTE_GAP;

        // Smart Wrap logic for rearrange
        const stackBottom = 24 + 180;
        if (currentY > stackBottom) {
          currentX = VmWhiteBoard.NOTE_GAP;
        } else {
          currentX = VmWhiteBoard.INITIAL_X;
        }
      }

      note.x = currentX;
      note.y = currentY;

      currentX += VmWhiteBoard.NOTE_WIDTH + VmWhiteBoard.NOTE_GAP;
    }
    this.save(); // Persist positions after rearrange
  }
}
