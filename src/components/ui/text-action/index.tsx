import { Button, type ButtonIconProps } from "@/components/ui/button";
import { ICON_SIZES } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/** The gap a host sets between its actions and a text action under them. */
export const TEXT_ACTION_GAP = "$1.5";

type Props = {
  label: string;
  hint?: string;
  onPress: () => void;
  /** Set after the label, such as a chevron that points on. */
  icon?: ButtonIconProps["as"];
  testID?: string;
};

/** A text action at a card's start edge, its words flush with the copy. */
export const TextAction = ({ label, hint, onPress, icon, testID }: Props) => (
  <Button
    variant="link"
    testID={testID}
    onPress={onPress}
    accessibilityLabel={label}
    accessibilityHint={hint}
    alignSelf="flex-start"
    gap="$0.5"
    // Cancels the link's $inline inset, so the words line up with the copy.
    marginHorizontal="$-2"
    // The 44 pt target hangs into the card's padding, not below it.
    marginBottom="$-2.5">
    <Text size="md" fontWeight="600" color="$accentText" flexShrink={1}>
      {label}
    </Text>
    {icon ? <Button.Icon as={icon} size={ICON_SIZES.sm} /> : null}
  </Button>
);
