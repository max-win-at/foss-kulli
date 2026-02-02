import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for app.js IoC logic.
 *
 * app.js runs inside a 'alpine:init' event handler. Since we cannot easily
 * load it as a module, we replicate and test the two key pieces of logic:
 *   1. Note ID counter initialization from existing notes
 *   2. Note factory function
 */

// ─── Replicated logic from app.js ─────────────────────────────
// (exact copy of the counter + factory logic for isolated testing)

function initNoteIdCounter(existingNotes) {
  let noteIdCounter = 0;
  for (const note of existingNotes) {
    if (note.id && note.id.startsWith('note-')) {
      const num = parseInt(note.id.replace('note-', ''), 10);
      if (!isNaN(num) && num > noteIdCounter) {
        noteIdCounter = num;
      }
    }
  }
  return noteIdCounter;
}

function createNoteFactory(initialCounter) {
  let noteIdCounter = initialCounter;
  return (text, x, y) => {
    const id = `note-${++noteIdCounter}`;
    return new VmStickyNote(id, text, x, y);
  };
}

// ────────────────────────────────────────────────────────────────

describe('app.js - Note ID Counter', () => {
  it('initializes to 0 when no existing notes', () => {
    expect(initNoteIdCounter([])).toBe(0);
  });

  it('finds the highest note-N ID', () => {
    const notes = [
      { id: 'note-3', text: 'C' },
      { id: 'note-1', text: 'A' },
      { id: 'note-7', text: 'G' },
      { id: 'note-5', text: 'E' },
    ];

    expect(initNoteIdCounter(notes)).toBe(7);
  });

  it('ignores notes without IDs', () => {
    const notes = [
      { text: 'No ID' },
      { id: 'note-2', text: 'Has ID' },
    ];

    expect(initNoteIdCounter(notes)).toBe(2);
  });

  it('ignores notes with non-matching ID formats', () => {
    const notes = [
      { id: 'custom-1', text: 'Custom' },
      { id: 'sticky-5', text: 'Sticky' },
      { id: 'note-3', text: 'Correct' },
    ];

    expect(initNoteIdCounter(notes)).toBe(3);
  });

  it('handles non-numeric suffixes gracefully', () => {
    const notes = [
      { id: 'note-abc', text: 'Bad suffix' },
      { id: 'note-2', text: 'Good' },
    ];

    expect(initNoteIdCounter(notes)).toBe(2);
  });

  it('handles empty string ID', () => {
    const notes = [{ id: '', text: 'Empty ID' }];

    expect(initNoteIdCounter(notes)).toBe(0);
  });

  it('handles note-0 ID', () => {
    const notes = [{ id: 'note-0', text: 'Zero' }];

    // 0 is not > 0, so counter stays at 0
    expect(initNoteIdCounter(notes)).toBe(0);
  });

  it('handles null ID', () => {
    const notes = [{ id: null, text: 'Null ID' }];

    expect(initNoteIdCounter(notes)).toBe(0);
  });
});

describe('app.js - Note Factory', () => {
  it('generates sequential IDs starting from counter + 1', () => {
    const factory = createNoteFactory(0);

    const note1 = factory('First', 10, 20);
    const note2 = factory('Second', 30, 40);

    expect(note1.id).toBe('note-1');
    expect(note2.id).toBe('note-2');
  });

  it('continues from existing counter value', () => {
    const factory = createNoteFactory(5);

    const note = factory('Next', 10, 20);

    expect(note.id).toBe('note-6');
  });

  it('creates VmStickyNote instances', () => {
    const factory = createNoteFactory(0);

    const note = factory('Hello', 100, 200);

    expect(note).toBeInstanceOf(VmStickyNote);
    expect(note.text).toBe('Hello');
    expect(note.x).toBe(100);
    expect(note.y).toBe(200);
  });

  it('increments counter across multiple calls', () => {
    const factory = createNoteFactory(10);

    const ids = [];
    for (let i = 0; i < 5; i++) {
      ids.push(factory('Note', 0, 0).id);
    }

    expect(ids).toEqual(['note-11', 'note-12', 'note-13', 'note-14', 'note-15']);
  });

  it('sets createdAt to current time', () => {
    const factory = createNoteFactory(0);
    const before = new Date();
    const note = factory('Test', 0, 0);
    const after = new Date();

    expect(note.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(note.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
