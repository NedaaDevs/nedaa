import { ScrollDirection } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";

jest.mock("expo-sqlite/kv-store", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const reset = (scrollDirection: ScrollDirection) =>
  useQuranStore.setState({
    scrollDirection,
    autoScrollPlaying: false,
    autoScrollPrevDirection: null,
  });

describe("quran store auto-scroll axis restore", () => {
  it("stashes the horizontal axis and switches to vertical on start", () => {
    reset(ScrollDirection.HORIZONTAL);
    useQuranStore.getState().setAutoScrollPlaying(true);
    const s = useQuranStore.getState();
    expect(s.autoScrollPlaying).toBe(true);
    expect(s.scrollDirection).toBe(ScrollDirection.VERTICAL);
    expect(s.autoScrollPrevDirection).toBe(ScrollDirection.HORIZONTAL);
  });

  it("stashes nothing when already vertical", () => {
    reset(ScrollDirection.VERTICAL);
    useQuranStore.getState().setAutoScrollPlaying(true);
    const s = useQuranStore.getState();
    expect(s.scrollDirection).toBe(ScrollDirection.VERTICAL);
    expect(s.autoScrollPrevDirection).toBeNull();
  });

  it("restores the stashed axis on stop and clears the stash", () => {
    reset(ScrollDirection.HORIZONTAL);
    useQuranStore.getState().setAutoScrollPlaying(true);
    useQuranStore.getState().setAutoScrollPlaying(false);
    const s = useQuranStore.getState();
    expect(s.autoScrollPlaying).toBe(false);
    expect(s.scrollDirection).toBe(ScrollDirection.HORIZONTAL);
    expect(s.autoScrollPrevDirection).toBeNull();
  });

  it("leaves the axis alone when stopping with no stash", () => {
    reset(ScrollDirection.VERTICAL);
    useQuranStore.getState().setAutoScrollPlaying(true);
    useQuranStore.getState().setAutoScrollPlaying(false);
    expect(useQuranStore.getState().scrollDirection).toBe(ScrollDirection.VERTICAL);
  });

  it("keeps the original stash when start is called twice", () => {
    reset(ScrollDirection.HORIZONTAL);
    useQuranStore.getState().setAutoScrollPlaying(true);
    useQuranStore.getState().setAutoScrollPlaying(true);
    expect(useQuranStore.getState().autoScrollPrevDirection).toBe(ScrollDirection.HORIZONTAL);
    useQuranStore.getState().setAutoScrollPlaying(false);
    expect(useQuranStore.getState().scrollDirection).toBe(ScrollDirection.HORIZONTAL);
  });

  it("toggles through the same start/stop rules", () => {
    reset(ScrollDirection.HORIZONTAL);
    useQuranStore.getState().toggleAutoScroll();
    expect(useQuranStore.getState().scrollDirection).toBe(ScrollDirection.VERTICAL);
    useQuranStore.getState().toggleAutoScroll();
    expect(useQuranStore.getState().autoScrollPlaying).toBe(false);
    expect(useQuranStore.getState().scrollDirection).toBe(ScrollDirection.HORIZONTAL);
  });

  it("drops the stash when the user picks an axis mid-glide", () => {
    reset(ScrollDirection.HORIZONTAL);
    useQuranStore.getState().setAutoScrollPlaying(true);
    useQuranStore.getState().setScrollDirection(ScrollDirection.VERTICAL);
    useQuranStore.getState().setAutoScrollPlaying(false);
    const s = useQuranStore.getState();
    expect(s.scrollDirection).toBe(ScrollDirection.VERTICAL);
    expect(s.autoScrollPrevDirection).toBeNull();
  });
});

describe("read-along takes exclusive control of the viewport", () => {
  const start = (scrollDirection: ScrollDirection) => {
    useQuranStore.setState({
      scrollDirection,
      autoScrollPlaying: false,
      autoScrollPrevDirection: null,
      readAlong: false,
    });
    useQuranStore.getState().setAutoScrollPlaying(true);
  };

  it("stops a running glide and restores the axis when switched on", () => {
    start(ScrollDirection.HORIZONTAL);
    useQuranStore.getState().setReadAlong(true);
    const s = useQuranStore.getState();
    expect(s.readAlong).toBe(true);
    expect(s.autoScrollPlaying).toBe(false);
    expect(s.scrollDirection).toBe(ScrollDirection.HORIZONTAL);
    expect(s.autoScrollPrevDirection).toBeNull();
  });

  it("stops a running glide when toggled on", () => {
    start(ScrollDirection.HORIZONTAL);
    useQuranStore.getState().toggleReadAlong();
    const s = useQuranStore.getState();
    expect(s.readAlong).toBe(true);
    expect(s.autoScrollPlaying).toBe(false);
    expect(s.scrollDirection).toBe(ScrollDirection.HORIZONTAL);
  });

  it("leaves the axis alone when switched off", () => {
    useQuranStore.setState({
      scrollDirection: ScrollDirection.VERTICAL,
      autoScrollPlaying: false,
      autoScrollPrevDirection: null,
      readAlong: true,
    });
    useQuranStore.getState().setReadAlong(false);
    const s = useQuranStore.getState();
    expect(s.readAlong).toBe(false);
    expect(s.scrollDirection).toBe(ScrollDirection.VERTICAL);
  });
});
