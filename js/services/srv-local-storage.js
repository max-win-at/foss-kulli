/**
 * SrvLocalStorage - Local Storage Service
 * Handles persistence for notes and trash
 */
class SrvLocalStorage {
  static STORAGE_KEY_NOTES = "foss_kulli_notes";
  static STORAGE_KEY_TRASH = "foss_kulli_trash";

  constructor() {}

  /**
   * Save active notes to local storage
   * @param {Array<VmStickyNote>} notes
   */
  saveNotes(notes) {
    const serialized = JSON.stringify(notes);
    localStorage.setItem(SrvLocalStorage.STORAGE_KEY_NOTES, serialized);
  }

  /**
   * Load active notes from local storage
   * @returns {Array<Object>} Plain objects, need hydration
   */
  loadNotes() {
    const json = localStorage.getItem(SrvLocalStorage.STORAGE_KEY_NOTES);
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error("Failed to parse notes from storage", e);
      return [];
    }
  }

  /**
   * Add a note to the trash
   * @param {VmStickyNote} note
   */
  moveToTrash(note) {
    const trash = this.loadTrash();
    // Add deletedAt timestamp
    const trashedItem = {
      ...note,
      deletedAt: new Date().toISOString(),
    };
    trash.push(trashedItem);
    this.saveTrash(trash);
  }

  /**
   * Save trash list
   * @param {Array} trashItems
   */
  saveTrash(trashItems) {
    localStorage.setItem(
      SrvLocalStorage.STORAGE_KEY_TRASH,
      JSON.stringify(trashItems),
    );
  }

  /**
   * Load trash items
   * @returns {Array}
   */
  loadTrash() {
    const json = localStorage.getItem(SrvLocalStorage.STORAGE_KEY_TRASH);
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error("Failed to parse trash from storage", e);
      return [];
    }
  }

  /**
   * Clean up trash older than retention days
   * @param {number} days
   */
  cleanupTrash(days) {
    const trash = this.loadTrash();
    if (trash.length === 0) return;

    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);

    const kept = trash.filter((item) => {
      if (!item.deletedAt) return false; // Invalid entry, remove
      const deletedDate = new Date(item.deletedAt);
      return deletedDate > limitDate;
    });

    if (kept.length !== trash.length) {
      this.saveTrash(kept);
      console.log(`Cleaned up ${trash.length - kept.length} old trash items.`);
    }
  }
}

// Export pattern will be handled by app.js (if using modules) or just class definition availability
// Since we are moving to Alpine.init injection, we don't need window.SrvLocalStorage assignment
// But currently files are included via script tags.
// Keeping the class definition global by default in non-module scripts?
// The user wants to "remove all direct access to the window or document object".
// Assigning TO window is adding access to window.
// So I should simply NOT do `window.SrvLogicStorage = ...`
// But if I don't, how does `app.js` see it?
// `app.js` is also a script tag.
// If they are all script tags, defining `class X {}` at top level puts it in global scope (window.X) automatically?
// No, `class` declarations are not hoisted and don't become properties of window automatically in strict mode or modules?
// In standard non-module script tags, `class X` does create a global `X`.
// But explicit assignment `window.X = X` is redundant but harmless, EXCEPT the user explicitly said "do not make object globally available via reference augmentation on the window".
// So I will REMOVE the explicit assignment.
