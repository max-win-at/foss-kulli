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
     */
    constructor(id, text, x, y) {
        this.id = id;
        this.text = text;
        this.x = x;
        this.y = y;
    }
}

// Make available globally for non-module scripts
window.VmStickyNote = VmStickyNote;
