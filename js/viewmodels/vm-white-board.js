/**
 * VmWhiteBoard - Main Whiteboard ViewModel
 * Handles note creation, search, and about functionality
 */
class VmWhiteBoard {
  /**
   * @param {Function} noteFactory - Factory function to create notes: (text, x, y, id) => VmStickyNote
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

        // Smart Wrap logic
        const stackBottom = 24 + 180;
        if (currentY > stackBottom) {
          currentX = this._config.noteGap;
        } else {
          currentX = this._config.initialX;
        }
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
    const newNote = this._noteFactory(initialChar, position.x, position.y);
    
    // Add to array immediately so array order stays stable
    this.notes.push(newNote);
    this.editingNote = newNote;

    // Record when we started editing to ignore blur events that fire too soon
    this._editStartTime = Date.now();

    // Focus the editing note after Alpine renders it
    setTimeout(() => {
      const editEl = document.querySelector('.note-editor');
      if (editEl) {
        // Set initial text content directly
        editEl.textContent = initialChar;
        editEl.focus();
        // Move cursor to end using service
        this._vmDom.moveCursorToEnd(editEl);
      }
    }, 50);
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
   * @param {VmStickyNote} note
   */
  editNote(note) {
    // If already editing the same note, do nothing
    if (this.editingNote && this.editingNote.id === note.id) {
      return;
    }
    
    // If editing a different note, stop editing (blur will save via onEditorBlur)
    if (this.editingNote) {
      // Don't call confirmEditing, just clear - the note stays in the array
      this.editingNote = null;
      this.stopIconAnimation();
    }

    // Set as editing - note stays in the array, we just reference it
    this.editingNote = note;

    this.startIconAnimation(); // Start toggling icons

    // Record when we started editing to ignore blur events that fire too soon
    this._editStartTime = Date.now();
    
    // Use setTimeout to ensure Alpine has fully updated the DOM with x-show
    // $nextTick alone doesn't wait for x-show transitions to complete
    setTimeout(() => {
      if (!this.editingNote) {
        return;
      }
      
      // Use querySelector since $refs may not work reliably with x-show transitions
      const editEl = document.querySelector('.note-editor');
      
      if (editEl) {
        editEl.textContent = this.editingNote.text;
        editEl.focus();
        // Move cursor to end using service
        this._vmDom.moveCursorToEnd(editEl);
      }
    }, 50);
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
    
    // Ignore blur events that fire within 200ms of starting to edit
    // These are caused by the programmatic focus, not user action
    if (timeSinceEditStart < 200) {
      return;
    }
    
    if (this.isDeleting) {
      return;
    }
    
    this.confirmEditing();
  }

  /**
   * Confirm the editing note - note stays in array, just end editing mode
   */
  confirmEditing() {
    if (this.editingNote) {
      // If text is empty, remove the note from the array
      if (this.editingNote.text.trim().length === 0) {
        this.notes = this.notes.filter(n => n.id !== this.editingNote.id);
      }
      this.save(); // Persist
    }
    this.editingNote = null;
    this.stopIconAnimation(); // Stop anims
  }

  /**
   * Cancel editing - for new empty notes, remove. For existing notes, keep.
   */
  cancelEditing() {
    // If the note has no text (new note that was cancelled), remove it
    if (this.editingNote && this.editingNote.text.trim().length === 0) {
      this.notes = this.notes.filter(n => n.id !== this.editingNote.id);
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

      // Remove from array since note is in there now
      this.notes = this.notes.filter(n => n.id !== this.editingNote.id);
      
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
   * Handle click on the whiteboard background
   * Confirms editing if clicking outside notes
   * @param {MouseEvent} event
   */
  onWhiteBoardClick(event) {
    // Only act if we have an editing note
    if (!this.editingNote) return;
    
    // Check if click was on an interactive element that should NOT deselect
    const isOnNote = event.target.closest('.sticky-note');
    const isOnFab = event.target.closest('.fab');
    const isOnPopup = event.target.closest('.popup');
    const isOnStack = event.target.closest('.empty-state-container');
    const isOnMenu = event.target.closest('.selected-note-menu');
    
    // If clicked on a non-editing sticky note, let editNoteById handle it
    if (isOnNote && !isOnNote.classList.contains('editing')) {
      return;
    }
    
    // If clicked on the editing note itself, don't deselect
    if (isOnNote && isOnNote.classList.contains('editing')) {
      return;
    }
    
    // If clicked on FABs, popups, stack, or menu - don't deselect
    if (isOnFab || isOnPopup || isOnStack || isOnMenu) {
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
    // editingNote is now in the notes array, no need to combine separately
    const allNotes = this.notes;

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

    // Smart Wrap: If we are below the note stack (Top 24 + Height 180 = 204),
    // we can start from the left edge (NOTE_GAP) instead of indenting.
    const stackBottom = 24 + 180;
    const startX =
      nextRowY > stackBottom ? this._config.noteGap : this._config.initialX;

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
    // editingNote is now in the notes array, no need to combine separately
    const allNotes = this.notes;

    if (allNotes.length === 0) return;

    const currentViewportWidth = this.viewportWidth;
    let currentX = this._config.initialX;
    let currentY = this._config.initialY;

    for (const note of allNotes) {
      // Check if note would overflow current row
      if (
        currentX + this._config.noteWidth >
        currentViewportWidth - this._config.noteGap
      ) {
        // Move to next row
        currentY += this._config.noteHeight + this._config.noteGap;

        // Smart Wrap logic for rearrange
        const stackBottom = 24 + 180;
        if (currentY > stackBottom) {
          currentX = this._config.noteGap;
        } else {
          currentX = this._config.initialX;
        }
      }

      note.x = currentX;
      note.y = currentY;

      currentX += this._config.noteWidth + this._config.noteGap;
    }
    this.save(); // Persist positions after rearrange
  }
}
