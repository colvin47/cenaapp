import { sceneArtists, sceneActivity, sceneEvents, sceneGenres, scenePlaylists, sceneTracks } from "@shared/scene-seed";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { artists, events, follows, notifications, tracks } from "../drizzle/schema";
import { addTrackToPlaylist, cancelArtistEvent, createArtistEventTicket, createArtistMerchandise, createArtistProfile, createCustomNotification, addCollectiveMember, createCollective, createModerationReport, createPlaylist, hideReportedContent, acceptCollectiveInvite, acceptPendingCollectiveInvite, createCollectiveInvite, declineCollectiveInvite, getCollectivePermission, listArtistMerchandise, listPublicEventTickets, listPublicMerchandise, listAuditLogs, listCollectiveMembers, listPendingCollectiveInvites, previewCollectiveInvite, listModerationReports, listUserCollectives, removeCollectiveMember, updateCollectiveMember, updateModerationReport, writeAuditLog, findArtists, findTracks, getArtistByOwnerId, getArtistCatalog, getArtistStats, getArtistPublicDetail, getDb, getEventDetail, getPlaylistDetail, getTrackDetail, getUserLibrary, listArtistEvents, listEvents, listNotifications, markNotificationsRead, recordTrackListen, setAccountType, takedownTrack, toggleEventInterest, toggleFollow, toggleSavedTrack, updateArtistEvent, updateArtistProfile, updateListenerProfile, deleteArtistEvent } from "./db";
import { storageDelete, storagePresignPut } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { canAudit, canBroadcast, canModerate } from "./permissions";
import { parseExternalTrackUrl } from "@shared/track-source";

const discoveryInput = z.object({
  city: z.string().trim().min(1).max(120).default("Campinas"),
  genre: z.string().trim().max(80).default("Tudo"),
  search: z.string().trim().max(120).default(""),
});

const publicHttpsUrl = z.string().trim().url().max(2048).refine(value => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use um endereço HTTPS.");
const currencyPrice = z.number().min(0).max(999999.99).refine(amount => {
  const cents = amount * 100;
  return Math.abs(cents - Math.round(cents)) <= Number.EPSILON * Math.max(1, Math.abs(cents)) * 4;
}, "O preço deve ter no máximo duas casas decimais.");
const hasCoordinatePair = (coordinates: { latitude?: number | null; longitude?: number | null }) =>
  (coordinates.latitude === undefined && coordinates.longitude === undefined)
  || (coordinates.latitude === null && coordinates.longitude === null)
  || (typeof coordinates.latitude === "number" && typeof coordinates.longitude === "number");

function foldSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function cityMatches(value: string, selected: string) {
  const city = foldSearch(value).split(",")[0];
  const wanted = foldSearch(selected).split(",")[0];
  return !wanted || city === wanted;
}

function filterSeed(input: z.infer<typeof discoveryInput>) {
  const query = foldSearch(input.search);
  const tracksResult = sceneTracks.filter(track => {
    const matchesCity = cityMatches(track.city, input.city);
    const matchesGenre = input.genre === "Tudo" || track.genre === input.genre;
    const haystack = foldSearch(`${track.title} ${track.artist} ${track.genre} ${track.city} ${track.creditsNote ?? ""}`);
    return matchesCity && matchesGenre && (!query || haystack.includes(query));
  });
  const artistsResult = sceneArtists.filter(artist => {
    const matchesCity = cityMatches(artist.city, input.city);
    const haystack = foldSearch(`${artist.name} ${artist.handle} ${artist.genre} ${artist.city} ${artist.bio} ${artist.manifesto ?? ""}`);
    return matchesCity && (!query || haystack.includes(query));
  });
  const eventsResult = sceneEvents.filter(event => {
    const matchesCity = cityMatches(event.city, input.city);
    const haystack = foldSearch(`${event.title} ${event.place} ${event.city} ${event.description} ${event.program ?? ""} ${event.eventType ?? ""}`);
    return matchesCity && (!query || haystack.includes(query));
  });
  return { tracks: tracksResult, artists: artistsResult, events: eventsResult, source: "seed" as const };
}

function demoOrEmpty(input: z.infer<typeof discoveryInput>) {
  const isDemoCity = input.city.trim().toLowerCase() === "campinas" || input.city.trim().toLowerCase() === "campinas, sp";
  if (isDemoCity) return filterSeed(input);
  return { tracks: [], artists: [], events: [], source: "empty" as const };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie("webdev_app_session", { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  scene: router({
    discovery: publicProcedure.input(discoveryInput).query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        const demo = demoOrEmpty(input);
        const isDemo = demo.source === "seed";
        return { ...demo, city: input.city, genres: sceneGenres, playlists: isDemo ? scenePlaylists : [], activity: isDemo ? sceneActivity : [] };
      }
      const [dbTracks, dbArtists, dbEvents] = await Promise.all([
        findTracks(input.search, input.genre, input.city),
        findArtists(input.search, input.city),
        listEvents(input.city, input.search),
      ]);
      if (!dbTracks.length && !dbArtists.length && !dbEvents.length) {
        return { tracks: [], artists: [], events: [], source: "empty" as const, city: input.city, genres: sceneGenres, playlists: [], activity: [] };
      }
      return {
        tracks: dbTracks.map(track => ({ ...track, duration: track.duration ?? 0, releaseType: track.releaseType ?? "single", creditsNote: track.creditsNote ?? "", cover: track.cover ?? sceneTracks[0].cover, embedUrl: track.externalUrl ? parseExternalTrackUrl(track.externalUrl)?.embedUrl ?? null : null, accent: "#c8f36a" })),
        artists: dbArtists.map(artist => ({ id: artist.id, name: artist.name, handle: artist.handle, profileType: artist.profileType ?? "solo", genre: artist.genre ?? "Cena local", bio: artist.bio ?? "", manifesto: artist.manifesto ?? "", city: artist.city, image: artist.avatarUrl ?? sceneArtists[0].image, accent: "#c8f36a", followers: "—", supportUrl: artist.supportUrl ?? undefined, pixUrl: artist.pixUrl ?? undefined, merchUrl: artist.merchUrl ?? undefined, instagramUrl: artist.instagramUrl ?? undefined, bandcampUrl: artist.bandcampUrl ?? undefined })),
        events: dbEvents.map(event => ({ ...event, day: event.eventDate.toLocaleDateString("pt-BR", { day: "2-digit" }), month: event.eventDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(), time: event.eventDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), isoDate: event.eventDate.toISOString(), color: "lime" as const, interest: Number(event.interest ?? 0) })),
        source: "database" as const,
        city: input.city,
        genres: sceneGenres,
        playlists: [],
        activity: [],
      };
    }),

    setAccountType: protectedProcedure.input(z.object({ accountType: z.enum(["listener", "artist"]) })).mutation(async ({ ctx, input }) => {
      const updated = await setAccountType(ctx.user.id, input.accountType);
      return { accountType: input.accountType, persisted: updated };
    }),
    updateListenerProfile: protectedProcedure.input(z.object({ city: z.string().trim().min(2).max(120), favoriteGenres: z.string().trim().max(255).optional(), publicBio: z.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => ({ persisted: await updateListenerProfile(ctx.user.id, input) })),

    library: protectedProcedure.query(({ ctx }) => getUserLibrary(ctx.user.id)),
    notifications: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user.id)),
    markNotificationsRead: protectedProcedure.mutation(({ ctx }) => markNotificationsRead(ctx.user.id)),
    createCustomNotification: protectedProcedure.input(z.object({ title: z.string().trim().min(3).max(220), body: z.string().trim().min(3).max(1000), href: z.string().trim().max(255).optional() })).mutation(async ({ ctx, input }) => {
      if (!canBroadcast(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Sua função não permite enviar avisos." });
      return createCustomNotification(input);
    }),
    suggestTrackMetadata: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(220), album: z.string().trim().max(220).optional(), genre: z.string().trim().max(80).optional(), city: z.string().trim().max(120), description: z.string().trim().max(1000).optional(), releaseType: z.string().trim().max(40), creditsNote: z.string().trim().max(1000).optional(), audioName: z.string().trim().max(255).optional(), durationSeconds: z.number().int().nonnegative().max(86400).optional(), artistName: z.string().trim().max(160).optional(), artistBio: z.string().trim().max(1000).optional(), artistGenre: z.string().trim().max(80).optional(), profileType: z.string().trim().max(40).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Ative o perfil de artista antes de gerar sugestões." });
      const result = await invokeLLM({
        messages: [
          { role: "system", content: "Você é uma pessoa editora cuidadosa do CENA, uma plataforma brasileira de música independente. Gere sugestões em português do Brasil, sem inventar fatos não fornecidos. Seja específico sobre o contexto underground somente quando houver pistas nos dados. Nunca confirme direitos autorais, autoria ou identidade. O resultado será revisado pelo artista antes da publicação." },
          { role: "user", content: JSON.stringify({ tarefa: "Sugerir descrição de faixa, gênero editorial, créditos e bio da banda/artista", dados: input }) },
        ],
        outputSchema: { name: "cena_track_suggestion", strict: true, schema: { type: "object", additionalProperties: false, properties: { description: { type: "string", description: "Descrição editorial curta da faixa, em 1 ou 2 frases." }, genre: { type: "string", description: "Gênero ou subgênero sugerido, mantendo o gênero informado quando não houver evidência para mudar." }, album: { type: "string", description: "Álbum/projeto sugerido; vazio quando não houver informação." }, creditsNote: { type: "string", description: "Créditos organizados a partir do texto fornecido; não invente nomes." }, artistBio: { type: "string", description: "Sugestão curta para a bio do artista, baseada somente nos dados fornecidos." }, tags: { type: "array", items: { type: "string" }, description: "Até cinco tags editoriais curtas." } }, required: ["description", "genre", "album", "creditsNote", "artistBio", "tags"] } },
        maxTokens: 900,
      });
      const content = result.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.filter(part => part.type === "text").map(part => part.text).join(" ") : "";
      if (!text) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A IA não retornou uma sugestão. Tente novamente ou preencha manualmente." });
      try {
        const parsed = JSON.parse(text) as { description?: string; genre?: string; album?: string; creditsNote?: string; artistBio?: string; tags?: string[] };
        return { description: parsed.description?.slice(0, 1000) || input.description || "", genre: parsed.genre?.slice(0, 80) || input.genre || "", album: parsed.album?.slice(0, 220) || input.album || "", creditsNote: parsed.creditsNote?.slice(0, 1000) || input.creditsNote || "", artistBio: parsed.artistBio?.slice(0, 1000) || input.artistBio || "", tags: Array.isArray(parsed.tags) ? parsed.tags.filter(tag => typeof tag === "string").slice(0, 5) : [] };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A sugestão veio em um formato inesperado. Tente novamente ou preencha manualmente." });
      }
    }),

    myArtistProfile: protectedProcedure.query(({ ctx }) => getArtistByOwnerId(ctx.user.id)),
    artistStats: protectedProcedure.query(({ ctx }) => getArtistStats(ctx.user.id)),
    artistCatalog: protectedProcedure.query(({ ctx }) => getArtistCatalog(ctx.user.id)),
    myEvents: protectedProcedure.query(({ ctx }) => listArtistEvents(ctx.user.id)),
    trackDetail: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getTrackDetail(input.id)),
    eventDetail: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getEventDetail(input.id)),
    eventTickets: publicProcedure.input(z.object({ eventId: z.number().int().positive() })).query(({ input }) => listPublicEventTickets(input.eventId)),
    artistMerchandise: publicProcedure.input(z.object({ artistId: z.number().int().positive() })).query(({ input }) => listPublicMerchandise(input.artistId)),
    artistDetail: publicProcedure.input(z.object({ handle: z.string().trim().min(1).max(80).regex(/^@?[a-zA-Z0-9_]+$/) })).query(({ input }) => getArtistPublicDetail(input.handle)),
    playlistDetail: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => getPlaylistDetail(input.id, ctx.user?.id)),

    createArtistProfile: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), handle: z.string().trim().min(2).max(80).regex(/^@?[a-zA-Z0-9_]+$/), city: z.string().trim().min(2).max(120), profileType: z.enum(["solo", "band", "mc", "producer", "dj", "collective", "label", "venue"]).default("solo"), genre: z.string().trim().max(80).optional(), bio: z.string().trim().max(1000).optional(), manifesto: z.string().trim().max(1500).optional(), supportUrl: z.string().url().max(2048).optional(), pixUrl: z.string().trim().max(255).optional(), merchUrl: z.string().url().max(2048).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Ative o perfil de artista antes de continuar." });
      const handle = input.handle.startsWith("@") ? input.handle : `@${input.handle}`;
      try {
        const profile = await createArtistProfile(ctx.user.id, { ...input, handle });
        if (!profile) return { persisted: false, profile: null };
        return { persisted: true, profile };
      } catch (error) {
        if (String(error).toLowerCase().includes("duplicate")) throw new TRPCError({ code: "CONFLICT", message: "Esse @ já está em uso. Escolha outro." });
        throw error;
      }
    }),

    updateArtistProfile: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), handle: z.string().trim().min(2).max(80).regex(/^@?[a-zA-Z0-9_]+$/), city: z.string().trim().min(2).max(120), profileType: z.enum(["solo", "band", "mc", "producer", "dj", "collective", "label", "venue"]).optional(), genre: z.string().trim().max(80).optional(), bio: z.string().trim().max(1000).optional(), manifesto: z.string().trim().max(1500).optional(), avatarUrl: z.string().url().max(2048).optional(), coverUrl: z.string().url().max(2048).optional(), instagramUrl: z.string().url().max(2048).optional(), bandcampUrl: z.string().url().max(2048).optional(), supportUrl: z.string().url().max(2048).optional(), pixUrl: z.string().trim().max(255).optional(), merchUrl: z.string().url().max(2048).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Ative o perfil de artista antes de editar." });
      const handle = input.handle.startsWith("@") ? input.handle : `@${input.handle}`;
      try {
        const profile = await updateArtistProfile(ctx.user.id, { ...input, handle });
        if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Crie seu perfil de artista antes de editar." });
        return { persisted: true, profile };
      } catch (error) {
        if (String(error).toLowerCase().includes("duplicate")) throw new TRPCError({ code: "CONFLICT", message: "Esse @ já está em uso. Escolha outro." });
        throw error;
      }
    }),

    followArtist: protectedProcedure.input(z.object({ artistId: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ followed: await toggleFollow(ctx.user.id, input.artistId) })),
    interestEvent: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ interested: await toggleEventInterest(ctx.user.id, input.eventId) })),
    saveTrack: protectedProcedure.input(z.object({ trackId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await toggleSavedTrack(ctx.user.id, input.trackId);
      if (result.missing) throw new TRPCError({ code: "NOT_FOUND", message: "Essa faixa não está disponível para salvar." });
      return result;
    }),
    takedownTrack: protectedProcedure.input(z.object({ trackId: z.number().int().positive(), reason: z.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem remover suas faixas." });
      const removed = await takedownTrack(ctx.user.id, input.trackId, input.reason);
      if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "Faixa não encontrada ou já removida." });
      return { removed: true };
    }),
    recordPlay: publicProcedure.input(z.object({ trackId: z.number().int().positive(), listenedSeconds: z.number().int().min(0).max(86400).default(0), city: z.string().trim().max(120).optional() })).mutation(async ({ ctx, input }) => ({ recorded: await recordTrackListen(input.trackId, ctx.user?.id, input.listenedSeconds, input.city) })),
    myMerchandise: protectedProcedure.query(({ ctx }) => listArtistMerchandise(ctx.user.id)),
    createMerchandise: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), description: z.string().trim().max(1000).optional(), price: currencyPrice, stock: z.number().int().min(0).max(100000), imageUrl: publicHttpsUrl.optional(), externalUrl: publicHttpsUrl.optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem cadastrar produtos." });
      const id = await createArtistMerchandise(ctx.user.id, input);
      if (!id) throw new TRPCError({ code: "BAD_REQUEST", message: "Crie seu perfil de artista antes de cadastrar produtos." });
      await writeAuditLog({ actorId: ctx.user.id, action: "merchandise.created", targetType: "merchandise", targetId: id, metadata: { name: input.name } });
      return { id, persisted: true };
    }),
    createEventTicket: protectedProcedure.input(z.object({ eventId: z.number().int().positive(), name: z.string().trim().min(2).max(100), price: currencyPrice, quantityAvailable: z.number().int().min(0).max(100000), pixKey: z.string().trim().max(255).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem cadastrar lotes de ingresso." });
      const id = await createArtistEventTicket(ctx.user.id, input);
      if (!id) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado no seu perfil." });
      await writeAuditLog({ actorId: ctx.user.id, action: "event.ticket.created", targetType: "event", targetId: input.eventId, metadata: { name: input.name, price: input.price } });
      return { id, persisted: true };
    }),

    requestUpload: protectedProcedure.input(z.object({ kind: z.enum(["audio", "image"]), fileName: z.string().trim().min(1).max(180), contentType: z.string().trim().min(1).max(120), size: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem enviar arquivos." });
      const maxSize = input.kind === "audio" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (input.size > maxSize) throw new TRPCError({ code: "BAD_REQUEST", message: `O arquivo excede o limite de ${input.kind === "audio" ? "50 MB" : "10 MB"}.` });
      const extension = input.fileName.includes(".") ? input.fileName.split(".").pop()?.toLowerCase() : "bin";
      const allowed = input.kind === "audio" ? ["mp3", "wav", "m4a", "ogg"] : ["jpg", "jpeg", "png", "webp"];
      if (!extension || !allowed.includes(extension)) throw new TRPCError({ code: "BAD_REQUEST", message: "Formato de arquivo não suportado." });
      const allowedContentTypes = input.kind === "audio" ? ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/ogg"] : ["image/jpeg", "image/png", "image/webp"];
      if (!allowedContentTypes.includes(input.contentType.toLowerCase())) throw new TRPCError({ code: "BAD_REQUEST", message: "O tipo MIME do arquivo não é suportado." });
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-140);
      return storagePresignPut(`cena/${ctx.user.id}/${input.kind}/${Date.now()}-${safeName}`, input.contentType.toLowerCase());
    }),

    cleanupUpload: protectedProcedure.input(z.object({ paths: z.array(z.string().trim().min(1).max(2048)).max(14) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem limpar uploads." });
      const prefix = `/manus-storage/cena/${ctx.user.id}/`;
      const ownedPaths = input.paths.filter(path => path.startsWith(prefix));
      const results = await Promise.allSettled(ownedPaths.map(path => storageDelete(path.replace(/^\/manus-storage\//, ""))));
      return { attempted: ownedPaths.length, removed: results.filter(result => result.status === "fulfilled" && result.value).length };
    }),
    createPlaylist: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(160), collaborative: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      const id = await createPlaylist(ctx.user.id, input.name, input.collaborative);
      return { id, name: input.name, collaborative: input.collaborative, persisted: id !== null };
    }),

    addTrackToPlaylist: protectedProcedure.input(z.object({ playlistId: z.number().int().positive(), trackId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await addTrackToPlaylist(ctx.user.id, input.playlistId, input.trackId);
      if (result.reason === "FORBIDDEN") throw new TRPCError({ code: "FORBIDDEN", message: "Essa playlist não está aberta para colaboração." });
      if (result.reason === "NOT_FOUND" || result.reason === "TRACK_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Playlist ou faixa não encontrada." });
      return result;
    }),

    updateEvent: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(180), venue: z.string().trim().min(1).max(180), city: z.string().trim().min(1).max(120), address: z.string().trim().max(255).nullable().optional(), latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), eventDate: z.string().datetime(), eventType: z.enum(["show", "battle", "cypher", "cultural_round", "diy_festival", "occupation", "zine_fair", "workshop", "listening_party", "release"]).default("show"), admissionType: z.enum(["ticket", "free", "contribution"]).default("ticket"), description: z.string().max(500).optional(), program: z.string().max(1000).optional(), accessibility: z.string().max(500).optional(), safeSpace: z.boolean().default(false), ageRating: z.string().max(40).optional(), ticketUrl: publicHttpsUrl.optional() }).refine(hasCoordinatePair, { message: "Informe latitude e longitude juntas.", path: ["longitude"] })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem editar eventos." });
      const event = await updateArtistEvent(ctx.user.id, input.id, { ...input, eventDate: new Date(input.eventDate) });
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
      return { persisted: true, event };
    }),
    cancelEvent: protectedProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem cancelar eventos." });
      const canceled = await cancelArtistEvent(ctx.user.id, input.id, input.reason);
      if (!canceled) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
      return { canceled: true };
    }),
    deleteEvent: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem excluir eventos." });
      const deleted = await deleteArtistEvent(ctx.user.id, input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
      return { deleted: true };
    }),
    createEvent: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(180), venue: z.string().trim().min(1).max(180), city: z.string().trim().min(1).max(120), address: z.string().trim().max(255).optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), eventDate: z.string().datetime(), collectiveId: z.number().int().positive().optional(), eventType: z.enum(["show", "battle", "cypher", "cultural_round", "diy_festival", "occupation", "zine_fair", "workshop", "listening_party", "release"]).default("show"), admissionType: z.enum(["ticket", "free", "contribution"]).default("ticket"), description: z.string().max(500).optional(), program: z.string().max(1000).optional(), accessibility: z.string().max(500).optional(), safeSpace: z.boolean().default(false), ageRating: z.string().max(40).optional(), ticketUrl: publicHttpsUrl.optional() }).refine(hasCoordinatePair, { message: "Informe latitude e longitude juntas.", path: ["longitude"] })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem criar eventos." });
      if (input.collectiveId) {
        const permission = await getCollectivePermission(ctx.user.id, input.collectiveId);
        if (!permission || !["owner", "editor", "agenda"].includes(permission)) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode publicar agenda neste coletivo." });
      }
      const db = await getDb();
      if (!db) return { persisted: false, id: null };
      const owner = await db.select({ id: artists.id }).from(artists).where(eq(artists.ownerId, ctx.user.id)).limit(1);
      if (!owner[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Crie seu perfil de artista antes de criar um evento." });
      const result = await db.insert(events).values({ ...input, latitude: input.latitude == null ? null : String(input.latitude), longitude: input.longitude == null ? null : String(input.longitude), artistId: owner[0].id, eventDate: new Date(input.eventDate) });
      const followers = await db.select({ userId: follows.followerId }).from(follows).where(eq(follows.artistId, owner[0].id));
      if (followers.length) await db.insert(notifications).values(followers.map(follower => ({ userId: follower.userId, kind: "event" as const, title: "Novo show na sua cena", body: `${input.name} foi adicionado à agenda.`, href: `/eventos/${Number(result[0].insertId)}` })));
      return { persisted: true, id: Number(result[0].insertId) };
    }),

    createTrack: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(180), album: z.string().max(180).optional(), genre: z.string().max(80).optional(), city: z.string().trim().min(1).max(120), collectiveId: z.number().int().positive().optional(), description: z.string().max(1000).optional(), releaseType: z.enum(["single", "album", "demo", "live", "split", "compilation"]).default("single"), releaseDate: z.string().datetime().optional(), visibility: z.enum(["public", "private"]).default("public"), sourceType: z.enum(["upload", "spotify", "youtube", "bandcamp", "soundcloud"]).default("upload"), externalUrl: z.string().trim().url().max(2048).optional(), creditsNote: z.string().max(1500).optional(), idempotencyKey: z.string().trim().min(16).max(64), coverUrl: z.string().trim().min(1).max(2048).optional(), bookletPages: z.array(z.string().trim().min(1).max(2048)).max(12).optional(), audioUrl: z.string().trim().min(1).max(2048).optional(), durationSeconds: z.number().int().nonnegative().optional(), rightsDeclared: z.literal(true) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.accountType !== "artist" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas artistas podem enviar faixas." });
      const externalSource = input.externalUrl ? parseExternalTrackUrl(input.externalUrl) : null;
      if (input.sourceType === "upload" && !input.audioUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie um áudio próprio ou escolha uma fonte externa." });
      if (input.sourceType !== "upload" && (!externalSource || externalSource.sourceType !== input.sourceType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Cole um link válido do provedor escolhido." });
      const ownedAudioPrefix = `/manus-storage/cena/${ctx.user.id}/audio/`;
      const ownedCoverPrefix = `/manus-storage/cena/${ctx.user.id}/image/`;
      if ((input.audioUrl && !input.audioUrl.startsWith(ownedAudioPrefix)) || (input.coverUrl && !input.coverUrl.startsWith(ownedCoverPrefix)) || (input.bookletPages ?? []).some(page => !page.startsWith(ownedCoverPrefix))) throw new TRPCError({ code: "BAD_REQUEST", message: "Os arquivos precisam ser enviados pelo fluxo oficial da Cena." });
      if (input.collectiveId) {
        const permission = await getCollectivePermission(ctx.user.id, input.collectiveId);
        if (!permission || !["owner", "editor"].includes(permission)) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode publicar faixas neste coletivo." });
      }
      const db = await getDb();
      if (!db) return { persisted: false, id: null };
      const owner = await db.select({ id: artists.id }).from(artists).where(eq(artists.ownerId, ctx.user.id)).limit(1);
      if (!owner[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Crie seu perfil de artista antes de enviar uma faixa." });
      const existingByKey = await db.select({ id: tracks.id, artistId: tracks.artistId }).from(tracks).where(eq(tracks.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existingByKey[0]) {
        if (existingByKey[0].artistId !== owner[0].id) throw new TRPCError({ code: "CONFLICT", message: "A chave de publicação já está vinculada a outro artista." });
        return { persisted: true, id: existingByKey[0].id, duplicate: true };
      }
      const existing = input.audioUrl ? await db.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.artistId, owner[0].id), eq(tracks.audioUrl, input.audioUrl))).limit(1) : input.externalUrl ? await db.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.artistId, owner[0].id), eq(tracks.externalUrl, input.externalUrl))).limit(1) : [];
      if (existing[0]) return { persisted: true, id: existing[0].id, duplicate: true };
      const { bookletPages, releaseDate, ...trackInput } = input;
      const result = await db.insert(tracks).values({ ...trackInput, bookletPages: bookletPages ? JSON.stringify(bookletPages) : null, releaseDate: releaseDate ? new Date(releaseDate) : null, artistId: owner[0].id, rightsDeclaredAt: new Date() });
      const followers = await db.select({ userId: follows.followerId }).from(follows).where(eq(follows.artistId, owner[0].id));
      const shouldNotify = input.visibility === "public" && (!releaseDate || new Date(releaseDate).getTime() <= Date.now());
      if (shouldNotify && followers.length) await db.insert(notifications).values(followers.map(follower => ({ userId: follower.userId, kind: "release" as const, title: "Tem som novo na sua cena", body: `${input.title} acabou de chegar.`, href: `/faixas/${Number(result[0].insertId)}` })));
      await writeAuditLog({ actorId: ctx.user.id, action: "track.published", targetType: "track", targetId: Number(result[0].insertId), metadata: { title: input.title, city: input.city } });
      return { persisted: true, id: Number(result[0].insertId) };
    }),
    createCollective: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), handle: z.string().trim().min(2).max(80).regex(/^@?[a-zA-Z0-9_]+$/), type: z.enum(["collective", "label", "venue", "media", "festival"]).default("collective"), city: z.string().trim().min(2).max(120), bio: z.string().trim().max(1000).optional(), manifesto: z.string().trim().max(1500).optional(), supportUrl: z.string().url().max(2048).optional(), pixUrl: z.string().trim().max(255).optional() })).mutation(async ({ ctx, input }) => {
      return { collective: await createCollective(ctx.user.id, input) };
    }),
    myCollectives: protectedProcedure.query(async ({ ctx }) => listUserCollectives(ctx.user.id)),
    pendingCollectiveInvites: protectedProcedure.query(({ ctx }) => listPendingCollectiveInvites(ctx.user.id)),
    acceptPendingCollectiveInvite: protectedProcedure.input(z.object({ inviteId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await acceptPendingCollectiveInvite(ctx.user.id, input.inviteId);
      if (!result.accepted && result.reason === "ARTIST_PROFILE_REQUIRED") throw new TRPCError({ code: "BAD_REQUEST", message: "Crie um perfil de artista antes de aceitar." });
      if (!result.accepted) throw new TRPCError({ code: "BAD_REQUEST", message: "Este convite não está mais disponível." });
      return result;
    }),
    declineCollectiveInvite: protectedProcedure.input(z.object({ inviteId: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ declined: await declineCollectiveInvite(ctx.user.id, input.inviteId) })),
    createCollectiveInvite: protectedProcedure.input(z.object({ collectiveId: z.number().int().positive(), permission: z.enum(["editor", "agenda", "member"]), email: z.string().email().max(320).optional() })).mutation(async ({ ctx, input }) => {
      const invite = await createCollectiveInvite(ctx.user.id, input);
      if (!invite) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o proprietário pode criar convites." });
      return invite;
    }),
    previewCollectiveInvite: protectedProcedure.input(z.object({ token: z.string().trim().min(40).max(120) })).query(({ input }) => previewCollectiveInvite(input.token)),
    acceptCollectiveInvite: protectedProcedure.input(z.object({ token: z.string().trim().min(40).max(120) })).mutation(async ({ ctx, input }) => {
      const result = await acceptCollectiveInvite(ctx.user.id, input.token);
      if (!result.accepted && result.reason === "ARTIST_PROFILE_REQUIRED") throw new TRPCError({ code: "BAD_REQUEST", message: "Crie um perfil de artista antes de aceitar o convite." });
      if (!result.accepted) throw new TRPCError({ code: "BAD_REQUEST", message: "Este convite é inválido, expirou ou já foi usado." });
      return result;
    }),
    collectiveMembers: protectedProcedure.input(z.object({ collectiveId: z.number().int().positive() })).query(async ({ ctx, input }) => listCollectiveMembers(ctx.user.id, input.collectiveId)),
    addCollectiveMember: protectedProcedure.input(z.object({ collectiveId: z.number().int().positive(), artistId: z.number().int().positive(), permission: z.enum(["editor", "agenda", "member"]), memberRole: z.string().trim().max(100).optional() })).mutation(async ({ ctx, input }) => ({ added: await addCollectiveMember(ctx.user.id, input) })),
    removeCollectiveMember: protectedProcedure.input(z.object({ collectiveId: z.number().int().positive(), artistId: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ removed: await removeCollectiveMember(ctx.user.id, input) })),
    updateCollectiveMember: protectedProcedure.input(z.object({ collectiveId: z.number().int().positive(), artistId: z.number().int().positive(), permission: z.enum(["editor", "agenda", "member"]), memberRole: z.string().trim().max(100).optional() })).mutation(async ({ ctx, input }) => ({ updated: await updateCollectiveMember(ctx.user.id, input) })),
    auditLogs: protectedProcedure.query(async ({ ctx }) => {
      if (!canAudit(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Sua função não permite consultar o histórico." });
      return listAuditLogs();
    }),
    moderationReports: protectedProcedure.input(z.object({ status: z.enum(["open", "reviewed", "resolved", "rejected"]).optional() }).optional()).query(async ({ ctx, input }) => {
      if (!canModerate(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Sua função não permite consultar a moderação." });
      return listModerationReports(input?.status);
    }),
    updateModerationReport: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["open", "reviewed", "resolved", "rejected"]) })).mutation(async ({ ctx, input }) => {
      if (!canModerate(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Sua função não permite atualizar a moderação." });
      const updated = await updateModerationReport(input.id, input.status);
      if (updated) await writeAuditLog({ actorId: ctx.user.id, action: `moderation.${input.status}`, targetType: "report", targetId: input.id });
      return { updated };
    }),
    hideReportedContent: protectedProcedure.input(z.object({ reportId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!canModerate(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Sua função não permite ocultar conteúdo." });
      const hidden = await hideReportedContent(input.reportId);
      if (hidden) await writeAuditLog({ actorId: ctx.user.id, action: "moderation.content_hidden", targetType: "report", targetId: input.reportId });
      return { hidden };
    }),
    reportContent: protectedProcedure.input(z.object({ targetType: z.enum(["track", "artist", "event", "collective"]), targetId: z.number().int().positive(), reason: z.string().trim().min(2).max(120), details: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const id = await createModerationReport({ reporterId: ctx.user.id, ...input });
      return { reported: Boolean(id), id };
    }),
  }),
});

export type AppRouter = typeof appRouter;
