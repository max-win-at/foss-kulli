# Test Coverage Analysis - Foss Kulli

## Current State

**Test coverage: 0%** - The project has no testing infrastructure, no test files, no test runner, and no CI/CD pipeline for automated testing. There are 7 JavaScript source files totaling ~1,385 lines of application logic, none of which have corresponding tests.

---

## Source File Inventory

| File | Lines | Testability | Priority |
|------|-------|-------------|----------|
| `js/viewmodels/vm-white-board.js` | 598 | High | **Critical** |
| `js/pwa-register.js` | 282 | Medium | Low |
| `sw.js` | 269 | Medium | Low |
| `js/services/srv-local-storage.js` | 113 | High | **High** |
| `js/app.js` | 49 | Medium | Medium |
| `js/viewmodels/vm-dom.js` | 42 | Low | Low |
| `js/viewmodels/vm-sticky-note.js` | 32 | Very High | **High** |

---

## Recommended Testing Framework

Since the project is a vanilla JS application with no build system or `package.json`, the first step is to set up a lightweight test infrastructure:

- **Test Runner:** [Vitest](https://vitest.dev/) (fast, ESM-native, minimal config) or [Jest](https://jestjs.io/) (most widely adopted)
- **DOM Mocking:** `jsdom` environment (built into both Vitest and Jest)
- **localStorage Mock:** Manual mock or `jest-localstorage-mock`
- **No E2E framework needed initially** - unit and integration tests provide the highest value-to-effort ratio for this codebase

---

## Priority 1 (Critical): VmWhiteBoard - `vm-white-board.js`

This is the application's core logic hub at 598 lines. It manages note lifecycle, search, layout positioning, keyboard handling, and UI state. A bug here breaks the entire app.

### Pure Logic Functions (no DOM dependency, highest value)

#### `matchesSearch(note)`
- Returns `true` when query is empty or whitespace-only
- Returns `false` when note is null or note.text is null
- Performs case-insensitive substring match
- Handles edge cases: empty note text, special characters in query

#### `getNextNotePosition()`
- Returns `INITIAL_X, INITIAL_Y` when no notes exist
- Places next note to the right of the last note
- Wraps to the next row when viewport overflows
- Uses "Smart Wrap" logic: starts at `NOTE_GAP` (left edge) when below the stack area, or at `INITIAL_X` when beside the stack
- Includes the editing note in position calculations

#### `rearrangeNotes()`
- Repositions all notes to fit the current viewport width
- Applies the same Smart Wrap row logic as `getNextNotePosition`
- Includes the editing note in the layout
- Calls `save()` after rearranging

#### `applySearchFilter()`
- Saves original positions before first filter application
- Filters notes by match and sorts by `createdAt` descending (newest first)
- Repositions matching notes using the standard layout algorithm
- Restores original positions when search query is cleared

#### `restorePositions()`
- Restores positions from the saved `_originalPositions` map
- Clears the map after restoring
- No-ops when no positions are saved

### State Management (testable with mocks)

#### `confirmEditing()`
- Adds the editing note to `notes[]` if text is non-empty after trimming
- Saves to storage
- Clears `editingNote` to null
- Stops icon animation

#### `cancelEditing()`
- Adds the editing note back to `notes[]` if text is non-empty (preserves work)
- Clears `editingNote` to null
- Stops icon animation

#### `deleteEditingNote()`
- Moves note to trash via storage service
- Clears editing state after 300ms animation delay
- Saves after deletion

#### `createNote(text)`
- Creates a note at the next calculated position
- Adds to `notes[]` and saves

#### `editNote(note)`
- Confirms any currently editing note first
- Removes the target note from `notes[]`
- Sets it as `editingNote`
- Starts icon animation

#### `onKeyDown(event)`
- Ignores input when search or about popup is open
- Ignores modifier key combos (Ctrl, Meta, Alt)
- Ignores special keys (Escape, Tab, Shift, Control, Alt, Meta, CapsLock)
- Ignores input when already editing
- Starts editing on single printable characters

#### `onEditingKeyDown(event)`
- Ctrl+Enter or Cmd+Enter confirms editing
- Escape cancels editing
- All other keys pass through for normal typing

#### `onPaste(event)`
- Ignores paste when popup is open
- Ignores paste when already editing (lets contenteditable handle it)
- Creates a new note from clipboard text
- Trims and validates non-empty text

#### Toggle and popup methods
- `toggleSearch()`: toggles search, closes about
- `toggleAbout()`: toggles about, closes search
- `closePopups()`: closes both
- `clearSearch()`: resets query and restores positions

### Suggested Test Cases: ~45-55 unit tests

---

## Priority 2 (High): SrvLocalStorage - `srv-local-storage.js`

This is the persistence layer. Data loss bugs here are unrecoverable.

### `saveNotes(notes)` / `loadNotes()`
- Serializes notes array to JSON and stores under the correct key
- Returns empty array when no data exists
- Returns empty array on corrupted/invalid JSON (error recovery)
- Round-trip: save then load returns equivalent data

### `moveToTrash(note)`
- Appends note to trash with `deletedAt` ISO timestamp
- Preserves existing trash items
- Spreads note properties correctly

### `loadTrash()` / `saveTrash(trashItems)`
- Same empty/corrupted handling as notes
- Correctly persists trash array

### `cleanupTrash(days)`
- Removes items older than the retention period
- Keeps items within the retention period
- Removes items with missing `deletedAt` (invalid entries)
- No-ops on empty trash
- Only writes when items are actually removed (optimization check)

### Suggested Test Cases: ~20-25 unit tests

---

## Priority 3 (High): VmStickyNote - `vm-sticky-note.js`

Small but foundational. Every other component depends on this model being correct.

### Constructor
- Sets `id`, `text`, `x`, `y` correctly
- Defaults `createdAt` to current date when not provided
- Converts string dates to Date objects
- Converts Date objects passed as `createdAt`

### `formattedDate` getter
- Returns locale-formatted date and time string
- Formats time with 2-digit hour and minute
- Handles various date inputs (ISO strings, timestamps, Date objects)

### Suggested Test Cases: ~8-10 unit tests

---

## Priority 4 (Medium): app.js - IoC Container

### Note ID Counter Logic
- Initializes to 0 when no existing notes
- Finds the highest `note-N` ID from existing notes
- Ignores notes without IDs or non-matching ID formats
- Handles non-numeric suffixes gracefully (`isNaN` check)

### Note Factory
- Generates sequential IDs (`note-1`, `note-2`, ...)
- Creates VmStickyNote with correct parameters
- Counter increments across multiple calls

### Suggested Test Cases: ~8-12 unit tests

---

## Priority 5 (Low): VmDom - `vm-dom.js`

### `onResize()`
- Updates `viewportWidth` and `viewportHeight` from `window.innerWidth/Height`

### `moveCursorToEnd(element)`
- No-ops when element is null
- Creates range, collapses to end, and sets selection
- Requires DOM mocking - lower value relative to effort

### Suggested Test Cases: ~4-6 unit tests

---

## Priority 6 (Low): PWAManager - `pwa-register.js`

Heavily coupled to browser APIs (`navigator.serviceWorker`, `window.matchMedia`, DOM manipulation). Testing provides value but requires extensive mocking.

### Key areas to test
- `isStandalone()` - checks display mode, navigator.standalone, and referrer
- `promptInstall()` - guards against missing install event, clears state after prompt
- `applyUpdate()` - sends SKIP_WAITING message to waiting worker
- `dismissUpdate()` - hides update banner

### Suggested Test Cases: ~10-15 unit tests (with mocks)

---

## Priority 7 (Low): Service Worker - `sw.js`

Service workers require specialized testing environments. Consider deferring to integration/E2E tests.

### Key areas to test
- `fetchAndCache()` - the only extractable pure-ish function
- Cache cleanup logic in activate event
- Correct routing of requests (Google Fonts, Tailwind CDN, local assets)
- Message handling (SKIP_WAITING, CLEAR_CACHE)

### Suggested Test Cases: ~10-15 unit tests (requires SW test environment)

---

## Summary of Recommended Test Plan

### Phase 1: Foundation (highest impact)
1. Set up `package.json` with Vitest (or Jest) + jsdom
2. Write tests for **VmStickyNote** (~10 tests) - quickest win, validates the data model
3. Write tests for **SrvLocalStorage** (~25 tests) - protects against data loss, uses simple localStorage mock
4. Write tests for **VmWhiteBoard pure logic** (~30 tests) - `matchesSearch`, `getNextNotePosition`, `rearrangeNotes`, `applySearchFilter`

### Phase 2: Interaction Logic
5. Write tests for **VmWhiteBoard state management** (~20 tests) - confirm/cancel/delete editing, create note, toggle popups
6. Write tests for **VmWhiteBoard event handlers** (~15 tests) - `onKeyDown`, `onEditingKeyDown`, `onPaste`
7. Write tests for **app.js IoC logic** (~10 tests) - ID counter, factory

### Phase 3: Browser-Dependent Code
8. Write tests for **VmDom** (~5 tests)
9. Write tests for **PWAManager** (~15 tests)
10. Write tests for **Service Worker** (~15 tests)

### Estimated total: ~145 unit tests across all phases

### Coverage targets
| Phase | Estimated Line Coverage | Files Covered |
|-------|------------------------|---------------|
| Phase 1 | ~55% | 3 of 7 files |
| Phase 2 | ~80% | 4 of 7 files |
| Phase 3 | ~95% | 7 of 7 files |

---

## Key Risks Identified (Untested)

These are areas where the lack of tests poses the greatest risk of user-facing bugs:

1. **Note position calculation overflow** (`getNextNotePosition`, `rearrangeNotes`) - Incorrect wrapping could cause notes to render off-screen or overlap. The Smart Wrap logic has two distinct code paths that must be tested with various viewport widths.

2. **Search filter position corruption** (`applySearchFilter`, `restorePositions`) - If original positions are not saved/restored correctly, clearing a search could permanently scramble note positions.

3. **Data persistence round-trip** (`saveNotes`/`loadNotes`) - Silent data corruption on JSON parse failure returns an empty array, which could cause data loss if `saveNotes` is subsequently called with the empty result.

4. **Trash cleanup date arithmetic** (`cleanupTrash`) - Off-by-one errors in date comparison could prematurely delete or indefinitely retain trashed notes.

5. **Note ID counter initialization** (`app.js`) - If the counter doesn't correctly find the max existing ID, new notes could collide with existing IDs, causing data corruption.

6. **Editing state machine** (`editNote` -> `confirmEditing`/`cancelEditing`/`deleteEditingNote`) - Complex state transitions where a bug could lose note content. For example, `editNote` removes the note from the list before editing begins; if the app crashes mid-edit, the note is lost.
