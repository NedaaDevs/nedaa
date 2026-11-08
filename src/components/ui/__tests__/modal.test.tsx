import { BackHandler } from "react-native";
import { screen } from "@testing-library/react-native";

import { Modal, ModalContent } from "@/components/ui/modal";
import { androidBack } from "@/test-helpers/backHandler";
import { renderWithTheme } from "@/test-helpers/theme";

const LABEL = "Change city";

const dialog = (isOpen: boolean, onClose = jest.fn()) => (
  <Modal isOpen={isOpen} onClose={onClose}>
    <ModalContent />
  </Modal>
);

describe("Modal", () => {
  it("labels the dialog surface with the accessibilityLabel it is given", async () => {
    await renderWithTheme(
      <Modal isOpen accessibilityLabel={LABEL}>
        <ModalContent />
      </Modal>
    );

    expect(screen.getByLabelText(LABEL)).toBeTruthy();
  });

  // The dialog covers the screen, so back must not act on the screen under it.
  it("closes on Android's back while it is open", async () => {
    const pressBack = androidBack();
    const onClose = jest.fn();
    await renderWithTheme(dialog(true, onClose));

    expect(await pressBack()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // A caller's inline onClose is a new function on every render.
  it("leaves back to a dialog above it when its parent re-renders", async () => {
    const pressBack = androidBack();
    const onClose = jest.fn();
    await renderWithTheme(dialog(true));
    const above = jest.fn(() => true);
    BackHandler.addEventListener("hardwareBackPress", above);
    await screen.rerender(dialog(true, onClose));

    expect(await pressBack()).toBe(true);
    expect(above).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes through the onClose of its latest render", async () => {
    const pressBack = androidBack();
    const onClose = jest.fn();
    await renderWithTheme(dialog(true));
    await screen.rerender(dialog(true, onClose));

    await pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves Android's back to the screen once it closes", async () => {
    const pressBack = androidBack();
    await renderWithTheme(dialog(true));
    await screen.rerender(dialog(false));

    expect(await pressBack()).toBe(false);
  });
});
