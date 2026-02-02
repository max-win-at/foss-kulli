import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Helper: creates a VmWhiteBoard instance with mock dependencies.
 */
function createBoard(opts = {}) {
  const srvLocalStorage = {
    saveNotes: vi.fn(),
    loadNotes: vi.fn(() => []),
    moveToTrash: vi.fn(),
    cleanupTrash: vi.fn(),
    loadTrash: vi.fn(() => []),
    saveTrash: vi.fn(),
  };

  let noteIdCounter = 0;
  const noteFactory = (text, x, y) => {
    const id = `note-${++noteIdCounter}`;
    return new VmStickyNote(id, text, x, y);
  };

  const vmDom = { viewportWidth: 1024, viewportHeight: 768 };

  const board = new VmWhiteBoard(
    opts.noteFactory || noteFactory,
    opts.srvLocalStorage || srvLocalStorage,
    vmDom,
  );

  // Override Alpine-specific methods that don't exist in tests
  board.$nextTick = (fn) => fn();
  board.$refs = { noteEditor: null };

  // Set a usable viewport width
  board.viewportWidth = opts.viewportWidth || 1024;

  return { board, srvLocalStorage, vmDom, noteFactory: opts.noteFactory || noteFactory };
}

// ────────────────────────────────────────────────────────────────
// Pure Logic Functions
// ────────────────────────────────────────────────────────────────

describe('VmWhiteBoard', () => {
  describe('matchesSearch', () => {
    it('returns true when query is empty', () => {
      const { board } = createBoard();
      board.searchQuery = '';

      expect(board.matchesSearch({ text: 'anything' })).toBe(true);
    });

    it('returns true when query is whitespace-only', () => {
      const { board } = createBoard();
      board.searchQuery = '   ';

      expect(board.matchesSearch({ text: 'anything' })).toBe(true);
    });

    it('returns false when note is null', () => {
      const { board } = createBoard();
      board.searchQuery = 'test';

      expect(board.matchesSearch(null)).toBe(false);
    });

    it('returns false when note.text is null', () => {
      const { board } = createBoard();
      board.searchQuery = 'test';

      expect(board.matchesSearch({ text: null })).toBe(false);
    });

    it('returns false when note.text is undefined', () => {
      const { board } = createBoard();
      board.searchQuery = 'test';

      expect(board.matchesSearch({ text: undefined })).toBe(false);
    });

    it('performs case-insensitive match', () => {
      const { board } = createBoard();
      board.searchQuery = 'HELLO';

      expect(board.matchesSearch({ text: 'hello world' })).toBe(true);
    });

    it('matches substring', () => {
      const { board } = createBoard();
      board.searchQuery = 'llo';

      expect(board.matchesSearch({ text: 'hello world' })).toBe(true);
    });

    it('returns false when text does not contain query', () => {
      const { board } = createBoard();
      board.searchQuery = 'xyz';

      expect(board.matchesSearch({ text: 'hello world' })).toBe(false);
    });

    it('handles special characters in query', () => {
      const { board } = createBoard();
      board.searchQuery = '(test)';

      expect(board.matchesSearch({ text: 'this is a (test) note' })).toBe(true);
      expect(board.matchesSearch({ text: 'no match here' })).toBe(false);
    });

    it('matches empty note text only when query is empty', () => {
      const { board } = createBoard();

      board.searchQuery = '';
      expect(board.matchesSearch({ text: '' })).toBe(true);

      board.searchQuery = 'a';
      expect(board.matchesSearch({ text: '' })).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('getNextNotePosition', () => {
    it('returns INITIAL_X, INITIAL_Y when no notes exist', () => {
      const { board } = createBoard();

      const pos = board.getNextNotePosition();

      expect(pos).toEqual({
        x: VmWhiteBoard.INITIAL_X,
        y: VmWhiteBoard.INITIAL_Y,
      });
    });

    it('places next note to the right of the last note', () => {
      const { board } = createBoard();
      board.notes = [new VmStickyNote('n1', 'Hi', 240, 24)];

      const pos = board.getNextNotePosition();

      expect(pos.x).toBe(240 + VmWhiteBoard.NOTE_WIDTH + VmWhiteBoard.NOTE_GAP);
      expect(pos.y).toBe(24);
    });

    it('wraps to the next row when viewport overflows', () => {
      const { board } = createBoard({ viewportWidth: 500 });
      board.viewportWidth = 500;
      // Place a note near the right edge
      board.notes = [new VmStickyNote('n1', 'Hi', 300, 24)];

      const pos = board.getNextNotePosition();

      // newX = 300 + 180 + 20 = 500, but 500 + 180 > 500 - 20 = 480, so wraps
      expect(pos.y).toBeGreaterThan(24);
    });

    it('uses INITIAL_X for wrapped rows beside the stack area', () => {
      const { board } = createBoard({ viewportWidth: 500 });
      board.viewportWidth = 500;
      // Note at y=24 (within stack area), wrapping keeps INITIAL_X
      board.notes = [new VmStickyNote('n1', 'Hi', 300, 24)];

      const pos = board.getNextNotePosition();
      const stackBottom = 24 + 180; // 204

      // If nextRowY <= stackBottom, startX = INITIAL_X
      // nextRowY = 24 + 180 + 20 = 224 > 204, so it's below stack -> NOTE_GAP
      expect(pos.x).toBe(VmWhiteBoard.NOTE_GAP);
    });

    it('uses NOTE_GAP for wrapped rows below the stack area', () => {
      const { board } = createBoard({ viewportWidth: 500 });
      board.viewportWidth = 500;
      // Place note well below the stack
      board.notes = [new VmStickyNote('n1', 'Hi', 300, 300)];

      const pos = board.getNextNotePosition();

      // nextRowY = 300 + 180 + 20 = 500, well below stackBottom (204)
      expect(pos.x).toBe(VmWhiteBoard.NOTE_GAP);
    });

    it('includes the editing note in position calculations', () => {
      const { board } = createBoard();
      board.notes = [];
      board.editingNote = new VmStickyNote('editing', 'Draft', 240, 24);

      const pos = board.getNextNotePosition();

      // Should calculate relative to the editing note, not return INITIAL
      expect(pos.x).toBe(240 + VmWhiteBoard.NOTE_WIDTH + VmWhiteBoard.NOTE_GAP);
    });

    it('handles multiple notes filling a row', () => {
      const { board } = createBoard({ viewportWidth: 800 });
      board.viewportWidth = 800;
      // Place notes to fill the first row
      board.notes = [
        new VmStickyNote('n1', 'A', 240, 24),
        new VmStickyNote('n2', 'B', 440, 24),
      ];

      const pos = board.getNextNotePosition();
      // 440 + 180 + 20 = 640 => 640 + 180 = 820 > 800 - 20 = 780 → wraps
      expect(pos.y).toBe(24 + VmWhiteBoard.NOTE_HEIGHT + VmWhiteBoard.NOTE_GAP);
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('rearrangeNotes', () => {
    it('does nothing when there are no notes', () => {
      const { board, srvLocalStorage } = createBoard();
      board.notes = [];

      board.rearrangeNotes();

      // save() is not called because the method returns early
      expect(srvLocalStorage.saveNotes).not.toHaveBeenCalled();
    });

    it('repositions notes to fit the viewport', () => {
      const { board } = createBoard({ viewportWidth: 500 });
      board.viewportWidth = 500;
      board.notes = [
        new VmStickyNote('n1', 'A', 0, 0),
        new VmStickyNote('n2', 'B', 0, 0),
        new VmStickyNote('n3', 'C', 0, 0),
      ];

      board.rearrangeNotes();

      // First note starts at INITIAL_X, INITIAL_Y
      expect(board.notes[0].x).toBe(VmWhiteBoard.INITIAL_X);
      expect(board.notes[0].y).toBe(VmWhiteBoard.INITIAL_Y);
      // Subsequent notes are positioned correctly
      expect(board.notes[1].y).toBeGreaterThanOrEqual(VmWhiteBoard.INITIAL_Y);
    });

    it('calls save() after rearranging', () => {
      const { board, srvLocalStorage } = createBoard();
      board.notes = [new VmStickyNote('n1', 'A', 0, 0)];

      board.rearrangeNotes();

      expect(srvLocalStorage.saveNotes).toHaveBeenCalled();
    });

    it('includes the editing note in the layout', () => {
      const { board } = createBoard({ viewportWidth: 1024 });
      board.viewportWidth = 1024;
      board.notes = [new VmStickyNote('n1', 'A', 0, 0)];
      board.editingNote = new VmStickyNote('editing', 'Draft', 0, 0);

      board.rearrangeNotes();

      // Both notes should be repositioned
      expect(board.notes[0].x).toBe(VmWhiteBoard.INITIAL_X);
      expect(board.editingNote.x).toBe(
        VmWhiteBoard.INITIAL_X + VmWhiteBoard.NOTE_WIDTH + VmWhiteBoard.NOTE_GAP,
      );
    });

    it('applies Smart Wrap below the stack area', () => {
      const { board } = createBoard({ viewportWidth: 460 });
      board.viewportWidth = 460;
      // With viewport=460, INITIAL_X=240, one note fits per row in the stack zone
      // Layout: n1 at (240,24), n2 wraps to (20,224), n3 fits at (220,224)
      board.notes = [
        new VmStickyNote('n1', 'A', 0, 0),
        new VmStickyNote('n2', 'B', 0, 0),
        new VmStickyNote('n3', 'C', 0, 0),
      ];

      board.rearrangeNotes();

      const stackBottom = 24 + 180;
      // n1 stays in the stack zone
      expect(board.notes[0].x).toBe(VmWhiteBoard.INITIAL_X);
      expect(board.notes[0].y).toBe(VmWhiteBoard.INITIAL_Y);

      // n2 is the first note on the wrapped row below the stack,
      // so it starts at NOTE_GAP (not INITIAL_X)
      expect(board.notes[1].x).toBe(VmWhiteBoard.NOTE_GAP);
      expect(board.notes[1].y).toBeGreaterThan(stackBottom);

      // n3 fits on the same row as n2
      expect(board.notes[2].y).toBe(board.notes[1].y);
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('applySearchFilter / restorePositions', () => {
    it('restores positions when query is cleared', () => {
      const { board } = createBoard();
      board.notes = [
        new VmStickyNote('n1', 'Hello', 100, 200),
        new VmStickyNote('n2', 'World', 300, 400),
      ];

      // Set a search query to save original positions
      board.searchQuery = 'Hello';
      board.applySearchFilter();

      // Positions should have changed for matching notes
      // Now clear the search
      board.searchQuery = '';
      board.applySearchFilter();

      // Positions should be restored
      expect(board.notes[0].x).toBe(100);
      expect(board.notes[0].y).toBe(200);
      expect(board.notes[1].x).toBe(300);
      expect(board.notes[1].y).toBe(400);
    });

    it('saves original positions before first filter', () => {
      const { board } = createBoard();
      board.notes = [
        new VmStickyNote('n1', 'Match', 111, 222),
      ];

      board.searchQuery = 'Match';
      board.applySearchFilter();

      // The _originalPositions should have been saved
      expect(board._originalPositions).toBeTruthy();
      expect(board._originalPositions.get('n1')).toEqual({ x: 111, y: 222 });
    });

    it('does not overwrite original positions on subsequent filters', () => {
      const { board } = createBoard();
      board.notes = [
        new VmStickyNote('n1', 'Hello World', 111, 222),
      ];

      // First filter - saves originals
      board.searchQuery = 'Hello';
      board.applySearchFilter();

      // Note position changes
      const posAfterFirstFilter = { x: board.notes[0].x, y: board.notes[0].y };

      // Second filter - should NOT overwrite originals
      board.searchQuery = 'World';
      board.applySearchFilter();

      // Original should still be 111, 222 (not posAfterFirstFilter)
      expect(board._originalPositions.get('n1')).toEqual({ x: 111, y: 222 });
    });

    it('filters notes by search match and sorts by createdAt descending', () => {
      const { board } = createBoard({ viewportWidth: 2000 });
      board.viewportWidth = 2000;

      const older = new VmStickyNote('n1', 'Match older', 0, 0, '2024-01-01');
      const newer = new VmStickyNote('n2', 'Match newer', 0, 0, '2025-06-01');
      const noMatch = new VmStickyNote('n3', 'No result', 0, 0);
      board.notes = [older, newer, noMatch];

      board.searchQuery = 'Match';
      board.applySearchFilter();

      // newer should be positioned first (leftmost) because it sorts descending
      expect(newer.x).toBeLessThanOrEqual(older.x);
    });

    it('restorePositions no-ops when no positions are saved', () => {
      const { board } = createBoard();
      board.notes = [new VmStickyNote('n1', 'Hi', 50, 60)];

      board.restorePositions();

      // Nothing should change
      expect(board.notes[0].x).toBe(50);
      expect(board.notes[0].y).toBe(60);
    });

    it('clears _originalPositions after restoring', () => {
      const { board } = createBoard();
      board.notes = [new VmStickyNote('n1', 'Hi', 50, 60)];

      board.searchQuery = 'Hi';
      board.applySearchFilter();
      expect(board._originalPositions).toBeTruthy();

      board.searchQuery = '';
      board.applySearchFilter();
      expect(board._originalPositions).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('clearSearch', () => {
    it('resets searchQuery to empty string', () => {
      const { board } = createBoard();
      board.searchQuery = 'something';

      board.clearSearch();

      expect(board.searchQuery).toBe('');
    });

    it('restores original positions', () => {
      const { board } = createBoard();
      board.notes = [new VmStickyNote('n1', 'Hi', 77, 88)];

      board.searchQuery = 'Hi';
      board.applySearchFilter();

      board.clearSearch();

      expect(board.notes[0].x).toBe(77);
      expect(board.notes[0].y).toBe(88);
    });
  });

  // ────────────────────────────────────────────────────────────
  // State Management
  // ────────────────────────────────────────────────────────────

  describe('confirmEditing', () => {
    it('adds editing note to notes[] if text is non-empty', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Hello', 10, 20);

      board.confirmEditing();

      expect(board.notes).toHaveLength(1);
      expect(board.notes[0].text).toBe('Hello');
    });

    it('does not add editing note if text is empty or whitespace', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', '   ', 10, 20);

      board.confirmEditing();

      expect(board.notes).toHaveLength(0);
    });

    it('calls save() after confirming', () => {
      const { board, srvLocalStorage } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Hello', 10, 20);

      board.confirmEditing();

      expect(srvLocalStorage.saveNotes).toHaveBeenCalled();
    });

    it('clears editingNote to null', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Hello', 10, 20);

      board.confirmEditing();

      expect(board.editingNote).toBeNull();
    });

    it('no-ops when editingNote is null', () => {
      const { board, srvLocalStorage } = createBoard();
      board.editingNote = null;

      board.confirmEditing();

      expect(board.notes).toHaveLength(0);
      expect(srvLocalStorage.saveNotes).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('cancelEditing', () => {
    it('adds editing note back to notes[] if text is non-empty', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Draft', 10, 20);

      board.cancelEditing();

      expect(board.notes).toHaveLength(1);
      expect(board.notes[0].text).toBe('Draft');
    });

    it('discards editing note if text is empty or whitespace', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', '  ', 10, 20);

      board.cancelEditing();

      expect(board.notes).toHaveLength(0);
    });

    it('clears editingNote to null', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Hello', 10, 20);

      board.cancelEditing();

      expect(board.editingNote).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('deleteEditingNote', () => {
    it('moves note to trash via storage service', () => {
      vi.useFakeTimers();
      const { board, srvLocalStorage } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Delete me', 10, 20);

      board.deleteEditingNote();
      vi.advanceTimersByTime(300);

      expect(srvLocalStorage.moveToTrash).toHaveBeenCalledWith(board.editingNote || expect.anything());
      vi.useRealTimers();
    });

    it('clears editing state after 300ms animation delay', () => {
      vi.useFakeTimers();
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Delete me', 10, 20);

      board.deleteEditingNote();

      // Before timeout: still in deleting state
      expect(board.isDeleting).toBe(true);

      vi.advanceTimersByTime(300);

      expect(board.editingNote).toBeNull();
      expect(board.isDeleting).toBe(false);
      vi.useRealTimers();
    });

    it('calls save() after deletion', () => {
      vi.useFakeTimers();
      const { board, srvLocalStorage } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Delete me', 10, 20);

      board.deleteEditingNote();
      vi.advanceTimersByTime(300);

      expect(srvLocalStorage.saveNotes).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('createNote', () => {
    it('creates a note at the next calculated position', () => {
      const { board } = createBoard();

      board.createNote('New note');

      expect(board.notes).toHaveLength(1);
      expect(board.notes[0].text).toBe('New note');
      expect(board.notes[0].x).toBe(VmWhiteBoard.INITIAL_X);
      expect(board.notes[0].y).toBe(VmWhiteBoard.INITIAL_Y);
    });

    it('saves after creating a note', () => {
      const { board, srvLocalStorage } = createBoard();

      board.createNote('Saved note');

      expect(srvLocalStorage.saveNotes).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('editNote', () => {
    it('removes the target note from notes[]', () => {
      const { board } = createBoard();
      const note = new VmStickyNote('n1', 'Edit me', 10, 20);
      board.notes = [note];

      board.editNote(note);

      expect(board.notes).toHaveLength(0);
    });

    it('sets the note as editingNote', () => {
      const { board } = createBoard();
      const note = new VmStickyNote('n1', 'Edit me', 10, 20);
      board.notes = [note];

      board.editNote(note);

      expect(board.editingNote).toBe(note);
    });

    it('confirms any currently editing note first', () => {
      const { board } = createBoard();
      const existing = new VmStickyNote('n1', 'Existing', 10, 20);
      board.editingNote = existing;
      const newNote = new VmStickyNote('n2', 'New edit', 30, 40);
      board.notes = [newNote];

      board.editNote(newNote);

      // The previously editing note should have been confirmed (added to notes)
      // and then newNote removed and set as editing
      expect(board.editingNote).toBe(newNote);
      expect(board.notes.some((n) => n.id === 'n1')).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('createNewNote', () => {
    it('starts editing an empty note', () => {
      const { board } = createBoard();
      // Mock startEditing
      const spy = vi.spyOn(board, 'startEditing').mockImplementation(() => {});

      board.createNewNote();

      expect(spy).toHaveBeenCalledWith('');
      spy.mockRestore();
    });

    it('does nothing if already editing', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Draft', 0, 0);
      const spy = vi.spyOn(board, 'startEditing');

      board.createNewNote();

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('updateEditingText', () => {
    it('updates the editing note text', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Old', 0, 0);

      board.updateEditingText('New text');

      expect(board.editingNote.text).toBe('New text');
    });

    it('no-ops when editingNote is null', () => {
      const { board } = createBoard();
      board.editingNote = null;

      // Should not throw
      expect(() => board.updateEditingText('text')).not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────
  // Event Handlers
  // ────────────────────────────────────────────────────────────

  describe('onKeyDown', () => {
    function makeEvent(overrides = {}) {
      return {
        key: 'a',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
        ...overrides,
      };
    }

    it('ignores input when search popup is open', () => {
      const { board } = createBoard();
      board.isSearchOpen = true;
      const spy = vi.spyOn(board, 'startEditing');

      board.onKeyDown(makeEvent({ key: 'a' }));

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('ignores input when about popup is open', () => {
      const { board } = createBoard();
      board.isAboutOpen = true;
      const spy = vi.spyOn(board, 'startEditing');

      board.onKeyDown(makeEvent({ key: 'a' }));

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('ignores modifier key combos (Ctrl)', () => {
      const { board } = createBoard();
      const spy = vi.spyOn(board, 'startEditing');

      board.onKeyDown(makeEvent({ key: 'a', ctrlKey: true }));

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('ignores modifier key combos (Meta)', () => {
      const { board } = createBoard();
      const spy = vi.spyOn(board, 'startEditing');

      board.onKeyDown(makeEvent({ key: 'a', metaKey: true }));

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('ignores modifier key combos (Alt)', () => {
      const { board } = createBoard();
      const spy = vi.spyOn(board, 'startEditing');

      board.onKeyDown(makeEvent({ key: 'a', altKey: true }));

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('ignores special keys (Escape, Tab, Shift, etc.)', () => {
      const { board } = createBoard();
      const spy = vi.spyOn(board, 'startEditing');

      const specialKeys = ['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];
      for (const key of specialKeys) {
        board.onKeyDown(makeEvent({ key }));
      }

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('ignores input when already editing', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Draft', 0, 0);
      const spy = vi.spyOn(board, 'startEditing');

      board.onKeyDown(makeEvent({ key: 'b' }));

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('starts editing on a single printable character', () => {
      const { board } = createBoard();
      const spy = vi.spyOn(board, 'startEditing').mockImplementation(() => {});
      const event = makeEvent({ key: 'x' });

      board.onKeyDown(event);

      expect(spy).toHaveBeenCalledWith('x');
      expect(event.preventDefault).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('does not start editing for multi-character keys like "Enter"', () => {
      const { board } = createBoard();
      const spy = vi.spyOn(board, 'startEditing');

      board.onKeyDown(makeEvent({ key: 'Enter' }));

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('onEditingKeyDown', () => {
    function makeEvent(overrides = {}) {
      return {
        key: 'a',
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        ...overrides,
      };
    }

    it('Ctrl+Enter confirms editing', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Text', 0, 0);
      const event = makeEvent({ key: 'Enter', ctrlKey: true });

      board.onEditingKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(board.editingNote).toBeNull();
    });

    it('Cmd+Enter (Meta) confirms editing', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Text', 0, 0);
      const event = makeEvent({ key: 'Enter', metaKey: true });

      board.onEditingKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(board.editingNote).toBeNull();
    });

    it('Escape cancels editing', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Text', 0, 0);
      const event = makeEvent({ key: 'Escape' });

      board.onEditingKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(board.editingNote).toBeNull();
    });

    it('allows other keys to pass through', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Text', 0, 0);
      const event = makeEvent({ key: 'a' });

      board.onEditingKeyDown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      // editingNote should still be set
      expect(board.editingNote).not.toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────

  describe('onPaste', () => {
    function makePasteEvent(text) {
      return {
        clipboardData: { getData: vi.fn(() => text) },
        preventDefault: vi.fn(),
      };
    }

    it('creates a new note from clipboard text', () => {
      const { board } = createBoard();
      const event = makePasteEvent('Pasted content');

      board.onPaste(event);

      expect(board.notes).toHaveLength(1);
      expect(board.notes[0].text).toBe('Pasted content');
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('trims whitespace from pasted text', () => {
      const { board } = createBoard();
      const event = makePasteEvent('  hello  ');

      board.onPaste(event);

      expect(board.notes[0].text).toBe('hello');
    });

    it('ignores paste when search popup is open', () => {
      const { board } = createBoard();
      board.isSearchOpen = true;

      board.onPaste(makePasteEvent('text'));

      expect(board.notes).toHaveLength(0);
    });

    it('ignores paste when about popup is open', () => {
      const { board } = createBoard();
      board.isAboutOpen = true;

      board.onPaste(makePasteEvent('text'));

      expect(board.notes).toHaveLength(0);
    });

    it('ignores paste when already editing', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Draft', 0, 0);

      board.onPaste(makePasteEvent('text'));

      expect(board.notes).toHaveLength(0);
    });

    it('ignores paste with empty text', () => {
      const { board } = createBoard();

      board.onPaste(makePasteEvent('   '));

      expect(board.notes).toHaveLength(0);
    });

    it('ignores paste with null clipboard data', () => {
      const { board } = createBoard();
      const event = { clipboardData: null, preventDefault: vi.fn() };

      // Should not throw
      expect(() => board.onPaste(event)).not.toThrow();
      expect(board.notes).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // Popup Toggles
  // ────────────────────────────────────────────────────────────

  describe('toggleSearch', () => {
    it('opens search and closes about', () => {
      const { board } = createBoard();
      board.isSearchOpen = false;
      board.isAboutOpen = true;

      board.toggleSearch();

      expect(board.isSearchOpen).toBe(true);
      expect(board.isAboutOpen).toBe(false);
    });

    it('closes search when already open', () => {
      const { board } = createBoard();
      board.isSearchOpen = true;

      board.toggleSearch();

      expect(board.isSearchOpen).toBe(false);
    });
  });

  describe('toggleAbout', () => {
    it('opens about and closes search', () => {
      const { board } = createBoard();
      board.isAboutOpen = false;
      board.isSearchOpen = true;

      board.toggleAbout();

      expect(board.isAboutOpen).toBe(true);
      expect(board.isSearchOpen).toBe(false);
    });

    it('closes about when already open', () => {
      const { board } = createBoard();
      board.isAboutOpen = true;

      board.toggleAbout();

      expect(board.isAboutOpen).toBe(false);
    });
  });

  describe('closePopups', () => {
    it('closes both popups', () => {
      const { board } = createBoard();
      board.isSearchOpen = true;
      board.isAboutOpen = true;

      board.closePopups();

      expect(board.isSearchOpen).toBe(false);
      expect(board.isAboutOpen).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // getMenuPosition
  // ────────────────────────────────────────────────────────────

  describe('getMenuPosition', () => {
    it('returns display:none when not editing', () => {
      const { board } = createBoard();
      board.editingNote = null;

      expect(board.getMenuPosition()).toBe('display: none;');
    });

    it('returns correct CSS positioning when editing', () => {
      const { board } = createBoard();
      board.editingNote = new VmStickyNote('n1', 'Hi', 100, 200);

      const pos = board.getMenuPosition();

      expect(pos).toContain('left: 100px');
      expect(pos).toContain('top: 390px'); // 200 + 190
    });
  });

  // ────────────────────────────────────────────────────────────
  // Icon Animation
  // ────────────────────────────────────────────────────────────

  describe('icon animation', () => {
    it('stopIconAnimation resets icons to defaults', () => {
      const { board } = createBoard();
      board.deleteIcon = 'delete_forever';
      board.dragIcon = 'touch_app';
      board.iconOpacity = 0;

      board.stopIconAnimation();

      expect(board.deleteIcon).toBe('delete');
      expect(board.dragIcon).toBe('pan_tool');
      expect(board.iconOpacity).toBe(1);
    });

    it('onDeleteEnter sets delete_forever icon', () => {
      const { board } = createBoard();

      board.onDeleteEnter();

      expect(board.deleteIcon).toBe('delete_forever');
    });

    it('onDeleteLeave resets delete icon', () => {
      const { board } = createBoard();
      board.deleteIcon = 'delete_forever';

      board.onDeleteLeave();

      expect(board.deleteIcon).toBe('delete');
    });

    it('onDragStart sets touch_app icon', () => {
      const { board } = createBoard();

      board.onDragStart();

      expect(board.dragIcon).toBe('touch_app');
    });

    it('onDragEnd resets drag icon', () => {
      const { board } = createBoard();
      board.dragIcon = 'touch_app';

      board.onDragEnd();

      expect(board.dragIcon).toBe('pan_tool');
    });
  });

  // ────────────────────────────────────────────────────────────
  // Static constants
  // ────────────────────────────────────────────────────────────

  describe('static constants', () => {
    it('has expected layout constants', () => {
      expect(VmWhiteBoard.NOTE_WIDTH).toBe(180);
      expect(VmWhiteBoard.NOTE_HEIGHT).toBe(180);
      expect(VmWhiteBoard.NOTE_GAP).toBe(20);
      expect(VmWhiteBoard.INITIAL_X).toBe(240);
      expect(VmWhiteBoard.INITIAL_Y).toBe(24);
    });
  });
});
