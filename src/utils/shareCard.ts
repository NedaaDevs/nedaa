import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

interface ShareCardArgs {
  ref: RefObject<View | null>;
  // Basename for the shared file, without extension.
  fileName: string;
  dialogTitle?: string;
}

// Captures a rendered view as a PNG and opens the OS share sheet. Copies the
// capture tmpfile to a named .png so the share sheet keeps "Save Image" and a
// meaningful attachment name. Returns false on capture/share failure or cancel;
// callers surface nothing (silent, matching the ayah share flow).
export const captureAndShare = async ({
  ref,
  fileName,
  dialogTitle,
}: ShareCardArgs): Promise<boolean> => {
  try {
    const uri = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
    const named = new File(Paths.cache, `${fileName}.png`);
    if (named.exists) named.delete();
    await new File(uri).copy(named);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(named.uri, { mimeType: "image/png", dialogTitle });
    }
    return true;
  } catch {
    return false;
  }
};
