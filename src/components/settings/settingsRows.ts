import type { ParseKeys } from "i18next";
import {
  AlarmClock,
  Bell,
  CalendarDays,
  CirclePlus,
  FileText,
  Globe,
  Info,
  LayoutGrid,
  MapPin,
  SlidersHorizontal,
  Sun,
} from "lucide-react-native";

import type { IconProps } from "@/components/ui/icon";
import { BACK_DESTINATION, type BackDestination } from "@/constants/BackDestinations";
import { SETTINGS_ROW, type SettingsRowId } from "@/constants/SettingsRoot";

type SettingsRowTarget = {
  destination: BackDestination;
  /** One glyph per destination, wherever a link to it is drawn. */
  icon: IconProps["as"];
  /** The row's name when it differs from the screen's own title. */
  titleKey?: ParseKeys;
};

/** Where each Settings root row leads, and what it is called. */
export const SETTINGS_ROWS: Record<SettingsRowId, SettingsRowTarget> = {
  [SETTINGS_ROW.PREFERENCES]: {
    destination: BACK_DESTINATION.SETTINGS_PREFERENCES,
    icon: FileText,
  },
  [SETTINGS_ROW.APPEARANCE]: {
    destination: BACK_DESTINATION.SETTINGS_THEME,
    icon: Sun,
  },
  [SETTINGS_ROW.LANGUAGE]: {
    destination: BACK_DESTINATION.SETTINGS_LANGUAGE,
    icon: Globe,
  },
  [SETTINGS_ROW.LOCATION]: {
    destination: BACK_DESTINATION.SETTINGS_LOCATION,
    icon: MapPin,
  },
  // The screen holds more, but the method is what the row reports. The glyph
  // matches the prayer sheet's Adjustment row, which opens the same screen.
  [SETTINGS_ROW.CALCULATION]: {
    destination: BACK_DESTINATION.SETTINGS_PROVIDER,
    icon: SlidersHorizontal,
    titleKey: "providers.aladhan.method.title",
  },
  [SETTINGS_ROW.HIJRI]: {
    destination: BACK_DESTINATION.SETTINGS_HIJRI,
    icon: CalendarDays,
    // The offset is the summary, so the title names only the date.
    titleKey: "settings.rows.hijri",
  },
  [SETTINGS_ROW.NOTIFICATIONS]: {
    destination: BACK_DESTINATION.SETTINGS_NOTIFICATION,
    icon: Bell,
  },
  [SETTINGS_ROW.ALARMS]: {
    destination: BACK_DESTINATION.SETTINGS_ALARM,
    icon: AlarmClock,
  },
  [SETTINGS_ROW.ATHKAR]: {
    destination: BACK_DESTINATION.SETTINGS_ATHKAR,
    icon: CirclePlus,
  },
  [SETTINGS_ROW.WIDGETS]: {
    destination: BACK_DESTINATION.SETTINGS_WIDGETS,
    icon: LayoutGrid,
  },
  [SETTINGS_ROW.ABOUT]: {
    destination: BACK_DESTINATION.SETTINGS_ABOUT,
    icon: Info,
  },
};
