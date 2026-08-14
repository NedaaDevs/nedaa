import { View } from "react-native";

import HizbMedallion from "@/components/quran/HizbMedallion";
import { BUNDLED_ORNAMENT_META, NEDAA_STYLE_ID } from "@/constants/Quran";
import { MushafVersion, OrnamentAsset, OrnamentCategory, QuranThemeType } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import { effectiveOrnamentStyle } from "@/utils/quranOrnaments";

interface HizbPageMarkerProps {
  rub: number;
  height: number;
  version: MushafVersion;
  quranTheme: QuranThemeType;
}

// Resolves the installed page-holder pack once, so every placement of the mark
// uses the same artwork and panel geometry as the current reader theme.
const HizbPageMarker = ({ rub, height, version, quranTheme }: HizbPageMarkerProps) => {
  const holderStyle = useQuranStore((s) =>
    effectiveOrnamentStyle(
      s.ornamentStyle[OrnamentCategory.PAGE_HOLDER],
      s.ornamentResolved[OrnamentCategory.PAGE_HOLDER]?.[version]
    )
  );
  const holderMeta =
    useQuranStore((s) => s.ornamentMeta[OrnamentCategory.PAGE_HOLDER]) ??
    BUNDLED_ORNAMENT_META[OrnamentCategory.PAGE_HOLDER];
  const packHizb = holderMeta.assets[OrnamentAsset.HIZB];
  const hizbMeta =
    packHizb ?? BUNDLED_ORNAMENT_META[OrnamentCategory.PAGE_HOLDER].assets[OrnamentAsset.HIZB];

  if (!hizbMeta) return null;

  return (
    <View pointerEvents="none" style={{ width: height * hizbMeta.aspect, height }}>
      <HizbMedallion
        rub={rub}
        width={height * hizbMeta.aspect}
        height={height}
        version={version}
        quranTheme={quranTheme}
        styleId={packHizb ? holderStyle : NEDAA_STYLE_ID}
        panel={hizbMeta.panel}
      />
    </View>
  );
};

export default HizbPageMarker;
