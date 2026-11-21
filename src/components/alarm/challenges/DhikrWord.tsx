import { Text, type TextProps } from "@/components/ui/text";
import { Face } from "@/components/ui/text/face";
import { FONT_LANGUAGE } from "@/constants/Fonts";

type Props = Omit<TextProps, "fontSize" | "lineHeight" | "style" | "children"> & {
  children: string;
  /** The type size; its line box must clear the tashkeel. */
  type: { fontSize: number; lineHeight: number };
};

const RIGHT_TO_LEFT = { writingDirection: "rtl" } as const;

/** Dhikr text as written, in the Arabic face, in any app language. */
const DhikrWord = ({ children, type, ...props }: Props) => (
  <Face language={FONT_LANGUAGE.ARABIC}>
    <Text
      color="$fg"
      fontWeight="500"
      {...props}
      fontSize={type.fontSize}
      lineHeight={type.lineHeight}
      // Joined letters break under any tracking, so Latin's tightening is off.
      letterSpacing={undefined}
      style={RIGHT_TO_LEFT}>
      {children}
    </Text>
  </Face>
);

export default DhikrWord;
