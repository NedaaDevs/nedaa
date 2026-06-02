import { useState } from "react";
import { ScrollView } from "react-native";

import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuranContentDB } from "@/services/quran-content-db";

const QuranDebugScreen = () => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const resetAndVerify = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      await QuranContentDB.resetQuranDb();
      // Next open re-copies the bundled asset. Exercise the exact tables the
      // reader (page data) and long-press (ayah metadata) read.
      const ayahs = await QuranContentDB.getAyahsForPage(2);
      const surahs = await QuranContentDB.getAllSurahs();
      const meta = await QuranContentDB.getAyahMetadata(2, 1);
      setResult(
        `OK — re-copied and verified.\n` +
          `page 2 ayahs: ${ayahs.length}\n` +
          `surahs: ${surahs.length}\n` +
          `metadata 2:1 juz: ${meta?.juz ?? "—"}`
      );
    } catch (error) {
      setResult(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Background>
      <TopBar title="Quran Debug" href="/settings" backOnClick />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card>
          <VStack gap="$3" padding="$4">
            <Text fontWeight="600">Quran content database</Text>
            <Text size="sm" color="$typographySecondary">
              Drops the copied quran.db and re-copies the bundled asset, then reads the ayahs and
              metadata tables the reader and long-press use. Use this to confirm a corrected DB
              ships (e.g. in TestFlight).
            </Text>
            <Button onPress={resetAndVerify}>
              <Button.Text>{busy ? "Working…" : "Reset & re-copy quran.db"}</Button.Text>
            </Button>
            {result ? (
              <Text size="sm" color="$typography">
                {result}
              </Text>
            ) : null}
          </VStack>
        </Card>
      </ScrollView>
    </Background>
  );
};

export default QuranDebugScreen;
