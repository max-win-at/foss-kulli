/**
 * Foss Kulli - App Entry Point & IoC Container
 * Registers Alpine.js components and handles dependency injection
 */

// Note ID counter
let noteIdCounter = 0;

/**
 * Factory function for creating sticky notes
 * @param {string} text - Note content
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {VmStickyNote}
 */
function noteFactory(text, x, y) {
    const id = `note-${++noteIdCounter}`;
    return new VmStickyNote(id, text, x, y);
}

/**
 * Alpine.js data component for the whiteboard
 * This is the function called by x-data="vmWhiteBoard()"
 */
function vmWhiteBoard() {
    return new VmWhiteBoard(noteFactory);
}

// Make available globally for Alpine.js
window.vmWhiteBoard = vmWhiteBoard;
