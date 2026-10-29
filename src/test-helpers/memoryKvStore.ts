// An in-memory expo-sqlite/kv-store; a suite's jest.mock factory returns
// jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule.
export const memoryKv = new Map<string, string>();

// While a flag is set, the sync calls of that kind throw.
export const memoryKvFailure = { read: false, write: false };

export const resetMemoryKv = (): void => {
  memoryKv.clear();
  memoryKvFailure.read = false;
  memoryKvFailure.write = false;
};

const getItemSync = (key: string): string | null => {
  if (memoryKvFailure.read) throw new Error("memoryKv: read failed");
  return memoryKv.get(key) ?? null;
};

const setItemSync = (key: string, value: string): void => {
  if (memoryKvFailure.write) throw new Error("memoryKv: write failed");
  memoryKv.set(key, value);
};

const removeItemSync = (key: string): boolean => {
  if (memoryKvFailure.write) throw new Error("memoryKv: write failed");
  return memoryKv.delete(key);
};

const getItemAsync = async (key: string): Promise<string | null> => memoryKv.get(key) ?? null;

const setItemAsync = async (key: string, value: string): Promise<void> => {
  memoryKv.set(key, value);
};

const removeItemAsync = async (key: string): Promise<boolean> => memoryKv.delete(key);

const memoryStorage = {
  getItemSync,
  setItemSync,
  removeItemSync,
  getItemAsync,
  setItemAsync,
  removeItemAsync,
  getItem: getItemAsync,
  setItem: setItemAsync,
  removeItem: async (key: string): Promise<void> => {
    memoryKv.delete(key);
  },
};

// A store with its own database file shares the one in-memory map.
export const memoryKvStoreModule = {
  __esModule: true,
  default: memoryStorage,
  SQLiteStorage: jest.fn(() => memoryStorage),
};
