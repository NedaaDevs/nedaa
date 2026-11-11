import { FC } from "react";
import { useTranslation } from "react-i18next";

import { SegmentedChoice } from "@/components/ui/segmented-choice";

import { ALARM_VOLUME_STEPS } from "@/types/alarm";

type Props = {
  value: number;
  onChange: (volume: number) => void;
};

const VolumeSlider: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();

  return (
    <SegmentedChoice
      options={ALARM_VOLUME_STEPS}
      value={value}
      onChange={onChange}
      accessibilityLabel={t("alarm.settings.volume")}
      label={(step) => `${Math.round(step * 100)}%`}
    />
  );
};

export default VolumeSlider;
