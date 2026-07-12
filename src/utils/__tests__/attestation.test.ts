const mockGenerateKey = jest.fn();
const mockAttestKey = jest.fn();
const mockPrepareProvider = jest.fn();
const mockRequestCheck = jest.fn();
const mockWarn = jest.fn();
let mockIsSupported = true;
let mockPlatformOS = "ios";

jest.mock("@expo/app-integrity", () => ({
  get isSupported() {
    return mockIsSupported;
  },
  generateKeyAsync: (...args: unknown[]) => mockGenerateKey(...args),
  attestKeyAsync: (...args: unknown[]) => mockAttestKey(...args),
  prepareIntegrityTokenProviderAsync: (...args: unknown[]) => mockPrepareProvider(...args),
  requestIntegrityCheckAsync: (...args: unknown[]) => mockRequestCheck(...args),
}));

jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ w: (...args: unknown[]) => mockWarn(...args) }) },
}));

let mockCloudConfigured = true;
jest.mock("@/constants/Attestation", () => ({
  CLOUD_PROJECT_NUMBER: "12345",
  isCloudProjectConfigured: () => mockCloudConfigured,
}));

// eslint-disable-next-line import/first -- import must follow jest.mock hoisting
import { attest } from "@/utils/attestation";

describe("attest (iOS)", () => {
  beforeEach(() => {
    mockPlatformOS = "ios";
    mockIsSupported = true;
    jest.clearAllMocks();
  });

  it("returns token + keyId on success", async () => {
    mockGenerateKey.mockResolvedValue("key-123");
    mockAttestKey.mockResolvedValue("attest-object");
    const res = await attest("challenge-abc");
    expect(res).toEqual({ platform: "ios", token: "attest-object", keyId: "key-123" });
    expect(mockAttestKey).toHaveBeenCalledWith("key-123", "challenge-abc");
  });

  it("returns null when App Attest is unsupported", async () => {
    mockIsSupported = false;
    expect(await attest("c")).toBeNull();
    expect(mockGenerateKey).not.toHaveBeenCalled();
  });

  it("returns null (no throw) when attestation fails", async () => {
    mockGenerateKey.mockRejectedValue(new Error("secure enclave nope"));
    await expect(attest("c")).resolves.toBeNull();
  });
});

describe("attest (Android)", () => {
  beforeEach(() => {
    mockPlatformOS = "android";
    mockCloudConfigured = true;
    jest.clearAllMocks();
  });

  it("returns null without calling the provider when the cloud project is unconfigured", async () => {
    mockCloudConfigured = false;
    expect(await attest("c")).toBeNull();
    expect(mockPrepareProvider).not.toHaveBeenCalled();
  });

  it("prepares provider then returns integrity token", async () => {
    mockPrepareProvider.mockResolvedValue(undefined);
    mockRequestCheck.mockResolvedValue("integrity-token");
    const res = await attest("challenge-xyz");
    expect(res).toEqual({ platform: "android", token: "integrity-token" });
  });

  it("returns null (no throw) when Play Integrity is unavailable (HMS/no-GMS)", async () => {
    mockPrepareProvider.mockRejectedValue(new Error("no GMS"));
    await expect(attest("c")).resolves.toBeNull();
  });
});
