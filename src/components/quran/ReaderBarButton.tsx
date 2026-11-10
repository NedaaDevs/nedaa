import type { ReactNode } from "react";

import { Pressable } from "@/components/ui/pressable";

type Props = { onPress: () => void; label: string; children: ReactNode };

/** A reader top-bar control: its icon centred in a `$target` square. */
const ReaderBarButton = ({ onPress, label, children }: Props) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    alignItems="center"
    justifyContent="center">
    {children}
  </Pressable>
);

export default ReaderBarButton;
