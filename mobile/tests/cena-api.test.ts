import { describe, expect, it, vi } from "vitest";
import { createCenaApiClient } from "../lib/cena-api";
import { directAudioUrl, validatedApiBaseUrl, validatedMediaUrl } from "../lib/media-urls";

const API_BASE = "https://api.cena.test";
function clientWith(fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>, timeoutMs = 1000) {
  return createCenaApiClient(API_BASE, fetcher, timeoutMs);
}

describe("cliente API CENA offline", () => {
  it("decodifica a resposta tRPC envelopada e serializa input na URL", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => new Response(JSON.stringify({ result: { data: { json: { id: 42, title: "Faixa" } } } }), { status: 200 }));
    const result = await clientWith(fetcher).query<{ id: number; title: string }>("scene.trackDetail", { id: 42 });
    expect(result).toEqual({ id: 42, title: "Faixa" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetcher.mock.calls[0];
    const parsed = new URL(String(requestUrl));
    expect(parsed.origin).toBe(API_BASE);
    expect(parsed.pathname).toBe("/api/trpc/scene.trackDetail");
    expect(JSON.parse(decodeURIComponent(parsed.searchParams.get("input") || ""))).toEqual({ json: { id: 42 } });
    expect(init?.method).toBe("GET");
    expect(init?.headers).toEqual({ Accept: "application/json" });
  });

  it("retorna dados tRPC sem subcampo json e respeita erro da resposta HTTP", async () => {
    const success = clientWith(async () => new Response(JSON.stringify({ result: { data: [1, 2] } }), { status: 200 }));
    await expect(success.query("scene.eventTickets", {})).resolves.toEqual([1, 2]);
    const failure = clientWith(async () => new Response(JSON.stringify({ message: "indisponível" }), { status: 503 }));
    await expect(failure.query("scene.discovery", {})).rejects.toThrow("HTTP 503");
  });

  it("propaga mensagens de erro tRPC mesmo com status HTTP de sucesso", async () => {
    const client = clientWith(async () => new Response(JSON.stringify({ error: { json: { message: "acesso negado" } } }), { status: 200 }));
    await expect(client.query("scene.trackDetail", { id: 2 })).rejects.toThrow("acesso negado");
  });

  it("rejeita JSON inválido e envelopes sem dados", async () => {
    const malformed = clientWith(async () => new Response("não é json", { status: 200 }));
    await expect(malformed.query("scene.trackDetail", {})).rejects.toThrow("resposta inválida");
    const missing = clientWith(async () => new Response(JSON.stringify({ result: {} }), { status: 200 }));
    await expect(missing.query("scene.trackDetail", {})).rejects.toThrow("dados esperados");
  });

  it("cancela fetch pendente no timeout e apresenta erro amigável", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const client = clientWith(fetcher, 5);
    await expect(client.query("scene.discovery", {})).rejects.toThrow("demorou demais");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("validação de URLs", () => {
  it("aceita HTTPS e apenas HTTP para endereços locais de desenvolvimento", () => {
    expect(validatedApiBaseUrl("https://api.cena.test/")).toBe("https://api.cena.test");
    expect(validatedApiBaseUrl("http://localhost:3000", true)).toBe("http://localhost:3000");
    expect(validatedApiBaseUrl("http://192.168.1.20:3000", true)).toBe("http://192.168.1.20:3000");
    expect(() => validatedApiBaseUrl("http://example.com", true)).toThrow();
    expect(() => validatedApiBaseUrl("http://localhost:3000", false)).toThrow();
    expect(() => validatedApiBaseUrl("https://user:pass@api.cena.test")).toThrow();
  });

  it("valida caminhos de mídia e só reconhece URLs de áudio direto compatível", () => {
    expect(validatedMediaUrl("/covers/cena.jpg", API_BASE)).toBe(`${API_BASE}/covers/cena.jpg`);
    expect(validatedMediaUrl("javascript:alert(1)", API_BASE)).toBeUndefined();
    expect(validatedMediaUrl("http://example.com/file.mp3", API_BASE, true)).toBeUndefined();
    expect(directAudioUrl("https://cdn.cena.test/audio/faixa.mp3?signature=ok", API_BASE)).toBe("https://cdn.cena.test/audio/faixa.mp3?signature=ok");
    expect(directAudioUrl("https://cdn.cena.test/stream?id=42&type=audio/mpeg", API_BASE)).toBe("https://cdn.cena.test/stream?id=42&type=audio/mpeg");
    for (const pageUrl of [
      "https://open.spotify.com/track/abc",
      "https://www.youtube.com/watch?v=abc",
      "https://artist.bandcamp.com/album/record",
      "https://soundcloud.com/artist/track",
      "https://cdn.cena.test/track/without-audio-type",
    ]) expect(directAudioUrl(pageUrl, API_BASE)).toBeUndefined();
  });
});
