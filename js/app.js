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
    initialY: 24,  // Align with top of stack
  };

  // 2. Instantiate Services/ViewModels with constructor parameter injection
  const srvLocalStorage = new SrvLocalStorage();
  // Create VmDom with injected window/document and wrap in Alpine.reactive
  const vmDom = Alpine.reactive(new VmDom(window, document));

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
   * @returns {VmStickyNote}
   */
  const noteFactory = (text, x, y) => {
    const id = `note-${++noteIdCounter}`;
    return new VmStickyNote(id, text, x, y);
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
});
