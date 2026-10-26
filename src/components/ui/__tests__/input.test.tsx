import { createRef } from "react";
import type { TextInputInstance } from "react-native";

import { Input } from "@/components/ui/input";
import { renderWithTheme } from "@/test-helpers/theme";

describe("Input ref", () => {
  // tsc checks the ref type; the run checks the instance behind it.
  it("hands the caller the TextInput instance to focus and clear", async () => {
    const ref = createRef<TextInputInstance>();
    await renderWithTheme(<Input ref={ref} />);

    expect(typeof ref.current?.focus).toBe("function");
    expect(typeof ref.current?.clear).toBe("function");
  });
});
