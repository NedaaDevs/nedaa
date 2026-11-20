import { View, type ViewProps } from "react-native";

/** Test id of every mocked blur that is given none of its own. */
export const BLUR_MOCK_ID = "blur-view";

/** expo-blur as a plain View that keeps its props; jest has no native blur. */
export const BlurView = (props: ViewProps) => <View testID={BLUR_MOCK_ID} {...props} />;
