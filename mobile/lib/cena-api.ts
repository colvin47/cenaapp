import type { ArtistDetail, DiscoveryResult, EventTicket, MerchandiseItem, SceneEvent, Track } from "./types";
import { validatedApiBaseUrl, validatedMediaUrl } from "./media-urls";

const configuredBaseUrl = process.env.EXPO_PUBLIC_CENA_API_BASE_URL?.trim();
const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;
export const CENA_API_BASE_URL = validatedApiBaseUrl(configuredBaseUrl, isDevelopment);
const REQUEST_TIMEOUT_MS = 15_000;

type TrpcEnvelope<T> = {
  result?: { data?: { json?: T } | T };
  error?: { json?: { message?: string }; message?: string };
};
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createCenaApiClient(baseUrl: string, fetchImpl: FetchLike, timeoutMs = REQUEST_TIMEOUT_MS) {
  const apiBaseUrl = validatedApiBaseUrl(baseUrl, isDevelopment);
  async function query<T>(procedure: string, input: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const encodedInput = encodeURIComponent(JSON.stringify({ json: input }));
      const url = `${apiBaseUrl}/api/trpc/${procedure}?input=${encodedInput}`;
      const response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
      let envelope: TrpcEnvelope<T>;
      try {
        envelope = await response.json() as TrpcEnvelope<T>;
      } catch {
        throw new Error("O CENA retornou uma resposta inválida.");
      }
      const errorMessage = envelope.error?.json?.message || envelope.error?.message;
      if (!response.ok || errorMessage) throw new Error(errorMessage || `A API do CENA respondeu com HTTP ${response.status}.`);
      const data = envelope.result?.data;
      if (data === undefined) throw new Error("A API do CENA não retornou os dados esperados.");
      return ((typeof data === "object" && data !== null && "json" in data) ? data.json : data) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("A conexão com o CENA demorou demais. Tente novamente.");
      if (error instanceof Error) throw error;
      throw new Error("Não foi possível conectar ao CENA.");
    } finally {
      clearTimeout(timeout);
    }
  }
  return { query };
}

const defaultClient = createCenaApiClient(CENA_API_BASE_URL, (input, init) => fetch(input, init));
function queryTrpc<T>(procedure: string, input: Record<string, unknown>) {
  return defaultClient.query<T>(procedure, input);
}

export function absoluteMediaUrl(value?: string | null) {
  return validatedMediaUrl(value, CENA_API_BASE_URL, isDevelopment);
}

export function getDiscovery(input: { city: string; genre?: string; search?: string }) {
  return queryTrpc<DiscoveryResult>("scene.discovery", { city: input.city, genre: input.genre || "Tudo", search: input.search || "" }).then(result => ({
    ...result,
    tracks: result.tracks.map(track => ({ ...track, _demo: result.source === "seed", handle: track.handle || result.artists.find(artist => artist.id === track.artistId)?.handle })),
  }));
}
export async function getTrackDetail(id: number) {
  return queryTrpc<Track | null>("scene.trackDetail", { id });
}
export async function getArtistDetail(handle: string) {
  return queryTrpc<ArtistDetail | null>("scene.artistDetail", { handle });
}
export async function getEventDetail(id: number) {
  return queryTrpc<SceneEvent | null>("scene.eventDetail", { id });
}
export async function getEventTickets(eventId: number) {
  return queryTrpc<EventTicket[]>("scene.eventTickets", { eventId });
}
export async function getArtistMerchandise(artistId: number) {
  return queryTrpc<MerchandiseItem[]>("scene.artistMerchandise", { artistId });
}
