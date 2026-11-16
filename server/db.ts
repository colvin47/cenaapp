import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gte, isNull, like, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  artists,
  auditLogs,
  collectiveMembers,
  collectiveInvites,
  collectives,
  moderationReports,
  eventInterests,
  eventTickets,
  events,
  follows,
  InsertUser,
  playlistTracks,
  playlists,
  notifications,
  merchandise,
  savedTracks,
  trackPlays,
  trackCredits,
  tracks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      const value = user[field] ?? null;
      values[field] = value;
      updateSet[field] = value;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (user.accountType !== undefined) {
    values.accountType = user.accountType;
    updateSet.accountType = user.accountType;
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function setAccountType(userId: number, accountType: "listener" | "artist") {
  const db = await getDb();
  if (!db) return false;
  await db.update(users).set({ accountType, updatedAt: new Date() }).where(eq(users.id, userId));
  return true;
}

export async function updateListenerProfile(userId: number, input: { city: string; favoriteGenres?: string; publicBio?: string }) {
  const db = await getDb();
  if (!db) return false;
  await db.update(users).set({ city: input.city, favoriteGenres: input.favoriteGenres || null, publicBio: input.publicBio || null, updatedAt: new Date() }).where(eq(users.id, userId));
  return true;
}

export async function getArtistByOwnerId(ownerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(artists).where(eq(artists.ownerId, ownerId)).limit(1);
  return result[0];
}

export async function createArtistProfile(ownerId: number, input: { name: string; handle: string; city: string; genre?: string; bio?: string; profileType?: "solo" | "band" | "mc" | "producer" | "dj" | "collective" | "label" | "venue"; manifesto?: string; supportUrl?: string; pixUrl?: string; merchUrl?: string }) {
  const db = await getDb();
  if (!db) return null;
  const existing = await getArtistByOwnerId(ownerId);
  if (existing) return existing;
  const result = await db.insert(artists).values({ ownerId, name: input.name, handle: input.handle, city: input.city, genre: input.genre || null, bio: input.bio || null, profileType: input.profileType || "solo", manifesto: input.manifesto || null, supportUrl: input.supportUrl || null, pixUrl: input.pixUrl || null, merchUrl: input.merchUrl || null });
  const created = await db.select().from(artists).where(eq(artists.id, Number(result[0].insertId))).limit(1);
  return created[0] ?? null;
}

export async function updateArtistProfile(ownerId: number, input: { name: string; handle: string; city: string; genre?: string; bio?: string; profileType?: "solo" | "band" | "mc" | "producer" | "dj" | "collective" | "label" | "venue"; manifesto?: string; avatarUrl?: string; coverUrl?: string; instagramUrl?: string; bandcampUrl?: string; supportUrl?: string; pixUrl?: string; merchUrl?: string }) {
  const db = await getDb();
  if (!db) return null;
  const existing = await getArtistByOwnerId(ownerId);
  if (!existing) return null;
  await db.update(artists).set({ ...input, genre: input.genre || null, bio: input.bio || null, manifesto: input.manifesto || null, avatarUrl: input.avatarUrl || null, coverUrl: input.coverUrl || null, instagramUrl: input.instagramUrl || null, bandcampUrl: input.bandcampUrl || null, supportUrl: input.supportUrl || null, pixUrl: input.pixUrl || null, merchUrl: input.merchUrl || null, updatedAt: new Date() }).where(eq(artists.ownerId, ownerId));
  return getArtistByOwnerId(ownerId);
}

export async function getArtistStats(ownerId: number) {
  const db = await getDb();
  if (!db) return null;
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return null;
  const [playRows, followerRows, eventRows, topTracks] = await Promise.all([
    db.select({ total: count(trackPlays.id) }).from(trackPlays).innerJoin(tracks, eq(trackPlays.trackId, tracks.id)).where(eq(tracks.artistId, artist.id)),
    db.select({ total: count(follows.artistId) }).from(follows).where(eq(follows.artistId, artist.id)),
    db.select({ id: events.id, name: events.name, interest: count(eventInterests.eventId) }).from(events).leftJoin(eventInterests, eq(eventInterests.eventId, events.id)).where(eq(events.artistId, artist.id)).groupBy(events.id, events.name).orderBy(desc(events.eventDate)).limit(10),
    db.select({ id: tracks.id, title: tracks.title, plays: count(trackPlays.id) }).from(tracks).leftJoin(trackPlays, eq(trackPlays.trackId, tracks.id)).where(eq(tracks.artistId, artist.id)).groupBy(tracks.id, tracks.title).orderBy(desc(count(trackPlays.id))).limit(5),
  ]);
  return { plays: Number(playRows[0]?.total ?? 0), followers: Number(followerRows[0]?.total ?? 0), events: eventRows.map(event => ({ ...event, interest: Number(event.interest ?? 0) })), topTracks: topTracks.map(track => ({ ...track, plays: Number(track.plays ?? 0) })) };
}

export async function getArtistCatalog(ownerId: number) {
  const db = await getDb();
  if (!db) return { tracks: [], events: [] };
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return { tracks: [], events: [] };
  const [artistTracks, artistEvents] = await Promise.all([
    db.select({ id: tracks.id, title: tracks.title, artist: artists.name, artistId: tracks.artistId, genre: tracks.genre, city: tracks.city, duration: tracks.durationSeconds, cover: tracks.coverUrl, audioUrl: tracks.audioUrl, sourceType: tracks.sourceType, externalUrl: tracks.externalUrl, description: tracks.description, releaseType: tracks.releaseType, releaseDate: tracks.releaseDate, creditsNote: tracks.creditsNote, bookletPages: tracks.bookletPages }).from(tracks).innerJoin(artists, eq(tracks.artistId, artists.id)).where(and(eq(tracks.artistId, artist.id), eq(tracks.visibility, "public"), eq(tracks.moderationStatus, "published"))).orderBy(desc(tracks.createdAt)).limit(100),
    db.select({ id: events.id, title: events.name, place: events.venue, city: events.city, address: events.address, latitude: events.latitude, longitude: events.longitude, eventDate: events.eventDate, description: events.description, ticketUrl: events.ticketUrl, eventType: events.eventType, admissionType: events.admissionType, accessibility: events.accessibility, safeSpace: events.safeSpace, ageRating: events.ageRating, program: events.program, canceledAt: events.canceledAt, artistId: events.artistId }).from(events).where(eq(events.artistId, artist.id)).orderBy(asc(events.eventDate)).limit(100),
  ]);
  return { tracks: artistTracks, events: artistEvents };
}

export async function getTrackDetail(trackId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ id: tracks.id, title: tracks.title, album: tracks.album, artistId: tracks.artistId, artist: artists.name, handle: artists.handle, genre: tracks.genre, city: tracks.city, duration: tracks.durationSeconds, cover: tracks.coverUrl, audioUrl: tracks.audioUrl, sourceType: tracks.sourceType, externalUrl: tracks.externalUrl, description: tracks.description, releaseType: tracks.releaseType, releaseDate: tracks.releaseDate, visibility: tracks.visibility, creditsNote: tracks.creditsNote, bookletPages: tracks.bookletPages }).from(tracks).innerJoin(artists, eq(tracks.artistId, artists.id)).where(and(eq(tracks.id, trackId), eq(tracks.moderationStatus, "published"), eq(tracks.visibility, "public"), or(isNull(tracks.releaseDate), lte(tracks.releaseDate, new Date())))).limit(1);
  return result[0] ?? null;
}

export async function getEventDetail(eventId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ id: events.id, title: events.name, place: events.venue, city: events.city, address: events.address, latitude: events.latitude, longitude: events.longitude, eventDate: events.eventDate, description: events.description, ticketUrl: events.ticketUrl, artistId: events.artistId, artist: artists.name, handle: artists.handle, eventType: events.eventType, admissionType: events.admissionType, accessibility: events.accessibility, safeSpace: events.safeSpace, ageRating: events.ageRating, program: events.program, canceledAt: events.canceledAt, cancelReason: events.cancelReason }).from(events).innerJoin(artists, eq(events.artistId, artists.id)).where(eq(events.id, eventId)).limit(1);
  return result[0] ?? null;
}

export async function getArtistPublicDetail(handle: string) {
  const db = await getDb();
  if (!db) return null;
  const normalizedHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const rows = await db.select().from(artists).where(eq(artists.handle, normalizedHandle)).limit(1);
  const artist = rows[0];
  if (!artist) return null;

  const [followerRows, artistTracks, artistEvents, artistMerchandise] = await Promise.all([
    db.select({ total: count(follows.artistId) }).from(follows).where(eq(follows.artistId, artist.id)),
    db.select({ id: tracks.id, title: tracks.title, album: tracks.album, artistId: tracks.artistId, artist: artists.name, genre: tracks.genre, city: tracks.city, duration: tracks.durationSeconds, cover: tracks.coverUrl, audioUrl: tracks.audioUrl, sourceType: tracks.sourceType, externalUrl: tracks.externalUrl, description: tracks.description, releaseType: tracks.releaseType, releaseDate: tracks.releaseDate, creditsNote: tracks.creditsNote, bookletPages: tracks.bookletPages }).from(tracks).innerJoin(artists, eq(tracks.artistId, artists.id)).where(and(eq(tracks.artistId, artist.id), eq(tracks.visibility, "public"), eq(tracks.moderationStatus, "published"), or(isNull(tracks.releaseDate), lte(tracks.releaseDate, new Date())))).orderBy(desc(tracks.createdAt)).limit(100),
    db.select({ id: events.id, title: events.name, place: events.venue, city: events.city, address: events.address, latitude: events.latitude, longitude: events.longitude, eventDate: events.eventDate, description: events.description, ticketUrl: events.ticketUrl, artistId: events.artistId, eventType: events.eventType, admissionType: events.admissionType, accessibility: events.accessibility, safeSpace: events.safeSpace, ageRating: events.ageRating, program: events.program, interest: count(eventInterests.eventId) }).from(events).leftJoin(eventInterests, eq(eventInterests.eventId, events.id)).where(and(eq(events.artistId, artist.id), gte(events.eventDate, new Date()), isNull(events.canceledAt))).groupBy(events.id).orderBy(asc(events.eventDate)).limit(50),
    listPublicMerchandise(artist.id),
  ]);

  return {
    artist: {
      id: artist.id,
      name: artist.name,
      handle: artist.handle,
      profileType: artist.profileType,
      genre: artist.genre ?? "Cena local",
      bio: artist.bio ?? "",
      manifesto: artist.manifesto ?? undefined,
      city: artist.city,
      image: artist.avatarUrl ?? artist.coverUrl ?? "",
      accent: "#c8f36a",
      followers: Number(followerRows[0]?.total ?? 0).toLocaleString("pt-BR"),
      instagramUrl: artist.instagramUrl ?? undefined,
      bandcampUrl: artist.bandcampUrl ?? undefined,
      supportUrl: artist.supportUrl ?? undefined,
      pixUrl: artist.pixUrl ?? undefined,
      merchUrl: artist.merchUrl ?? undefined,
      merchandise: artistMerchandise,
    },
    tracks: artistTracks,
    events: artistEvents.map(event => ({ ...event, interest: Number(event.interest ?? 0) })),
  };
}

export async function getPlaylistDetail(playlistId: number, viewerId?: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: playlists.id, ownerId: playlists.ownerId, ownerName: users.name, name: playlists.name, collaborative: playlists.collaborative }).from(playlists).leftJoin(users, eq(playlists.ownerId, users.id)).where(eq(playlists.id, playlistId)).limit(1);
  const playlist = rows[0];
  if (!playlist || (!playlist.collaborative && playlist.ownerId !== viewerId)) return null;

  const playlistTracksResult = await db.select({ id: tracks.id, title: tracks.title, album: tracks.album, artistId: tracks.artistId, artist: artists.name, genre: tracks.genre, city: tracks.city, duration: tracks.durationSeconds, cover: tracks.coverUrl, audioUrl: tracks.audioUrl, sourceType: tracks.sourceType, externalUrl: tracks.externalUrl, releaseType: tracks.releaseType, creditsNote: tracks.creditsNote, bookletPages: tracks.bookletPages }).from(playlistTracks).innerJoin(tracks, eq(playlistTracks.trackId, tracks.id)).innerJoin(artists, eq(tracks.artistId, artists.id)).where(and(eq(playlistTracks.playlistId, playlistId), eq(tracks.visibility, "public"), eq(tracks.moderationStatus, "published"), or(isNull(tracks.releaseDate), lte(tracks.releaseDate, new Date())))).orderBy(asc(playlistTracks.position), asc(playlistTracks.createdAt)).limit(100);

  return {
    playlist: {
      id: playlist.id,
      name: playlist.name,
      collaborative: playlist.collaborative,
      owner: playlist.ownerName || "Ouvinte da CENA",
      description: playlist.collaborative ? "Uma playlist aberta à colaboração da comunidade." : "Playlist privada da sua biblioteca.",
    },
    tracks: playlistTracksResult,
  };
}

function citySearchPattern(city: string) {
  return city.split(",")[0]?.trim() || city.trim();
}

export async function findArtists(searchTerm?: string, city?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    conditions.push(or(like(artists.name, pattern), like(artists.handle, pattern), like(artists.genre, pattern), like(artists.city, pattern), like(artists.bio, pattern), like(artists.manifesto, pattern)));
  }
  if (city) conditions.push(like(artists.city, `${citySearchPattern(city)}%`));
  return db.select().from(artists).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(artists.name)).limit(50);
}

export async function findTracks(searchTerm?: string, genre?: string, city?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    conditions.push(or(like(tracks.title, pattern), like(tracks.album, pattern), like(tracks.genre, pattern), like(tracks.city, pattern), like(artists.name, pattern), like(artists.handle, pattern)));
  }
  if (genre && genre !== "Tudo") conditions.push(eq(tracks.genre, genre));
  if (city) conditions.push(like(tracks.city, `${citySearchPattern(city)}%`));
  return db.select({
    id: tracks.id,
    title: tracks.title,
    artistId: tracks.artistId,
    genre: tracks.genre,
    city: tracks.city,
    releaseType: tracks.releaseType,
    sourceType: tracks.sourceType,
    externalUrl: tracks.externalUrl,
    creditsNote: tracks.creditsNote,
    duration: tracks.durationSeconds,
    cover: tracks.coverUrl,
    audioUrl: tracks.audioUrl,
    bookletPages: tracks.bookletPages,
    artist: artists.name,
  }).from(tracks).innerJoin(artists, eq(tracks.artistId, artists.id)).where(and(eq(tracks.moderationStatus, "published"), eq(tracks.visibility, "public"), or(isNull(tracks.releaseDate), lte(tracks.releaseDate, new Date())), ...(conditions.length ? conditions : []))).orderBy(desc(tracks.createdAt)).limit(50);
}

export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
}

export async function markNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, userId));
  return true;
}

export async function createCustomNotification(input: { title: string; body: string; href?: string }) {
  const db = await getDb();
  if (!db) return { created: 0 };
  const recipients = await db.select({ id: users.id }).from(users);
  if (!recipients.length) return { created: 0 };
  await db.insert(notifications).values(recipients.map(recipient => ({ userId: recipient.id, kind: "system" as const, title: input.title, body: input.body, href: input.href || null })));
  return { created: recipients.length };
}

export async function takedownTrack(ownerId: number, trackId: number, reason?: string) {
  const db = await getDb();
  if (!db) return false;
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return false;
  const result = await db.update(tracks).set({ moderationStatus: "takedown", takedownReason: reason || "Removida pelo artista", removedAt: new Date(), updatedAt: new Date() }).where(and(eq(tracks.id, trackId), eq(tracks.artistId, artist.id), eq(tracks.moderationStatus, "published")));
  if (Number(result[0]?.affectedRows ?? 0) > 0) {
    await db.insert(notifications).values({ userId: artist.ownerId, kind: "moderation", title: "Faixa removida da publicação", body: reason || "A faixa foi retirada do ar e não aparece mais na descoberta pública.", href: "/perfil" });
  }
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function listEvents(city?: string, searchTerm?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [gte(events.eventDate, new Date()), isNull(events.canceledAt)];
  if (city) conditions.push(like(events.city, `${citySearchPattern(city)}%`));
  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    const searchCondition = or(like(events.name, pattern), like(events.venue, pattern), like(events.city, pattern), like(events.description, pattern), like(events.program, pattern), like(artists.name, pattern));
    if (searchCondition) conditions.push(searchCondition);
  }
  return db.select({
    id: events.id,
    title: events.name,
    place: events.venue,
    city: events.city,
    eventDate: events.eventDate,
    address: events.address,
    latitude: events.latitude,
    longitude: events.longitude,
    description: events.description,
    ticketUrl: events.ticketUrl,
    eventType: events.eventType,
    admissionType: events.admissionType,
    accessibility: events.accessibility,
    safeSpace: events.safeSpace,
    ageRating: events.ageRating,
    program: events.program,
    canceledAt: events.canceledAt,
    artistId: events.artistId,
    artist: artists.name,
    interest: count(eventInterests.eventId),
  }).from(events).innerJoin(artists, eq(events.artistId, artists.id)).leftJoin(eventInterests, eq(eventInterests.eventId, events.id)).where(and(...conditions)).groupBy(events.id, artists.name).orderBy(asc(events.eventDate)).limit(50);
}

export async function listArtistEvents(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return [];
  return db.select().from(events).where(eq(events.artistId, artist.id)).orderBy(asc(events.eventDate)).limit(50);
}

export async function updateArtistEvent(ownerId: number, eventId: number, input: { name: string; venue: string; city: string; address?: string | null; latitude?: number | null; longitude?: number | null; eventDate: Date; description?: string; ticketUrl?: string; eventType?: "show" | "battle" | "cypher" | "cultural_round" | "diy_festival" | "occupation" | "zine_fair" | "workshop" | "listening_party" | "release"; admissionType?: "ticket" | "free" | "contribution"; accessibility?: string; safeSpace?: boolean; ageRating?: string; program?: string }) {
  const db = await getDb();
  if (!db) return null;
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return null;
  const { name, venue, city, address, latitude, longitude, eventDate, eventType, admissionType, description, ticketUrl, accessibility, safeSpace, ageRating, program } = input;
  await db.update(events).set({
    name,
    venue,
    city,
    ...(address !== undefined ? { address: address || null } : {}),
    ...(latitude !== undefined ? { latitude: latitude === null ? null : String(latitude) } : {}),
    ...(longitude !== undefined ? { longitude: longitude === null ? null : String(longitude) } : {}),
    eventDate,
    eventType,
    admissionType,
    description: description || null,
    ticketUrl: ticketUrl || null,
    accessibility: accessibility || null,
    safeSpace,
    ageRating: ageRating || null,
    program: program || null,
    updatedAt: new Date(),
  }).where(and(eq(events.id, eventId), eq(events.artistId, artist.id)));
  const result = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.artistId, artist.id))).limit(1);
  return result[0] ?? null;
}

export async function deleteArtistEvent(ownerId: number, eventId: number) {
  const db = await getDb();
  if (!db) return false;
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return false;
  const result = await db.delete(events).where(and(eq(events.id, eventId), eq(events.artistId, artist.id)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function cancelArtistEvent(ownerId: number, eventId: number, reason?: string) {
  const db = await getDb();
  if (!db) return false;
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return false;
  const result = await db.update(events).set({ canceledAt: new Date(), cancelReason: reason || "Evento cancelado pelo artista", updatedAt: new Date() }).where(and(eq(events.id, eventId), eq(events.artistId, artist.id)));
  if (Number(result[0]?.affectedRows ?? 0) > 0) {
    const interested = await db.select({ userId: eventInterests.userId }).from(eventInterests).where(eq(eventInterests.eventId, eventId));
    if (interested.length) await db.insert(notifications).values(interested.map(row => ({ userId: row.userId, kind: "event" as const, title: "Evento cancelado", body: reason || "Um evento da sua agenda foi cancelado pelo artista.", href: "/eventos" })));
  }
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function writeAuditLog(input: { actorId: number; action: string; targetType: string; targetId?: number; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(auditLogs).values({ actorId: input.actorId, action: input.action, targetType: input.targetType, targetId: input.targetId ?? null, metadata: input.metadata ? JSON.stringify(input.metadata) : null });
  return Number(result[0].insertId);
}
export async function listAuditLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: auditLogs.id, action: auditLogs.action, targetType: auditLogs.targetType, targetId: auditLogs.targetId, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actorName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(50);
}
export async function getCollectivePermission(userId: number, collectiveId: number) {
  const db = await getDb();
  if (!db) return null;
  const owner = await db.select({ id: collectives.id }).from(collectives).where(and(eq(collectives.id, collectiveId), eq(collectives.ownerId, userId))).limit(1);
  if (owner[0]) return "owner" as const;
  const member = await db.select({ permission: collectiveMembers.permission }).from(collectiveMembers).innerJoin(artists, eq(artists.id, collectiveMembers.artistId)).where(and(eq(collectiveMembers.collectiveId, collectiveId), eq(artists.ownerId, userId))).limit(1);
  return member[0]?.permission ?? null;
}
export async function createCollective(ownerId: number, input: { name: string; handle: string; type: "collective" | "label" | "venue" | "media" | "festival"; city: string; bio?: string; manifesto?: string; supportUrl?: string; pixUrl?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(collectives).values({ ownerId, ...input, bio: input.bio || null, manifesto: input.manifesto || null, supportUrl: input.supportUrl || null, pixUrl: input.pixUrl || null });
  const id = Number(result[0].insertId);
  await writeAuditLog({ actorId: ownerId, action: "collective.created", targetType: "collective", targetId: id, metadata: { name: input.name, city: input.city } });
  return db.select().from(collectives).where(eq(collectives.id, id)).limit(1).then(rows => rows[0] ?? null);
}
export async function listUserCollectives(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: collectives.id, name: collectives.name, handle: collectives.handle, type: collectives.type, city: collectives.city, ownerId: collectives.ownerId, memberPermission: collectiveMembers.permission }).from(collectives).leftJoin(collectiveMembers, eq(collectiveMembers.collectiveId, collectives.id)).leftJoin(artists, eq(artists.id, collectiveMembers.artistId)).where(or(eq(collectives.ownerId, userId), eq(artists.ownerId, userId))).orderBy(asc(collectives.name));
  return rows.map(row => ({ id: row.id, name: row.name, handle: row.handle, type: row.type, city: row.city, permission: row.ownerId === userId ? "owner" : row.memberPermission }));
}
export async function addCollectiveMember(ownerId: number, input: { collectiveId: number; artistId: number; permission: "editor" | "agenda" | "member"; memberRole?: string }) {
  const db = await getDb();
  if (!db) return false;
  const collective = await db.select({ id: collectives.id }).from(collectives).where(and(eq(collectives.id, input.collectiveId), eq(collectives.ownerId, ownerId))).limit(1);
  if (!collective[0]) return false;
  await db.insert(collectiveMembers).values({ collectiveId: input.collectiveId, artistId: input.artistId, permission: input.permission, memberRole: input.memberRole || null }).onDuplicateKeyUpdate({ set: { permission: input.permission, memberRole: input.memberRole || null } });
  await writeAuditLog({ actorId: ownerId, action: "collective.member_added", targetType: "collective", targetId: input.collectiveId, metadata: { artistId: input.artistId, permission: input.permission } });
  return true;
}
export async function createCollectiveInvite(ownerId: number, input: { collectiveId: number; permission: "editor" | "agenda" | "member"; email?: string }) {
  const db = await getDb();
  if (!db) return null;
  const collective = await db.select({ id: collectives.id }).from(collectives).where(and(eq(collectives.id, input.collectiveId), eq(collectives.ownerId, ownerId))).limit(1);
  if (!collective[0]) return null;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(collectiveInvites).values({ collectiveId: input.collectiveId, inviterId: ownerId, tokenHash, permission: input.permission, email: input.email || null, expiresAt });
  await writeAuditLog({ actorId: ownerId, action: "collective.invite_created", targetType: "collective", targetId: input.collectiveId, metadata: { permission: input.permission, email: input.email || null } });
  return { token, expiresAt };
}
export async function listPendingCollectiveInvites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const user = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]?.email) return [];
  return db.select({ id: collectiveInvites.id, collectiveId: collectiveInvites.collectiveId, collectiveName: collectives.name, collectiveHandle: collectives.handle, inviterName: users.name, permission: collectiveInvites.permission, expiresAt: collectiveInvites.expiresAt }).from(collectiveInvites).innerJoin(collectives, eq(collectives.id, collectiveInvites.collectiveId)).innerJoin(users, eq(users.id, collectiveInvites.inviterId)).where(and(eq(collectiveInvites.email, user[0].email), isNull(collectiveInvites.acceptedAt), isNull(collectiveInvites.declinedAt), gte(collectiveInvites.expiresAt, new Date()))).orderBy(desc(collectiveInvites.createdAt));
}
export async function declineCollectiveInvite(userId: number, inviteId: number) {
  const db = await getDb();
  if (!db) return false;
  const user = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]?.email) return false;
  const result = await db.update(collectiveInvites).set({ declinedAt: new Date() }).where(and(eq(collectiveInvites.id, inviteId), eq(collectiveInvites.email, user[0].email), isNull(collectiveInvites.acceptedAt), isNull(collectiveInvites.declinedAt)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
export async function acceptPendingCollectiveInvite(userId: number, inviteId: number) {
  const db = await getDb();
  if (!db) return { accepted: false, reason: "DATABASE_UNAVAILABLE" as const };
  const user = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]?.email) return { accepted: false, reason: "EMAIL_REQUIRED" as const };
  const rows = await db.select({ id: collectiveInvites.id, collectiveId: collectiveInvites.collectiveId, permission: collectiveInvites.permission, expiresAt: collectiveInvites.expiresAt }).from(collectiveInvites).where(and(eq(collectiveInvites.id, inviteId), eq(collectiveInvites.email, user[0].email), isNull(collectiveInvites.acceptedAt), isNull(collectiveInvites.declinedAt), gte(collectiveInvites.expiresAt, new Date()))).limit(1);
  const invite = rows[0];
  if (!invite) return { accepted: false, reason: "INVITE_INVALID" as const };
  const artist = await db.select({ id: artists.id }).from(artists).where(eq(artists.ownerId, userId)).limit(1);
  if (!artist[0]) return { accepted: false, reason: "ARTIST_PROFILE_REQUIRED" as const };
  await db.insert(collectiveMembers).values({ collectiveId: invite.collectiveId, artistId: artist[0].id, permission: invite.permission }).onDuplicateKeyUpdate({ set: { permission: invite.permission } });
  await db.update(collectiveInvites).set({ acceptedAt: new Date() }).where(eq(collectiveInvites.id, invite.id));
  await writeAuditLog({ actorId: userId, action: "collective.invite_accepted", targetType: "collective", targetId: invite.collectiveId, metadata: { permission: invite.permission, source: "pending" } });
  return { accepted: true as const, collectiveId: invite.collectiveId };
}
export async function previewCollectiveInvite(token: string) {
  const db = await getDb();
  if (!db) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await db.select({ collectiveName: collectives.name, collectiveHandle: collectives.handle, inviterName: users.name, permission: collectiveInvites.permission, expiresAt: collectiveInvites.expiresAt }).from(collectiveInvites).innerJoin(collectives, eq(collectives.id, collectiveInvites.collectiveId)).innerJoin(users, eq(users.id, collectiveInvites.inviterId)).where(and(eq(collectiveInvites.tokenHash, tokenHash), isNull(collectiveInvites.acceptedAt), isNull(collectiveInvites.declinedAt), gte(collectiveInvites.expiresAt, new Date()))).limit(1);
  return rows[0] ?? null;
}
export async function acceptCollectiveInvite(userId: number, token: string) {
  const db = await getDb();
  if (!db) return { accepted: false, reason: "DATABASE_UNAVAILABLE" as const };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await db.select({ id: collectiveInvites.id, collectiveId: collectiveInvites.collectiveId, permission: collectiveInvites.permission, expiresAt: collectiveInvites.expiresAt }).from(collectiveInvites).where(and(eq(collectiveInvites.tokenHash, tokenHash), isNull(collectiveInvites.acceptedAt), isNull(collectiveInvites.declinedAt))).limit(1);
  const invite = rows[0];
  if (!invite || invite.expiresAt.getTime() < Date.now()) return { accepted: false, reason: "INVITE_INVALID" as const };
  const artist = await db.select({ id: artists.id }).from(artists).where(eq(artists.ownerId, userId)).limit(1);
  if (!artist[0]) return { accepted: false, reason: "ARTIST_PROFILE_REQUIRED" as const };
  await db.insert(collectiveMembers).values({ collectiveId: invite.collectiveId, artistId: artist[0].id, permission: invite.permission }).onDuplicateKeyUpdate({ set: { permission: invite.permission } });
  await db.update(collectiveInvites).set({ acceptedAt: new Date() }).where(eq(collectiveInvites.id, invite.id));
  await writeAuditLog({ actorId: userId, action: "collective.invite_accepted", targetType: "collective", targetId: invite.collectiveId, metadata: { permission: invite.permission } });
  return { accepted: true as const, collectiveId: invite.collectiveId };
}
export async function listCollectiveMembers(userId: number, collectiveId: number) {
  const db = await getDb();
  if (!db) return [];
  const owner = await db.select({ id: collectives.id }).from(collectives).where(and(eq(collectives.id, collectiveId), eq(collectives.ownerId, userId))).limit(1);
  if (!owner[0]) return [];
  return db.select({ artistId: artists.id, name: artists.name, handle: artists.handle, permission: collectiveMembers.permission, memberRole: collectiveMembers.memberRole }).from(collectiveMembers).innerJoin(artists, eq(artists.id, collectiveMembers.artistId)).where(eq(collectiveMembers.collectiveId, collectiveId)).orderBy(asc(artists.name));
}
export async function removeCollectiveMember(ownerId: number, input: { collectiveId: number; artistId: number }) {
  const db = await getDb();
  if (!db) return false;
  const collective = await db.select({ id: collectives.id }).from(collectives).where(and(eq(collectives.id, input.collectiveId), eq(collectives.ownerId, ownerId))).limit(1);
  if (!collective[0]) return false;
  const result = await db.delete(collectiveMembers).where(and(eq(collectiveMembers.collectiveId, input.collectiveId), eq(collectiveMembers.artistId, input.artistId)));
  const removed = Number(result[0]?.affectedRows ?? 0) > 0;
  if (removed) await writeAuditLog({ actorId: ownerId, action: "collective.member_removed", targetType: "collective", targetId: input.collectiveId, metadata: { artistId: input.artistId } });
  return removed;
}
export async function updateCollectiveMember(ownerId: number, input: { collectiveId: number; artistId: number; permission: "editor" | "agenda" | "member"; memberRole?: string }) {
  const db = await getDb();
  if (!db) return false;
  const collective = await db.select({ id: collectives.id }).from(collectives).where(and(eq(collectives.id, input.collectiveId), eq(collectives.ownerId, ownerId))).limit(1);
  if (!collective[0]) return false;
  const result = await db.update(collectiveMembers).set({ permission: input.permission, memberRole: input.memberRole || null }).where(and(eq(collectiveMembers.collectiveId, input.collectiveId), eq(collectiveMembers.artistId, input.artistId)));
  if (Number(result[0]?.affectedRows ?? 0) > 0) await writeAuditLog({ actorId: ownerId, action: "collective.member_updated", targetType: "collective", targetId: input.collectiveId, metadata: { artistId: input.artistId, permission: input.permission } });
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
export async function createModerationReport(input: { reporterId: number; targetType: "track" | "artist" | "event" | "collective"; targetId: number; reason: string; details?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(moderationReports).values({ reporterId: input.reporterId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details || null });
  return Number(result[0].insertId);
}
export async function listModerationReports(status?: "open" | "reviewed" | "resolved" | "rejected") {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: moderationReports.id,
    targetType: moderationReports.targetType,
    targetId: moderationReports.targetId,
    reason: moderationReports.reason,
    details: moderationReports.details,
    status: moderationReports.status,
    createdAt: moderationReports.createdAt,
    resolvedAt: moderationReports.resolvedAt,
    reporterName: users.name,
  }).from(moderationReports).leftJoin(users, eq(moderationReports.reporterId, users.id)).where(status ? eq(moderationReports.status, status) : undefined).orderBy(asc(moderationReports.createdAt)).limit(100);
}
export async function updateModerationReport(reportId: number, status: "open" | "reviewed" | "resolved" | "rejected") {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(moderationReports).set({ status, resolvedAt: status === "resolved" || status === "rejected" ? new Date() : null }).where(eq(moderationReports.id, reportId));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}
export async function hideReportedContent(reportId: number) {
  const db = await getDb();
  if (!db) return false;
  const report = await db.select({ targetType: moderationReports.targetType, targetId: moderationReports.targetId }).from(moderationReports).where(eq(moderationReports.id, reportId)).limit(1);
  if (!report[0]) return false;
  let affected = 0;
  if (report[0].targetType === "track") {
    const result = await db.update(tracks).set({ moderationStatus: "takedown", takedownReason: "Ocultada após revisão da comunidade", removedAt: new Date(), updatedAt: new Date() }).where(eq(tracks.id, report[0].targetId));
    affected = Number(result[0]?.affectedRows ?? 0);
  } else if (report[0].targetType === "event") {
    const result = await db.update(events).set({ canceledAt: new Date(), cancelReason: "Evento ocultado após revisão da comunidade", updatedAt: new Date() }).where(eq(events.id, report[0].targetId));
    affected = Number(result[0]?.affectedRows ?? 0);
  }
  if (affected > 0) await updateModerationReport(reportId, "resolved");
  return affected > 0;
}

export async function toggleFollow(userId: number, artistId: number) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(follows).where(and(eq(follows.followerId, userId), eq(follows.artistId, artistId))).limit(1);
  if (existing.length) {
    await db.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.artistId, artistId)));
    return false;
  }
  await db.insert(follows).values({ followerId: userId, artistId });
  return true;
}

export async function toggleEventInterest(userId: number, eventId: number) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(eventInterests).where(and(eq(eventInterests.userId, userId), eq(eventInterests.eventId, eventId))).limit(1);
  if (existing.length) {
    await db.delete(eventInterests).where(and(eq(eventInterests.userId, userId), eq(eventInterests.eventId, eventId)));
    return false;
  }
  await db.insert(eventInterests).values({ userId, eventId });
  return true;
}

export type TrackPlayEligibility = {
  visibility: string;
  moderationStatus: string;
  removedAt: Date | null;
  releaseDate: Date | null;
};

export function isTrackEligibleForPlay(track: TrackPlayEligibility, now = new Date()) {
  return track.visibility === "public"
    && track.moderationStatus === "published"
    && track.removedAt === null
    && (track.releaseDate === null || track.releaseDate.getTime() <= now.getTime());
}

export async function recordTrackPlay(trackId: number, userId?: number) {
  return recordTrackListen(trackId, userId, 0);
}
export async function recordTrackListen(trackId: number, userId: number | undefined, listenedSeconds: number, city?: string) {
  const db = await getDb();
  if (!db) return false;
  const now = new Date();
  const eligibleTrack = await db.select({ durationSeconds: tracks.durationSeconds, visibility: tracks.visibility, moderationStatus: tracks.moderationStatus, removedAt: tracks.removedAt, releaseDate: tracks.releaseDate }).from(tracks).where(and(
    eq(tracks.id, trackId),
    eq(tracks.visibility, "public"),
    eq(tracks.moderationStatus, "published"),
    isNull(tracks.removedAt),
    or(isNull(tracks.releaseDate), lte(tracks.releaseDate, now)),
  )).limit(1);
  if (!eligibleTrack[0] || !isTrackEligibleForPlay(eligibleTrack[0], now)) return false;
  const maxListenSeconds = eligibleTrack[0].durationSeconds == null
    ? 86400
    : Math.max(0, Math.min(86400, eligibleTrack[0].durationSeconds));
  await db.insert(trackPlays).values({ trackId, userId: userId ?? null, listenedSeconds: Math.max(0, Math.min(maxListenSeconds, Math.floor(listenedSeconds))), city: city?.trim().slice(0, 120) || null });
  return true;
}

export async function listPublicEventTickets(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  const event = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), isNull(events.canceledAt))).limit(1);
  if (!event[0]) return [];
  const rows = await db.select({ id: eventTickets.id, eventId: eventTickets.eventId, name: eventTickets.name, price: eventTickets.price, quantityAvailable: eventTickets.quantityAvailable, quantityReserved: eventTickets.quantityReserved, pixKey: eventTickets.pixKey }).from(eventTickets).where(and(eq(eventTickets.eventId, eventId), eq(eventTickets.isAvailable, true))).orderBy(asc(eventTickets.price), asc(eventTickets.id)).limit(30);
  return rows.filter(row => row.quantityAvailable > row.quantityReserved).map(row => ({ ...row, available: row.quantityAvailable - row.quantityReserved }));
}

export async function listPublicMerchandise(artistId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: merchandise.id, artistId: merchandise.artistId, title: merchandise.name, description: merchandise.description, price: merchandise.price, stock: merchandise.stock, imageUrl: merchandise.imageUrl, externalUrl: merchandise.externalUrl }).from(merchandise).where(and(eq(merchandise.artistId, artistId), eq(merchandise.isAvailable, true))).orderBy(desc(merchandise.updatedAt)).limit(50);
  return rows.filter(row => row.stock > 0);
}

export async function listArtistMerchandise(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return [];
  return db.select().from(merchandise).where(eq(merchandise.artistId, artist.id)).orderBy(desc(merchandise.updatedAt)).limit(50);
}

export async function createArtistMerchandise(ownerId: number, input: { name: string; description?: string; price: number; stock: number; imageUrl?: string; externalUrl?: string }) {
  const db = await getDb();
  if (!db) return null;
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return null;
  const result = await db.insert(merchandise).values({ artistId: artist.id, name: input.name, description: input.description || null, price: input.price.toFixed(2), stock: input.stock, imageUrl: input.imageUrl || null, externalUrl: input.externalUrl || null, isAvailable: input.stock > 0 });
  return Number(result[0].insertId);
}

export async function createArtistEventTicket(ownerId: number, input: { eventId: number; name: string; price: number; quantityAvailable: number; pixKey?: string }) {
  const db = await getDb();
  if (!db) return null;
  const artist = await getArtistByOwnerId(ownerId);
  if (!artist) return null;
  const event = await db.select({ id: events.id }).from(events).where(and(eq(events.id, input.eventId), eq(events.artistId, artist.id))).limit(1);
  if (!event[0]) return null;
  const result = await db.insert(eventTickets).values({ eventId: input.eventId, name: input.name, price: input.price.toFixed(2), quantityAvailable: input.quantityAvailable, pixKey: input.pixKey || null, isAvailable: input.quantityAvailable > 0 });
  return Number(result[0].insertId);
}

export async function toggleSavedTrack(userId: number, trackId: number) {
  const db = await getDb();
  if (!db) return { saved: false, persisted: false };
  const track = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!track[0]) return { saved: false, persisted: true, missing: true };
  const existing = await db.select().from(savedTracks).where(and(eq(savedTracks.userId, userId), eq(savedTracks.trackId, trackId))).limit(1);
  if (existing.length) {
    await db.delete(savedTracks).where(and(eq(savedTracks.userId, userId), eq(savedTracks.trackId, trackId)));
    return { saved: false, persisted: true };
  }
  await db.insert(savedTracks).values({ userId, trackId });
  return { saved: true, persisted: true };
}

export async function createPlaylist(userId: number, name: string, collaborative: boolean) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(playlists).values({ ownerId: userId, name, collaborative });
  return Number(result[0].insertId);
}

export async function addTrackToPlaylist(userId: number, playlistId: number, trackId: number) {
  const db = await getDb();
  if (!db) return { ok: false as const, reason: "DATABASE" as const };
  const playlist = await db.select({ ownerId: playlists.ownerId, collaborative: playlists.collaborative }).from(playlists).where(eq(playlists.id, playlistId)).limit(1);
  if (!playlist[0]) return { ok: false as const, reason: "NOT_FOUND" as const };
  if (playlist[0].ownerId !== userId && !playlist[0].collaborative) return { ok: false as const, reason: "FORBIDDEN" as const };
  const track = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!track[0]) return { ok: false as const, reason: "TRACK_NOT_FOUND" as const };
  const existing = await db.select().from(playlistTracks).where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackId))).limit(1);
  if (existing.length) return { ok: true as const, added: false };
  const last = await db.select({ position: playlistTracks.position }).from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId)).orderBy(desc(playlistTracks.position)).limit(1);
  await db.insert(playlistTracks).values({ playlistId, trackId, addedBy: userId, position: (last[0]?.position ?? -1) + 1 });
  await db.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, playlistId));
  return { ok: true as const, added: true };
}

export async function getUserLibrary(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [followRows, interestRows, playlistRows, savedRows, recentRows] = await Promise.all([
    db.select({ artistId: follows.artistId }).from(follows).where(eq(follows.followerId, userId)),
    db.select({ eventId: eventInterests.eventId }).from(eventInterests).where(eq(eventInterests.userId, userId)),
    db.select({ id: playlists.id, name: playlists.name, collaborative: playlists.collaborative }).from(playlists).where(eq(playlists.ownerId, userId)).orderBy(desc(playlists.updatedAt)),
    db.select({ trackId: savedTracks.trackId }).from(savedTracks).where(eq(savedTracks.userId, userId)),
    db.select({ trackId: trackPlays.trackId }).from(trackPlays).where(eq(trackPlays.userId, userId)).orderBy(desc(trackPlays.playedAt)).limit(20),
  ]);
  const playlistsWithTracks = await Promise.all(playlistRows.map(async playlist => {
    const rows = await db.select({ trackId: playlistTracks.trackId }).from(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id)).orderBy(asc(playlistTracks.position));
    return { ...playlist, trackIds: rows.map(row => row.trackId) };
  }));
  return {
    followedArtistIds: followRows.map(row => row.artistId),
    interestedEventIds: interestRows.map(row => row.eventId),
    savedTrackIds: savedRows.map(row => row.trackId),
    recentTrackIds: Array.from(new Set(recentRows.map(row => row.trackId))),
    playlists: playlistsWithTracks,
  };
}
