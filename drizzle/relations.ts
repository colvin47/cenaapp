import { relations } from "drizzle-orm";
import {
  artists,
  collectiveMembers,
  collectives,
  eventInterests,
  eventTickets,
  events,
  follows,
  moderationReports,
  merchandise,
  playlistTracks,
  playlists,
  trackCredits,
  trackPlays,
  savedTracks,
  tracks,
  users,
} from "./schema";

export const usersRelations = relations(users, ({ one, many }) => ({
  artist: one(artists, { fields: [users.id], references: [artists.ownerId] }),
  playlists: many(playlists),
  follows: many(follows),
  eventInterests: many(eventInterests),
  trackPlays: many(trackPlays),
  savedTracks: many(savedTracks),
  collectives: many(collectives),
  reports: many(moderationReports),
}));

export const artistsRelations = relations(artists, ({ one, many }) => ({
  owner: one(users, { fields: [artists.ownerId], references: [users.id] }),
  tracks: many(tracks),
  events: many(events),
  merchandise: many(merchandise),
  followers: many(follows),
  collectiveMemberships: many(collectiveMembers),
  credits: many(trackCredits),
}));

export const collectivesRelations = relations(collectives, ({ one, many }) => ({
  owner: one(users, { fields: [collectives.ownerId], references: [users.id] }),
  members: many(collectiveMembers),
}));

export const collectiveMembersRelations = relations(collectiveMembers, ({ one }) => ({
  collective: one(collectives, { fields: [collectiveMembers.collectiveId], references: [collectives.id] }),
  artist: one(artists, { fields: [collectiveMembers.artistId], references: [artists.id] }),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  artist: one(artists, { fields: [tracks.artistId], references: [artists.id] }),
  playlistTracks: many(playlistTracks),
  plays: many(trackPlays),
  savedBy: many(savedTracks),
  credits: many(trackCredits),
}));

export const trackCreditsRelations = relations(trackCredits, ({ one }) => ({
  track: one(tracks, { fields: [trackCredits.trackId], references: [tracks.id] }),
  artist: one(artists, { fields: [trackCredits.artistId], references: [artists.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  artist: one(artists, { fields: [events.artistId], references: [artists.id] }),
  interests: many(eventInterests),
  tickets: many(eventTickets),
}));

export const eventTicketsRelations = relations(eventTickets, ({ one }) => ({
  event: one(events, { fields: [eventTickets.eventId], references: [events.id] }),
}));

export const merchandiseRelations = relations(merchandise, ({ one }) => ({
  artist: one(artists, { fields: [merchandise.artistId], references: [artists.id] }),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  owner: one(users, { fields: [playlists.ownerId], references: [users.id] }),
  tracks: many(playlistTracks),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, { fields: [playlistTracks.playlistId], references: [playlists.id] }),
  track: one(tracks, { fields: [playlistTracks.trackId], references: [tracks.id] }),
  addedByUser: one(users, { fields: [playlistTracks.addedBy], references: [users.id] }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, { fields: [follows.followerId], references: [users.id] }),
  artist: one(artists, { fields: [follows.artistId], references: [artists.id] }),
}));

export const eventInterestsRelations = relations(eventInterests, ({ one }) => ({
  user: one(users, { fields: [eventInterests.userId], references: [users.id] }),
  event: one(events, { fields: [eventInterests.eventId], references: [events.id] }),
}));

export const trackPlaysRelations = relations(trackPlays, ({ one }) => ({
  track: one(tracks, { fields: [trackPlays.trackId], references: [tracks.id] }),
  user: one(users, { fields: [trackPlays.userId], references: [users.id] }),
}));

export const savedTracksRelations = relations(savedTracks, ({ one }) => ({
  user: one(users, { fields: [savedTracks.userId], references: [users.id] }),
  track: one(tracks, { fields: [savedTracks.trackId], references: [tracks.id] }),
}));

export const moderationReportsRelations = relations(moderationReports, ({ one }) => ({
  reporter: one(users, { fields: [moderationReports.reporterId], references: [users.id] }),
}));
