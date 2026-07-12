import * as AppIntegrity from "@expo/app-integrity";
import { Platform } from "react-native";

import { PlatformType } from "@/enums/app";
import { CLOUD_PROJECT_NUMBER, isCloudProjectConfigured } from "@/constants/Attestation";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("feedback");

export interface AttestationResult {
  platform: PlatformType;
  token: string;
  keyId?: string;
}

// iOS App Attest: fresh key + attestation object per call (feedback is rare — no key reuse in v1).
const attestIOS = async (challenge: string): Promise<AttestationResult | null> => {
  if (!AppIntegrity.isSupported) return null;
  const keyId = await AppIntegrity.generateKeyAsync();
  const token = await AppIntegrity.attestKeyAsync(keyId, challenge);
  return { platform: PlatformType.IOS, token, keyId };
};

// Android Play Integrity standard flow: prepare provider, then request a token bound to the
// challenge. Returns null on HMS / no-GMS devices (prepare/request reject).
const attestAndroid = async (challenge: string): Promise<AttestationResult | null> => {
  if (!isCloudProjectConfigured()) {
    log.w("attest", "CLOUD_PROJECT_NUMBER not configured; Android attestation is disabled");
    return null;
  }
  await AppIntegrity.prepareIntegrityTokenProviderAsync(CLOUD_PROJECT_NUMBER);
  const token = await AppIntegrity.requestIntegrityCheckAsync(challenge);
  return { platform: PlatformType.ANDROID, token };
};

// Produce an app-attestation token for the feedback endpoint. Never throws: any failure or
// unsupported environment resolves null (backend treats null as the unattested tier).
export const attest = async (challenge: string): Promise<AttestationResult | null> => {
  try {
    return Platform.OS === PlatformType.IOS
      ? await attestIOS(challenge)
      : await attestAndroid(challenge);
  } catch (error) {
    log.w(
      "attest",
      `attestation failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
};
