/**
 * VmStickyNote - Sticky Note ViewModel
 * Represents a single sticky note with text and position
 */
class VmStickyNote {
  /**
   * @param {string} id - Unique identifier
   * @param {string} text - Note content
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string|Date} createdAt - Creation date
   * @param {boolean} deleted - Soft-delete flag
   */
  constructor(id, text, x, y, createdAt = new Date(), deleted = false) {
    // Direct properties for Alpine reactivity
    this.id = id;
    this.text = text;
    // Ensure x and y are valid numbers (default to 0 if undefined/null)
    this.x = typeof x === "number" ? x : 0;
    this.y = typeof y === "number" ? y : 0;
    // ensure we work with Date objects internally if passed as string/date
    this.createdAt = new Date(createdAt);
    // Soft-delete flag - notes with deleted=true are hidden but kept in array
    this.deleted = deleted;
  }

  get formattedDate() {
    return (
      this.createdAt.toLocaleDateString() +
      " " +
      this.createdAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }
}
