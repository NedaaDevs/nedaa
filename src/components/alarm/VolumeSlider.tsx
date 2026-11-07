import { FC } from "react";
import { useTranslation } from "react-i18next";

import { SegmentedChoice } from "@/components/ui/segmented-choice";

import { MIN_ALARM_VOLUME } from "@/types/alarm";

type Props = {
  value: number;
  onChange: (volume: number) => void;
};

const VOLUME_STEPS = [MIN_ALARM_VOLUME, 0.5, 0.75, 1.0];

const VolumeSlider: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();

  return (
    <SegmentedChoice
      options={VOLUME_STEPS}
      value={value}
      onChange={onChange}
      accessibilityLabel={t("alarm.settings.volume")}
      label={(step) => `${Math.round(step * 100)}%`}
    />
  );
};

export default VolumeSlider;
