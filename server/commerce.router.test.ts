import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createArtistMerchandise: vi.fn(),
  createArtistEventTicket: vi.fn(),
  updateArtistEvent: vi.fn(),
  recordTrackListen: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, ...dbMocks };
});

import { appRouter } from "./routers";
import { isTrackEligibleForPlay } from "./db";

function callerFor(accountType: "listener" | "artist" = "artist") {
  const ctx: TrpcContext = {
    user: {
      id: 42,
      openId: "commerce-router-test",
      email: "artist@example.test",
      name: "Test Artist",
      loginMethod: "test",
      role: "user",
      adminRole: "moderator",
      accountType,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

const eventInput = {
  id: 11,
  name: "Show de teste",
  venue: "Casa de show",
  city: "Campinas",
  eventDate: "2026-12-01T20:00:00.000Z",
};

describe("commerce and event router validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.createArtistMerchandise.mockResolvedValue(21);
    dbMocks.createArtistEventTicket.mockResolvedValue(31);
    dbMocks.updateArtistEvent.mockResolvedValue({ id: 11, ...eventInput, address: "Rua preservada", latitude: "-22.9", longitude: "-47.1" });
    dbMocks.recordTrackListen.mockResolvedValue(true);
    dbMocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it("forbids non-artists from creating merchandise and tickets before DB calls", async () => {
    const caller = callerFor("listener");
    await expect(caller.scene.createMerchandise({ name: "Camiseta", price: 20, stock: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.scene.createEventTicket({ eventId: 11, name: "Pista", price: 20, quantityAvailable: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.createArtistMerchandise).not.toHaveBeenCalled();
    expect(dbMocks.createArtistEventTicket).not.toHaveBeenCalled();
  });

  it("rejects prices with more than two decimal places for merchandise and tickets", async () => {
    const caller = callerFor();
    await expect(caller.scene.createMerchandise({ name: "Camiseta", price: 12.345, stock: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.scene.createEventTicket({ eventId: 11, name: "Pista", price: 0.001, quantityAvailable: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createArtistMerchandise).not.toHaveBeenCalled();
    expect(dbMocks.createArtistEventTicket).not.toHaveBeenCalled();
  });

  it("accepts prices precisely representable in cents, including floating-point cent values", async () => {
    const caller = callerFor();
    await expect(caller.scene.createMerchandise({ name: "Camiseta", price: 19.99, stock: 1 })).resolves.toMatchObject({ id: 21, persisted: true });
    await expect(caller.scene.createEventTicket({ eventId: 11, name: "Pista", price: 1.15, quantityAvailable: 10 })).resolves.toMatchObject({ id: 31, persisted: true });
    expect(dbMocks.createArtistMerchandise).toHaveBeenCalledWith(42, expect.objectContaining({ price: 19.99 }));
    expect(dbMocks.createArtistEventTicket).toHaveBeenCalledWith(42, expect.objectContaining({ price: 1.15 }));
  });

  it("rejects insecure commerce URLs and invalid upload payloads", async () => {
    const caller = callerFor();
    await expect(caller.scene.createMerchandise({ name: "Camiseta", price: 10, stock: 1, imageUrl: "http://example.test/image.png" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.scene.createTrack({
      title: "Faixa",
      city: "Campinas",
      sourceType: "spotify",
      externalUrl: "https://example.test/track",
      idempotencyKey: "invalid-url-key-1234",
      rightsDeclared: true,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.scene.requestUpload({ kind: "audio", fileName: "track.exe", contentType: "audio/mpeg", size: 100 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createArtistMerchandise).not.toHaveBeenCalled();
  });

  it("requires coordinate pairs and rejects out-of-range coordinates on event updates", async () => {
    const caller = callerFor();
    await expect(caller.scene.updateEvent({ ...eventInput, latitude: -22.9 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.scene.updateEvent({ ...eventInput, longitude: -47.1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.scene.updateEvent({ ...eventInput, latitude: 91, longitude: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.updateArtistEvent).not.toHaveBeenCalled();
  });

  it("omits address and coordinate columns when an event PATCH does not provide them", async () => {
    const caller = callerFor();
    const result = await caller.scene.updateEvent(eventInput);
    expect(result.event).toMatchObject({ address: "Rua preservada", latitude: "-22.9", longitude: "-47.1" });
    const update = dbMocks.updateArtistEvent.mock.calls[0][2];
    expect(update).not.toHaveProperty("address");
    expect(update).not.toHaveProperty("latitude");
    expect(update).not.toHaveProperty("longitude");
  });

  it("allows explicitly clearing address and both coordinates, but rejects a partial clear", async () => {
    const caller = callerFor();
    await expect(caller.scene.updateEvent({ ...eventInput, address: null, latitude: null })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.scene.updateEvent({ ...eventInput, address: null, latitude: null, longitude: null })).resolves.toMatchObject({ persisted: true });
    expect(dbMocks.updateArtistEvent.mock.calls[0][2]).toMatchObject({ address: null, latitude: null, longitude: null });
  });

  it("counts plays only for public, published, unretracted tracks that are released", () => {
    const now = new Date("2026-11-11T12:00:00.000Z");
    const eligible = { visibility: "public", moderationStatus: "published", removedAt: null, releaseDate: null };
    expect(isTrackEligibleForPlay(eligible, now)).toBe(true);
    expect(isTrackEligibleForPlay({ ...eligible, visibility: "private" }, now)).toBe(false);
    expect(isTrackEligibleForPlay({ ...eligible, moderationStatus: "pending" }, now)).toBe(false);
    expect(isTrackEligibleForPlay({ ...eligible, removedAt: new Date("2026-11-10T12:00:00.000Z") }, now)).toBe(false);
    expect(isTrackEligibleForPlay({ ...eligible, releaseDate: new Date("2026-11-12T12:00:00.000Z") }, now)).toBe(false);
    expect(isTrackEligibleForPlay({ ...eligible, releaseDate: new Date("2026-11-11T12:00:00.000Z") }, now)).toBe(true);
  });

  it("returns an unrecorded result when the public-listen guard refuses an unpublished track", async () => {
    dbMocks.recordTrackListen.mockResolvedValue(false);
    await expect(callerFor("listener").scene.recordPlay({ trackId: 99, listenedSeconds: 30 })).resolves.toEqual({ recorded: false });
    expect(dbMocks.recordTrackListen).toHaveBeenCalledWith(99, 42, 30, undefined);
  });
});
