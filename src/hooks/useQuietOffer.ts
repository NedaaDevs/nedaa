import { EMERGENCY_QUIET_OFFER, type EmergencyQuietOffer } from "@/constants/EmergencyQuiet";
import type { EmergencyQuietControl } from "@/hooks/useAlarmScreen";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
import {
  allowanceInEffect,
  confirmOpenFor,
  quietOfferFor,
  refillDate,
  usesLeft,
} from "@/utils/emergencyQuiet";

export type QuietOffer = Readonly<{
  offer: EmergencyQuietOffer;
  /** The confirm shows only while the quiet is offered. */
  confirmOpen: boolean;
  /** The first day a spent month's quiets are back. */
  refillsOn: Date;
}>;

/** What a ringing alarm's quiet shows; one screen reads it once. */
export const useQuietOffer = (
  control: EmergencyQuietControl | undefined,
  wayOut: boolean
): QuietOffer => {
  const now = useMinuteClock().getTime();
  const ledger = useEmergencyQuietStore((state) => state.ledger);
  const offer = control
    ? quietOfferFor({
        ...control,
        wayOut,
        allowance: allowanceInEffect(ledger, now),
        left: usesLeft(ledger, now),
      })
    : EMERGENCY_QUIET_OFFER.HIDDEN;
  return {
    offer,
    confirmOpen: confirmOpenFor(control?.confirming === true, offer),
    refillsOn: refillDate(ledger, now),
  };
};
