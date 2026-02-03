/**
 * Vitest global setup file.
 * Loads all source classes into globalThis so tests can import them,
 * and provides a clean localStorage before each test.
 */
import { loadSource } from "./helpers/load-source.js";

// Load source files in dependency order.
// MdlStickyNote must come first because VmWhiteBoard.init() references it.
loadSource("js/models/mdl-sticky-note.js", "MdlStickyNote");
loadSource("js/services/srv-local-storage.js", "SrvLocalStorage");
loadSource("js/viewmodels/vm-dom.js", "VmDom");
loadSource("js/viewmodels/vm-white-board.js", "VmWhiteBoard");

// Clear localStorage between tests to prevent leakage.
beforeEach(() => {
  localStorage.clear();
});
