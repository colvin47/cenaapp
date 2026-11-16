import { useEffect, type ReactNode } from "react";
import {
  Bookmark,
  Clock3,
  ListMusic,
  MapPin,
  Music2,
  Play,
  RotateCcw,
  Share2,
  Ticket,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  sceneArtists,
  sceneEvents,
  scenePlaylists,
  sceneTracks,
  type SceneArtist,
  type SceneEvent,
  type SceneTrack,
} from "@shared/scene-seed";
import { parseExternalTrackUrl } from "@shared/track-source";

type EntityPageContent = {
  tracks: SceneTrack[];
  artists: SceneArtist[];
  events: SceneEvent[];
  playlists: typeof scenePlaylists;
  source: "seed" | "database" | "empty" | "unavailable";
};

type TrackRecord = {
  id: number;
  title: string;
  artist: string;
  artistId: number;
  handle?: string;
  album?: string | null;
  description?: string | null;
  releaseDate?: Date | string | null;
  genre: string | null;
  city: string;
  duration: number | null;
  cover: string | null;
  audioUrl: string | null;
  sourceType: SceneTrack["sourceType"] | null;
  externalUrl: string | null;
  releaseType: SceneTrack["releaseType"] | null;
  creditsNote: string | null;
  bookletPages: string | null;
};

type EventRecord = {
  id: number;
  title: string;
  place: string;
  city: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  eventDate: Date | string;
  description: string | null;
  ticketUrl: string | null;
  artistId: number;
  eventType?: SceneEvent["eventType"];
  admissionType?: SceneEvent["admissionType"];
  accessibility?: string | null;
  safeSpace?: boolean;
  ageRating?: string | null;
  program?: string | null;
  interest?: number;
  canceledAt?: Date | string | null;
  cancelReason?: string | null;
};

type Props = {
  path: string;
  content: EntityPageContent;
  interested: number[];
  savedTracks: number[];
  onPlay: (track: SceneTrack) => void;
  onInterest: (eventId: number) => void;
  onSaveTrack: (trackId: number) => void;
  onShare: (label: string, path?: string) => void;
  onAddToPlaylist: (trackId: number) => void;
  onQueueTrack: (trackId: number) => void;
  onOpenArtist: (artist: SceneArtist) => void;
  renderArtistProfile: (artist: SceneArtist, tracks: SceneTrack[], events: SceneEvent[]) => ReactNode;
};

function parseTrackId(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return 0;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function safeDecode(value: string | undefined) {
  if (!value) return "";
  try {
    return decodeURIComponent(value).replace(/^@/, "").trim();
  } catch {
    return "";
  }
}

function parseBooklet(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

function toSceneTrack(track: TrackRecord): SceneTrack {
  const external = track.externalUrl ? parseExternalTrackUrl(track.externalUrl) : null;
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    artistId: track.artistId,
    genre: track.genre || "Cena local",
    city: track.city,
    duration: track.duration ?? 0,
    cover: track.cover || sceneTracks[0].cover,
    accent: "#c8f36a",
    audioUrl: track.audioUrl ?? undefined,
    sourceType: track.sourceType ?? "upload",
    externalUrl: track.externalUrl ?? undefined,
    embedUrl: external?.embedUrl ?? null,
    releaseType: track.releaseType ?? "single",
    creditsNote: track.creditsNote ?? undefined,
    bookletPages: parseBooklet(track.bookletPages),
  };
}

function toSceneEvent(event: EventRecord): SceneEvent {
  const date = new Date(event.eventDate);
  const validDate = Number.isFinite(date.getTime());
  return {
    id: event.id,
    day: validDate ? date.toLocaleDateString("pt-BR", { day: "2-digit" }) : "—",
    month: validDate ? date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase() : "—",
    title: event.title,
    place: event.place,
    city: event.city,
    address: event.address ?? undefined,
    latitude: event.latitude ?? undefined,
    longitude: event.longitude ?? undefined,
    time: validDate ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—",
    description: event.description ?? "",
    color: "lime",
    interest: Number(event.interest ?? 0),
    artistId: event.artistId,
    isoDate: validDate ? date.toISOString() : undefined,
    ticketUrl: event.ticketUrl ?? undefined,
    eventType: event.eventType,
    admissionType: event.admissionType,
    accessibility: event.accessibility ?? undefined,
    safeSpace: event.safeSpace,
    ageRating: event.ageRating ?? undefined,
    program: event.program ?? undefined,
  };
}

function DemoNotice() {
  return (
    <div className="demo-content-notice" role="note">
      Conteúdo de demonstração. Não representa publicação ou atividade real na CENA.
    </div>
  );
}

function EntityState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="page entity-detail-page">
      <div className="entity-detail-state" role="status">
        <Music2 size={24} />
        <strong>{title}</strong>
        <span>{message}</span>
        {onRetry && (
          <button className="ghost-button" type="button" onClick={onRetry}>
            <RotateCcw size={15} /> Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

function EntityTrackRow({
  track,
  onPlay,
  onShare,
  onSave,
  onAdd,
  onQueue,
}: {
  track: SceneTrack;
  onPlay: () => void;
  onShare: () => void;
  onSave: () => void;
  onAdd: () => void;
  onQueue: () => void;
}) {
  return (
    <article className="entity-track-row">
      <img src={track.cover} alt={`Capa de ${track.title}`} loading="lazy" />
      <div className="entity-track-copy">
        <strong>{track.title}</strong>
        <span>{track.artist} · {track.genre} · {track.city}</span>
      </div>
      <div className="entity-track-actions">
        <button className="icon-button" type="button" aria-label={`Tocar ${track.title}`} onClick={onPlay}>
          <Play size={16} fill="currentColor" />
        </button>
        <button className="icon-button quiet" type="button" aria-label={`Salvar ${track.title}`} onClick={onSave}>
          <Bookmark size={16} />
        </button>
        <button className="icon-button quiet" type="button" aria-label={`Adicionar ${track.title} a uma playlist`} onClick={onAdd}>
          <ListMusic size={16} />
        </button>
        <button className="icon-button quiet" type="button" aria-label={`Adicionar ${track.title} à fila`} onClick={onQueue}>
          <Users size={16} />
        </button>
        <button className="icon-button quiet" type="button" aria-label={`Compartilhar ${track.title}`} onClick={onShare}>
          <Share2 size={16} />
        </button>
      </div>
    </article>
  );
}

function EventTicketOffers({ eventId }: { eventId: number }) {
  const tickets = trpc.scene.eventTickets.useQuery({ eventId }, { staleTime: 30_000 });
  return <section className="content-section event-ticket-offers"><span className="eyebrow coral">lotes divulgados pela produção</span>{tickets.isLoading ? <p role="status">Carregando ofertas de ingressos…</p> : tickets.error ? <div className="empty-card" role="alert"><strong>Não foi possível carregar os lotes.</strong><span>Tente consultar novamente antes de concluir que não há ingressos.</span><button className="text-button" type="button" onClick={() => void tickets.refetch()}>Tentar novamente</button></div> : tickets.data?.length ? <div className="activity-list">{tickets.data.map(ticket => <div className="activity-item" key={ticket.id}><div><strong>{ticket.name}</strong><span>{Number(ticket.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {ticket.available} disponíveis</span></div><small>Venda direta com a produção</small>{ticket.pixKey && <small className="event-pix-key">Pix da produção: <strong>{ticket.pixKey}</strong></small>}</div>)}</div> : <p role="status">A produção ainda não divulgou lotes para este evento.</p>}</section>;
}

function ArtistMerchandise({ items }: { items: Array<{ id: number; title: string; description?: string | null; price: string | number; stock: number; imageUrl?: string | null; externalUrl?: string | null }> }) {
  return <section className="content-section artist-merchandise"><span className="eyebrow lime">apoie diretamente</span><h2>Vitrine do projeto.</h2>{items.length ? <div className="merchandise-grid">{items.map(item => <article className="merchandise-card" key={item.id}>{item.imageUrl && <img src={item.imageUrl} alt={item.title} loading="lazy" />}<h3>{item.title}</h3>{item.description && <p>{item.description}</p>}<strong>{Number(item.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong><small>{item.stock} disponível(is)</small>{item.externalUrl && <a className="ghost-button" href={item.externalUrl} target="_blank" rel="noreferrer">Comprar fora da CENA</a>}</article>)}</div> : <p role="status">Este projeto ainda não publicou produtos na vitrine.</p>}</section>;
}

export function EntityDetailView(props: Props) {
  const {
    path,
    content,
    interested,
    savedTracks,
    onPlay,
    onInterest,
    onSaveTrack,
    onShare,
    onAddToPlaylist,
    onQueueTrack,
    onOpenArtist,
    renderArtistProfile,
  } = props;

  const pathname = path.split(/[?#]/, 1)[0] || "/";
  const [kind, rawIdentity] = pathname.split("/").filter(Boolean);
  const id = parseTrackId(rawIdentity);
  const handle = safeDecode(rawIdentity);
  const trackQuery = trpc.scene.trackDetail.useQuery({ id: id || 1 }, { enabled: kind === "faixas" && id > 0, staleTime: 30_000 });
  const artistQuery = trpc.scene.artistDetail.useQuery({ handle: handle || "invalid" }, { enabled: kind === "artistas" && Boolean(handle), staleTime: 30_000 });
  const eventQuery = trpc.scene.eventDetail.useQuery({ id: id || 1 }, { enabled: kind === "eventos" && id > 0, staleTime: 30_000 });
  const playlistQuery = trpc.scene.playlistDetail.useQuery({ id: id || 1 }, { enabled: kind === "playlists" && id > 0, staleTime: 30_000 });

  const demo = content.source === "seed";
  const demoTrack = demo && kind === "faixas" ? content.tracks.find(track => track.id === id) : undefined;
  const demoArtist = demo && kind === "artistas" ? content.artists.find(artist => artist.handle.replace(/^@/, "") === handle) : undefined;
  const demoEvent = demo && kind === "eventos" ? content.events.find(event => event.id === id) : undefined;
  const demoPlaylist = demo && kind === "playlists" ? content.playlists.find(playlist => playlist.id === id) : undefined;

  let title = "CENA. — conteúdo da sua cidade";
  let description = "Descubra faixas, artistas e encontros feitos por quem vive a cena local.";
  if (kind === "faixas") { title = `${trackQuery.data?.title ?? demoTrack?.title ?? "Faixa compartilhada"} — CENA.`; description = trackQuery.data?.description || description; }
  if (kind === "artistas") { title = `${artistQuery.data?.artist.name ?? demoArtist?.name ?? "Perfil de artista"} — CENA.`; description = artistQuery.data?.artist.bio || demoArtist?.bio || description; }
  if (kind === "eventos") { title = `${eventQuery.data?.title ?? demoEvent?.title ?? "Evento"} — CENA.`; description = eventQuery.data?.description || demoEvent?.description || description; }
  if (kind === "playlists") { title = `${playlistQuery.data?.playlist.name ?? demoPlaylist?.name ?? "Playlist"} — CENA.`; description = playlistQuery.data?.playlist.description || demoPlaylist?.description || description; }
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (meta) meta.content = description;
  }, [title, description]);

  const retry = (query: { refetch: () => unknown }) => () => { void query.refetch(); };

  if (kind === "faixas") {
    if (!id) return <EntityState title="Faixa não encontrada." message="O endereço da faixa não contém um identificador válido." />;
    if (trackQuery.isLoading && !demoTrack) {
      return <EntityState title="Carregando faixa…" message="Buscando a publicação solicitada." />;
    }
    if (trackQuery.error && !demoTrack) {
      return <EntityState title="Não foi possível carregar a faixa." message="O serviço de faixas está temporariamente indisponível." onRetry={retry(trackQuery)} />;
    }
    const record = trackQuery.data;
    const track = record ? toSceneTrack(record as TrackRecord) : demoTrack;
    if (!track) return <EntityState title="Faixa não encontrada." message="Ela pode estar privada, removida ou ainda não ter sido publicada." />;
    const fallbackArtist: SceneArtist | undefined = record?.handle ? { id: track.artistId, name: track.artist, handle: record.handle, profileType: "solo", genre: track.genre, bio: "", city: track.city, image: track.cover, accent: "#c8f36a", followers: "0" } : undefined;
    const artist = content.artists.find(item => item.id === track.artistId) ?? fallbackArtist;
    const releaseDate = record?.releaseDate ? new Date(record.releaseDate).toLocaleDateString("pt-BR") : null;
    return (
      <div className="page detail-page entity-detail-page">
        {demo && <DemoNotice />}
        <span className="eyebrow lime">{demo ? "faixa de demonstração" : "faixa compartilhada"}</span>
        <div className="detail-hero">
          <img src={track.cover} alt={`Capa de ${track.title}, ${track.artist}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/cover-abstract.jpg"; }} />
          <div>
            <h1>{track.title}</h1>
            <p>{track.artist} · {track.genre} · {track.city}</p>
            {artist && <button type="button" className="text-button" onClick={() => onOpenArtist(artist)}>Ver perfil de {artist.name}</button>}
            {record?.description && <p className="detail-description">{record.description}</p>}
            {(record?.album || releaseDate || track.releaseType) && (
              <div className="entity-detail-facts">
                {record?.album && <span>{record.album}</span>}
                {track.releaseType && <span>{track.releaseType}</span>}
                {releaseDate && <span>{releaseDate}</span>}
              </div>
            )}
            {track.creditsNote && <p className="detail-description"><strong>Créditos:</strong> {track.creditsNote}</p>}
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => onPlay(track)}><Play size={16} fill="currentColor" /> Ouvir agora</button>
              <button className={`ghost-button ${savedTracks.includes(track.id) ? "is-saved" : ""}`} type="button" onClick={() => onSaveTrack(track.id)}><Bookmark size={16} /> {savedTracks.includes(track.id) ? "Salva" : "Salvar"}</button>
              <button className="ghost-button" type="button" onClick={() => onAddToPlaylist(track.id)}><ListMusic size={16} /> Playlist</button>
              <button className="icon-button" type="button" aria-label="Adicionar à fila" onClick={() => onQueueTrack(track.id)}><Users size={16} /></button>
              <button className="icon-button" type="button" aria-label="Compartilhar" onClick={() => onShare(`Faixa ${track.title}`, `/faixas/${track.id}`)}><Share2 size={16} /></button>
            </div>
          </div>
        </div>
        {track.bookletPages?.length ? <div className="entity-detail-facts"><span>Encarte com {track.bookletPages.length} página(s)</span></div> : null}
      </div>
    );
  }

  if (kind === "artistas") {
    if (!handle) return <EntityState title="Perfil não encontrado." message="O endereço do perfil não contém um @ válido." />;
    if (artistQuery.isLoading && !demoArtist) return <EntityState title="Carregando perfil…" message="Buscando o perfil artístico solicitado." />;
    if (artistQuery.error && !demoArtist) return <EntityState title="Não foi possível carregar o perfil." message="O serviço de artistas está temporariamente indisponível." onRetry={retry(artistQuery)} />;
    const artist = artistQuery.data?.artist ?? demoArtist;
    if (!artist) return <EntityState title="Perfil não encontrado." message="Não encontramos esse perfil público na CENA." />;
    const tracks = artistQuery.data ? artistQuery.data.tracks.map(track => toSceneTrack(track as TrackRecord)) : content.tracks.filter(track => track.artistId === artist.id);
    const events = artistQuery.data ? artistQuery.data.events.map(event => toSceneEvent(event as EventRecord)) : content.events.filter(event => event.artistId === artist.id);
    return <>{demo && <DemoNotice />}{renderArtistProfile(artist, tracks, events)}{artistQuery.data?.artist.merchandise && <ArtistMerchandise items={artistQuery.data.artist.merchandise} />}</>;
  }

  if (kind === "eventos") {
    if (!id) return <EntityState title="Evento não encontrado." message="O endereço do evento não contém um identificador válido." />;
    if (eventQuery.isLoading && !demoEvent) return <EntityState title="Carregando evento…" message="Buscando o evento solicitado." />;
    if (eventQuery.error && !demoEvent) return <EntityState title="Não foi possível carregar o evento." message="O serviço de agenda está temporariamente indisponível." onRetry={retry(eventQuery)} />;
    const record = eventQuery.data as EventRecord | null | undefined;
    const event = record ? toSceneEvent(record) : demoEvent;
    if (!event) return <EntityState title="Evento não encontrado." message="Ele pode ter sido removido ou não estar disponível publicamente." />;
    return (
      <div className="page detail-page entity-detail-page">
        {demo && <DemoNotice />}
        <span className="eyebrow coral">{demo ? "evento de demonstração" : "evento compartilhado"}</span>
        {record?.canceledAt && <div className="event-canceled-notice" role="status">Evento cancelado{record.cancelReason ? `: ${record.cancelReason}` : "."}</div>}
        <div className="detail-event-date"><strong>{event.day}</strong><span>{event.month}</span></div>
        <h1>{event.title}</h1>
        <p className="detail-meta"><MapPin size={15} /> {event.place} · {event.city} <span><Clock3 size={15} /> {event.time}</span></p>
        {event.description && <p className="detail-description">{event.description}</p>}
        {event.program && <p className="detail-description"><strong>Programação:</strong> {event.program}</p>}
        {event.accessibility && <p className="detail-description"><strong>Acessibilidade:</strong> {event.accessibility}</p>}
        <div className="entity-detail-facts">
          {event.eventType && <span>{event.eventType.replaceAll("_", " ")}</span>}
          {event.admissionType && <span>{event.admissionType === "free" ? "Gratuito" : event.admissionType === "contribution" ? "Contribuição" : "Ingresso"}</span>}
          {event.safeSpace && <span>Espaço seguro</span>}
          {event.ageRating && <span>{event.ageRating}</span>}
        </div>
        <div className="hero-actions">
          {!record?.canceledAt && <button className="primary-button" type="button" onClick={() => onInterest(event.id)}>{interested.includes(event.id) ? "Você vai" : "Tenho interesse"}</button>}
          {event.ticketUrl && <a className="ghost-button" href={event.ticketUrl} target="_blank" rel="noreferrer"><Ticket size={16} /> Ingressos</a>}
          {(event.address || (event.latitude != null && event.longitude != null)) && <a className="ghost-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.latitude != null && event.longitude != null ? `${event.latitude},${event.longitude}` : `${event.address}, ${event.place}, ${event.city}`)}`} target="_blank" rel="noreferrer"><MapPin size={16} /> Abrir mapa</a>}
          <button type="button" aria-label="Compartilhar" className="icon-button" onClick={() => onShare(`Evento ${event.title}`, `/eventos/${event.id}`)}><Share2 size={16} /></button>
        </div>
        {!record?.canceledAt && <EventTicketOffers eventId={event.id} />}
      </div>
    );
  }

  if (kind === "playlists") {
    if (!id) return <EntityState title="Playlist não encontrada." message="O endereço da playlist não contém um identificador válido." />;
    if (playlistQuery.isLoading && !demoPlaylist) return <EntityState title="Carregando playlist…" message="Buscando a playlist solicitada." />;
    if (playlistQuery.error && !demoPlaylist) return <EntityState title="Não foi possível carregar a playlist." message="O serviço de biblioteca está temporariamente indisponível." onRetry={retry(playlistQuery)} />;
    const detail = playlistQuery.data;
    const playlist = detail?.playlist ?? demoPlaylist;
    if (!playlist) return <EntityState title="Playlist não encontrada." message="Ela pode ser privada, ter sido removida ou não existir." />;
    const playlistTrackIds = demoPlaylist?.tracks ?? [];
    const tracks = detail ? detail.tracks.map(track => toSceneTrack(track as TrackRecord)) : content.tracks.filter(track => playlistTrackIds.includes(track.id));
    return (
      <div className="page detail-page entity-detail-page">
        {demo && <DemoNotice />}
        <span className="eyebrow lavender">{demo ? "playlist de demonstração" : playlist.collaborative ? "playlist colaborativa" : "playlist privada"}</span>
        <div className="playlist-detail-heading"><div className="playlist-collage"><span style={{ background: "#c8f36a" }} /><span style={{ background: "#ff765f" }} /><span style={{ background: "#a69aff" }} /><ListMusic size={22} /></div><div><h1>{playlist.name}</h1><p>{playlist.description}</p><p className="detail-meta"><Users size={15} /> {playlist.owner} · {tracks.length} faixas</p></div></div>
        <div className="hero-actions">
          {playlist.collaborative && <button className="ghost-button" type="button" onClick={() => onShare(`Playlist ${playlist.name}`, `/playlists/${playlist.id}`)}><Share2 size={16} /> Compartilhar</button>}
        </div>
        <section className="entity-playlist-tracks" aria-label="Faixas da playlist">
          {tracks.length ? tracks.map(track => (
            <EntityTrackRow
              key={track.id}
              track={track}
              onPlay={() => onPlay(track)}
              onShare={() => onShare(`Faixa ${track.title}`, `/faixas/${track.id}`)}
              onSave={() => onSaveTrack(track.id)}
              onAdd={() => onAddToPlaylist(track.id)}
              onQueue={() => onQueueTrack(track.id)}
            />
          )) : <div className="empty-card"><ListMusic size={22} /><strong>Esta playlist ainda não tem faixas públicas.</strong><span>Faixas privadas ou indisponíveis não aparecem aqui.</span></div>}
        </section>
      </div>
    );
  }

  return <EntityState title="Página não encontrada." message="Confira o endereço ou volte à descoberta da CENA." />;
}
