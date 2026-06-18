import { openQuranReminderTarget } from "@/utils/notificationDeepLink";
import { QuranContentDB } from "@/services/quran-content-db";
import { useQuranStore } from "@/stores/quran";

jest.mock("@/services/quran-content-db", () => ({
  QuranContentDB: { getSurah: jest.fn() },
}));

const mockSetCurrentPage = jest.fn();
jest.mock("@/stores/quran", () => ({
  useQuranStore: { getState: jest.fn() },
}));

const getSurah = QuranContentDB.getSurah as jest.Mock;
const getState = useQuranStore.getState as jest.Mock;

describe("openQuranReminderTarget", () => {
  beforeEach(() => {
    getSurah.mockReset();
    mockSetCurrentPage.mockReset();
    getState.mockReturnValue({ setCurrentPage: mockSetCurrentPage });
  });

  it("navigates the reader to the surah's pageStart", async () => {
    getSurah.mockResolvedValue({ number: 18, pageStart: 293 });
    await openQuranReminderTarget({ surah: 18 });
    expect(getSurah).toHaveBeenCalledWith(18);
    expect(mockSetCurrentPage).toHaveBeenCalledWith(293);
  });

  it("no-ops when surah is missing", async () => {
    await openQuranReminderTarget({});
    expect(getSurah).not.toHaveBeenCalled();
    expect(mockSetCurrentPage).not.toHaveBeenCalled();
  });

  it("no-ops gracefully when content is unavailable", async () => {
    getSurah.mockResolvedValue(null);
    await openQuranReminderTarget({ surah: 18 });
    expect(mockSetCurrentPage).not.toHaveBeenCalled();
  });
});
