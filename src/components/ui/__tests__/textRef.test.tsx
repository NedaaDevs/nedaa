import { createRef, type ComponentRef } from "react";

import { Text } from "@/components/ui/text";
import { renderWithTheme } from "@/test-helpers/theme";

describe("Text ref", () => {
  // tsc checks the ref type; the run checks the instance behind it.
  it("hands the caller the native Text instance to measure", async () => {
    const ref = createRef<ComponentRef<typeof Text>>();
    await renderWithTheme(<Text ref={ref}>label</Text>);

    expect(typeof ref.current?.measure).toBe("function");
  });
});
