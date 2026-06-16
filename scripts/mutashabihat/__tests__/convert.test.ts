import { convertWaqar144 } from "../convert";

describe("convertWaqar144", () => {
  // tiny fake absolute→"surah:ayah" map for the test
  const map: Record<number, string> = { 1: "1:1", 2: "1:2", 3: "1:3", 5: "2:1", 6: "2:2" };
  const absToKey = (abs: number): string | undefined => map[abs];

  it("flattens juz keys, expands array ayahs, dedupes bidirectional, builds a sorted id", () => {
    const raw = {
      "1": [
        { src: { ayah: 1 }, muts: [{ ayah: 5 }] },
        { src: { ayah: 5 }, muts: [{ ayah: 1 }] }, // reverse dup
        { src: { ayah: [2, 3] }, muts: [{ ayah: 6 }], ctx: 2 }, // array + ctx
      ],
    };
    const groups = convertWaqar144(raw, absToKey);

    expect(groups).toHaveLength(2);

    const g1 = groups.find((g) => g.id === "1:1,2:1")!;
    expect(g1.members).toEqual(["1:1", "2:1"]);
    expect(g1.showContext).toBe(0);

    const g2 = groups.find((g) => g.id === "1:2,1:3,2:2")!;
    expect(g2.members).toEqual(["1:2", "1:3", "2:2"]);
    expect(g2.showContext).toBe(2);
  });

  it("drops entries with unmapped absolute numbers or fewer than 2 members", () => {
    expect(convertWaqar144({ "1": [{ src: { ayah: 1 }, muts: [{ ayah: 999 }] }] }, absToKey)).toEqual(
      []
    );
    expect(convertWaqar144({ "1": [{ src: { ayah: 1 }, muts: [{ ayah: 1 }] }] }, absToKey)).toEqual(
      []
    );
  });
});
