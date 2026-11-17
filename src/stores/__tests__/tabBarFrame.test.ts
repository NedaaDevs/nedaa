import { useTabBarFrameStore } from "@/stores/tabBarFrame";

const covered = () => useTabBarFrameStore.getState().covers > 0;

describe("covering the tab bar", () => {
  afterEach(() => useTabBarFrameStore.setState({ covers: 0 }));

  it("stays covered until every cover is lifted", () => {
    const { cover } = useTabBarFrameStore.getState();
    expect(covered()).toBe(false);

    const liftFirst = cover();
    const liftSecond = cover();
    liftFirst();
    expect(covered()).toBe(true);

    liftSecond();
    expect(covered()).toBe(false);
  });

  it("lifts a cover once, however often it is asked", () => {
    const { cover } = useTabBarFrameStore.getState();
    const keep = cover();
    const lift = cover();
    lift();
    lift();

    expect(covered()).toBe(true);
    keep();
  });
});
