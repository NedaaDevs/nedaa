// React Native ships its CSS gradient parser untyped; the sky tests use it.
declare module "react-native/Libraries/StyleSheet/processBackgroundImage" {
  type ColorStop = { color: number; position: number | string | null };
  type ParsedGradient =
    | {
        type: "linear-gradient";
        direction: { type: "angle"; value: number } | { type: "keyword"; value: string };
        colorStops: ColorStop[];
      }
    | { type: "radial-gradient"; colorStops: ColorStop[] };

  /** One entry per accepted gradient; empty when any token is invalid. */
  export default function processBackgroundImage(input: string): ParsedGradient[];
}
