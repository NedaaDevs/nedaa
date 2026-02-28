import { useEffect } from "react";
import { router } from "expo-router";
import { useAthkarStore } from "@/stores/athkar";

export default function NotFoundScreen() {
  const playerState = useAthkarStore((s) => s.playerState);

  useEffect(() => {
    if (playerState !== "idle") {
      router.replace("/(tabs)/athkar");
    } else {
      router.replace("/");
    }
  }, [playerState]);

  return null;
}
