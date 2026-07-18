import { Appearance, Image } from "react-native";

// The Nedaa logo shown as Now Playing artwork on the Lock Screen / Control
// Center while audio plays. Resolves the bundled app icon to a URI the native
// media session can load; the dark scheme uses the dark-background variant.
export const resolveNowPlayingArtwork = (): string | undefined => {
  try {
    const isDark = Appearance.getColorScheme() === "dark";
    const source = isDark
      ? Image.resolveAssetSource(require("../../assets/images/ios-dark.png"))
      : Image.resolveAssetSource(require("../../assets/images/icon.png"));
    return source?.uri;
  } catch {
    return undefined;
  }
};
