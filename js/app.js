/**
 * Foss Kulli - App Entry Point & IoC Container
 * Registers Alpine.js components and handles dependency injection
 */

document.addEventListener("alpine:init", () => {
  // 1. Configuration
  const whiteBoardConfig = {
    noteWidth: 180,
    noteHeight: 180,
    noteGap: 20,
    initialX: 240, // 24px (left) + 180px (width) + 36px (gap)
    initialY: 24, // Align with top of stack
  };

  const pwaConfig = {
    swPath: "/sw.js",
    swScope: "/",
  };

  const storageConfig = {
    notesKey: "foss_kulli_notes",
    trashKey: "foss_kulli_trash",
  };

  const domSelectors = {
    noteEditor: ".note-editor",
    stickyNote: ".sticky-note",
    fab: ".fab",
    popup: ".popup",
    emptyStateContainer: ".empty-state-container",
    selectedNoteMenu: ".selected-note-menu",
    editingClass: "editing",
  };

  // 2. Instantiate Services/ViewModels with constructor parameter injection
  const srvLocalStorage = new SrvLocalStorage(storageConfig);
  // Create VmDom with injected window/document/selectors and wrap in Alpine.reactive
  const vmDom = Alpine.reactive(new VmDom(window, document, domSelectors));
  // Create VmPwa with injected dependencies and wrap in Alpine.reactive
  const vmPwa = Alpine.reactive(new VmPwa(window, navigator, pwaConfig));

  // 3. Define Factories
  // Initialize counter based on existing notes to avoid duplicate IDs
  const existingNotes = srvLocalStorage.loadNotes();
  let noteIdCounter = 0;
  for (const note of existingNotes) {
    if (note.id && note.id.startsWith("note-")) {
      const num = parseInt(note.id.replace("note-", ""), 10);
      if (!isNaN(num) && num > noteIdCounter) {
        noteIdCounter = num;
      }
    }
  }

  /**
   * Factory function for creating sticky notes
   * @param {string} text - Note content
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {MdlStickyNote}
   */
  const noteFactory = (text, x, y) => {
    const id = `note-${++noteIdCounter}`;
    return new MdlStickyNote(id, text, x, y);
  };

  // 4. Create Singleton ViewModels with injected dependencies
  const vmWhiteBoardInstance = new VmWhiteBoard(
    noteFactory,
    srvLocalStorage,
    vmDom,
    whiteBoardConfig,
  );

  // 5. Publish via Alpine.data
  // Using a closure to return the singleton instance
  Alpine.data("vmWhiteBoard", () => vmWhiteBoardInstance);
  Alpine.data("vmDom", () => vmDom);
  Alpine.data("vmPwa", () => vmPwa);
});
