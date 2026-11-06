import { View, type ViewProps } from "react-native";

/** expo-blur as a plain View that keeps its props; jest has no native blur. */
export const BlurView = (props: ViewProps) => <View {...props} />;
