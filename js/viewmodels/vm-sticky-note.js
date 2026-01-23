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
   */
  constructor(id, text, x, y, createdAt = new Date()) {
    this.id = id;
    this.text = text;
    this.x = x;
    this.y = y;
    // ensure we work with Date objects internally if passed as string/date
    this.createdAt = new Date(createdAt);
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
