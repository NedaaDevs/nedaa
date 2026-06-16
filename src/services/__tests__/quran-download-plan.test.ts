import { planEditionDownload } from "@/services/quran-download-plan";

const edition = {
  imagesVersion: "2026-06-16",
  metaVersion: "2026-06-16",
  requiresImages: "2026-06-16",
};

describe("planEditionDownload", () => {
  it("needs both legs on a fresh install (nothing installed, nothing on disk)", () => {
    expect(planEditionDownload({}, edition, false, false)).toEqual({
      needImages: true,
      needMeta: true,
    });
  });

  it("needs nothing when both are current and on disk", () => {
    const installed = { images: "2026-06-16", meta: "2026-06-16" };
    expect(planEditionDownload(installed, edition, true, true)).toEqual({
      needImages: false,
      needMeta: false,
    });
  });

  it("re-downloads only meta when bounds are missing but images are current", () => {
    const installed = { images: "2026-06-16", meta: "2026-06-16" };
    expect(planEditionDownload(installed, edition, true, false)).toEqual({
      needImages: false,
      needMeta: true,
    });
  });

  it("an images version bump forces BOTH (meta's requiresImages no longer matches)", () => {
    const installed = { images: "2026-05-01", meta: "2026-05-01" };
    expect(planEditionDownload(installed, edition, true, true)).toEqual({
      needImages: true,
      needMeta: true,
    });
  });

  it("a meta-only version bump re-downloads only meta", () => {
    const installed = { images: "2026-06-16", meta: "2026-05-01" };
    expect(planEditionDownload(installed, edition, true, true)).toEqual({
      needImages: false,
      needMeta: true,
    });
  });

  it("images present on disk but unknown installed version → re-download", () => {
    expect(planEditionDownload({}, edition, true, true)).toEqual({
      needImages: true,
      needMeta: true,
    });
  });
});
