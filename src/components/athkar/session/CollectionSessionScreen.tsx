import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Pencil } from "lucide-react-native";

import { CollectionEditSheet } from "@/components/athkar/session/CollectionEditSheet";
import { SessionReader } from "@/components/athkar/session/SessionReader";
import { Box } from "@/components/ui/box";
import { ScreenHeader } from "@/components/ui/screen-header";
import { customAthkarEditHref } from "@/constants/Athkar";
import { SESSION_SOURCE, type CollectionSource } from "@/constants/AthkarSession";
import { useAthkarSession, type SessionPort } from "@/hooks/useAthkarSession";
import {
  useCustomOpening,
  useCustomPort,
  useHisnOpening,
  useHisnPort,
} from "@/hooks/useAthkarSessionPort";
import { focusHref } from "@/utils/athkarSessionSource";

type Shared = {
  /** The collection's name. */
  title: string;
  /** Back to the list of collections. */
  onBack: () => void;
};

type ReaderProps = Shared & {
  source: CollectionSource;
  port: SessionPort;
  onEdit: () => void;
};

/** A collection as a session: its name and its two ways out, over the reader. */
const CollectionReader = ({ source, port, title, onBack, onEdit }: ReaderProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useAthkarSession(port);
  return (
    <Box flex={1}>
      <ScreenHeader
        variant="bar"
        title={title}
        back={{ onPress: onBack, name: t("athkar.myAthkar") }}
        action={{ icon: Pencil, label: t("athkar.collection.edit"), onPress: onEdit }}
      />
      <Box flex={1} paddingHorizontal="$4">
        <SessionReader
          session={session}
          title={title}
          doneMessage={t("athkar.session.collectionDone")}
          onOpenFocus={() => router.push(focusHref(source))}
        />
      </Box>
    </Box>
  );
};

const HisnReader = ({ categoryId, ...shared }: Shared & { categoryId: number }) => {
  const [editing, setEditing] = useState(false);
  const port = useHisnPort(categoryId);
  useHisnOpening(categoryId, port.ready);
  return (
    <>
      <CollectionReader
        {...shared}
        source={{ kind: SESSION_SOURCE.HISN, categoryId }}
        port={port}
        onEdit={() => setEditing(true)}
      />
      <CollectionEditSheet
        open={editing}
        categoryId={categoryId}
        onClose={() => setEditing(false)}
      />
    </>
  );
};

const CustomReader = ({ groupId, ...shared }: Shared & { groupId: number }) => {
  const router = useRouter();
  const port = useCustomPort(groupId);
  useCustomOpening(groupId, port.ready);
  return (
    <CollectionReader
      {...shared}
      source={{ kind: SESSION_SOURCE.CUSTOM, groupId }}
      port={port}
      onEdit={() => router.push(customAthkarEditHref(groupId))}
    />
  );
};

type Props = Shared & { source: CollectionSource };

/** A saved topic or a custom group, read as a session in the person's look. */
export const CollectionSessionScreen = ({ source, ...shared }: Props) => {
  switch (source.kind) {
    case SESSION_SOURCE.HISN:
      return <HisnReader key={source.categoryId} categoryId={source.categoryId} {...shared} />;
    case SESSION_SOURCE.CUSTOM:
      return <CustomReader key={source.groupId} groupId={source.groupId} {...shared} />;
  }
};
