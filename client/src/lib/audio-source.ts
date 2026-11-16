import { parseExternalTrackUrl } from "@shared/track-source";

/** Returns only a direct audio source; supported provider pages belong in an embed/link. */
export function selectAudioStreamUrl(
  audioUrl: string | null | undefined,
): string | undefined {
  const candidate = audioUrl?.trim();
  if (!candidate || parseExternalTrackUrl(candidate)) return undefined;
  try {
    const hostname = new URL(candidate).hostname.toLowerCase().replace(/^www\./, "");
    if (
      hostname === "spotify.com" ||
      hostname.endsWith(".spotify.com") ||
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be" ||
      hostname === "soundcloud.com" ||
      hostname.endsWith(".soundcloud.com") ||
      hostname.endsWith(".bandcamp.com")
    ) return undefined;
  } catch {
    // Relative paths and other non-provider URLs can be valid audio sources.
  }
  return candidate;
}
