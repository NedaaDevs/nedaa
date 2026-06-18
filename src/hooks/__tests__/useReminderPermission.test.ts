import { ensureReminderPermission } from "@/hooks/useReminderPermission";
import { checkPermissions, requestNotificationPermission } from "@/utils/notifications";

jest.mock("@/utils/notifications", () => ({
  checkPermissions: jest.fn(),
  requestNotificationPermission: jest.fn(),
}));

const mockCheck = checkPermissions as jest.Mock;
const mockRequest = requestNotificationPermission as jest.Mock;

describe("ensureReminderPermission", () => {
  beforeEach(() => {
    mockCheck.mockReset();
    mockRequest.mockReset();
  });

  it("returns granted without requesting when already granted", async () => {
    mockCheck.mockResolvedValue({ status: "granted" });
    expect(await ensureReminderPermission()).toBe("granted");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("requests when not granted and maps granted", async () => {
    mockCheck.mockResolvedValue({ status: "undetermined" });
    mockRequest.mockResolvedValue({ status: "granted" });
    expect(await ensureReminderPermission()).toBe("granted");
  });

  it("maps a denied request to denied", async () => {
    mockCheck.mockResolvedValue({ status: "denied" });
    mockRequest.mockResolvedValue({ status: "denied" });
    expect(await ensureReminderPermission()).toBe("denied");
  });
});
