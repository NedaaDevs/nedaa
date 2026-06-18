import { mustDownloadBeforeOpen, needsContentUpdate } from "@/services/quranContentDbStrategy";

describe("mustDownloadBeforeOpen", () => {
  it("blocks on download only when no usable installed DB", () => {
    // installed + stamped → open immediately, no blocking download (the cold-start fix)
    expect(mustDownloadBeforeOpen(true, "5")).toBe(false);
    // no DB file → genuine first launch, must download
    expect(mustDownloadBeforeOpen(false, null)).toBe(true);
    // DB file but no version marker (interrupted/partial) → re-download
    expect(mustDownloadBeforeOpen(true, null)).toBe(true);
    // marker but no file (shouldn't happen) → re-download
    expect(mustDownloadBeforeOpen(false, "5")).toBe(true);
  });
});

describe("needsContentUpdate", () => {
  it("flags an update only when installed and manifest versions both exist and differ", () => {
    expect(needsContentUpdate("5", "6")).toBe(true);
    expect(needsContentUpdate("5", "5")).toBe(false);
    // offline / no manifest → no background update
    expect(needsContentUpdate("5", null)).toBe(false);
    // not installed → handled by the blocking path, not a background update
    expect(needsContentUpdate(null, "6")).toBe(false);
    expect(needsContentUpdate(null, null)).toBe(false);
  });
});
