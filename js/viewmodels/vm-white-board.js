/**
 * VmWhiteBoard - Main Whiteboard ViewModel
 * Handles note creation, search, and about functionality
 */
class VmWhiteBoard {
    static NOTE_WIDTH = 200;
    static NOTE_HEIGHT = 150;
    static NOTE_GAP = 20;
    static INITIAL_X = 40;
    static INITIAL_Y = 160;

    /**
     * @param {Function} noteFactory - Factory function to create notes: (text, x, y) => VmStickyNote
     */
    constructor(noteFactory) {
        this._noteFactory = noteFactory;

        // Initialize reactive state
        this.hintVisible = true;
        this.notes = [];
        this.isSearchOpen = false;
        this.isAboutOpen = false;
        this.searchQuery = '';

        // Currently editing note (spawned immediately on typing)
        this.editingNote = null;
    }

    /**
     * Alpine.js init method - called automatically
     */
    init() {
        // Resize handled via @resize.window in HTML binding
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
        const ignoredKeys = ['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];
        if (ignoredKeys.includes(event.key)) return;

        // If already editing, let the contenteditable handle input
        if (this.editingNote) return;

        // Handle Escape - cancel editing without saving
        if (event.key === 'Escape') {
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
        this.hintVisible = false;

        // Focus the editing note after Alpine renders it
        this.$nextTick(() => {
            const editEl = this.$refs.noteEditor;
            if (editEl) {
                // Set initial text content directly (not via binding to avoid cursor reset)
                editEl.textContent = initialChar;
                editEl.focus();
                // Move cursor to end
                const range = document.createRange();
                range.selectNodeContents(editEl);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });
    }

    /**
     * Confirm the editing note and add to notes array
     */
    confirmEditing() {
        if (this.editingNote && this.editingNote.text.trim().length > 0) {
            this.notes.push(this.editingNote);
        }
        this.editingNote = null;

        if (this.notes.length === 0) {
            this.hintVisible = true;
        }
    }

    /**
     * Cancel editing and discard the note
     */
    cancelEditing() {
        this.editingNote = null;
        if (this.notes.length === 0) {
            this.hintVisible = true;
        }
    }

    /**
     * Update editing note text from contenteditable
     * @param {string} text 
     */
    updateEditingText(text) {
        if (this.editingNote) {
            this.editingNote.text = text;
        }
    }

    /**
     * Handle keydown in the editing note
     * @param {KeyboardEvent} event 
     */
    onEditingKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.confirmEditing();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelEditing();
        }
    }

    /**
     * Handle paste events
     * @param {ClipboardEvent} event 
     */
    onPaste(event) {
        if (this.isSearchOpen || this.isAboutOpen) return;
        if (this.editingNote) return; // Let contenteditable handle paste during editing

        const text = event.clipboardData?.getData('text');
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
                input.value = '';
            }
        }
    }

    /**
     * Handle blur from hidden input (mobile)
     * @param {FocusEvent} event 
     */
    onInputBlur(event) {
        const input = event.target;
        input.value = '';
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
     * Create a new sticky note at the calculated position (for paste)
     * @param {string} text - Note content
     */
    createNote(text) {
        const position = this.getNextNotePosition();
        const note = this._noteFactory(text, position.x, position.y);
        this.notes.push(note);
        this.hintVisible = false;
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

        const viewportWidth = window.innerWidth;

        // Find rightmost note
        let rightmostNote = allNotes[0];
        for (const note of allNotes) {
            if (note.x > rightmostNote.x) {
                rightmostNote = note;
            }
        }

        // Calculate position to the right of rightmost note
        const newX = rightmostNote.x + VmWhiteBoard.NOTE_WIDTH + VmWhiteBoard.NOTE_GAP;
        const newY = rightmostNote.y;

        // Check if it would overflow
        if (newX + VmWhiteBoard.NOTE_WIDTH <= viewportWidth - VmWhiteBoard.NOTE_GAP) {
            return { x: newX, y: newY };
        }

        // Overflow: place below leftmost note
        let leftmostNote = allNotes[0];
        let lowestY = allNotes[0].y;

        for (const note of allNotes) {
            if (note.x < leftmostNote.x) {
                leftmostNote = note;
            }
            if (note.y > lowestY) {
                lowestY = note.y;
            }
        }

        return {
            x: leftmostNote.x,
            y: lowestY + VmWhiteBoard.NOTE_HEIGHT + VmWhiteBoard.NOTE_GAP
        };
    }

    /**
     * Rearrange all notes to fit the current viewport width
     * Called on window resize
     */
    rearrangeNotes() {
        if (this.notes.length === 0) return;

        const viewportWidth = window.innerWidth;
        let currentX = VmWhiteBoard.INITIAL_X;
        let currentY = VmWhiteBoard.INITIAL_Y;
        let rowMaxHeight = 0;

        for (const note of this.notes) {
            // Check if note would overflow current row
            if (currentX + VmWhiteBoard.NOTE_WIDTH > viewportWidth - VmWhiteBoard.NOTE_GAP) {
                // Move to next row
                currentX = VmWhiteBoard.INITIAL_X;
                currentY += VmWhiteBoard.NOTE_HEIGHT + VmWhiteBoard.NOTE_GAP;
            }

            note.x = currentX;
            note.y = currentY;

            currentX += VmWhiteBoard.NOTE_WIDTH + VmWhiteBoard.NOTE_GAP;
        }
    }
}

// Make available globally for non-module scripts
window.VmWhiteBoard = VmWhiteBoard;
