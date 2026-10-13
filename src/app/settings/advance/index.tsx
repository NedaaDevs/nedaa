import { Redirect } from "expo-router";

import { BACK_DESTINATION } from "@/constants/BackDestinations";

// /settings/advance opens the Calculation screen.
const AdvanceSettings = () => <Redirect href={BACK_DESTINATION.SETTINGS_PROVIDER.href} />;

export default AdvanceSettings;
