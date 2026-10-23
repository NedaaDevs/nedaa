import { useState } from "react";
import { Text } from "react-native";
import { screen } from "@testing-library/react-native";

import { LIST_GROUP_PART, ListGroup } from "@/components/ui/list-group";
import { ELEVATION } from "@/constants/Elevation";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { renderWithTheme } from "@/test-helpers/theme";

const mounts: string[] = [];

/** Records each mount, so a test can tell a kept row from a remounted one. */
const Remembers = ({ label }: { label: string }) => {
  useState(() => mounts.push(label));
  return <Text>{label}</Text>;
};

const dividers = () =>
  screen.queryAllByTestId(LIST_GROUP_PART.DIVIDER, { includeHiddenElements: true });

describe("ListGroup", () => {
  it("draws one resting surface round its rows, with no border", async () => {
    await renderWithTheme(
      <ListGroup testID="group">
        <Text>one</Text>
      </ListGroup>
    );

    const group = screen.getByTestId("group");
    expect(group).not.toHaveStyle({ borderTopWidth: 1 });
    expect(group).toHaveStyle({
      backgroundColor: NEDAA_LIGHT.surfaceGlass.hex,
      boxShadow: ELEVATION.e1.boxShadow.light,
      overflow: "hidden",
    });
  });

  // A rule between rows, never above the first or below the last.
  it("rules between its rows only", async () => {
    await renderWithTheme(
      <ListGroup>
        <Text>one</Text>
        <Text>two</Text>
        <Text>three</Text>
      </ListGroup>
    );

    expect(dividers()).toHaveLength(2);
  });

  // A row gated off leaves no rule behind.
  it("skips rows that are not shown", async () => {
    await renderWithTheme(
      <ListGroup>
        <Text>one</Text>
        {false}
        {null}
        <Text>two</Text>
      </ListGroup>
    );

    expect(dividers()).toHaveLength(1);
  });

  // A keyed row stays mounted when a row before it goes.
  it("keeps each row by its own key", async () => {
    mounts.length = 0;
    const rows = (withA: boolean) => (
      <ListGroup>
        {withA ? <Remembers key="a" label="a" /> : null}
        <Remembers key="b" label="b" />
      </ListGroup>
    );
    await renderWithTheme(rows(true));

    await screen.rerender(rows(false));

    expect(mounts.filter((label) => label === "b")).toHaveLength(1);
  });
});
