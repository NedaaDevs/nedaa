import type { File } from "expo-file-system";

type WriteContent = Parameters<File["write"]>[0];

// expo-file-system 58 adds a blocking writeSync; on 57, write blocks.
type WritableFile = {
  write: (content: WriteContent) => unknown;
  writeSync?: (content: WriteContent) => void;
};

/** Writes `content` to `file` and returns after the write completes. */
export const writeFileSync = (file: WritableFile, content: WriteContent): void => {
  if (file.writeSync) file.writeSync(content);
  else void file.write(content);
};
