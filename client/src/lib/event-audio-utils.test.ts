import { describe, expect, it } from "vitest";
import { selectAudioStreamUrl } from "./audio-source";
import {
  formatLocalDateTimeInput,
  localDateTimeToISOString,
} from "./event-date";

describe("datetime-local conversion", () => {
  it("round-trips a local date and time without shifting the wall-clock value", () => {
    const previousTimezone = process.env.TZ;
    const input = "2030-06-15T19:45";
    try {
      process.env.TZ = "America/Sao_Paulo";
      const iso = localDateTimeToISOString(input);

      expect(iso).toBe("2030-06-15T22:45:00.000Z");
      expect(formatLocalDateTimeInput(iso!)).toBe(input);
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it("returns an empty value for invalid dates", () => {
    expect(localDateTimeToISOString("not-a-date")).toBeNull();
    expect(formatLocalDateTimeInput("not-a-date")).toBe("");
  });
});

describe("audio stream selection", () => {
  it("does not treat provider page URLs as direct audio files", () => {
    expect(
      selectAudioStreamUrl("https://open.spotify.com/track/abc123"),
    ).toBeUndefined();
    expect(
      selectAudioStreamUrl("https://www.youtube.com/watch?v=abc123"),
    ).toBeUndefined();
    expect(
      selectAudioStreamUrl("https://soundcloud.com/artist/track"),
    ).toBeUndefined();
    expect(
      selectAudioStreamUrl("https://open.spotify.com/album/abc123"),
    ).toBeUndefined();
    expect(
      selectAudioStreamUrl("https://artist.bandcamp.com/album/release"),
    ).toBeUndefined();
  });

  it("keeps an uploaded audio URL as a playable source", () => {
    expect(selectAudioStreamUrl("https://cdn.example.test/audio/track.mp3")).toBe(
      "https://cdn.example.test/audio/track.mp3",
    );
  });
});
