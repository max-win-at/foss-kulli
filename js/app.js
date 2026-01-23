/**
 * Foss Kulli - App Entry Point & IoC Container
 * Registers Alpine.js components and handles dependency injection
 */

document.addEventListener("alpine:init", () => {
  // 1. Instantiate Services/ViewModels
  const srvLocalStorage = new SrvLocalStorage();
  // Create VmDom and wrap in Alpine.reactive to allow subscription in VmWhiteBoard
  const vmDom = Alpine.reactive(new VmDom());

  // 2. Define Factories
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

  // 3. Create Singleton ViewModels
  const vmWhiteBoardInstance = new VmWhiteBoard(
    noteFactory,
    srvLocalStorage,
    vmDom,
  );

  // 4. Publish via Alpine.data
  // Using a closure to return the singleton instance
  Alpine.data("vmWhiteBoard", () => vmWhiteBoardInstance);
  Alpine.data("vmDom", () => vmDom);
});
