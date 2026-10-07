import { screen } from "@testing-library/react-native";

import { Modal, ModalContent } from "@/components/ui/modal";
import { renderWithTheme } from "@/test-helpers/theme";

const LABEL = "Change city";

describe("Modal", () => {
  it("labels the dialog surface with the accessibilityLabel it is given", async () => {
    await renderWithTheme(
      <Modal isOpen accessibilityLabel={LABEL}>
        <ModalContent />
      </Modal>
    );

    expect(screen.getByLabelText(LABEL)).toBeTruthy();
  });
});
