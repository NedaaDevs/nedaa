import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import AudioOnboarding from "@/components/athkar/AudioOnboarding";
import { SessionReader } from "@/components/athkar/session/SessionReader";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import type { AthkarLookId } from "@/constants/AthkarLook";
import { ATHKAR_FOCUS_HREF } from "@/constants/AthkarSession";
import { useAthkarDayLoad } from "@/hooks/useAthkarDayLoad";
import { useAthkarSession } from "@/hooks/useAthkarSession";
import { useDailyPort, useSessionOpening } from "@/hooks/useAthkarSessionPort";
import { useStartAthkarAudio } from "@/hooks/useStartAthkarAudio";
import { useAthkarStore } from "@/stores/athkar";

type AthkarSessionScreenProps = {
  /** A look being tried on, drawn in place of the stored one. */
  trying?: AthkarLookId;
};

/** The morning or evening session, with its audio session. */
export const AthkarSessionScreen = ({ trying }: AthkarSessionScreenProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  useSessionOpening();
  const session = useAthkarSession(useDailyPort());
  const day = useAthkarDayLoad();
  const audio = useStartAthkarAudio();
  const type = useAthkarStore((s) => s.currentType);
  const period = t(type === ATHKAR_TYPE.MORNING ? "athkar.morning" : "athkar.evening");
  const { current } = session;

  return (
    <>
      <SessionReader
        session={session}
        title={period}
        doneMessage={t("athkar.session.done", { type: period })}
        load={day}
        onOpenFocus={() => router.push(ATHKAR_FOCUS_HREF)}
        onStartAudio={() => current && audio.start(current.item.id)}
        trying={trying}
      />
      <AudioOnboarding isOpen={audio.onboardingOpen} onClose={audio.closeOnboarding} />
    </>
  );
};
