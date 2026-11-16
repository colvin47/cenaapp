import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  city: varchar("city", { length: 120 }),
  favoriteGenres: varchar("favoriteGenres", { length: 255 }),
  publicBio: text("publicBio"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  adminRole: mysqlEnum("adminRole", ["owner", "moderator", "agenda"]).default("moderator").notNull(),
  accountType: mysqlEnum("accountType", ["listener", "artist"]).default("listener").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const artists = mysqlTable(
  "artists",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    handle: varchar("handle", { length: 80 }).notNull().unique(),
    profileType: mysqlEnum("profileType", ["solo", "band", "mc", "producer", "dj", "collective", "label", "venue"]).default("solo").notNull(),
    bio: text("bio"),
    manifesto: text("manifesto"),
    genre: varchar("genre", { length: 80 }),
    city: varchar("city", { length: 120 }).notNull(),
    avatarUrl: text("avatarUrl"),
    coverUrl: text("coverUrl"),
    instagramUrl: text("instagramUrl"),
    bandcampUrl: text("bandcampUrl"),
    supportUrl: text("supportUrl"),
    pixUrl: varchar("pixUrl", { length: 255 }),
    merchUrl: text("merchUrl"),
    isVerified: boolean("isVerified").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ cityIdx: index("idx_artists_city").on(table.city), typeIdx: index("idx_artists_profile_type").on(table.profileType) }),
);

export const collectives = mysqlTable(
  "collectives",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    handle: varchar("handle", { length: 80 }).notNull().unique(),
    type: mysqlEnum("type", ["collective", "label", "venue", "media", "festival"]).default("collective").notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    bio: text("bio"),
    manifesto: text("manifesto"),
    imageUrl: text("imageUrl"),
    supportUrl: text("supportUrl"),
    pixUrl: varchar("pixUrl", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ cityIdx: index("idx_collectives_city").on(table.city), ownerIdx: index("idx_collectives_owner").on(table.ownerId) }),
);

export const collectiveMembers = mysqlTable(
  "collectiveMembers",
  {
    collectiveId: int("collectiveId").notNull().references(() => collectives.id, { onDelete: "cascade" }),
    artistId: int("artistId").notNull().references(() => artists.id, { onDelete: "cascade" }),
    memberRole: varchar("memberRole", { length: 100 }),
    permission: mysqlEnum("permission", ["owner", "editor", "agenda", "member"]).default("member").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ pk: primaryKey({ columns: [table.collectiveId, table.artistId] }), artistIdx: index("idx_collective_members_artist").on(table.artistId) }),
);

export const collectiveInvites = mysqlTable(
  "collectiveInvites",
  {
    id: int("id").autoincrement().primaryKey(),
    collectiveId: int("collectiveId").notNull().references(() => collectives.id, { onDelete: "cascade" }),
    inviterId: int("inviterId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
    permission: mysqlEnum("permission", ["editor", "agenda", "member"]).default("member").notNull(),
    email: varchar("email", { length: 320 }),
    expiresAt: timestamp("expiresAt").notNull(),
    acceptedAt: timestamp("acceptedAt"),
    declinedAt: timestamp("declinedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ collectiveIdx: index("idx_collective_invites_collective").on(table.collectiveId), tokenIdx: index("idx_collective_invites_token").on(table.tokenHash) }),
);
export const tracks = mysqlTable(
  "tracks",
  {
    id: int("id").autoincrement().primaryKey(),
    artistId: int("artistId").notNull().references(() => artists.id, { onDelete: "cascade" }),
    collectiveId: int("collectiveId").references(() => collectives.id, { onDelete: "set null" }),
    title: varchar("title", { length: 180 }).notNull(),
    album: varchar("album", { length: 180 }),
    genre: varchar("genre", { length: 80 }),
    city: varchar("city", { length: 120 }).notNull(),
    description: text("description"),
    releaseType: mysqlEnum("releaseType", ["single", "album", "demo", "live", "split", "compilation"]).default("single").notNull(),
    releaseDate: timestamp("releaseDate"),
    visibility: mysqlEnum("visibility", ["public", "private"]).default("public").notNull(),
    sourceType: mysqlEnum("sourceType", ["upload", "spotify", "youtube", "bandcamp", "soundcloud"]).default("upload").notNull(),
    externalUrl: text("externalUrl"),
    creditsNote: text("creditsNote"),
    coverUrl: text("coverUrl"),
    bookletPages: text("bookletPages"),
    audioUrl: text("audioUrl"),
    idempotencyKey: varchar("idempotencyKey", { length: 64 }).notNull().unique(),
    durationSeconds: int("durationSeconds"),
    rightsDeclared: boolean("rightsDeclared").default(false).notNull(),
    rightsDeclaredAt: timestamp("rightsDeclaredAt"),
    moderationStatus: mysqlEnum("moderationStatus", ["published", "pending_review", "takedown"]).default("published").notNull(),
    takedownReason: text("takedownReason"),
    removedAt: timestamp("removedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ artistIdx: index("idx_tracks_artist").on(table.artistId), cityGenreIdx: index("idx_tracks_city_genre").on(table.city, table.genre), formatIdx: index("idx_tracks_release_type").on(table.releaseType), createdAtIdx: index("idx_tracks_created_at").on(table.createdAt), collectiveIdx: index("idx_tracks_collective").on(table.collectiveId) }),
);

export const trackCredits = mysqlTable(
  "trackCredits",
  {
    trackId: int("trackId").notNull().references(() => tracks.id, { onDelete: "cascade" }),
    creditName: varchar("creditName", { length: 160 }).notNull(),
    creditRole: varchar("creditRole", { length: 100 }).notNull(),
    artistId: int("artistId").references(() => artists.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ pk: primaryKey({ columns: [table.trackId, table.creditName, table.creditRole] }), artistIdx: index("idx_track_credits_artist").on(table.artistId) }),
);

export const events = mysqlTable(
  "events",
  {
    id: int("id").autoincrement().primaryKey(),
    artistId: int("artistId").notNull().references(() => artists.id, { onDelete: "cascade" }),
    collectiveId: int("collectiveId").references(() => collectives.id, { onDelete: "set null" }),
    name: varchar("name", { length: 180 }).notNull(),
    venue: varchar("venue", { length: 180 }).notNull(),
    address: varchar("address", { length: 255 }),
    city: varchar("city", { length: 120 }).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    eventType: mysqlEnum("eventType", ["show", "battle", "cypher", "cultural_round", "diy_festival", "occupation", "zine_fair", "workshop", "listening_party", "release"]).default("show").notNull(),
    admissionType: mysqlEnum("admissionType", ["ticket", "free", "contribution"]).default("ticket").notNull(),
    eventDate: timestamp("eventDate").notNull(),
    description: text("description"),
    program: text("program"),
    accessibility: text("accessibility"),
    safeSpace: boolean("safeSpace").default(false).notNull(),
    ageRating: varchar("ageRating", { length: 40 }),
    ticketUrl: text("ticketUrl"),
    canceledAt: timestamp("canceledAt"),
    cancelReason: text("cancelReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ cityDateIdx: index("idx_events_city_date").on(table.city, table.eventDate), typeIdx: index("idx_events_type").on(table.eventType), artistIdx: index("idx_events_artist").on(table.artistId), collectiveIdx: index("idx_events_collective").on(table.collectiveId) }),
);

export const eventTickets = mysqlTable(
  "eventTickets",
  {
    id: int("id").autoincrement().primaryKey(),
    eventId: int("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).default("0.00").notNull(),
    quantityAvailable: int("quantityAvailable").default(0).notNull(),
    quantityReserved: int("quantityReserved").default(0).notNull(),
    pixKey: varchar("pixKey", { length: 255 }),
    isAvailable: boolean("isAvailable").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ eventIdx: index("idx_event_tickets_event_available").on(table.eventId, table.isAvailable) }),
);

export const merchandise = mysqlTable(
  "merchandise",
  {
    id: int("id").autoincrement().primaryKey(),
    artistId: int("artistId").notNull().references(() => artists.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).default("0.00").notNull(),
    stock: int("stock").default(0).notNull(),
    imageUrl: text("imageUrl"),
    externalUrl: text("externalUrl"),
    isAvailable: boolean("isAvailable").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ artistAvailableIdx: index("idx_merchandise_artist_available").on(table.artistId, table.isAvailable) }),
);

export const playlists = mysqlTable(
  "playlists",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    collaborative: boolean("collaborative").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ ownerIdx: index("idx_playlists_owner").on(table.ownerId) }),
);

export const playlistTracks = mysqlTable(
  "playlistTracks",
  {
    playlistId: int("playlistId").notNull().references(() => playlists.id, { onDelete: "cascade" }),
    trackId: int("trackId").notNull().references(() => tracks.id, { onDelete: "cascade" }),
    addedBy: int("addedBy").references(() => users.id, { onDelete: "set null" }),
    position: int("position").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ pk: primaryKey({ columns: [table.playlistId, table.trackId] }), playlistPositionIdx: index("idx_playlist_tracks_position").on(table.playlistId, table.position) }),
);

export const follows = mysqlTable(
  "follows",
  {
    followerId: int("followerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    artistId: int("artistId").notNull().references(() => artists.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ pk: primaryKey({ columns: [table.followerId, table.artistId] }), artistIdx: index("idx_follows_artist").on(table.artistId) }),
);

export const eventInterests = mysqlTable(
  "eventInterests",
  {
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    eventId: int("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ pk: primaryKey({ columns: [table.userId, table.eventId] }), eventIdx: index("idx_event_interests_event").on(table.eventId) }),
);

export const trackPlays = mysqlTable(
  "trackPlays",
  {
    id: int("id").autoincrement().primaryKey(),
    trackId: int("trackId").notNull().references(() => tracks.id, { onDelete: "cascade" }),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    listenedSeconds: int("listenedSeconds").default(0).notNull(),
    city: varchar("city", { length: 120 }),
    playedAt: timestamp("playedAt").defaultNow().notNull(),
  },
  table => ({ trackDateIdx: index("idx_track_plays_track_date").on(table.trackId, table.playedAt), userDateIdx: index("idx_track_plays_user_date").on(table.userId, table.playedAt) }),
);

export const savedTracks = mysqlTable(
  "savedTracks",
  {
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    trackId: int("trackId").notNull().references(() => tracks.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ pk: primaryKey({ columns: [table.userId, table.trackId] }), trackIdx: index("idx_saved_tracks_track").on(table.trackId) }),
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["release", "event", "moderation", "system"]).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    body: text("body").notNull(),
    href: varchar("href", { length: 255 }),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ userDateIdx: index("idx_notifications_user_date").on(table.userId, table.createdAt) }),
);

export const moderationReports = mysqlTable(
  "moderationReports",
  {
    id: int("id").autoincrement().primaryKey(),
    reporterId: int("reporterId").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: mysqlEnum("targetType", ["track", "artist", "event", "collective"]).notNull(),
    targetId: int("targetId").notNull(),
    reason: varchar("reason", { length: 120 }).notNull(),
    details: text("details"),
    status: mysqlEnum("status", ["open", "reviewed", "resolved", "rejected"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
  },
  table => ({ targetIdx: index("idx_reports_target").on(table.targetType, table.targetId), statusIdx: index("idx_reports_status").on(table.status) }),
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actorId").notNull().references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 120 }).notNull(),
    targetType: varchar("targetType", { length: 40 }).notNull(),
    targetId: int("targetId"),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ actorDateIdx: index("idx_audit_actor_date").on(table.actorId, table.createdAt), targetIdx: index("idx_audit_target").on(table.targetType, table.targetId) }),
);
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Artist = typeof artists.$inferSelect;
export type InsertArtist = typeof artists.$inferInsert;
export type Collective = typeof collectives.$inferSelect;
export type InsertCollective = typeof collectives.$inferInsert;
export type CollectiveMember = typeof collectiveMembers.$inferSelect;
export type InsertCollectiveMember = typeof collectiveMembers.$inferInsert;
export type Track = typeof tracks.$inferSelect;
export type InsertTrack = typeof tracks.$inferInsert;
export type TrackCredit = typeof trackCredits.$inferSelect;
export type InsertTrackCredit = typeof trackCredits.$inferInsert;
export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;
export type EventTicket = typeof eventTickets.$inferSelect;
export type InsertEventTicket = typeof eventTickets.$inferInsert;
export type Merchandise = typeof merchandise.$inferSelect;
export type InsertMerchandise = typeof merchandise.$inferInsert;
export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = typeof playlists.$inferInsert;
export type PlaylistTrack = typeof playlistTracks.$inferSelect;
export type InsertPlaylistTrack = typeof playlistTracks.$inferInsert;
export type Follow = typeof follows.$inferSelect;
export type InsertFollow = typeof follows.$inferInsert;
export type EventInterest = typeof eventInterests.$inferSelect;
export type InsertEventInterest = typeof eventInterests.$inferInsert;
export type TrackPlay = typeof trackPlays.$inferSelect;
export type InsertTrackPlay = typeof trackPlays.$inferInsert;
export type SavedTrack = typeof savedTracks.$inferSelect;
export type InsertSavedTrack = typeof savedTracks.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type ModerationReport = typeof moderationReports.$inferSelect;
export type InsertModerationReport = typeof moderationReports.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
