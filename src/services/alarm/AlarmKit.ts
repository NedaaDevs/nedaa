import { NativeModules, Platform } from "react-native";

// Types
export type AuthorizationStatus =
  | "notDetermined"
  | "authorized"
  | "denied"
  | "unsupported"
  | "unknown";

// Enums
import { PlatformType } from "@/enums/app";

export type AlarmState =
  | "scheduled"
  | "countdown"
  | "alerting"
  | "paused"
  | "snoozed"
  | "stopped"
  | "unknown";

export type AlarmInfo = {
  id: string;
  state: AlarmState;
  scheduleType?: "fixed" | "relative" | "unknown";
  scheduledDate?: string;
  nextFireDate?: string;
  hour?: number;
  minute?: number;
  repeats?: "once" | "daily" | "weekly" | "unknown";
  weekdays?: number[];
};

export type AlarmConfig = {
  /** Title displayed in alarm UI */
  title: string;

  /** Unix timestamp in milliseconds */
  timestamp: number;

  /** Days to repeat (0=Sunday, 1=Monday, ..., 6=Saturday). If set, uses hour/minute from timestamp for recurring alarm */
  weekdays?: number[];

  /** Snooze duration in minutes */
  snoozeMinutes?: number;

  /** Pre-alert countdown in seconds before alarm fires */
  preAlertSeconds?: number;

  // TODO: check possibilty of using custom sounds
  /**
   * Sound filename WITHOUT extension (must be in app bundle)
   * e.g., "makkah_athan1" for makkah_athan1.caf
   */
  soundName?: string;

  /** Tint color in hex (default: "#4CAF50") */
  tintColor?: string;

  /** Stop button text (default: "Dismiss") */
  stopButtonText?: string;

  /** Stop button SF Symbol icon (default: "checkmark.circle.fill") */
  stopButtonIcon?: string;

  /** Stop button text color in hex (default: white) */
  stopButtonColor?: string;

  /** Snooze button text (default: "Snooze Xm") */
  snoozeButtonText?: string;

  /** Snooze button SF Symbol icon (default: "clock.arrow.circlepath") */
  snoozeButtonIcon?: string;

  /** Snooze button text color in hex (default: white) */
  snoozeButtonColor?: string;
};

// ==========================================
// NATIVE MODULE
// ==========================================

const { AlarmKitModule } = NativeModules;

// ==========================================
// ALARMKIT SERVICE
// ==========================================

class AlarmKitService {
  private static instance: AlarmKitService;

  private constructor() {}

  static getInstance(): AlarmKitService {
    if (!AlarmKitService.instance) {
      AlarmKitService.instance = new AlarmKitService();
    }
    return AlarmKitService.instance;
  }

  /**
   * Check if AlarmKit is supported (iOS 26+)
   */
  async isSupported(): Promise<boolean> {
    if (Platform.OS !== PlatformType.IOS || !AlarmKitModule) {
      return false;
    }

    try {
      return await AlarmKitModule.isSupported();
    } catch {
      return false;
    }
  }

  /**
   * Request AlarmKit authorization from user
   */
  async requestAuthorization(): Promise<{ status: AuthorizationStatus }> {
    if (Platform.OS !== PlatformType.IOS || !AlarmKitModule) {
      return { status: "unsupported" };
    }

    try {
      return await AlarmKitModule.requestAuthorization();
    } catch (error) {
      console.error("[AlarmKit] Authorization error:", error);
      throw error;
    }
  }

  /**
   * Get current authorization status
   */
  async getAuthorizationStatus(): Promise<AuthorizationStatus> {
    if (Platform.OS !== PlatformType.IOS || !AlarmKitModule) {
      return "unsupported";
    }

    try {
      return await AlarmKitModule.getAuthorizationStatus();
    } catch {
      return "unknown";
    }
  }

  /**
   * Schedule an alarm
   * @returns Object with alarmId and success status
   */
  async scheduleAlarm(config: AlarmConfig): Promise<{ alarmId: string; success: boolean }> {
    if (Platform.OS !== PlatformType.IOS || !AlarmKitModule) {
      throw new Error("AlarmKit is not available on this platform");
    }

    const isAvailable = await this.isSupported();
    if (!isAvailable) {
      throw new Error("AlarmKit requires iOS 26+");
    }

    try {
      return await AlarmKitModule.scheduleAlarm(config);
    } catch (error) {
      console.error("[AlarmKit] Schedule error:", error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled alarm (before it fires)
   * Returns { success: boolean, alreadyCancelled: boolean }
   */
  async cancelAlarm(alarmId: string): Promise<{ success: boolean; alreadyCancelled: boolean }> {
    if (Platform.OS !== PlatformType.IOS || !AlarmKitModule) {
      return { success: false, alreadyCancelled: false };
    }

    try {
      const result = await AlarmKitModule.cancelAlarm(alarmId);
      return {
        success: result?.success ?? false,
        alreadyCancelled: result?.alreadyCancelled ?? false,
      };
    } catch (error: any) {
      // Error 0 means "alarm not found" - this is expected when cancelling
      // an alarm that doesn't exist yet (e.g., first time setup)
      const isNotFoundError = error?.message?.includes("error 0");
      if (!isNotFoundError) {
        console.error("[AlarmKit] Cancel error:", error);
      }
      return { success: false, alreadyCancelled: true };
    }
  }

  /**
   * Get all scheduled/active alarms
   */
  async getAllAlarms(): Promise<AlarmInfo[]> {
    if (Platform.OS !== PlatformType.IOS || !AlarmKitModule) {
      return [];
    }

    try {
      return await AlarmKitModule.getAllAlarms();
    } catch {
      return [];
    }
  }
}

export const alarmKit = AlarmKitService.getInstance();
