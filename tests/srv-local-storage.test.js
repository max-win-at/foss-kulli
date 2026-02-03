import { describe, it, expect, vi, beforeEach } from "vitest";

// Test configuration for storage keys
const TEST_STORAGE_CONFIG = {
  notesKey: "foss_kulli_notes",
  trashKey: "foss_kulli_trash",
};

describe("SrvLocalStorage", () => {
  let srv;

  beforeEach(() => {
    srv = new SrvLocalStorage(TEST_STORAGE_CONFIG);
  });

  // ─── saveNotes / loadNotes ───────────────────────────────────

  describe("saveNotes / loadNotes", () => {
    it("round-trips an array of notes", () => {
      const notes = [
        { id: "note-1", text: "Hello", x: 10, y: 20 },
        { id: "note-2", text: "World", x: 30, y: 40 },
      ];
      srv.saveNotes(notes);
      const loaded = srv.loadNotes();

      expect(loaded).toEqual(notes);
    });

    it("returns empty array when no data exists", () => {
      expect(srv.loadNotes()).toEqual([]);
    });

    it("returns empty array on corrupted JSON", () => {
      localStorage.setItem(TEST_STORAGE_CONFIG.notesKey, "{bad json");
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(srv.loadNotes()).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("overwrites previous data on save", () => {
      srv.saveNotes([{ id: "note-1", text: "First" }]);
      srv.saveNotes([{ id: "note-2", text: "Second" }]);

      const loaded = srv.loadNotes();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe("note-2");
    });

    it("saves empty array", () => {
      srv.saveNotes([{ id: "note-1", text: "Hi" }]);
      srv.saveNotes([]);

      expect(srv.loadNotes()).toEqual([]);
    });

    it("stores data under the correct key", () => {
      srv.saveNotes([{ id: "note-1" }]);
      const raw = localStorage.getItem("foss_kulli_notes");

      expect(raw).toBeTruthy();
      expect(JSON.parse(raw)).toEqual([{ id: "note-1" }]);
    });
  });

  // ─── moveToTrash ─────────────────────────────────────────────

  describe("moveToTrash", () => {
    it("adds a note to trash with a deletedAt timestamp", () => {
      const note = { id: "note-1", text: "Goodbye", x: 10, y: 20 };
      srv.moveToTrash(note);

      const trash = srv.loadTrash();
      expect(trash).toHaveLength(1);
      expect(trash[0].id).toBe("note-1");
      expect(trash[0].text).toBe("Goodbye");
      expect(trash[0].deletedAt).toBeTruthy();
      // deletedAt should be a valid ISO date string
      expect(new Date(trash[0].deletedAt).toISOString()).toBe(
        trash[0].deletedAt,
      );
    });

    it("preserves existing trash items", () => {
      srv.moveToTrash({ id: "note-1", text: "First" });
      srv.moveToTrash({ id: "note-2", text: "Second" });

      const trash = srv.loadTrash();
      expect(trash).toHaveLength(2);
      expect(trash[0].id).toBe("note-1");
      expect(trash[1].id).toBe("note-2");
    });

    it("spreads all note properties into the trash item", () => {
      const note = {
        id: "note-1",
        text: "Hi",
        x: 100,
        y: 200,
        createdAt: "2025-01-01",
      };
      srv.moveToTrash(note);

      const trashed = srv.loadTrash()[0];
      expect(trashed.x).toBe(100);
      expect(trashed.y).toBe(200);
      expect(trashed.createdAt).toBe("2025-01-01");
    });
  });

  // ─── loadTrash / saveTrash ───────────────────────────────────

  describe("loadTrash / saveTrash", () => {
    it("returns empty array when no trash exists", () => {
      expect(srv.loadTrash()).toEqual([]);
    });

    it("round-trips trash items", () => {
      const items = [
        { id: "note-1", deletedAt: "2025-01-01T00:00:00.000Z" },
        { id: "note-2", deletedAt: "2025-02-01T00:00:00.000Z" },
      ];
      srv.saveTrash(items);

      expect(srv.loadTrash()).toEqual(items);
    });

    it("returns empty array on corrupted trash JSON", () => {
      localStorage.setItem(TEST_STORAGE_CONFIG.trashKey, "not-json");
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(srv.loadTrash()).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("stores trash under the correct key", () => {
      srv.saveTrash([{ id: "note-1" }]);
      const raw = localStorage.getItem("foss_kulli_trash");

      expect(raw).toBeTruthy();
      expect(JSON.parse(raw)).toEqual([{ id: "note-1" }]);
    });
  });

  // ─── cleanupTrash ────────────────────────────────────────────

  describe("cleanupTrash", () => {
    it("removes items older than the retention period", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      srv.saveTrash([{ id: "note-old", deletedAt: oldDate.toISOString() }]);

      srv.cleanupTrash(30);

      expect(srv.loadTrash()).toEqual([]);
    });

    it("keeps items within the retention period", () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      srv.saveTrash([
        { id: "note-recent", deletedAt: recentDate.toISOString() },
      ]);

      srv.cleanupTrash(30);

      const trash = srv.loadTrash();
      expect(trash).toHaveLength(1);
      expect(trash[0].id).toBe("note-recent");
    });

    it("removes items with missing deletedAt as invalid entries", () => {
      srv.saveTrash([{ id: "note-no-date" }]);

      srv.cleanupTrash(30);

      expect(srv.loadTrash()).toEqual([]);
    });

    it("handles a mix of old, recent, and invalid entries", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2);

      srv.saveTrash([
        { id: "note-old", deletedAt: oldDate.toISOString() },
        { id: "note-recent", deletedAt: recentDate.toISOString() },
        { id: "note-invalid" },
      ]);

      srv.cleanupTrash(30);

      const trash = srv.loadTrash();
      expect(trash).toHaveLength(1);
      expect(trash[0].id).toBe("note-recent");
    });

    it("no-ops on empty trash", () => {
      const saveSpy = vi.spyOn(srv, "saveTrash");

      srv.cleanupTrash(30);

      expect(saveSpy).not.toHaveBeenCalled();
      saveSpy.mockRestore();
    });

    it("does not write when no items are removed", () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 1);

      srv.saveTrash([
        { id: "note-recent", deletedAt: recentDate.toISOString() },
      ]);

      const saveSpy = vi.spyOn(srv, "saveTrash");
      srv.cleanupTrash(30);

      // saveTrash should NOT be called because no items were removed
      expect(saveSpy).not.toHaveBeenCalled();
      saveSpy.mockRestore();
    });

    it("writes when at least one item is removed", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      srv.saveTrash([{ id: "note-old", deletedAt: oldDate.toISOString() }]);

      const saveSpy = vi.spyOn(srv, "saveTrash");
      srv.cleanupTrash(30);

      expect(saveSpy).toHaveBeenCalledOnce();
      saveSpy.mockRestore();
    });
  });

  // ─── instance config keys ─────────────────────────────────────────────

  describe("instance config keys", () => {
    it("has the expected notes storage key from config", () => {
      expect(srv._notesKey).toBe("foss_kulli_notes");
    });

    it("has the expected trash storage key from config", () => {
      expect(srv._trashKey).toBe("foss_kulli_trash");
    });
  });
});
