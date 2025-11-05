import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import Storage from "expo-sqlite/kv-store";
import { Platform } from "react-native";

// Enums
import { PlatformType } from "@/enums/app";

// Types
import type { CustomSound } from "@/types/customSound";

type CustomSoundsState = {
  /** All custom sounds added by the user */
  customSounds: CustomSound[];

  /** Loading state */
  isLoading: boolean;

  /** Whether the store has been initialized */
  isInitialized: boolean;
};

type CustomSoundsActions = {
  /** Initialize the store by loading from storage */
  initialize: () => Promise<void>;

  /** Add a new custom sound */
  addCustomSound: (sound: CustomSound) => Promise<void>;

  /** Update an existing custom sound */
  updateCustomSound: (id: string, updates: Partial<CustomSound>) => Promise<void>;

  /** Delete a custom sound */
  deleteCustomSound: (id: string) => Promise<void>;

  /** Get a custom sound by ID */
  getCustomSound: (id: string) => CustomSound | undefined;

  /** Get all custom sounds available for a notification type */
  getCustomSoundsForType: (type: string) => CustomSound[];

  /** Clear all custom sounds (for testing/debugging) */
  clearAllCustomSounds: () => Promise<void>;
};

export const useCustomSoundsStore = create<CustomSoundsState & CustomSoundsActions>()(
  persist(
    (set, get) => ({
      // Initial state
      customSounds: [],
      isLoading: false,
      isInitialized: false,

      // Initialize store
      initialize: async () => {
        if (Platform.OS !== PlatformType.ANDROID) {
          set({ isInitialized: true });
          return;
        }

        // With persist middleware, data is already loaded
        set({ isInitialized: true });
        console.log("[CustomSounds] Initialized with", get().customSounds.length, "sounds");
      },

      // Add custom sound
      addCustomSound: async (sound: CustomSound) => {
        const { customSounds } = get();
        const newSounds = [...customSounds, sound];

        set({ customSounds: newSounds });
        console.log("[CustomSounds] Added sound:", sound.name);
      },

      // Update custom sound
      updateCustomSound: async (id: string, updates: Partial<CustomSound>) => {
        const { customSounds } = get();
        const newSounds = customSounds.map((sound) =>
          sound.id === id ? { ...sound, ...updates } : sound
        );

        set({ customSounds: newSounds });
        console.log("[CustomSounds] Updated sound:", id);
      },

      // Delete custom sound
      deleteCustomSound: async (id: string) => {
        const { customSounds } = get();
        const newSounds = customSounds.filter((sound) => sound.id !== id);

        set({ customSounds: newSounds });
        console.log("[CustomSounds] Deleted sound:", id);
      },

      // Get custom sound by ID
      getCustomSound: (id: string) => {
        const { customSounds } = get();
        return customSounds.find((sound) => sound.id === id);
      },

      // Get custom sounds for a notification type
      getCustomSoundsForType: (type: string) => {
        const { customSounds } = get();
        return customSounds.filter((sound) => sound.availableFor.includes(type as any));
      },

      // Clear all custom sounds
      clearAllCustomSounds: async () => {
        set({ customSounds: [] });
        console.log("[CustomSounds] Cleared all sounds");
      },
    }),
    {
      name: "custom-sounds-storage",
      storage: createJSONStorage(() => Storage),
    }
  )
);
