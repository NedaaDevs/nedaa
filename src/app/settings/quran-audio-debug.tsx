import { useState, useCallback } from "react";
import { ScrollView } from "react-native";
import { TrackPlayer, PlayerQueue } from "react-native-nitro-player";
import type { TrackItem } from "react-native-nitro-player";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import TopBar from "@/components/TopBar";
import { Background } from "@/components/ui/background";

import { useQuranAudioStore } from "@/stores/quranAudio";
import { quranAudioPlayer } from "@/services/quran-audio/quranAudioPlayer";
import { nitroSession } from "@/services/audio/nitroSession";
import { QURAN_LISTEN_MODE, type QuranListenMode } from "@/types/quran-audio";

// Three short Al-Fatiha files, used only by the raw nitro spike below.
const SPIKE_BASE = "https://audio-cdn.tarteel.ai/quran/minshawyMurattal";
const SPIKE_FILES = ["001001", "001002", "001003"];

const QuranAudioDebugScreen = () => {
  const {
    playerState,
    currentSurah,
    currentAyah,
    listenMode,
    selectedRecitationId,
    following,
    setListenMode,
  } = useQuranAudioStore();

  const [events, setEvents] = useState<string[]>([]);
  const [spikeRunning, setSpikeRunning] = useState(false);
  const push = useCallback((line: string) => setEvents((prev) => [...prev, line]), []);

  // Nitro test: load 3 tracks with RepeatMode "off", play the first, and log
  // every track change + state change. Confirms whether nitro auto-advances and
  // emits a clean "stopped" at the end. Routed through the session arbiter (as a
  // "debug" owner) so it never clobbers the real players' event dispatch.
  const runSpike = useCallback(async () => {
    setEvents([]);
    setSpikeRunning(true);
    try {
      nitroSession.register("debug", {
        onChangeTrack: (t, r) => push(`onChangeTrack → ${t.id}${r ? ` (${r})` : ""}`),
        onPlaybackStateChange: (s, r) => push(`state → ${s}${r ? ` (${r})` : ""}`),
      });
      await nitroSession.ensureStarted();
      await nitroSession.acquire("debug");
      const tracks: TrackItem[] = SPIKE_FILES.map((n, i) => ({
        id: `s${i}`,
        title: `spike ${i}`,
        artist: "spike",
        album: "",
        duration: 0,
        url: `${SPIKE_BASE}/${n}.mp3`,
        artwork: undefined,
      }));
      const pid = await PlayerQueue.createPlaylist("nitro-spike");
      await PlayerQueue.addTracksToPlaylist(pid, tracks);
      await PlayerQueue.loadPlaylist(pid);
      await TrackPlayer.setRepeatMode("off");
      push("loaded 3 tracks, RepeatMode=off — playing s0");
      await TrackPlayer.playSong("s0", pid);
      await TrackPlayer.play();
    } catch (e) {
      push(`ERROR: ${(e as Error)?.message}`);
    } finally {
      setSpikeRunning(false);
    }
  }, [push]);

  const modes: QuranListenMode[] = [
    QURAN_LISTEN_MODE.STOP,
    QURAN_LISTEN_MODE.ADVANCE,
    QURAN_LISTEN_MODE.REPEAT_SURAH,
  ];

  return (
    <Background>
      <TopBar title="Quran Audio Debug" href="/settings" backOnClick />
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <VStack gap="$3">
          {/* Live player state */}
          <Card padding="$4">
            <VStack gap="$2">
              <Text size="lg" fontWeight="600" color="$typography">
                Player state
              </Text>
              <HStack justifyContent="space-between">
                <Text color="$typographySecondary">state</Text>
                <Badge action="info">
                  <Badge.Text>{playerState}</Badge.Text>
                </Badge>
              </HStack>
              <HStack justifyContent="space-between">
                <Text color="$typographySecondary">current ayah</Text>
                <Badge action="info">
                  <Badge.Text>
                    {currentSurah ? `${currentSurah}:${currentAyah}` : "none"}
                  </Badge.Text>
                </Badge>
              </HStack>
              <HStack justifyContent="space-between">
                <Text color="$typographySecondary">recitation</Text>
                <Badge action="info">
                  <Badge.Text>{selectedRecitationId}</Badge.Text>
                </Badge>
              </HStack>
              <HStack justifyContent="space-between">
                <Text color="$typographySecondary">following</Text>
                <Badge action={following ? "success" : "muted"}>
                  <Badge.Text>{following ? "yes" : "no"}</Badge.Text>
                </Badge>
              </HStack>
            </VStack>
          </Card>

          {/* Raw nitro auto-advance spike */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Nitro auto-advance spike
              </Text>
              <Text size="sm" color="$typographySecondary">
                Should advance s0 → s1 → s2 on its own, then one stopped event.
              </Text>
              <Button
                variant="solid"
                onPress={runSpike}
                disabled={spikeRunning}
                accessibilityLabel="Run nitro auto-advance spike">
                <Button.Text>{spikeRunning ? "Running…" : "Run auto-advance spike"}</Button.Text>
              </Button>
            </VStack>
          </Card>

          {/* Drive the real player */}
          <Card padding="$4">
            <VStack gap="$3">
              <Text size="lg" fontWeight="600" color="$typography">
                Player controls
              </Text>
              <HStack gap="$2" flexWrap="wrap">
                <Button
                  variant="solid"
                  onPress={() => quranAudioPlayer.playFromHere(2, 255)}
                  accessibilityLabel="Play from Al-Baqarah 255">
                  <Button.Text>Play from 2:255</Button.Text>
                </Button>
                <Button
                  variant="solid"
                  onPress={() => quranAudioPlayer.playAyah(1, 1)}
                  accessibilityLabel="Play Al-Fatiha 1">
                  <Button.Text>Play 1:1</Button.Text>
                </Button>
                <Button
                  variant="solid"
                  onPress={() => quranAudioPlayer.playSurah(112)}
                  accessibilityLabel="Play surah Al-Ikhlas">
                  <Button.Text>Play surah 112</Button.Text>
                </Button>
              </HStack>
              <HStack gap="$2" flexWrap="wrap">
                <Button
                  variant="outline"
                  onPress={() => quranAudioPlayer.pause()}
                  accessibilityLabel="Pause">
                  <Button.Text>Pause</Button.Text>
                </Button>
                <Button
                  variant="outline"
                  onPress={() => quranAudioPlayer.resume()}
                  accessibilityLabel="Resume">
                  <Button.Text>Resume</Button.Text>
                </Button>
                <Button
                  variant="outline"
                  onPress={() => quranAudioPlayer.stop()}
                  accessibilityLabel="Stop">
                  <Button.Text>Stop</Button.Text>
                </Button>
              </HStack>
              <Text size="sm" color="$typographySecondary">
                Listen mode (affects Play surah continuation)
              </Text>
              <HStack gap="$2" flexWrap="wrap">
                {modes.map((m) => (
                  <Button
                    key={m}
                    variant={listenMode === m ? "solid" : "outline"}
                    onPress={() => setListenMode(m)}
                    accessibilityLabel={`Set listen mode ${m}`}>
                    <Button.Text>{m}</Button.Text>
                  </Button>
                ))}
              </HStack>
            </VStack>
          </Card>

          {/* Spike event log */}
          <Card padding="$4">
            <VStack gap="$2">
              <HStack justifyContent="space-between" alignItems="center">
                <Text size="lg" fontWeight="600" color="$typography">
                  Spike events
                </Text>
                <Badge action="info">
                  <Badge.Text>{events.length}</Badge.Text>
                </Badge>
              </HStack>
              <Text size="sm" color="$typography" fontFamily="$mono">
                {events.length ? events.join("\n") : "— run the spike —"}
              </Text>
            </VStack>
          </Card>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default QuranAudioDebugScreen;
