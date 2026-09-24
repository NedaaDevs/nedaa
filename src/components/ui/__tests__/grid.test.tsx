import { Text } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { GRID_PART, Grid } from "@/components/ui/grid";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const hidden = { includeHiddenElements: true };
const items = () => screen.getAllByTestId(GRID_PART.ITEM, hidden);
const widthOf = (node: ReturnType<typeof items>[number]) =>
  Object.assign({}, ...[node.props.style].flat(Infinity)).width;

const renderGrid = () =>
  renderWithTheme(
    <Grid columns={2} gap="$2">
      <Grid.Item key="a" wide>
        <Text>A</Text>
      </Grid.Item>
      {["b", "c", "d", "e"].map((key) => (
        <Grid.Item key={key}>
          <Text>{key}</Text>
        </Grid.Item>
      ))}
    </Grid>
  );
const layOut = (width: number) =>
  act(() =>
    fireEvent(screen.getByTestId(GRID_PART.ROOT, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width, height: 200 } },
    })
  );

describe("Grid", () => {
  beforeEach(() => {
    mockReduced = false;
  });

  // Every column equal, the $2 gap (8) taken out; a wide item fills the row.
  it("splits its width into equal columns and lets a wide item span them", async () => {
    await renderGrid();
    await layOut(358);

    expect(items().map(widthOf)).toEqual([358, 175, 175, 175, 175]);
  });

  // One parent for every item, so a reordered item glides to its new place.
  it("moves each item to a new place with a layout transition", async () => {
    await renderGrid();

    items().forEach((item) => expect(item.props.layout).toBeDefined());
  });

  it("moves items at once under reduced motion", async () => {
    mockReduced = true;
    await renderGrid();

    items().forEach((item) => expect(item.props.layout).toBeUndefined());
  });
});
