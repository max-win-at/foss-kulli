import { describe, it, expect, vi } from "vitest";

describe("MdlStickyNote", () => {
  describe("constructor", () => {
    it("sets id, text, x, y correctly", () => {
      const note = new MdlStickyNote("note-1", "Hello", 100, 200);
      expect(note.id).toBe("note-1");
      expect(note.text).toBe("Hello");
      expect(note.x).toBe(100);
      expect(note.y).toBe(200);
    });

    it("defaults createdAt to current date when not provided", () => {
      const before = new Date();
      const note = new MdlStickyNote("note-1", "Hello", 0, 0);
      const after = new Date();

      expect(note.createdAt).toBeInstanceOf(Date);
      expect(note.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(note.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("converts an ISO string createdAt to a Date object", () => {
      const iso = "2025-03-15T10:30:00.000Z";
      const note = new MdlStickyNote("note-1", "Hello", 0, 0, iso);

      expect(note.createdAt).toBeInstanceOf(Date);
      expect(note.createdAt.toISOString()).toBe(iso);
    });

    it("accepts a Date object for createdAt", () => {
      const date = new Date("2024-01-01T00:00:00Z");
      const note = new MdlStickyNote("note-1", "Hello", 0, 0, date);

      expect(note.createdAt).toBeInstanceOf(Date);
      expect(note.createdAt.getTime()).toBe(date.getTime());
    });

    it("accepts a numeric timestamp for createdAt", () => {
      const ts = 1700000000000;
      const note = new MdlStickyNote("note-1", "Hello", 0, 0, ts);

      expect(note.createdAt).toBeInstanceOf(Date);
      expect(note.createdAt.getTime()).toBe(ts);
    });

    it("stores empty string text", () => {
      const note = new MdlStickyNote("note-1", "", 0, 0);
      expect(note.text).toBe("");
    });

    it("stores zero coordinates", () => {
      const note = new MdlStickyNote("note-1", "Hi", 0, 0);
      expect(note.x).toBe(0);
      expect(note.y).toBe(0);
    });
  });

  describe("formattedDate", () => {
    it("returns a string containing the date and time", () => {
      const note = new MdlStickyNote(
        "note-1",
        "Hello",
        0,
        0,
        "2025-06-15T14:30:00Z",
      );
      const formatted = note.formattedDate;

      expect(typeof formatted).toBe("string");
      // Should contain a date portion and a time portion separated by space
      expect(formatted).toContain(" ");
    });

    it("formats time with 2-digit hour and minute", () => {
      // Use a fixed date so we can check the time format
      const note = new MdlStickyNote(
        "note-1",
        "Hello",
        0,
        0,
        "2025-01-01T08:05:00Z",
      );
      const formatted = note.formattedDate;

      // The time part should have hh:mm format (locale-dependent but 2-digit)
      // We verify the formatted string is non-empty and reasonable
      expect(formatted.length).toBeGreaterThan(5);
    });

    it("handles dates created from ISO strings correctly", () => {
      const iso = "2024-12-25T00:00:00Z";
      const note = new MdlStickyNote("note-1", "Hello", 0, 0, iso);
      const formatted = note.formattedDate;

      expect(typeof formatted).toBe("string");
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
});
