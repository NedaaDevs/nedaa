import { SYSTEM_SOUND } from "@/constants/Notification";
import { channelSoundOption } from "@/utils/channelSound";

const FILE_SOUND = "makkah_athan1.ogg";

describe("channelSoundOption", () => {
  it("leaves the key out for the device sound", () =>
    expect(channelSoundOption(SYSTEM_SOUND)).toEqual({}));

  it("keeps a sound file", () =>
    expect(channelSoundOption(FILE_SOUND)).toEqual({ sound: FILE_SOUND }));

  it("keeps null, which mutes the channel", () =>
    expect(channelSoundOption(null)).toEqual({ sound: null }));
});
