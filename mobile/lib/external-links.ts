import { Linking } from "react-native";

export function safeExternalUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function openExternalUrl(value?: string | null) {
  const url = safeExternalUrl(value);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
