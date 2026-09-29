import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { useAppCovered, useCoverApp } from "@/components/ui/actionsheet/cover";

const COVERED = "covered";
const UNCOVERED = "uncovered";

const Sheet = ({ open }: { open: boolean }) => {
  useCoverApp(open);
  return null;
};

const App = () => <Text>{useAppCovered() ? COVERED : UNCOVERED}</Text>;

const renderSheets = (first: boolean, second = false) =>
  render(
    <>
      <App />
      <Sheet open={first} />
      <Sheet open={second} />
    </>
  );

describe("useCoverApp", () => {
  it("leaves the app uncovered while no sheet is open", async () => {
    await renderSheets(false);

    expect(screen.getByText(UNCOVERED)).toBeOnTheScreen();
  });

  it("covers the app while a sheet is open", async () => {
    await renderSheets(true);

    expect(screen.getByText(COVERED)).toBeOnTheScreen();
  });

  it("uncovers the app once the last open sheet closes", async () => {
    await renderSheets(true, true);

    await screen.rerender(
      <>
        <App />
        <Sheet open={false} />
        <Sheet open />
      </>
    );
    expect(screen.getByText(COVERED)).toBeOnTheScreen();

    await screen.rerender(
      <>
        <App />
        <Sheet open={false} />
        <Sheet open={false} />
      </>
    );
    expect(screen.getByText(UNCOVERED)).toBeOnTheScreen();
  });

  // A sheet unmounted while open must not leave the app hidden from readers.
  it("uncovers the app when an open sheet unmounts", async () => {
    await renderSheets(true);

    await screen.rerender(<App />);

    expect(screen.getByText(UNCOVERED)).toBeOnTheScreen();
  });
});
