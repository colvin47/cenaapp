const DEFAULT_API_BASE_URL = "https://cena-kn4vk68m.manus.space";
const DIRECT_AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "mp4", "wav"]);
const AUDIO_PAGE_HOSTS = ["spotify.com", "youtube.com", "youtu.be", "bandcamp.com", "soundcloud.com"];
function isLocalDevelopmentHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return true;
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some(part => part > 255)) return false;
  return octets[0] === 10 || octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

function parseHttpUrl(value: string, allowLocalHttp: boolean): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(allowLocalHttp && url.protocol === "http:" && isLocalDevelopmentHost(url.hostname))) return undefined;
    if (!url.hostname || url.username || url.password) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export function validatedApiBaseUrl(configured?: string | null, isDevelopment = false) {
  const value = configured?.trim() || DEFAULT_API_BASE_URL;
  const url = parseHttpUrl(value, isDevelopment);
  if (!url || url.search || url.hash) {
    throw new Error("A URL base da API CENA deve usar HTTPS (ou HTTP apenas para um host local em desenvolvimento) e não pode conter credenciais, query ou fragmento.");
  }
  return url.toString().replace(/\/+$/, "");
}

export function validatedMediaUrl(value?: string | null, baseUrl = DEFAULT_API_BASE_URL, isDevelopment = false) {
  if (!value?.trim()) return undefined;
  const raw = value.trim();
  const absolute = parseHttpUrl(raw, isDevelopment);
  const resolved = absolute || (raw.startsWith("/") || !/^[a-z][a-z\d+.-]*:/i.test(raw)
    ? parseHttpUrl(`${baseUrl.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}`, isDevelopment)
    : undefined);
  return resolved?.toString();
}

export function directAudioUrl(value?: string | null, baseUrl = DEFAULT_API_BASE_URL, isDevelopment = false) {
  const url = validatedMediaUrl(value, baseUrl, isDevelopment);
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (AUDIO_PAGE_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`))) return undefined;
  const extension = parsed.pathname.split("/").pop()?.split(".").pop()?.toLowerCase();
  const mimeHint = parsed.searchParams.get("response-content-type") || parsed.searchParams.get("mime") || parsed.searchParams.get("type");
  const hasAudioMime = Boolean(mimeHint && /^(audio\/(?:mpeg|mp3|mp4|aac|wav|ogg|opus|flac|x-aiff|x-caf)|video\/mp4)(?:;|$)/i.test(mimeHint));
  return (extension && DIRECT_AUDIO_EXTENSIONS.has(extension)) || hasAudioMime ? url : undefined;
}
