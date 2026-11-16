import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlay,
  Clock3,
  Disc3,
  Flag,
  Headphones,
  Heart,
  Home as HomeIcon,
  Link2,
  ListMusic,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Share2,
  SlidersHorizontal,
  Send,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Ticket,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { selectAudioStreamUrl } from "@/lib/audio-source";
import { formatLocalDateTimeInput, localDateTimeToISOString } from "@/lib/event-date";
import { COOKIE_NAME } from "@shared/const";
import { sceneActivity, sceneArtists, sceneEvents, sceneGenres, scenePlaylists, sceneTracks, type SceneArtist, type SceneEvent, type SceneTrack } from "@shared/scene-seed";
import { parseExternalTrackUrl, type TrackSourceType } from "@shared/track-source";
import { AccountProfileView } from "../components/AccountProfileView";
import { ArtistCommercePanel } from "@/components/ArtistCommercePanel";
import { BrazilCityPicker } from "@/components/BrazilCityPicker";
import { EntityDetailView } from "./EntityDetailView";

type View = "home" | "search" | "events" | "library" | "profile" | "upload" | "entityDetail";

function readSessionAuthHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("manus-cookie");
    if (!raw) return {};
    const prefix = `${COOKIE_NAME}=`;
    const pair = raw.split(";").find(value => value.trim().startsWith(prefix));
    const token = pair?.trim().slice(prefix.length);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

type UploadDraft = {
  title: string;
  sourceType: TrackSourceType;
  externalUrl: string;
  album: string;
  genre: string;
  city: string;
  description: string;
  releaseType: NonNullable<SceneTrack["releaseType"]>;
  releaseDate: string;
  visibility: "public" | "private";
  creditsNote: string;
  rights: boolean;
  audio: File | null;
  cover: File | null;
  bookletPages: File[];
  collectiveId: number | null;
};

type TrackSuggestion = { description: string; genre: string; album: string; creditsNote: string; artistBio: string; tags: string[] };

type ArtistDraft = {
  name: string;
  handle: string;
  city: string;
  genre: string;
  profileType: NonNullable<SceneArtist["profileType"]>;
  bio: string;
  manifesto: string;
  avatarUrl?: string;
  coverUrl?: string;
  instagramUrl?: string;
  bandcampUrl?: string;
  supportUrl?: string;
  pixUrl?: string;
  merchUrl?: string;
};

type ListenerDraft = { city: string; favoriteGenres: string; publicBio: string };

type LibrarySnapshot = {
  savedTrackIds?: number[];
  recentTrackIds?: number[];
  playlists?: Array<{ id: number; name: string; collaborative: boolean; trackIds: number[] }>;
} | null;
type ModerationReportItem = {
  id: number;
  targetType: "track" | "artist" | "event" | "collective";
  targetId: number;
  reason: string;
  details: string | null;
  status: "open" | "reviewed" | "resolved" | "rejected";
  createdAt: Date;
  resolvedAt: Date | null;
  reporterName: string | null;
};
type AuditLogItem = { id: number; action: string; targetType: string; targetId: number | null; metadata: string | null; createdAt: Date; actorName: string | null };

const fallbackContent = {
  tracks: sceneTracks,
  artists: sceneArtists,
  events: sceneEvents,
  genres: sceneGenres,
  playlists: scenePlaylists,
  activity: sceneActivity,
  source: "seed" as "seed" | "database" | "empty" | "unavailable",
};

function cityUf(city: string) {
  const parts = city.split(",").map(part => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts.at(-1) ?? "BR";
  return city.trim() === "Campinas" ? "SP" : "BR";
}
function displayCity(city: string) {
  const normalized = city.trim();
  if (!normalized) return "Brasil";
  return normalized.includes(",") ? normalized : `${normalized}, ${cityUf(normalized)}`;
}

function parseBookletPages(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((page): page is string => typeof page === "string" && page.length > 0).slice(0, 12);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((page): page is string => typeof page === "string" && page.length > 0).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function readSavedUploadDraft(): Partial<UploadDraft> {
  if (typeof window === "undefined") return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem("cena-upload-draft-v2") || "null") as Partial<UploadDraft> | null;
    if (!saved || typeof saved !== "object") return {};
    return { title: typeof saved.title === "string" ? saved.title : undefined, sourceType: saved.sourceType, externalUrl: typeof saved.externalUrl === "string" ? saved.externalUrl : undefined, album: typeof saved.album === "string" ? saved.album : undefined, genre: typeof saved.genre === "string" ? saved.genre : undefined, city: typeof saved.city === "string" ? saved.city : undefined, description: typeof saved.description === "string" ? saved.description : undefined, releaseType: saved.releaseType, releaseDate: typeof saved.releaseDate === "string" ? saved.releaseDate : undefined, visibility: saved.visibility === "private" ? "private" : "public", creditsNote: typeof saved.creditsNote === "string" ? saved.creditsNote : undefined, rights: Boolean(saved.rights), collectiveId: typeof saved.collectiveId === "number" ? saved.collectiveId : null };
  } catch { return {}; }
}

function rankSceneTracks(tracks: SceneTrack[], preferences: { city?: string | null; favoriteGenres?: string | null; followedArtistIds?: number[]; savedTrackIds?: number[]; recentTrackIds?: number[]; eventArtistIds?: number[] }) {
  const fold = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const city = fold(preferences.city).split(",")[0]?.trim();
  const genres = String(preferences.favoriteGenres ?? "").split(/[,;|]/).map(fold).filter(Boolean);
  const followed = new Set(preferences.followedArtistIds ?? []);
  const saved = new Set(preferences.savedTrackIds ?? []);
  const recent = new Set(preferences.recentTrackIds ?? []);
  return tracks.map((track, index) => {
    const trackCity = fold(track.city).split(",")[0]?.trim();
    const genre = fold(track.genre);
    let score = Math.max(0, 20 - index);
    if (city && trackCity === city) score += 34;
    if (genres.some(item => genre.includes(item) || item.includes(genre))) score += 28;
    if (followed.has(track.artistId)) score += 24;
    if (saved.has(track.id)) score += 10;
    if ((preferences.eventArtistIds ?? []).includes(track.artistId)) score += 12;
    if (recent.has(track.id)) score -= 16;
    return { track, score, reason: followed.has(track.artistId) ? "artista que você segue" : genres.some(item => genre.includes(item) || item.includes(genre)) ? "gênero que combina com você" : city && trackCity === city ? "da sua cidade" : "curadoria da cena" };
  }).sort((a, b) => b.score - a.score).map(item => item.track);
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function initials(name: string) {
  return name.split(" ").map(word => word[0]).join("").slice(0, 2).toUpperCase();
}

const releaseLabels: Record<NonNullable<SceneTrack["releaseType"]>, string> = { single: "single", album: "álbum", demo: "demo", live: "ao vivo", split: "split", compilation: "compilação" };
const profileLabels: Record<NonNullable<SceneArtist["profileType"]>, string> = { solo: "artista", band: "banda", mc: "MC", producer: "produtor", dj: "DJ", collective: "coletivo", label: "selo", venue: "espaço" };
const eventTypeLabels: Record<NonNullable<SceneEvent["eventType"]>, string> = { show: "show", battle: "batalha", cypher: "cypher", cultural_round: "roda cultural", diy_festival: "festival DIY", occupation: "ocupação", zine_fair: "feira de zines", workshop: "oficina", listening_party: "escuta coletiva", release: "lançamento" };

function viewFromPath(path: string): View {
  if (path.startsWith("/artistas/") || path.startsWith("/faixas/") || path.startsWith("/eventos/") || path.startsWith("/playlists/")) return "entityDetail";
  if (path === "/buscar") return "search";
  if (path === "/eventos") return "events";
  if (path === "/biblioteca") return "library";
  if (path === "/perfil") return "profile";
  if (path === "/enviar") return "upload";
  return "home";
}

function pathFromView(view: View) {
  if (view === "home" || view === "entityDetail") return "/";
  return `/${view === "search" ? "buscar" : view === "events" ? "eventos" : view === "library" ? "biblioteca" : view === "profile" ? "perfil" : "enviar"}`;
}

function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && <button className="text-button" onClick={onAction}>{action}<ChevronRight size={15} /></button>}
    </div>
  );
}

function EmptyState({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) {
  return <div className="empty-card"><Search size={22} /><div><strong>{title}</strong><span>{message}</span>{action && onAction && <button className="text-button empty-action" type="button" onClick={onAction}>{action}<ChevronRight size={14} /></button>}</div></div>;
}
function AlertPreferences() {
  const [preferences, setPreferences] = useState({ releases: true, events: true, changes: true, digest: false });
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cena-alert-preferences");
      if (saved) setPreferences(previous => ({ ...previous, ...(JSON.parse(saved) as Partial<typeof previous>) }));
    } catch { /* preferências locais inválidas não impedem o uso do app */ }
  }, []);
  const update = (key: keyof typeof preferences) => setPreferences(previous => {
    const next = { ...previous, [key]: !previous[key] };
    localStorage.setItem("cena-alert-preferences", JSON.stringify(next));
    return next;
  });
  return <section className="composer-card alert-preferences" aria-labelledby="alert-preferences-title"><div className="composer-heading"><div><span className="eyebrow lime">alertas locais</span><h2 id="alert-preferences-title">Seu radar, do seu jeito.</h2><p>Escolha quais avisos da cena você quer receber. Você pode mudar tudo depois.</p></div><Bell size={20} className="admin-notification-icon" /></div><div className="alert-preference-list">{([['releases', 'Novos lançamentos', 'Quando um artista seguido publicar uma faixa.'], ['events', 'Shows na sua cidade', 'Quando surgir um evento na cidade escolhida.'], ['changes', 'Mudanças e cancelamentos', 'Quando uma produção atualizar ou cancelar um evento.'], ['digest', 'Resumo semanal', 'Um digest curto, em vez de avisos a cada atividade.']] as const).map(([key, title, description]) => <label className="alert-preference" key={key}><input type="checkbox" checked={preferences[key]} onChange={() => update(key)} /><span><strong>{title}</strong><small>{description}</small></span></label>)}</div><small className="preference-note">As preferências ficam salvas neste dispositivo. O CENA só deve solicitar notificações do navegador depois do seu consentimento.</small></section>;
}
function AdminNotificationComposer({ onSubmit, isSending }: { onSubmit: (input: { title: string; body: string; href?: string }) => void; isSending: boolean }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  return <form className="composer-card admin-notification-card" onSubmit={event => { event.preventDefault(); onSubmit({ title, body, href: href || undefined }); setTitle(""); setBody(""); setHref(""); }}>
    <div className="composer-heading"><div><span className="eyebrow lime">administração</span><h2>Avisar a comunidade.</h2><p>Envie um aviso personalizado para todas as contas cadastradas no CENA.</p></div><Send size={20} className="admin-notification-icon" /></div>
    <div className="form-grid"><label>Título<input required minLength={3} maxLength={220} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Escuta coletiva no sábado" /></label><label>Link opcional<input value={href} onChange={event => setHref(event.target.value)} placeholder="/eventos/123 ou https://..." /></label></div>
    <label>Mensagem<textarea required minLength={3} maxLength={1000} value={body} onChange={event => setBody(event.target.value)} placeholder="Escreva um aviso curto e direto para a cena." /></label>
    <button className="primary-button" type="submit" disabled={isSending}><Send size={15} /> {isSending ? "Enviando..." : "Enviar notificação"}</button>
  </form>;
}

function ModerationQueue({ reports, isLoading, onResolve, onHide, isUpdating }: { reports: ModerationReportItem[]; isLoading: boolean; onResolve: (id: number, status: "reviewed" | "resolved" | "rejected") => void; onHide: (id: number) => void; isUpdating: boolean }) {
  return <section className="composer-card moderation-queue" aria-labelledby="moderation-queue-title">
    <div className="composer-heading"><div><span className="eyebrow lime">segurança da cena</span><h2 id="moderation-queue-title">Fila de moderação.</h2><p>Revise denúncias, registre uma decisão e preserve o contexto para a equipe.</p></div><ShieldCheck size={20} className="admin-notification-icon" /></div>
    {isLoading ? <p className="notification-empty">Carregando denúncias...</p> : reports.length ? <div className="moderation-report-list">{reports.map(report => <article className="moderation-report" key={report.id}><div><strong>{report.targetType} #{report.targetId}</strong><span>{report.reason} · por {report.reporterName || "pessoa da comunidade"}</span>{report.details && <small>{report.details}</small>}<small>Status: {report.status}</small></div><div className="moderation-actions"><button className="ghost-button" type="button" disabled={isUpdating} onClick={() => onResolve(report.id, "reviewed")}>Em revisão</button><button className="primary-button" type="button" disabled={isUpdating} onClick={() => onResolve(report.id, "resolved")}>Resolver</button>{(report.targetType === "track" || report.targetType === "event") && <button className="ghost-button" type="button" disabled={isUpdating} onClick={() => onHide(report.id)}>Ocultar conteúdo</button>}<button className="text-button" type="button" disabled={isUpdating} onClick={() => onResolve(report.id, "rejected")}>Rejeitar</button></div></article>)}</div> : <p className="notification-empty">Nenhuma denúncia aberta no momento.</p>}
  </section>;
}
function InviteConfirmation({ preview, isSaving, onAccept, onClose }: { preview: { collectiveName: string; collectiveHandle: string; inviterName: string | null; permission: string; expiresAt: Date | string }; isSaving: boolean; onAccept: () => void; onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="invite-confirm-title"><div className="small-modal invite-confirm-modal"><span className="eyebrow lavender">convite para coletivo</span><h2 id="invite-confirm-title">Você foi chamado para a cena.</h2><p><strong>{preview.collectiveName}</strong> <span>@{preview.collectiveHandle}</span> convidou você{preview.inviterName ? ` por ${preview.inviterName}` : ""}.</p><div className="invite-confirm-details"><span>Permissão concedida</span><strong>{preview.permission}</strong><span>Válido até</span><strong>{new Date(preview.expiresAt).toLocaleDateString("pt-BR")}</strong></div><p>Ao aceitar, seu perfil artístico ficará vinculado ao coletivo com essa permissão. Você poderá sair ou ter o acesso alterado depois.</p><div className="modal-actions"><button className="ghost-button" type="button" disabled={isSaving} onClick={onClose}>Agora não</button><button className="primary-button" type="button" disabled={isSaving} onClick={onAccept}>{isSaving ? "Aceitando..." : "Aceitar convite"}</button></div></div></div>;
}
function PendingCollectiveInvites({ invites, isLoading, onAccept, onDecline, isSaving }: { invites: Array<{ id: number; collectiveName: string; collectiveHandle: string; inviterName: string | null; permission: string; expiresAt: Date | string }>; isLoading: boolean; onAccept: (id: number) => void; onDecline: (id: number) => void; isSaving: boolean }) {
  if (isLoading || !invites.length) return null;
  return <section className="composer-card pending-invites-card"><div className="composer-heading"><div><span className="eyebrow lavender">convites pendentes</span><h2>Você foi chamado para a cena.</h2><p>Confira o coletivo e a permissão antes de entrar.</p></div><Users size={20} /></div><div className="pending-invite-list">{invites.map(invite => <div className="pending-invite" key={invite.id}><div><strong>{invite.collectiveName}</strong><span>@{invite.collectiveHandle} · por {invite.inviterName || "um projeto da cena"}</span><small>Permissão: {invite.permission} · expira em {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}</small></div><div><button className="primary-button" type="button" disabled={isSaving} onClick={() => onAccept(invite.id)}>Aceitar</button><button className="text-button" type="button" disabled={isSaving} onClick={() => onDecline(invite.id)}>Recusar</button></div></div>)}</div></section>;
}
function CollectiveStudio({ collectives, selectedId, onSelect, members, isLoading, onUpdate, onRemove, onInvite, inviteLink, isSaving }: { collectives: Array<{ id: number; name: string; permission: string | null }>; selectedId: number | null; onSelect: (id: number) => void; members: Array<{ artistId: number; name: string; handle: string; permission: string; memberRole: string | null }>; isLoading: boolean; onUpdate: (artistId: number, permission: "editor" | "agenda" | "member") => void; onRemove: (artistId: number) => void; onInvite: (permission: "editor" | "agenda" | "member", email?: string) => void; inviteLink: string; isSaving: boolean }) {
  if (!collectives.length) return null;
  return <section className="composer-card collective-studio-card"><div className="composer-heading"><div><span className="eyebrow lime">gestão compartilhada</span><h2>Seu coletivo.</h2><p>Organize quem publica, agenda e representa o projeto.</p></div><Users size={20} className="admin-notification-icon" /></div><label>Projeto<select value={selectedId ?? ""} onChange={event => onSelect(Number(event.target.value))}>{collectives.map(collective => <option key={collective.id} value={collective.id}>{collective.name} · {collective.permission}</option>)}</select></label><div className="collective-invite-row"><input id="collective-invite-email" type="email" placeholder="E-mail (opcional)" /><select id="collective-invite-permission" defaultValue="member"><option value="editor">Convidar como editor</option><option value="agenda">Convidar para agenda</option><option value="member">Convidar como membro</option></select><button className="ghost-button" type="button" disabled={isSaving || !selectedId} onClick={() => { const select = document.getElementById("collective-invite-permission") as HTMLSelectElement | null; onInvite((select?.value || "member") as "editor" | "agenda" | "member", (document.getElementById("collective-invite-email") as HTMLInputElement | null)?.value || undefined); }}>Gerar convite</button></div>{inviteLink && <div className="collective-invite-link"><input readOnly value={inviteLink} onFocus={event => event.currentTarget.select()} /><button className="text-button" type="button" onClick={() => { void navigator.clipboard?.writeText(inviteLink); toast.success("Convite copiado."); }}>Copiar</button><small>Válido por 7 dias e para um único aceite.</small></div>}{isLoading ? <p className="notification-empty">Carregando integrantes...</p> : members.length ? <div className="collective-member-list">{members.map(member => <div className="collective-member" key={member.artistId}><div><strong>{member.name}</strong><span>{member.handle}{member.memberRole ? ` · ${member.memberRole}` : ""}</span></div><select value={member.permission} disabled={isSaving} onChange={event => onUpdate(member.artistId, event.target.value as "editor" | "agenda" | "member")}><option value="editor">Editor</option><option value="agenda">Agenda</option><option value="member">Membro</option></select><button className="text-button" type="button" disabled={isSaving} onClick={() => onRemove(member.artistId)}>Remover</button></div>)}</div> : <p className="notification-empty">Nenhum artista vinculado ainda.</p>}</section>;
}
function AuditHistory({ logs, isLoading }: { logs: AuditLogItem[]; isLoading: boolean }) {
  return <section className="composer-card audit-history" aria-labelledby="audit-history-title"><div className="composer-heading"><div><span className="eyebrow lime">prestação de contas</span><h2 id="audit-history-title">Histórico da equipe.</h2><p>Registro recente de publicações e decisões administrativas.</p></div><ShieldCheck size={20} className="admin-notification-icon" /></div>{isLoading ? <p className="notification-empty">Carregando histórico...</p> : logs.length ? <div className="audit-list">{logs.map(log => <div className="audit-item" key={log.id}><strong>{log.action}</strong><span>{log.targetType}{log.targetId ? ` #${log.targetId}` : ""} · {log.actorName || "conta administrativa"}</span><small>{new Date(log.createdAt).toLocaleString("pt-BR")}</small></div>)}</div> : <p className="notification-empty">Nenhuma atividade registrada ainda.</p>}</section>;
}
function TrackRow({ track, active, playing, onPlay, onShare, saved, onSave, onAdd, onQueue }: { track: SceneTrack; active: boolean; playing: boolean; onPlay: () => void; onShare: () => void; saved?: boolean; onSave?: () => void; onAdd?: () => void; onQueue?: () => void }) {
  const sourceLabel = track.sourceType && track.sourceType !== "upload" ? { spotify: "Spotify", youtube: "YouTube", bandcamp: "Bandcamp", soundcloud: "SoundCloud" }[track.sourceType] : null;
  return (
    <article className={`track-row ${active ? "is-active" : ""}`}>
      <button className="track-art" style={{ "--accent": track.accent } as CSSProperties} onClick={onPlay} aria-label={`Tocar ${track.title}`}>
        <img src={track.cover} alt={`Capa de ${track.title}, ${track.artist}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/cover-abstract.jpg"; }} />
        <span className="track-art-overlay">{active && playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}</span>
      </button>
      <button className="track-copy" type="button" onClick={onPlay}>
        <strong>{track.title}</strong>
        <span>{track.artist} · {track.genre}</span>
        {track.releaseType && <small className="track-format">{sourceLabel ? `via ${sourceLabel} · ` : ""}{releaseLabels[track.releaseType]}{track.creditsNote ? ` · ${track.creditsNote.split(" · ")[0]}` : ""}</small>}
      </button>
      <span className="track-city"><MapPin size={12} />{track.city}</span>
      <span className="track-duration">{formatTime(track.duration)}</span>
      {onQueue && <button className="icon-button quiet" onClick={onQueue} aria-label={`Adicionar ${track.title} à fila`}><ListMusic size={16} /></button>}{onAdd && <button className="icon-button quiet" onClick={onAdd} aria-label={`Adicionar ${track.title} a uma playlist`}><Plus size={16} /></button>}{onSave && <button className={`icon-button quiet ${saved ? "is-saved" : ""}`} onClick={onSave} aria-label={saved ? `Remover ${track.title} das faixas salvas` : `Salvar ${track.title}`} aria-pressed={saved}><Bookmark size={16} fill={saved ? "currentColor" : "none"} /></button>}
      <button className="icon-button quiet" onClick={onShare} aria-label={`Compartilhar ${track.title}`}><Share2 size={16} /></button>
    </article>
  );
}

function ArtistCard({ artist, onOpen, followed, onFollow }: { artist: SceneArtist; onOpen: () => void; followed: boolean; onFollow: () => void }) {
  return (
    <article className="artist-card" style={{ "--accent": artist.accent } as CSSProperties}>
      <button className="artist-image" onClick={onOpen} aria-label={`Abrir perfil de ${artist.name}`}><img src={artist.image} alt={`Imagem de ${artist.name}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/cover-abstract.jpg"; }} /><span>{initials(artist.name)}</span></button>
      <div className="artist-card-body">
        <div><span className="card-kicker">{artist.genre}</span><h3>{artist.name}</h3><p>{artist.city}</p></div>
        <button className={`follow-button ${followed ? "is-followed" : ""}`} onClick={onFollow}>{followed ? <Check size={14} /> : <Plus size={14} />} {followed ? "Seguindo" : "Seguir"}</button>
      </div>
    </article>
  );
}

function addEventToCalendar(event: SceneEvent) {
  const start = event.isoDate ? new Date(event.isoDate) : new Date();
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const format = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CENA//Agenda local//PT-BR", "BEGIN:VEVENT", `UID:cena-event-${event.id}@cena`, `DTSTAMP:${format(new Date())}`, `DTSTART:${format(start)}`, `DTEND:${format(end)}`, `SUMMARY:${event.title.replace(/[,;\n]/g, " ")}`, `LOCATION:${event.place}, ${event.city}`, `DESCRIPTION:${event.description.replace(/[,;\n]/g, " ")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `cena-${event.id}.ics`; link.click(); URL.revokeObjectURL(url);
}

function EventCard({ event, interested, onInterest, onShare, onOpenArtist }: { event: SceneEvent; interested: boolean; onInterest: () => void; onShare: (path?: string) => void; onOpenArtist: () => void }) {
  const [, setLocation] = useLocation();
  const openEventDetails = () => setLocation(`/eventos/${event.id}`);
  return (
    <article className={`event-card event-${event.color}`}>
      <div className="event-date"><strong>{event.day}</strong><span>{event.month}</span></div>
      <div className="event-main">
        <div className="event-meta"><span><Clock3 size={13} /> {event.time}</span><span><MapPin size={13} /> {event.city}</span>{event.eventType && <span className="event-type-badge">{eventTypeLabels[event.eventType]}</span>}{event.admissionType && <span>{event.admissionType === "free" ? "gratuito" : event.admissionType === "contribution" ? "contribuição" : "ingresso"}</span>}</div>
        <h3><button type="button" className="event-title-link" aria-label={`Ver detalhes de ${event.title}`} onClick={openEventDetails}>{event.title}</button></h3>
        <button type="button" className="event-place" onClick={openEventDetails}>{event.place} <ArrowUpRight size={13} /></button>
        <p>{event.description}</p>{(event.safeSpace || event.accessibility || event.ageRating) && <div className="event-context">{event.safeSpace && <span><ShieldCheck size={13} /> espaço seguro</span>}{event.accessibility && <span>{event.accessibility}</span>}{event.ageRating && <span>{event.ageRating}</span>}</div>}
        {event.ticketUrl && <a className="event-place" href={event.ticketUrl} target="_blank" rel="noreferrer">Ingressos <Ticket size={12} /></a>}
        <div className="event-actions"><button type="button" className="text-button" onClick={openEventDetails}>Ver detalhes</button><button type="button" className={`interest-button ${interested ? "is-interested" : ""}`} onClick={onInterest}>{interested ? <Check size={15} /> : <Heart size={15} />} {interested ? "Você vai" : "Tenho interesse"}</button><button className="icon-button quiet" onClick={() => addEventToCalendar(event)} aria-label="Adicionar evento ao calendário"><CalendarDays size={16} /></button><button className="icon-button quiet" onClick={() => onShare()} aria-label="Compartilhar evento"><Share2 size={16} /></button></div>
      </div>
      <Ticket size={18} className="event-ticket" />
    </article>
  );
}

function HomeView({ content, activeGenre, setActiveGenre, activeCity, setActiveCity, onPlay, onOpenArtist, followed, onFollow, interested, onInterest, onShare, savedTracks, onSaveTrack, onAddToPlaylist, onQueueTrack, setView, personalization }: { content: typeof fallbackContent; activeGenre: string; setActiveGenre: (genre: string) => void; activeCity: string; setActiveCity: (city: string) => void; onPlay: (track: SceneTrack) => void; onOpenArtist: (artist: SceneArtist) => void; followed: number[]; onFollow: (id: number) => void; interested: number[]; onInterest: (id: number) => void; onShare: (label: string, path?: string) => void; savedTracks: number[]; onSaveTrack: (id: number) => void; onAddToPlaylist: (id: number) => void; onQueueTrack: (id: number) => void; setView: (view: View) => void; personalization: { city?: string | null; favoriteGenres?: string | null; recentTrackIds: number[]; interestedEventIds: number[]; eventArtistIds: number[]; isAuthenticated: boolean } }) {
  const interestedArtistIds = content.events.filter(event => personalization.interestedEventIds.includes(event.id)).map(event => event.artistId);
  const recommendedTracks = rankSceneTracks(content.tracks, { ...personalization, followedArtistIds: followed, savedTrackIds: savedTracks, eventArtistIds: interestedArtistIds });
  const recommendationLabel = personalization.isAuthenticated && (personalization.favoriteGenres || followed.length || savedTracks.length || personalization.recentTrackIds.length) ? "seu radar + curadoria local" : "curadoria local";
  return (
    <div className="page home-page">
      <section className="hero-block">
        <div className="hero-copy"><span className="eyebrow lime"><Radio size={13} /> AO VIVO EM {activeCity.toUpperCase()}</span><h1>A cidade tem<br /><em>som novo.</em></h1><p>Descubra faixas, artistas e shows feitos por quem vive a cena local.</p><div className="hero-actions"><button className="primary-button" onClick={() => recommendedTracks[0] && onPlay(recommendedTracks[0])}><Play size={16} fill="currentColor" /> Ouvir agora</button><button className="ghost-button" onClick={() => setView("events")}>Ver agenda <ChevronRight size={16} /></button></div></div>
        <div className="hero-art"><div className="hero-orb orb-one" /><div className="hero-orb orb-two" /><div className="hero-stamp"><span>escute<br />perto</span><Disc3 size={26} /></div><div className="hero-ticker"><span>• CENA LOCAL</span><span>• {activeCity.toUpperCase()}</span><span>• SEM ANÚNCIOS</span></div></div>
      </section>

      <section className="content-section">
        <SectionTitle eyebrow="descoberta regional" title="Em alta na sua cidade" action="Ver tudo" onAction={() => setView("search")} />
        <div className="filter-row"><label className="city-chip"><MapPin size={14} /><BrazilCityPicker value={activeCity} onChange={setActiveCity} compact /><ChevronRight size={14} /></label><div className="genre-filters">{content.genres.map(genre => <button key={genre} className={activeGenre === genre ? "active" : ""} onClick={() => setActiveGenre(genre)}>{genre}</button>)}</div></div>
        {content.source !== "seed" && !content.tracks.length && !content.artists.length && !content.events.length && <div className="empty-card city-empty-card"><MapPin size={22} /><strong>{content.source === "unavailable" ? "Não conseguimos carregar essa cena agora." : `Ainda não há catálogo em ${activeCity}.`}</strong><span>{content.source === "unavailable" ? "O serviço de descoberta está temporariamente indisponível. Tente novamente antes de concluir que a cidade está vazia." : "Essa cidade ainda está abrindo espaço para artistas, bandas e venues publicarem."}</span>{content.source === "unavailable" && <button className="text-button empty-action" type="button" onClick={() => window.location.reload()}>Tentar novamente <ChevronRight size={14} /></button>}</div>}
        {content.source !== "unavailable" && <div className="track-list">{content.tracks.length ? recommendedTracks.slice(0, 4).map((track, index) => <TrackRow key={track.id} track={track} active={index === 0} playing={false} onPlay={() => onPlay(track)} onShare={() => onShare(`Faixa ${track.title}`, `/faixas/${track.id}`)} saved={savedTracks.includes(track.id)} onSave={() => onSaveTrack(track.id)} onAdd={() => onAddToPlaylist(track.id)} onQueue={() => onQueueTrack(track.id)} />) : <EmptyState title={`Nada novo em ${activeCity}.`} message="Tente outro gênero ou escolha outra cidade para descobrir mais sons." />}</div>}
      </section>

<section className="content-section recommendation-section"><SectionTitle eyebrow={recommendationLabel} title="Descoberta com contexto" />{content.tracks.length > 1 ? <><p className="section-lede">{personalization.isAuthenticated ? "A ordem combina sua cidade, gêneros, artistas seguidos, faixas salvas e histórico — sem esconder o restante da cena." : `Estas faixas aparecem porque são parte do catálogo de ${activeCity}. Entre para ativar uma curadoria baseada no seu radar.`}</p><div className="recommendation-grid">{recommendedTracks.slice(1, 4).map(track => <article className="recommendation-card" key={track.id}><img src={track.cover} alt={`Capa de ${track.title}, ${track.artist}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/cover-abstract.jpg"; }} /><div><span className="card-kicker">{track.releaseType ? releaseLabels[track.releaseType] : "novo"} · {track.city}</span><h3>{track.title}</h3><p>{track.artist} · {track.genre}</p><button className="ghost-button" onClick={() => onPlay(track)}>Ouvir faixa local <Play size={14} /></button></div></article>)}</div></> : <EmptyState title={`A curadoria de ${activeCity} está começando.`} message="Estamos reunindo faixas e artistas da cidade. Enquanto isso, explore outros gêneros ou confira a agenda." action="Abrir busca" onAction={() => setView("search")} />}</section>

      <section className="collective-banner"><div className="collective-banner-copy"><span className="eyebrow lime"><Users size={14} /> cena em movimento</span><h2>Não é só ouvir.<br /><em>É fazer circular.</em></h2><p>Compilações, selos, palcos, zines e pessoas que dividem equipamento para a cena continuar de pé.</p></div><div className="collective-pills"><span><strong>01</strong> coletivos e selos</span><span><strong>02</strong> créditos visíveis</span><span><strong>03</strong> apoio direto</span><span><strong>04</strong> espaço seguro</span></div></section>

      <section className="content-section split-section"><div className="split-main"><SectionTitle eyebrow="gente que faz" title="Artistas da cena" action="Conhecer artistas" onAction={() => setView("search")} /><div className="artist-strip">{content.artists.map(artist => <ArtistCard key={artist.id} artist={artist} onOpen={() => onOpenArtist(artist)} followed={followed.includes(artist.id)} onFollow={() => onFollow(artist.id)} />)}</div></div><div className="quote-card"><Sparkles size={18} /><p>“O melhor som é aquele que você encontra a três quarteirões de casa.”</p><span>— Caderno de rua, Cambuí</span></div></section>

<section className="content-section"><SectionTitle eyebrow="chegue antes do refrão" title="Próximos encontros" action="Abrir agenda" onAction={() => setView("events")} />{content.events.length ? <div className="event-list">{content.events.slice(0, 3).map(event => <EventCard key={event.id} event={event} interested={interested.includes(event.id)} onInterest={() => onInterest(event.id)} onShare={() => onShare(`Evento ${event.title}`, `/eventos/${event.id}`)} onOpenArtist={() => setView("events")} />)}</div> : <EmptyState title={`A agenda de ${activeCity} está aberta para a cena.`} message="Ainda não há eventos publicados nessa cidade. Se você organiza uma noite, coloque-a no mapa." action="Abrir agenda" onAction={() => setView("events")} />}</section>
    </div>
  );
}

function SearchView({ content, activeCity, setActiveCity, searchTerm, setSearchTerm, activeGenre, setActiveGenre, onPlay, onOpenArtist, followed, onFollow, interested, onInterest, onShare, savedTracks, onSaveTrack, onAddToPlaylist, onQueueTrack }: { content: typeof fallbackContent; activeCity: string; setActiveCity: (city: string) => void; searchTerm: string; setSearchTerm: (term: string) => void; activeGenre: string; setActiveGenre: (genre: string) => void; onPlay: (track: SceneTrack) => void; onOpenArtist: (artist: SceneArtist) => void; followed: number[]; onFollow: (id: number) => void; interested: number[]; onInterest: (id: number) => void; onShare: (label: string, path?: string) => void; savedTracks: number[]; onSaveTrack: (id: number) => void; onAddToPlaylist: (id: number) => void; onQueueTrack: (id: number) => void }) {
  const foldText = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const term = foldText(searchTerm.trim());
  const tracks = content.tracks.filter(track => (activeGenre === "Tudo" || track.genre === activeGenre) && (!term || [track.title, track.artist, track.genre, track.city, track.releaseType, track.creditsNote].filter(Boolean).some(value => foldText(value).includes(term))));
  const artists = content.artists.filter(artist => !term || [artist.name, artist.handle, artist.genre, artist.city, artist.profileType, artist.bio, artist.manifesto].filter(Boolean).some(value => foldText(value).includes(term)));
  const events = content.events.filter(event => !term || [event.title, event.place, event.city, event.description, event.eventType].filter(Boolean).some(value => foldText(value).includes(term)));
  const searchSuggestions = Array.from(new Set([...content.artists.map(artist => artist.name), ...content.tracks.map(track => track.title), ...content.tracks.map(track => track.artist), ...content.genres, ...content.events.map(event => event.city)])).filter(Boolean).slice(0, 24);
  if (content.source === "unavailable") return <div className="page"><div className="page-intro"><span className="eyebrow">serviço temporariamente indisponível</span><h1>A busca volta já.</h1><p>Não foi possível consultar o catálogo de {activeCity} agora. Seus filtros continuam disponíveis quando o serviço retornar.</p></div><div className="empty-card city-empty-card"><MapPin size={22} /><strong>Não confunda isso com uma cidade vazia.</strong><span>O catálogo e a agenda estão temporariamente indisponíveis.</span><button className="text-button empty-action" type="button" onClick={() => window.location.reload()}>Tentar novamente <ChevronRight size={14} /></button></div></div>;
  return <div className="page"><div className="page-intro"><span className="eyebrow">explorar</span><h1>Buscar na cena.</h1><p>Artistas, faixas, gêneros, coletivos e lugares para ouvir a cena de {activeCity}.</p></div><div className="search-box"><Search size={20} /><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Busque por artista, faixa, selo, gênero, venue ou cidade" aria-label="Buscar na cena por artista, faixa, selo, gênero, venue ou cidade" list="cena-search-suggestions" autoFocus /><datalist id="cena-search-suggestions">{searchSuggestions.map(suggestion => <option key={suggestion} value={suggestion} />)}</datalist>{searchTerm && <button className="icon-button quiet" type="button" aria-label="Limpar busca" onClick={() => setSearchTerm("")}><X size={16} /></button>}</div><div className="filter-row search-filters"><label className="city-chip"><MapPin size={14} /><BrazilCityPicker value={activeCity} onChange={setActiveCity} compact /></label><div className="genre-filters">{content.genres.map(genre => <button key={genre} className={activeGenre === genre ? "active" : ""} onClick={() => setActiveGenre(genre)}>{genre}</button>)}</div></div><section className="content-section"><SectionTitle title={`Faixas ${searchTerm ? `para “${searchTerm}”` : "em destaque"}`} />{tracks.length ? <div className="track-list">{tracks.map(track => <TrackRow key={track.id} track={track} active={false} playing={false} onPlay={() => onPlay(track)} onShare={() => onShare(`Faixa ${track.title}`, `/faixas/${track.id}`)} saved={savedTracks.includes(track.id)} onSave={() => onSaveTrack(track.id)} onAdd={() => onAddToPlaylist(track.id)} onQueue={() => onQueueTrack(track.id)} />)}</div> : <EmptyState title="Nenhuma faixa encontrada." message={`Tente outro termo ou escolha outra cidade. A busca está filtrada em ${activeCity}.`} action="Limpar filtros" onAction={() => { setSearchTerm(""); setActiveGenre("Tudo"); }} />}</section><section className="content-section"><SectionTitle title="Artistas, bandas e coletivos" />{artists.length ? <div className="artist-strip">{artists.map(artist => <ArtistCard key={artist.id} artist={artist} onOpen={() => onOpenArtist(artist)} followed={followed.includes(artist.id)} onFollow={() => onFollow(artist.id)} />)}</div> : <EmptyState title="Nenhum projeto encontrado." message="Ainda não há esse projeto no radar da sua cidade." />}</section><section className="content-section"><SectionTitle eyebrow="agenda da cidade" title={searchTerm ? `Eventos para “${searchTerm}”` : "Próximos encontros"} />{events.length ? <div className="event-list event-page-list">{events.map(event => <EventCard key={event.id} event={event} interested={interested.includes(event.id)} onInterest={() => onInterest(event.id)} onShare={() => onShare(`Evento ${event.title}`, `/eventos/${event.id}`)} onOpenArtist={() => undefined} />)}</div> : <EmptyState title="Nenhum evento encontrado." message={`A agenda de ${activeCity} ainda não tem esse resultado. Tente outro termo ou abra a agenda completa.`} />}</section></div>;
}

function EventsView({ content, interested, onInterest, onShare, onCreateEvent, isArtist, managedEvents, onCancelEvent, onUpdateEvent, collectives }: { content: typeof fallbackContent; interested: number[]; onInterest: (id: number) => void; onShare: (label: string, path?: string) => void; onCreateEvent: (draft: { name: string; venue: string; city: string; address?: string; latitude?: number; longitude?: number; eventDate: string; collectiveId?: number | null; eventType: NonNullable<SceneEvent["eventType"]>; admissionType: NonNullable<SceneEvent["admissionType"]>; description: string; program: string; accessibility: string; safeSpace: boolean; ageRating: string; ticketUrl?: string }) => void; isArtist: boolean; managedEvents?: Array<{ id: number; name: string; venue: string; city: string; address?: string | null; latitude?: string | number | null; longitude?: string | number | null; eventDate: Date; description: string | null; ticketUrl: string | null; eventType?: NonNullable<SceneEvent["eventType"]>; admissionType?: NonNullable<SceneEvent["admissionType"]>; program?: string | null; accessibility?: string | null; safeSpace?: boolean; ageRating?: string | null }>; onCancelEvent: (id: number) => void; onUpdateEvent: (draft: { id: number; name: string; venue: string; city: string; address?: string | null; latitude?: number | null; longitude?: number | null; eventDate: string; eventType: NonNullable<SceneEvent["eventType"]>; admissionType: NonNullable<SceneEvent["admissionType"]>; description: string; program: string; accessibility: string; safeSpace: boolean; ageRating: string; ticketUrl?: string }) => void; collectives: Array<{ id: number; name: string; permission: string | null }> }) {
  const [showComposer, setShowComposer] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("Todas");
  const [draft, setDraft] = useState({ name: "", venue: "", city: "Campinas", address: "", latitude: "", longitude: "", eventDate: "", collectiveId: null as number | null, eventType: "show" as NonNullable<SceneEvent["eventType"]>, admissionType: "ticket" as NonNullable<SceneEvent["admissionType"]>, description: "", program: "", accessibility: "", safeSpace: false, ageRating: "", ticketUrl: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", venue: "", city: "", address: "", latitude: "", longitude: "", eventDate: "", eventType: "show" as NonNullable<SceneEvent["eventType"]>, admissionType: "ticket" as NonNullable<SceneEvent["admissionType"]>, description: "", program: "", accessibility: "", safeSpace: false, ageRating: "", ticketUrl: "" });
  const cities = ["Todas", ...Array.from(new Set(content.events.map(event => event.city)))];
  const filteredEvents = content.events.filter(event => {
    if (cityFilter !== "Todas" && event.city !== cityFilter) return false;
    if (dateFilter === "all" || !event.isoDate) return true;
    const days = (new Date(event.isoDate).getTime() - Date.now()) / 86_400_000;
    return days >= -1 && days <= Number(dateFilter);
  });
  if (content.source === "unavailable") return <div className="page"><div className="page-intro"><span className="eyebrow">agenda local</span><h1>A agenda volta já.</h1><p>Não foi possível consultar os eventos de sua região agora.</p></div><div className="empty-card city-empty-card"><MapPin size={22} /><strong>O serviço está temporariamente indisponível.</strong><span>Isso não significa que sua cidade está sem encontros publicados.</span><button className="text-button empty-action" type="button" onClick={() => window.location.reload()}>Tentar novamente <ChevronRight size={14} /></button></div></div>;
  return <div className="page"><div className="page-intro page-intro-row"><div><span className="eyebrow">agenda local</span><h1>Onde a cena se encontra.</h1><p>Shows, feiras e noites que merecem sair de casa.</p></div>{isArtist && <button className="primary-button" onClick={() => setShowComposer(value => !value)}><Plus size={16} /> Criar evento</button>}</div>{showComposer && <form className="composer-card" onSubmit={event => { event.preventDefault(); onCreateEvent({ ...draft, address: draft.address || undefined, latitude: draft.latitude ? Number(draft.latitude) : undefined, longitude: draft.longitude ? Number(draft.longitude) : undefined }); setShowComposer(false); }}><div className="composer-heading"><div><span className="eyebrow">artista</span><h2>Coloque seu show na agenda.</h2></div><button type="button" className="icon-button" onClick={() => setShowComposer(false)}><X size={18} /></button></div><div className="form-grid"><label>Nome do evento<input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Festival, show, sessão..." /></label><label>Local<input required value={draft.venue} onChange={event => setDraft({ ...draft, venue: event.target.value })} placeholder="Nome da casa" /></label><label>Cidade<BrazilCityPicker value={draft.city} onChange={city => setDraft({ ...draft, city })} /></label><label>Endereço do local<input maxLength={255} value={draft.address} onChange={event => setDraft({ ...draft, address: event.target.value })} placeholder="Rua, número, bairro (opcional)" /></label><div className="event-location-action"><button type="button" className="ghost-button" onClick={() => { if (!window.confirm("A CENA pedirá a localização deste dispositivo para preencher o ponto do evento. Confirme somente se o dispositivo estiver no local do evento. As coordenadas poderão ficar públicas na página do evento. Continuar?")) return; if (!navigator.geolocation) { toast.error("Este navegador não oferece geolocalização."); return; } navigator.geolocation.getCurrentPosition(position => setDraft(previous => ({ ...previous, latitude: String(position.coords.latitude), longitude: String(position.coords.longitude) })), () => toast.error("Não foi possível obter a localização. Confira a permissão do navegador."), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }); }}>Usar localização do local</button><small>{draft.latitude && draft.longitude ? `Ponto do mapa: ${Number(draft.latitude).toFixed(5)}, ${Number(draft.longitude).toFixed(5)}` : "Opcional · compartilhe apenas a localização do evento."}</small></div>{collectives.length > 0 && <label>Agenda do coletivo<select value={draft.collectiveId ?? ""} onChange={event => setDraft({ ...draft, collectiveId: event.target.value ? Number(event.target.value) : null })}><option value="">Meu projeto artístico</option>{collectives.filter(collective => collective.permission === "owner" || collective.permission === "editor" || collective.permission === "agenda").map(collective => <option key={collective.id} value={collective.id}>{collective.name}</option>)}</select></label>}<label>Data e hora<input required type="datetime-local" value={draft.eventDate} onChange={event => setDraft({ ...draft, eventDate: event.target.value })} /></label><label>Tipo<select value={draft.eventType} onChange={event => setDraft({ ...draft, eventType: event.target.value as NonNullable<SceneEvent["eventType"]> })}>{Object.entries(eventTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Entrada<select value={draft.admissionType} onChange={event => setDraft({ ...draft, admissionType: event.target.value as NonNullable<SceneEvent["admissionType"]> })}><option value="ticket">Ingresso</option><option value="free">Gratuito</option><option value="contribution">Contribuição</option></select></label></div><label>Descrição<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="O que acontece nessa noite?" /></label><label>Programação<textarea value={draft.program} onChange={event => setDraft({ ...draft, program: event.target.value })} placeholder="Horários, participantes, discotecagem..." /></label><label>Acessibilidade<textarea value={draft.accessibility} onChange={event => setDraft({ ...draft, accessibility: event.target.value })} placeholder="Rampa, Libras, banheiro acessível..." /></label><label className="rights-check"><input type="checkbox" checked={draft.safeSpace} onChange={event => setDraft({ ...draft, safeSpace: event.target.checked })} /><span><strong>Espaço seguro</strong> A produção se compromete com acolhimento e combate a assédio, racismo e LGBTfobia.</span></label><label>Classificação<input value={draft.ageRating} onChange={event => setDraft({ ...draft, ageRating: event.target.value })} placeholder="Livre, 16 anos..." /></label><label>Link de ingresso<input type="url" value={draft.ticketUrl} onChange={event => setDraft({ ...draft, ticketUrl: event.target.value })} placeholder="https://... (opcional)" /></label><button className="primary-button" type="submit">Publicar na agenda <ArrowUpRight size={16} /></button></form>}<div className="event-filters"><span className="eyebrow">filtrar agenda</span><select value={cityFilter} onChange={event => setCityFilter(event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select><select value={dateFilter} onChange={event => setDateFilter(event.target.value)}><option value="all">Todas as datas</option><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option></select></div><>{isArtist && managedEvents?.length ? <section className="content-section managed-events"><SectionTitle eyebrow="seu painel" title="Meus eventos" />{managedEvents.map(event => editingId === event.id ? <form className="managed-event-edit" key={event.id} onSubmit={submit => { submit.preventDefault(); onUpdateEvent({ id: event.id, ...editDraft, address: editDraft.address || undefined, latitude: editDraft.latitude ? Number(editDraft.latitude) : undefined, longitude: editDraft.longitude ? Number(editDraft.longitude) : undefined, ticketUrl: editDraft.ticketUrl || undefined }); setEditingId(null); }}><input required value={editDraft.name} onChange={input => setEditDraft({ ...editDraft, name: input.target.value })} /><input required value={editDraft.venue} onChange={input => setEditDraft({ ...editDraft, venue: input.target.value })} /><BrazilCityPicker value={editDraft.city} onChange={city => setEditDraft({ ...editDraft, city })} /><input value={editDraft.address} onChange={input => setEditDraft({ ...editDraft, address: input.target.value })} placeholder="Endereço" /><input type="number" step="any" min="-90" max="90" value={editDraft.latitude} onChange={input => setEditDraft({ ...editDraft, latitude: input.target.value })} placeholder="Latitude" /><input type="number" step="any" min="-180" max="180" value={editDraft.longitude} onChange={input => setEditDraft({ ...editDraft, longitude: input.target.value, latitude: input.target.value === "" ? "" : editDraft.latitude })} placeholder="Longitude" /><input required type="datetime-local" value={editDraft.eventDate} onChange={input => setEditDraft({ ...editDraft, eventDate: input.target.value })} /><textarea value={editDraft.description} onChange={input => setEditDraft({ ...editDraft, description: input.target.value })} /><input type="url" value={editDraft.ticketUrl} onChange={input => setEditDraft({ ...editDraft, ticketUrl: input.target.value })} placeholder="Link de ingresso" /><div><button className="primary-button" type="submit">Salvar</button><button className="ghost-button" type="button" onClick={() => setEditingId(null)}>Cancelar</button></div></form> : <div className="managed-event-row" key={event.id}><div><strong>{event.name}</strong><span>{event.eventDate.toLocaleDateString("pt-BR")} · {event.venue}, {event.city}</span></div><div className="managed-event-actions"><button className="ghost-button" onClick={() => { setEditingId(event.id); setEditDraft({ name: event.name, venue: event.venue, city: event.city, address: event.address ?? "", latitude: event.latitude == null ? "" : String(event.latitude), longitude: event.longitude == null ? "" : String(event.longitude), eventDate: formatLocalDateTimeInput(event.eventDate), eventType: event.eventType ?? "show", admissionType: event.admissionType ?? "ticket", description: event.description ?? "", program: event.program ?? "", accessibility: event.accessibility ?? "", safeSpace: Boolean(event.safeSpace), ageRating: event.ageRating ?? "", ticketUrl: event.ticketUrl ?? "" }); }}>Editar</button><button className="ghost-button danger-button" onClick={() => onCancelEvent(event.id)}>Cancelar evento</button></div></div>)}</section> : null}</><div className="event-list event-page-list">{filteredEvents.length ? filteredEvents.map(event => <EventCard key={event.id} event={event} interested={interested.includes(event.id)} onInterest={() => onInterest(event.id)} onShare={() => onShare(`Evento ${event.title}`, `/eventos/${event.id}`)} onOpenArtist={() => undefined} />) : <EmptyState title="Nenhum encontro nesse filtro." message={`Não encontramos eventos em ${cityFilter === "Todas" ? "sua cidade" : cityFilter} para esse período.`} action="Mostrar todas as datas" onAction={() => { setDateFilter("all"); setCityFilter("Todas"); }} />}</div></div>;
}

function LibraryView({ content, followed, onPlay, onOpenArtist, onCreatePlaylist, isAuthenticated, library, recentTrackIds, savedTracks, onSaveTrack, onOpenPlaylist, onShare }: { content: typeof fallbackContent; followed: number[]; onPlay: (track: SceneTrack) => void; onOpenArtist: (artist: SceneArtist) => void; onCreatePlaylist: () => void; isAuthenticated: boolean; library: LibrarySnapshot | undefined; recentTrackIds: number[]; savedTracks: number[]; onSaveTrack: (id: number) => void; onOpenPlaylist: (id: number) => void; onShare: (label: string, path?: string) => void }) {
  const followedArtists = content.artists.filter(artist => followed.includes(artist.id));
  const saved = content.tracks.filter(track => savedTracks.includes(track.id));
  const recentIds = library?.recentTrackIds ?? recentTrackIds;
  const recent = recentIds.map(id => content.tracks.find(track => track.id === id)).filter((track): track is SceneTrack => Boolean(track));
  const playlists = library?.playlists?.length ? library.playlists.map(playlist => ({ ...playlist, owner: "Você", description: playlist.collaborative ? "Aberta para a sua comunidade adicionar faixas." : "Sua rota pessoal pela cidade.", tracks: playlist.trackIds })) : content.playlists;
  return <div className="page"><div className="page-intro page-intro-row"><div><span className="eyebrow">seu canto</span><h1>Biblioteca.</h1><p>O que você guardou, seguiu e quer ouvir de novo.</p></div><button className="primary-button" onClick={onCreatePlaylist}><Plus size={16} /> Nova playlist</button></div><section className="content-section"><SectionTitle title={content.source === "seed" ? "Atividade de demonstração" : "Atividade"} />{content.source === "seed" && <p className="demo-content-notice">Atividade fictícia de demonstração; não representa publicações ou participação de usuários reais.</p>}<div className="activity-list">{content.activity.map(item => <div className="activity-item" key={item.id}><span className="activity-icon" style={{ background: item.accent }} /> <div><strong>{item.title}</strong><span>{item.time}</span></div><ArrowUpRight size={15} /></div>)}</div></section><section className="content-section"><SectionTitle title="Continuar ouvindo" />{recent.length ? <div className="track-list">{recent.slice(0, 5).map(track => <TrackRow key={track.id} track={track} active={false} playing={false} onPlay={() => onPlay(track)} onShare={() => undefined} saved={savedTracks.includes(track.id)} onSave={() => onSaveTrack(track.id)} />)}</div> : <div className="empty-card"><CirclePlay size={22} /><strong>Seu histórico começa aqui.</strong><span>Toque uma faixa para encontrá-la de novo na Biblioteca.</span></div>}</section><section className="content-section"><SectionTitle title="Faixas salvas" />{saved.length ? <div className="track-list">{saved.map(track => <TrackRow key={track.id} track={track} active={false} playing={false} onPlay={() => onPlay(track)} onShare={() => undefined} saved onSave={() => onSaveTrack(track.id)} />)}</div> : <div className="empty-card"><Bookmark size={22} /><strong>Suas faixas favoritas ficam aqui.</strong><span>Salve uma música durante a descoberta para ouvi-la de novo.</span></div>}</section><section className="content-section"><SectionTitle title={library?.playlists?.length ? "Suas playlists" : content.source === "seed" ? "Playlists de demonstração" : "Playlists"} /><div className="playlist-strip">{playlists.map(playlist => <article className="playlist-card" key={playlist.id}><div className="playlist-collage"><span style={{ background: "#c8f36a" }} /><span style={{ background: "#ff765f" }} /><span style={{ background: "#a69aff" }} /><ListMusic size={22} /></div><span className="card-kicker">{playlist.collaborative ? "colaborativa" : "playlist local"}</span><h3>{playlist.name}</h3><p>{playlist.description}</p><small>{playlist.owner} · {playlist.tracks.length} faixas</small><div className="playlist-card-actions"><button className="text-button" type="button" onClick={() => onOpenPlaylist(playlist.id)}>Abrir playlist</button>{playlist.collaborative && <button className="text-button" type="button" onClick={() => onShare(`Playlist ${playlist.name}`, `/playlists/${playlist.id}`)}>Compartilhar</button>}</div></article>)}</div></section><section className="content-section"><SectionTitle title="Artistas seguidos" />{followedArtists.length ? <div className="artist-strip">{followedArtists.map(artist => <ArtistCard key={artist.id} artist={artist} onOpen={() => onOpenArtist(artist)} followed onFollow={() => undefined} />)}</div> : <div className="empty-card"><Heart size={22} /><strong>Você ainda não segue ninguém.</strong><span>Descubra artistas da sua cidade e monte seu próprio radar.</span></div>}</section>{!isAuthenticated && <div className="login-callout"><LogIn size={20} /><div><strong>Entre para guardar sua cena.</strong><span>Follows, playlists e interesses ficam com você em qualquer tela.</span></div></div>}</div>;
}

function BookletViewer({ pages }: { pages: string[] }) {
  const [page, setPage] = useState(0);
  if (!pages.length) return null;
  return <section className="booklet-viewer" aria-label="Encarte folheável"><div className="booklet-heading"><div><span className="eyebrow lavender">encarte</span><h2>Folheie o projeto.</h2></div><span>{page + 1} / {pages.length}</span></div><div className="booklet-page"><img src={pages[page]} alt={`Página ${page + 1} do encarte`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/cover-abstract.jpg"; }} /></div><div className="booklet-controls"><button className="ghost-button" type="button" onClick={() => setPage(value => Math.max(0, value - 1))} disabled={page === 0}>Página anterior</button><div className="booklet-dots">{pages.map((_, index) => <button key={index} type="button" aria-label={`Abrir página ${index + 1}`} className={index === page ? "active" : ""} onClick={() => setPage(index)} />)}</div><button className="ghost-button" type="button" onClick={() => setPage(value => Math.min(pages.length - 1, value + 1))} disabled={page === pages.length - 1}>Próxima página</button></div></section>;
}
function ArtistProfile({ artist, content, followed, onFollow, onPlay, onShare, onReport }: { artist: SceneArtist; content: typeof fallbackContent; followed: boolean; onFollow: () => void; onPlay: (track: SceneTrack) => void; onShare: (label: string, path?: string) => void; onReport: () => void }) {
  const artistTracks = content.tracks.filter(track => track.artistId === artist.id);
  const artistEvents = content.events.filter(event => event.artistId === artist.id);
  const profileLabel = artist.profileType ? profileLabels[artist.profileType] : "artista";
  return <div className="page artist-profile-page"><div className="artist-cover" style={{ "--accent": artist.accent } as CSSProperties}><img src={artist.image} alt={`Capa do perfil de ${artist.name}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/cover-abstract.jpg"; }} /><div className="artist-cover-shade" /><span className="artist-cover-label">{artist.city}</span></div><div className="artist-profile-head"><div><span className="eyebrow">{profileLabel} · {artist.handle} · {artist.genre}</span><h1>{artist.name}{artist.profileType === "collective" && <BadgeCheck size={20} className="verified-mark" />}</h1><p>{artist.bio}</p>{artist.manifesto && <blockquote className="artist-manifesto">“{artist.manifesto}”</blockquote>}</div><div className="profile-actions"><button className={`follow-button large ${followed ? "is-followed" : ""}`} onClick={onFollow}>{followed ? <Check size={15} /> : <Plus size={15} />} {followed ? "Seguindo" : "Seguir"}</button><button type="button" aria-label="Compartilhar" className="icon-button" onClick={() => onShare(`Perfil de ${artist.name}`, `/artistas/${encodeURIComponent(artist.handle.replace(/^@/, ""))}`)}><Share2 size={17} /></button></div></div><section className="support-strip"><div><span className="eyebrow lime">apoie sem intermediário</span><strong>O dinheiro fica com quem faz.</strong></div><div className="support-actions">{artist.pixUrl && <button className="ghost-button" onClick={() => { void navigator.clipboard?.writeText(artist.pixUrl!); toast.success("Chave Pix copiada."); }}>Pix <ArrowUpRight size={13} /></button>}{artist.supportUrl && <a className="ghost-button" href={artist.supportUrl} target="_blank" rel="noreferrer">Apoiar <ArrowUpRight size={13} /></a>}{artist.merchUrl && <a className="ghost-button" href={artist.merchUrl} target="_blank" rel="noreferrer">Merch <ArrowUpRight size={13} /></a>}</div></section><section className="content-section"><SectionTitle eyebrow="faixas e créditos" title={`O som de ${artist.name}`} /><div className="track-list">{artistTracks.map(track => <TrackRow key={track.id} track={track} active={false} playing={false} onPlay={() => onPlay(track)} onShare={() => onShare(`Faixa ${track.title}`, `/faixas/${track.id}`)} />)}</div>{artistTracks.some(track => track.creditsNote) && <div className="credits-note"><Users size={15} /><span>Créditos visíveis: {artistTracks.filter(track => track.creditsNote).map(track => track.creditsNote).join(" · ")}</span></div>}</section>{artistEvents.length > 0 && <section className="content-section"><SectionTitle eyebrow="agenda" title="Próximos encontros" /><div className="event-list event-page-list">{artistEvents.map(event => <EventCard key={event.id} event={event} interested={false} onInterest={() => undefined} onShare={() => onShare(`Evento ${event.title}`, `/eventos/${event.id}`)} onOpenArtist={() => undefined} />)}</div></section>}<section className="profile-links"><span><Users size={15} /> {artist.followers} ouvintes</span>{artist.instagramUrl && <a href={artist.instagramUrl} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={13} /></a>}{artist.bandcampUrl && <a href={artist.bandcampUrl} target="_blank" rel="noreferrer">Bandcamp <ArrowUpRight size={13} /></a>}<button className="text-button report-button" onClick={onReport}><Flag size={13} /> Reportar</button></section></div>;
}

function UploadView({ draft, setDraft, onSubmit, isArtist, uploadStatus, onOpenProfile, onRequestNotifications, onSuggest, isSuggesting, suggestion, onApplyArtistBio, collectives }: { draft: UploadDraft; setDraft: (draft: UploadDraft) => void; onSubmit: () => void; isArtist: boolean; uploadStatus: string; onOpenProfile: () => void; onRequestNotifications: () => void; onSuggest: () => void; isSuggesting: boolean; suggestion: TrackSuggestion | null; onApplyArtistBio: (bio: string) => void; collectives: Array<{ id: number; name: string; permission: string | null }> }) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bookletInputRef = useRef<HTMLInputElement>(null);
  const canNotify = typeof window !== "undefined" && "Notification" in window;
  const notificationPermission = canNotify ? Notification.permission : "unsupported";
  const [audioMeta, setAudioMeta] = useState<{ duration: number; format: string } | null>(null);
  const handleAudioChange = (file: File | null) => {
    if (!file) return;
    const previewAudio = new Audio();
    const url = URL.createObjectURL(file);
    previewAudio.onloadedmetadata = () => { setAudioMeta({ duration: Math.round(previewAudio.duration || 0), format: file.type || file.name.split(".").pop()?.toUpperCase() || "áudio" }); URL.revokeObjectURL(url); };
    previewAudio.onerror = () => { setAudioMeta(null); URL.revokeObjectURL(url); };
    previewAudio.src = url;
    setDraft({ ...draft, audio: file, title: draft.title || file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ") });
  };
  return <div className="page"><div className="page-intro"><span className="eyebrow">selo aberto</span><h1>Seu som merece<br /><em>um lugar na cidade.</em></h1><p>Envie uma faixa, conte de onde ela vem e deixe a cena encontrar você.</p></div><div className="android-permission-card"><strong>Escolha seu áudio pelo Android</strong><span>Ao tocar em “Escolher áudio”, o Chrome abre o seletor de arquivos do aparelho. Não é necessário liberar acesso geral ao armazenamento: você escolhe apenas o arquivo que deseja enviar.</span>{canNotify && notificationPermission === "default" && <button className="ghost-button" type="button" onClick={onRequestNotifications}>Ativar avisos de lançamentos (opcional)</button>}{canNotify && notificationPermission === "denied" && <small>Os avisos estão bloqueados no Chrome. Abra as permissões do site para permitir notificações.</small>}</div><div className="source-choice"><span className="eyebrow lime">primeiro, escolha a fonte</span><div className="source-choice-buttons"><button type="button" className={draft.sourceType !== "upload" ? "active" : ""} onClick={() => setDraft({ ...draft, sourceType: draft.sourceType === "upload" ? "spotify" : draft.sourceType })}>Link de plataforma</button><button type="button" className={draft.sourceType === "upload" ? "active" : ""} onClick={() => setDraft({ ...draft, sourceType: "upload" })}>Áudio próprio</button></div>{draft.sourceType !== "upload" && <div className="external-link-fields"><label>Plataforma<select value={draft.sourceType} onChange={event => setDraft({ ...draft, sourceType: event.target.value as TrackSourceType })}><option value="spotify">Spotify</option><option value="youtube">YouTube</option><option value="bandcamp">Bandcamp</option><option value="soundcloud">SoundCloud</option></select></label><label>Link público da faixa<input required type="url" value={draft.externalUrl} onChange={event => setDraft({ ...draft, externalUrl: event.target.value })} placeholder="https://open.spotify.com/track/..." /><small>{draft.externalUrl && parseExternalTrackUrl(draft.externalUrl)?.sourceType === draft.sourceType ? `Link reconhecido: ${parseExternalTrackUrl(draft.externalUrl)?.label}.` : "Aceitamos um link público da plataforma escolhida."}</small></label></div>}</div><form className="upload-form" onSubmit={event => { event.preventDefault(); onSubmit(); }}>{uploadStatus && <div className="upload-status" role="status"><strong>{uploadStatus}</strong><span>Não feche esta tela até a publicação terminar.</span></div>}{!isArtist && <div className="upload-lock" role="status"><strong>Seu acesso atual é de ouvinte.</strong><span>Para publicar uma faixa, crie primeiro um perfil de artista ou banda.</span><button className="ghost-button" type="button" onClick={onOpenProfile}>Criar perfil de artista</button></div>}{draft.sourceType === "upload" ? <div className="upload-drop"><UploadCloud size={26} /><strong>{draft.audio ? draft.audio.name : "Escolha o arquivo de áudio"}</strong><span>MP3, WAV, M4A ou OGG · até 50 MB · duração recomendada de até 90 min</span><button className="primary-button" type="button" onClick={() => audioInputRef.current?.click()}>Escolher áudio</button><input ref={audioInputRef} required type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" onChange={event => handleAudioChange(event.target.files?.[0] ?? null)} /></div> : <div className="external-source-note"><Link2 size={19} /><div><strong>O CENA exibe o player da plataforma.</strong><span>O link continua sendo a fonte original. Spotify, YouTube e SoundCloud têm player embutido; Bandcamp fica como cartão seguro para abrir na plataforma.</span></div></div>}{audioMeta && <div className="audio-meta-read"><span>Leitura técnica</span><strong>{audioMeta.format} · {formatTime(audioMeta.duration)}</strong><small>Duração detectada automaticamente antes do envio.</small></div>}<div className="ai-suggest-row"><div><strong>Quer uma primeira versão da descrição?</strong><span>A IA usa os dados preenchidos e o perfil da banda como rascunho editável.</span></div><button className="ghost-button" type="button" disabled={draft.sourceType !== "upload" || !draft.audio || isSuggesting} onClick={onSuggest}><Sparkles size={15} /> {isSuggesting ? "Lendo e sugerindo..." : "Gerar sugestão"}</button></div>{suggestion && <div className="ai-suggestion-card"><span className="eyebrow lime">rascunho automático</span><p>{suggestion.description}</p>{suggestion.tags.length > 0 && <div className="suggestion-tags">{suggestion.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>}{suggestion.artistBio && <div className="artist-bio-suggestion"><small>Sugestão para a bio da banda/artista</small><p>{suggestion.artistBio}</p><button className="ghost-button" type="button" onClick={() => onApplyArtistBio(suggestion.artistBio)}>Usar na bio do perfil</button></div>}<small>Revise tudo antes de publicar. A sugestão não confirma autoria, direitos ou créditos.</small></div>}<div className="form-grid"><label>Título da faixa<input required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Como ela se chama?" /></label><label>Álbum ou projeto<input value={draft.album} onChange={event => setDraft({ ...draft, album: event.target.value })} placeholder="Opcional" /></label><label>Formato<select value={draft.releaseType} onChange={event => setDraft({ ...draft, releaseType: event.target.value as UploadDraft["releaseType"] })}>{Object.entries(releaseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Data de lançamento<input type="date" value={draft.releaseDate} onChange={event => setDraft({ ...draft, releaseDate: event.target.value })} /><small>Deixe vazio para publicar imediatamente.</small></label><label>Visibilidade<select value={draft.visibility} onChange={event => setDraft({ ...draft, visibility: event.target.value as UploadDraft["visibility"] })}><option value="public">Público</option><option value="private">Rascunho privado</option></select></label><label>Gênero<select value={draft.genre} onChange={event => setDraft({ ...draft, genre: event.target.value })}>{sceneGenres.filter(genre => genre !== "Tudo").map(genre => <option key={genre}>{genre}</option>)}</select></label><label>Cidade<BrazilCityPicker value={draft.city} onChange={city => setDraft({ ...draft, city })} /></label>{collectives.length > 0 && <label>Publicar em nome de<select value={draft.collectiveId ?? ""} onChange={event => setDraft({ ...draft, collectiveId: event.target.value ? Number(event.target.value) : null })}><option value="">Meu projeto artístico</option>{collectives.filter(collective => collective.permission === "owner" || collective.permission === "editor").map(collective => <option key={collective.id} value={collective.id}>{collective.name}</option>)}</select><small>O coletivo ficará visível como contexto da publicação.</small></label>}</div><label>Descrição<textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Uma frase sobre essa faixa" /></label><label>Créditos<textarea value={draft.creditsNote} onChange={event => setDraft({ ...draft, creditsNote: event.target.value })} placeholder="Voz · beat · produção · gravação · mix · arte" /></label><div className="cover-input"><span>Capa da faixa</span><button className="ghost-button" type="button" onClick={() => coverInputRef.current?.click()}>{draft.cover ? draft.cover.name : "Escolher imagem"}</button><input ref={coverInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" onChange={event => setDraft({ ...draft, cover: event.target.files?.[0] ?? null })} /></div><div className="cover-input booklet-input"><span>Encarte folheável <small>opcional · até 12 páginas</small></span><button className="ghost-button" type="button" onClick={() => bookletInputRef.current?.click()}>{draft.bookletPages.length ? `${draft.bookletPages.length} página(s) selecionada(s)` : "Adicionar encarte"}</button><input ref={bookletInputRef} type="file" multiple accept="image/*,.jpg,.jpeg,.png,.webp" onChange={event => setDraft({ ...draft, bookletPages: Array.from(event.target.files ?? []).slice(0, 12) })} /></div><label className="rights-check"><input type="checkbox" checked={draft.rights} onChange={event => setDraft({ ...draft, rights: event.target.checked })} /><span><strong>Declaro que tenho os direitos.</strong> Confirmo que sou o artista ou representante autorizado do áudio e da imagem enviados. A Cena pode hospedar e reproduzir este conteúdo conforme os termos de uso.</span></label><button className="primary-button" type="submit" disabled={!isArtist || !draft.rights || Boolean(uploadStatus) || (draft.sourceType === "upload" ? !draft.audio : !draft.externalUrl)}><UploadCloud size={16} /> {isArtist ? (draft.sourceType === "upload" ? "Publicar áudio na Cena" : "Divulgar link na Cena") : "Crie um perfil de artista primeiro"}</button></form></div>;
}
function ArtistSetupView({ draft, setDraft, onSubmit, isSaving }: { draft: ArtistDraft; setDraft: (draft: ArtistDraft) => void; onSubmit: () => void; isSaving: boolean }) {
  return <form className="composer-card artist-setup-card" onSubmit={event => { event.preventDefault(); onSubmit(); }}><div className="composer-heading"><div><span className="eyebrow lime">primeiro passo</span><h2>Apresente seu projeto.</h2><p>Seu perfil é a porta de entrada para faixas, shows e novos ouvintes.</p></div></div><div className="form-grid"><label>Nome artístico<input required minLength={2} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Como a cidade conhece você?" /></label><label>@ do projeto<input required pattern="@?[A-Za-z0-9_]+" value={draft.handle} onChange={event => setDraft({ ...draft, handle: event.target.value })} placeholder="lumeazul" /></label><label>Você é<select value={draft.profileType} onChange={event => setDraft({ ...draft, profileType: event.target.value as ArtistDraft["profileType"] })}>{Object.entries(profileLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Cidade<BrazilCityPicker value={draft.city} onChange={city => setDraft({ ...draft, city })} /></label><label>Gênero<input value={draft.genre} onChange={event => setDraft({ ...draft, genre: event.target.value })} placeholder="Punk, rap, grime..." /></label></div><label>Bio<textarea value={draft.bio} onChange={event => setDraft({ ...draft, bio: event.target.value })} placeholder="Conte em poucas linhas de onde vem o seu som." maxLength={1000} /></label><label>Manifesto ou jeito de fazer<textarea value={draft.manifesto} onChange={event => setDraft({ ...draft, manifesto: event.target.value })} placeholder="O que você quer fortalecer na cena?" maxLength={1500} /></label><div className="form-grid"><label>Link de apoio<input type="url" value={draft.supportUrl ?? ""} onChange={event => setDraft({ ...draft, supportUrl: event.target.value })} placeholder="https://apoia.se/..." /></label><label>Chave Pix<input value={draft.pixUrl ?? ""} onChange={event => setDraft({ ...draft, pixUrl: event.target.value })} placeholder="sua-chave-ou-email" /></label></div><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Salvando perfil..." : "Criar perfil de artista"} <ArrowUpRight size={16} /></button></form>;
}

function ListenerProfileView({ draft, setDraft, onSubmit, isSaving }: { draft: ListenerDraft; setDraft: (draft: ListenerDraft) => void; onSubmit: () => void; isSaving: boolean }) {
  return <form className="composer-card listener-profile-card" onSubmit={event => { event.preventDefault(); onSubmit(); }}><div className="composer-heading"><div><span className="eyebrow lavender">perfil de público</span><h2>Monte seu radar local.</h2><p>Esse perfil é separado do perfil de artista e serve para personalizar cidade, gêneros e agenda.</p></div></div><div className="form-grid"><label>Sua cidade<BrazilCityPicker value={draft.city} onChange={city => setDraft({ ...draft, city })} /></label><label>Gêneros favoritos<input value={draft.favoriteGenres} onChange={event => setDraft({ ...draft, favoriteGenres: event.target.value })} placeholder="Indie, MPB, eletrônico" /></label></div><label>Sobre você<textarea maxLength={500} value={draft.publicBio} onChange={event => setDraft({ ...draft, publicBio: event.target.value })} placeholder="O que você gosta de encontrar na cena?" /></label><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Salvando perfil..." : "Salvar perfil de público"} <ArrowUpRight size={16} /></button></form>;
}

function ArtistStudioView({ profile, stats, draft, setDraft, onSave, onRemoveTrack, onUpload, onUploadAsset, isSaving }: { profile: NonNullable<Awaited<ReturnType<typeof Promise.resolve>>> & { name: string; handle: string; city: string; genre?: string | null; bio?: string | null }; stats: { plays: number; followers: number; events: Array<{ id: number; name: string; interest: number }>; topTracks: Array<{ id: number; title: string; plays: number }> } | null | undefined; draft: ArtistDraft; setDraft: (draft: ArtistDraft) => void; onSave: () => void; onRemoveTrack: (id: number) => void; onUpload: () => void; onUploadAsset: (file: File, field: "avatarUrl" | "coverUrl") => void; isSaving: boolean }) {
  return <div className="artist-studio"><div className="section-title"><div><span className="eyebrow lime">seu estúdio</span><h2>O pulso do seu projeto.</h2></div><div className="studio-actions"><span className="data-mode is-live">dados reais</span><button className="primary-button" type="button" onClick={onUpload}><UploadCloud size={15} /> Enviar nova faixa</button></div></div><div className="stats-grid"><div className="stat-card"><strong>{stats?.plays ?? 0}</strong><span>reproduções</span></div><div className="stat-card"><strong>{stats?.followers ?? 0}</strong><span>seguidores</span></div><div className="stat-card"><strong>{stats?.events?.reduce((sum, event) => sum + event.interest, 0) ?? 0}</strong><span>interesses em shows</span></div></div><div className="composer-card"><div className="composer-heading"><div><span className="eyebrow">editar presença</span><h2>Deixe seu perfil mais completo.</h2></div><button className="primary-button" type="button" onClick={onSave} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar perfil"}</button></div><div className="artist-media-grid"><label className="media-upload-card"><span className="eyebrow lime">foto do projeto</span>{draft.avatarUrl && <img src={draft.avatarUrl} alt="Prévia da foto do projeto" /> }<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) onUploadAsset(file, "avatarUrl"); event.currentTarget.value = ""; }} /><small>JPG, PNG ou WebP · até 10 MB</small></label><label className="media-upload-card"><span className="eyebrow lime">capa do perfil</span>{draft.coverUrl && <img src={draft.coverUrl} alt="Prévia da capa do perfil" /> }<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) onUploadAsset(file, "coverUrl"); event.currentTarget.value = ""; }} /><small>Uma imagem horizontal para apresentar a cena do projeto.</small></label></div><div className="form-grid"><label>Nome artístico<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label>@ do projeto<input value={draft.handle} onChange={event => setDraft({ ...draft, handle: event.target.value })} /></label><label>Você é<select value={draft.profileType} onChange={event => setDraft({ ...draft, profileType: event.target.value as ArtistDraft["profileType"] })}>{Object.entries(profileLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Cidade<BrazilCityPicker value={draft.city} onChange={city => setDraft({ ...draft, city })} /></label><label>Gênero<input value={draft.genre} onChange={event => setDraft({ ...draft, genre: event.target.value })} /></label></div><label>Bio<textarea maxLength={1000} value={draft.bio} onChange={event => setDraft({ ...draft, bio: event.target.value })} /></label><label>Manifesto<textarea maxLength={1500} value={draft.manifesto} onChange={event => setDraft({ ...draft, manifesto: event.target.value })} placeholder="O que você quer fortalecer na cena?" /></label><div className="form-grid"><label>Instagram<input type="url" value={draft.instagramUrl ?? ""} onChange={event => setDraft({ ...draft, instagramUrl: event.target.value })} placeholder="https://instagram.com/..." /></label><label>Bandcamp<input type="url" value={draft.bandcampUrl ?? ""} onChange={event => setDraft({ ...draft, bandcampUrl: event.target.value })} placeholder="https://..." /></label><label>Link de apoio<input type="url" value={draft.supportUrl ?? ""} onChange={event => setDraft({ ...draft, supportUrl: event.target.value })} placeholder="https://apoia.se/..." /></label><label>Chave Pix<input value={draft.pixUrl ?? ""} onChange={event => setDraft({ ...draft, pixUrl: event.target.value })} placeholder="sua-chave" /></label><label>Merch<input type="url" value={draft.merchUrl ?? ""} onChange={event => setDraft({ ...draft, merchUrl: event.target.value })} placeholder="https://..." /></label></div></div><div className="content-section"><SectionTitle eyebrow="desempenho" title="Faixas mais ouvidas" />{stats?.topTracks?.length ? <div className="activity-list">{stats.topTracks.map(track => <div className="activity-item" key={track.id}><span className="activity-icon" style={{ background: "#c8f36a" }} /><div><strong>{track.title}</strong><span>{track.plays} reproduções</span></div><button className="icon-button quiet" type="button" aria-label={`Remover ${track.title}`} onClick={() => onRemoveTrack(track.id)}><X size={15} /></button></div>)}</div> : <EmptyState title="Ainda não há reproduções." message="Publique uma faixa e compartilhe seu perfil para começar a acompanhar a cena." />}</div></div>;
}

type AudioPreset = "flat" | "voz" | "grave" | "brilho" | "noite" | "palco";
type AudioSettings = { preset: AudioPreset; bass: number; mid: number; treble: number };
const audioPresets: Array<{ id: AudioPreset; label: string; description: string; bass: number; mid: number; treble: number }> = [
  { id: "flat", label: "Neutro", description: "Sem correção", bass: 0, mid: 0, treble: 0 },
  { id: "voz", label: "Voz", description: "Vocal e letra à frente", bass: -2, mid: 4, treble: 2 },
  { id: "grave", label: "Grave", description: "Peso para rap e beat", bass: 6, mid: 1, treble: -1 },
  { id: "brilho", label: "Brilho", description: "Detalhe para guitarras", bass: -1, mid: 2, treble: 5 },
  { id: "noite", label: "Noite", description: "Escuta mais suave", bass: -3, mid: 2, treble: -4 },
  { id: "palco", label: "Palco", description: "Impacto de show ao vivo", bass: 4, mid: 0, treble: 3 },
];
function readAudioSettings(): AudioSettings {
  const fallback: AudioSettings = { preset: "flat", bass: 0, mid: 0, treble: 0 };
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem("cena-audio-settings") || "null") as Partial<AudioSettings> | null;
    if (!parsed) return fallback;
    const validPreset = audioPresets.some(item => item.id === parsed.preset) ? parsed.preset as AudioPreset : "flat";
    return { preset: validPreset, bass: Number.isFinite(parsed.bass) ? Math.max(-8, Math.min(8, Number(parsed.bass))) : 0, mid: Number.isFinite(parsed.mid) ? Math.max(-8, Math.min(8, Number(parsed.mid))) : 0, treble: Number.isFinite(parsed.treble) ? Math.max(-8, Math.min(8, Number(parsed.treble))) : 0 };
  } catch { return fallback; }
}
function Player({ track, isPlaying, onToggle, onNext, onPrevious, progress, duration, onSeek, queueCount, onQueueOpen, audioSettings, onPreset, onBandChange, audioSupported, audioLoading, audioError, onRetry }: { track: SceneTrack; isPlaying: boolean; onToggle: () => void; onNext: () => void; onPrevious: () => void; progress: number; duration: number; onSeek: (value: number) => void; queueCount: number; onQueueOpen: () => void; audioSettings: AudioSettings; onPreset: (preset: AudioPreset) => void; onBandChange: (band: "bass" | "mid" | "treble", value: number) => void; audioSupported: boolean; audioLoading: boolean; audioError: string | null; onRetry: () => void }) {
  const [showAudio, setShowAudio] = useState(false);
  const bands: Array<{ id: "bass" | "mid" | "treble"; label: string; value: number }> = [{ id: "bass", label: "Grave", value: audioSettings.bass }, { id: "mid", label: "Médio", value: audioSettings.mid }, { id: "treble", label: "Agudo", value: audioSettings.treble }];
  const retryableError = Boolean(audioError && track.audioUrl);
  const sourceLabel = track.sourceType && track.sourceType !== "upload" ? { spotify: "Spotify", youtube: "YouTube", bandcamp: "Bandcamp", soundcloud: "SoundCloud" }[track.sourceType] : null;
  return <footer className={`scene-player ${isPlaying ? "is-playing" : ""}`} aria-live="polite"><div className="player-track"><img src={track.cover} alt={`Capa de ${track.title}, ${track.artist}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/cover-abstract.jpg"; }} /><div><strong>{track.title}</strong><span>{track.artist}</span>{audioLoading && <small className="player-status">carregando áudio…</small>}{audioError && <small className="player-status is-error">{audioError}</small>}</div></div>{track.embedUrl ? <div className="external-player-embed"><iframe title={`Player de ${track.title} em ${sourceLabel || "plataforma externa"}`} src={track.embedUrl} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" /></div> : track.externalUrl ? <a className="external-player-link" href={track.externalUrl} target="_blank" rel="noreferrer">Abrir no {sourceLabel || "serviço original"} <ArrowUpRight size={13} /></a> : null}<div className="player-controls"><button className="player-skip" onClick={onPrevious} aria-label="Faixa anterior"><SkipBack size={16} fill="currentColor" /></button><button className="player-play" onClick={retryableError ? onRetry : onToggle} aria-label={retryableError ? "Tentar tocar novamente" : audioError ? "Áudio ainda não disponível" : isPlaying ? "Pausar" : "Tocar"} disabled={audioLoading || Boolean(audioError && !retryableError)}>{audioError ? <CirclePlay size={18} fill="currentColor" /> : isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button className="player-skip" onClick={onNext} aria-label="Próxima faixa"><SkipForward size={16} fill="currentColor" /></button><button className={`player-audio-toggle ${showAudio ? "is-active" : ""}`} onClick={() => setShowAudio(value => !value)} aria-label="Abrir melhoria inteligente do som" aria-expanded={showAudio}><SlidersHorizontal size={16} /></button></div><div className="player-progress"><button className="queue-count" onClick={onQueueOpen} aria-label="Abrir fila de reprodução">fila {queueCount}</button><span>{formatTime(progress)}</span><input type="range" min="0" max={Math.max(duration, track.duration)} value={Math.min(progress, Math.max(duration, track.duration))} onChange={event => onSeek(Number(event.target.value))} aria-label="Posição da faixa" disabled={Boolean(audioError)} /><span>{formatTime(duration || track.duration)}</span></div>{showAudio && <div className="audio-panel" role="dialog" aria-label="Melhoria inteligente do som"><div className="audio-panel-head"><div><span className="eyebrow lime">som inteligente</span><strong>Equalizador da CENA.</strong></div><small>{audioSupported ? "Processamento neste dispositivo" : "Equalizador indisponível neste navegador"}</small></div><div className="audio-presets">{audioPresets.map(preset => <button key={preset.id} className={audioSettings.preset === preset.id ? "active" : ""} onClick={() => onPreset(preset.id)} disabled={!audioSupported} title={preset.description}>{preset.label}</button>)}</div><div className="audio-bands">{bands.map(band => <label key={band.id}><span>{band.label}<strong>{band.value > 0 ? "+" : ""}{band.value} dB</strong></span><input type="range" min="-8" max="8" step="1" value={band.value} onChange={event => onBandChange(band.id, Number(event.target.value))} disabled={!audioSupported} aria-label={`Ajuste de ${band.label}`} /></label>)}</div><p className="audio-note">Os ajustes são locais, não alteram o arquivo original e ficam salvos neste dispositivo.</p></div>}</footer>;
}
type StoredPlayerState = { trackId: number; position: number; currentTrackIndex: number; queue: number[]; recentTrackIds: number[] };

function readStoredPlayerState(): StoredPlayerState {
  if (typeof window === "undefined") return { trackId: 0, position: 0, currentTrackIndex: 0, queue: [], recentTrackIds: [] };
  try {
    const raw = window.localStorage.getItem("cena-player-state");
    if (!raw) return { trackId: 0, position: 0, currentTrackIndex: 0, queue: [], recentTrackIds: [] };
    const parsed = JSON.parse(raw) as Partial<StoredPlayerState>;
    return {
      trackId: Number.isFinite(parsed.trackId) ? Number(parsed.trackId) : 0,
      position: Number.isFinite(parsed.position) ? Math.max(0, Number(parsed.position)) : 0,
      currentTrackIndex: Number.isFinite(parsed.currentTrackIndex) ? Math.max(0, Number(parsed.currentTrackIndex)) : 0,
      queue: Array.isArray(parsed.queue) ? parsed.queue.filter((id): id is number => Number.isInteger(id)) : [],
      recentTrackIds: Array.isArray(parsed.recentTrackIds) ? parsed.recentTrackIds.filter((id): id is number => Number.isInteger(id)).slice(0, 20) : [],
    };
  } catch {
    return { trackId: 0, position: 0, currentTrackIndex: 0, queue: [], recentTrackIds: [] };
  }
}

export default function Home() {
  const { user, isAuthenticated, logout, error: sessionError, refresh: refreshSession } = useAuth();
  const [location, setLocation] = useLocation();
  const handleLogout = () => {
    setShowMenu(false);
    setIsPlaying(false);
    void logout().then(() => { setSelectedArtist(null); goTo("home"); toast.success("Você saiu da Cena."); }).catch(() => toast.error("Não foi possível sair agora. Tente novamente."));
  };
  const [view, setView] = useState<View>(() => viewFromPath(location));
  const [activeGenre, setActiveGenre] = useState("Tudo");
  const [activeCity, setActiveCity] = useState(() => { try { return window.localStorage.getItem("cena-city") || "Campinas"; } catch { return "Campinas"; } });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTrackIndex, setCurrentTrackIndex] = useState(() => readStoredPlayerState().currentTrackIndex);
  const [sharedTrack, setSharedTrack] = useState<SceneTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [progress, setProgress] = useState(() => readStoredPlayerState().position);
  const [duration, setDuration] = useState(0);
  const [followed, setFollowed] = useState<number[]>([]);
  const [interested, setInterested] = useState<number[]>([]);
  const [savedTracks, setSavedTracks] = useState<number[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<SceneArtist | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authIntent, setAuthIntent] = useState<"login" | "create">("login");
  const [showMenu, setShowMenu] = useState(false);
  const [role, setRole] = useState<"listener" | "artist">("listener");
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState<number | null>(null);
  const [queue, setQueue] = useState<number[]>(() => readStoredPlayerState().queue);
  const [recentTrackIds, setRecentTrackIds] = useState<number[]>(() => readStoredPlayerState().recentTrackIds);
  const [hasPlaybackIntent, setHasPlaybackIntent] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [playlistName, setPlaylistName] = useState("");
  const [collaborative, setCollaborative] = useState(true);
  const [uploadDraft, setUploadDraft] = useState<UploadDraft>(() => ({ title: "", sourceType: "spotify", externalUrl: "", album: "", genre: "Punk", city: "Campinas", description: "", releaseType: "single", releaseDate: "", visibility: "public", creditsNote: "", rights: false, collectiveId: null, ...readSavedUploadDraft(), audio: null, cover: null, bookletPages: [] }));
  const [artistDraft, setArtistDraft] = useState<ArtistDraft>({ name: "", handle: "", city: "Campinas", profileType: "solo", genre: "", bio: "", manifesto: "" });
  const [listenerDraft, setListenerDraft] = useState<ListenerDraft>({ city: "Campinas", favoriteGenres: "", publicBio: "" });
  const [showArtistStudio, setShowArtistStudio] = useState(false);
  const [selectedCollectiveId, setSelectedCollectiveId] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const inviteAttemptRef = useRef<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [trackSuggestion, setTrackSuggestion] = useState<TrackSuggestion | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioFiltersRef = useRef<{ bass: BiquadFilterNode; mid: BiquadFilterNode; treble: BiquadFilterNode } | null>(null);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => readAudioSettings());
  const [audioSupported, setAudioSupported] = useState(false);
  const uploadIdRef = useRef<string | null>(null);
  const accountTypeMutation = trpc.scene.setAccountType.useMutation({ onError: error => toast.error(error.message.includes("10001") || error.message.toLowerCase().includes("login") ? "Sua sessão expirou. Entre novamente para continuar." : error.message) });
  const followMutation = trpc.scene.followArtist.useMutation();
  const interestMutation = trpc.scene.interestEvent.useMutation();
  const saveTrackMutation = trpc.scene.saveTrack.useMutation();
  const playMutation = trpc.scene.recordPlay.useMutation();
  const playlistMutation = trpc.scene.createPlaylist.useMutation();
  const addTrackMutation = trpc.scene.addTrackToPlaylist.useMutation();
  const eventMutation = trpc.scene.createEvent.useMutation();
  const deleteEventMutation = trpc.scene.deleteEvent.useMutation();
  const cancelEventMutation = trpc.scene.cancelEvent.useMutation();
  const updateEventMutation = trpc.scene.updateEvent.useMutation();
  const cleanupUploadMutation = trpc.scene.cleanupUpload.useMutation();
  const trackMutation = trpc.scene.createTrack.useMutation();
  const suggestTrackMetadataMutation = trpc.scene.suggestTrackMetadata.useMutation({ onSuccess: suggestion => { setTrackSuggestion(suggestion); setUploadDraft(previous => ({ ...previous, title: previous.title || suggestion.album, album: suggestion.album || previous.album, genre: suggestion.genre || previous.genre, description: suggestion.description || previous.description, creditsNote: suggestion.creditsNote || previous.creditsNote })); toast.success("Sugestão criada. Revise antes de publicar."); }, onError: error => toast.error(error.message) });
  const takedownMutation = trpc.scene.takedownTrack.useMutation();
  const reportMutation = trpc.scene.reportContent.useMutation();
  const artistProfileMutation = trpc.scene.createArtistProfile.useMutation({ onError: error => toast.error(error.message.includes("10001") || error.message.toLowerCase().includes("login") ? "Sua sessão expirou. Entre novamente para continuar." : error.message) });
  const updateArtistProfileMutation = trpc.scene.updateArtistProfile.useMutation();
  const listenerProfileMutation = trpc.scene.updateListenerProfile.useMutation({ onError: error => toast.error(error.message.includes("10001") || error.message.toLowerCase().includes("login") ? "Sua sessão expirou. Entre novamente para continuar." : error.message) });
  const notifications = trpc.scene.notifications.useQuery(undefined, { enabled: isAuthenticated, staleTime: 15_000 });
  const markNotificationsReadMutation = trpc.scene.markNotificationsRead.useMutation();
  const utils = trpc.useUtils();
  const customNotificationMutation = trpc.scene.createCustomNotification.useMutation({ onSuccess: result => { toast.success(`Notificação enviada para ${result.created} conta${result.created === 1 ? "" : "s"}.`); void utils.scene.notifications.invalidate(); }, onError: error => toast.error(error.message) });
  const moderationReports = trpc.scene.moderationReports.useQuery({}, { enabled: isAuthenticated && user?.role === "admin" && user?.adminRole !== "agenda", staleTime: 15_000 });
  const auditLogs = trpc.scene.auditLogs.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" && user?.adminRole !== "agenda", staleTime: 15_000 });
  const myCollectives = trpc.scene.myCollectives.useQuery(undefined, { enabled: isAuthenticated && (user?.accountType === "artist" || user?.role === "admin"), staleTime: 30_000 });
  const pendingCollectiveInvites = trpc.scene.pendingCollectiveInvites.useQuery(undefined, { enabled: isAuthenticated, staleTime: 15_000 });
  const acceptPendingInviteMutation = trpc.scene.acceptPendingCollectiveInvite.useMutation({ onSuccess: () => { void pendingCollectiveInvites.refetch(); void myCollectives.refetch(); toast.success("Você entrou no coletivo."); }, onError: error => toast.error(error.message) });
  const declinePendingInviteMutation = trpc.scene.declineCollectiveInvite.useMutation({ onSuccess: () => { void pendingCollectiveInvites.refetch(); toast.success("Convite recusado."); }, onError: error => toast.error(error.message) });
  const collectiveMembers = trpc.scene.collectiveMembers.useQuery({ collectiveId: selectedCollectiveId ?? 0 }, { enabled: Boolean(selectedCollectiveId), staleTime: 15_000 });
  const updateCollectiveMemberMutation = trpc.scene.updateCollectiveMember.useMutation({ onSuccess: () => { void collectiveMembers.refetch(); void myCollectives.refetch(); toast.success("Permissão atualizada."); }, onError: error => toast.error(error.message) });
  const removeCollectiveMemberMutation = trpc.scene.removeCollectiveMember.useMutation({ onSuccess: () => { void collectiveMembers.refetch(); toast.success("Acesso removido do coletivo."); }, onError: error => toast.error(error.message) });
  const createCollectiveInviteMutation = trpc.scene.createCollectiveInvite.useMutation({ onSuccess: result => { setInviteLink(`${window.location.origin}?convite=${result.token}`); toast.success("Convite gerado por 7 dias."); }, onError: error => toast.error(error.message) });
  const inviteTokenFromUrl = new URLSearchParams(location.split("?")[1] || "").get("convite");
  const collectiveInvitePreview = trpc.scene.previewCollectiveInvite.useQuery({ token: inviteTokenFromUrl ?? "" }, { enabled: Boolean(isAuthenticated && inviteTokenFromUrl), staleTime: 30_000 });
  const acceptCollectiveInviteMutation = trpc.scene.acceptCollectiveInvite.useMutation({ onSuccess: () => { setLocation("/perfil"); void myCollectives.refetch(); toast.success("Você entrou no coletivo."); }, onError: error => toast.error(error.message) });
  const updateModerationReportMutation = trpc.scene.updateModerationReport.useMutation({ onSuccess: () => { void moderationReports.refetch(); void utils.scene.discovery.invalidate(); toast.success("Decisão de moderação registrada."); }, onError: error => toast.error(error.message) });
  const hideReportedContentMutation = trpc.scene.hideReportedContent.useMutation({ onSuccess: result => { void moderationReports.refetch(); void utils.scene.discovery.invalidate(); toast.success(result.hidden ? "Conteúdo ocultado e denúncia resolvida." : "Não foi possível localizar o conteúdo."); }, onError: error => toast.error(error.message) });
  const discovery = trpc.scene.discovery.useQuery({ city: activeCity, genre: activeGenre, search: searchTerm }, { staleTime: 30_000 });
  const library = trpc.scene.library.useQuery(undefined, { enabled: isAuthenticated, staleTime: 15_000 });
  const managedEvents = trpc.scene.myEvents.useQuery(undefined, { enabled: isAuthenticated && (user?.accountType === "artist" || user?.role === "admin"), staleTime: 15_000 });
  const artistStats = trpc.scene.artistStats.useQuery(undefined, { enabled: isAuthenticated && (user?.accountType === "artist" || user?.role === "admin"), staleTime: 30_000 });
  const artistProfile = trpc.scene.myArtistProfile.useQuery(undefined, { enabled: isAuthenticated && (user?.accountType === "artist" || user?.role === "admin"), staleTime: 15_000 });
  const artistCatalog = trpc.scene.artistCatalog.useQuery(undefined, { enabled: isAuthenticated && (user?.accountType === "artist" || user?.role === "admin"), staleTime: 15_000 });
  useEffect(() => {
    try { window.localStorage.setItem("cena-city", activeCity); } catch { /* storage optional */ }
  }, [activeCity]);
  useEffect(() => {
    try {
      const { audio: _audio, cover: _cover, bookletPages: _bookletPages, ...textDraft } = uploadDraft;
      window.localStorage.setItem("cena-upload-draft-v2", JSON.stringify(textDraft));
    } catch { /* rascunho local é opcional */ }
  }, [uploadDraft]);
  useEffect(() => {
    if (!library.data) return;
    setFollowed(library.data.followedArtistIds ?? []);
    setInterested(library.data.interestedEventIds ?? []);
    setSavedTracks(library.data.savedTrackIds ?? []);
  }, [library.data]);
  useEffect(() => {
    if (!artistProfile.data) return;
    setArtistDraft({ name: artistProfile.data.name, handle: artistProfile.data.handle, city: artistProfile.data.city, profileType: artistProfile.data.profileType ?? "solo", genre: artistProfile.data.genre ?? "", bio: artistProfile.data.bio ?? "", manifesto: artistProfile.data.manifesto ?? "", instagramUrl: artistProfile.data.instagramUrl ?? "", bandcampUrl: artistProfile.data.bandcampUrl ?? "", supportUrl: artistProfile.data.supportUrl ?? "", pixUrl: artistProfile.data.pixUrl ?? "", merchUrl: artistProfile.data.merchUrl ?? "" });
  }, [artistProfile.data]);
  useEffect(() => {
    if (!user) return;
    setListenerDraft({ city: user.city ?? "Campinas", favoriteGenres: user.favoriteGenres ?? "", publicBio: user.publicBio ?? "" });
  }, [user]);
  const content = useMemo<typeof fallbackContent>(() => {
    if (discovery.error) return { ...fallbackContent, tracks: [], artists: [], events: [], playlists: [], activity: [], source: "unavailable" as const };
    if (!discovery.data) return { ...fallbackContent, tracks: [], artists: [], events: [], playlists: [], activity: [], source: "unavailable" as const };
    return {
      ...fallbackContent,
      ...discovery.data,
      source: discovery.data.source,
      tracks: discovery.data.tracks.map(track => ({
        ...track,
        genre: track.genre ?? "Cena local",
        audioUrl: selectAudioStreamUrl(track.audioUrl),
        creditsNote: track.creditsNote ?? undefined,
        bookletPages: parseBookletPages(track.bookletPages),
        externalUrl: track.externalUrl ?? undefined,
        embedUrl: track.embedUrl ?? (track.externalUrl ? parseExternalTrackUrl(track.externalUrl)?.embedUrl : null),
        cover: track.cover || sceneTracks[0].cover,
        accent: track.accent || "#c8f36a",
      })),
      artists: discovery.data.artists.map(artist => ({
        ...artist,
        genre: artist.genre || "Cena local",
        bio: artist.bio || "",
        manifesto: artist.manifesto ?? undefined,
        supportUrl: artist.supportUrl ?? undefined,
        pixUrl: artist.pixUrl ?? undefined,
        merchUrl: artist.merchUrl ?? undefined,
        image: artist.image || sceneArtists[0].image,
        accent: artist.accent || "#c8f36a",
        followers: artist.followers || "—",
      })),
      events: discovery.data.events.map(event => ({
        ...event,
        description: event.description || "Uma noite para ouvir a cidade de perto.",
        day: event.day || "—",
        month: event.month || "—",
        time: event.time || "—",
        color: event.color || "lime",
        interest: event.interest || 0,
        ticketUrl: event.ticketUrl ?? undefined,
        accessibility: event.accessibility ?? undefined,
        ageRating: event.ageRating ?? undefined,
        program: event.program ?? undefined,
        eventType: event.eventType ?? "show",
        admissionType: event.admissionType ?? "ticket",
        safeSpace: Boolean(event.safeSpace),
        canceledAt: undefined,
      })),
    };
  }, [discovery.data]);
  const artistProfileTracks = useMemo<SceneTrack[]>(() => (artistCatalog.data?.tracks ?? []).map(track => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    artistId: track.artistId,
    genre: track.genre ?? "Cena local",
    city: track.city,
    duration: track.duration ?? 0,
    cover: track.cover ?? sceneTracks[0].cover,
    bookletPages: parseBookletPages(track.bookletPages),
    accent: "#c8f36a",
    audioUrl: selectAudioStreamUrl(track.audioUrl),
    sourceType: track.sourceType ?? "upload",
    externalUrl: track.externalUrl ?? undefined,
    releaseType: track.releaseType ?? "single",
    creditsNote: track.creditsNote ?? undefined,
  })), [artistCatalog.data]);
  const playerTracks = useMemo(() => sharedTrack && !content.tracks.some(track => track.id === sharedTrack.id) ? [...content.tracks, sharedTrack] : content.tracks, [content.tracks, sharedTrack]);
  const currentTrack = playerTracks[currentTrackIndex] ?? playerTracks[0] ?? sceneTracks[0];
  const isArtist = user?.accountType === "artist" || user?.role === "admin";
  useEffect(() => {
    if (discovery.isFetching || discovery.error) return;
    setQueue(previous => {
      const available = new Set([...content.tracks.map(track => track.id), ...(sharedTrack ? [sharedTrack.id] : [])]);
      const next = previous.filter(trackId => available.has(trackId));
      if (next.length !== previous.length) toast.info(`A fila foi ajustada para a cena de ${activeCity}.`);
      return next;
    });
  }, [activeCity, content.tracks, discovery.isFetching, sharedTrack]);

  useEffect(() => {
    const routePath = location.split("?")[0] || "/";
    const nextView = viewFromPath(routePath);
    setView(nextView);
    if (!routePath.startsWith("/artistas/")) setSelectedArtist(null);
    if (nextView === "entityDetail") return;
    const titles: Record<string, string> = { "/": "CENA. — o som da sua cidade", "/buscar": "Buscar na cena — CENA.", "/eventos": "Eventos locais — CENA.", "/biblioteca": "Sua biblioteca — CENA.", "/perfil": "Seu perfil — CENA.", "/enviar": "Enviar som — CENA." };
    const title = titles[routePath] || "CENA. — o som da sua cidade";
    document.title = title;
    const description = "Descubra faixas, artistas e shows feitos por quem vive a cena local.";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = description;
["og:title", "twitter:title"].forEach(property => { let tag = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`) as HTMLMetaElement | null; if (!tag) { tag = document.createElement("meta"); tag.setAttribute(property.startsWith("og:") ? "property" : "name", property); document.head.appendChild(tag); } tag.content = title; });
    ["og:description", "twitter:description"].forEach(property => { let tag = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`) as HTMLMetaElement | null; if (!tag) { tag = document.createElement("meta"); tag.setAttribute(property.startsWith("og:") ? "property" : "name", property); document.head.appendChild(tag); } tag.content = description; });
  }, [location]);
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const match = location.match(/^\/artistas\/([^/]+)/);
    if (!match) return;
    const handle = decodeURIComponent(match[1]).toLowerCase();
    const artist = content.artists.find(item => item.handle.replace(/^@/, "").toLowerCase() === handle);
    if (artist) setSelectedArtist(artist);
  }, [location, content.artists]);

  useEffect(() => {
    if (selectedCollectiveId === null && myCollectives.data?.length) setSelectedCollectiveId(myCollectives.data[0].id);
  }, [selectedCollectiveId, myCollectives.data]);
  useEffect(() => { if (inviteTokenFromUrl && !isAuthenticated) setShowAuth(true); }, [inviteTokenFromUrl, isAuthenticated]);
  useEffect(() => {
    if (!isAuthenticated || !library.data) return;
    setFollowed(library.data.followedArtistIds);
    setInterested(library.data.interestedEventIds);
  }, [isAuthenticated, library.data]);

  useEffect(() => {
    let pendingRole: string | null = null;
    try { pendingRole = window.localStorage.getItem("cena-pending-role"); } catch { /* storage optional */ }
    if (isAuthenticated && (pendingRole === "listener" || pendingRole === "artist") && !accountTypeMutation.isPending) {
      accountTypeMutation.mutate({ accountType: pendingRole }, { onSuccess: () => { try { window.localStorage.removeItem("cena-pending-role"); } catch { /* storage optional */ } void utils.auth.me.invalidate(); }, onError: () => { try { window.localStorage.removeItem("cena-pending-role"); } catch { /* storage optional */ } } });
    }
  }, [isAuthenticated, accountTypeMutation, accountTypeMutation.isPending, utils]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || typeof window === "undefined") return;
    audio.crossOrigin = "anonymous";
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass();
      const source = context.createMediaElementSource(audio);
      const bass = context.createBiquadFilter(); bass.type = "lowshelf"; bass.frequency.value = 160;
      const mid = context.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 0.8;
      const treble = context.createBiquadFilter(); treble.type = "highshelf"; treble.frequency.value = 4000;
      source.connect(bass).connect(mid).connect(treble).connect(context.destination);
      audioContextRef.current = context; audioFiltersRef.current = { bass, mid, treble }; bass.gain.value = audioSettings.bass; mid.gain.value = audioSettings.mid; treble.gain.value = audioSettings.treble; setAudioSupported(true);
    } catch { setAudioSupported(false); }
    return () => { audioFiltersRef.current = null; audioContextRef.current?.close().catch(() => undefined); audioContextRef.current = null; };
  }, []);
  useEffect(() => {
    const filters = audioFiltersRef.current;
    if (!filters) return;
    filters.bass.gain.value = audioSettings.bass;
    filters.mid.gain.value = audioSettings.mid;
    filters.treble.gain.value = audioSettings.treble;
    try { window.localStorage.setItem("cena-audio-settings", JSON.stringify(audioSettings)); } catch { /* optional storage */ }
  }, [audioSettings]);
  useEffect(() => {
    try {
      window.localStorage.setItem("cena-player-state", JSON.stringify({ trackId: currentTrack.id, position: progress, currentTrackIndex, queue, recentTrackIds }));
    } catch {
      // Storage can be unavailable in private browsing; playback must continue.
    }
  }, [currentTrack.id, progress, currentTrackIndex, queue, recentTrackIds]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!hasPlaybackIntent) return;
    setDuration(0);
    setAudioError(null);
    setAudioLoading(Boolean(currentTrack.audioUrl));
    if (!currentTrack.audioUrl) {
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
      setAudioLoading(false);
      if (!currentTrack.embedUrl && !currentTrack.externalUrl) setAudioError("Esta faixa ainda não tem áudio publicado.");
      return;
    }
    audio.src = currentTrack.audioUrl;
    audio.load();
    if (isPlaying) audio.play().catch(() => { setIsPlaying(false); setAudioError("O navegador bloqueou a reprodução. Toque novamente para continuar."); });
  }, [currentTrack.id, currentTrack.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { void audioContextRef.current?.resume(); audio.play().catch(() => setIsPlaying(false)); }
    else audio.pause();
  }, [isPlaying]);

  const playTrack = (track: SceneTrack) => {
    track = { ...track, audioUrl: selectAudioStreamUrl(track.audioUrl) };
    setHasPlaybackIntent(true);
    const index = content.tracks.findIndex(item => item.id === track.id);
    if (index >= 0) {
      setSharedTrack(null);
      setCurrentTrackIndex(index);
    } else {
      setSharedTrack(track);
      setCurrentTrackIndex(content.tracks.length);
    }
    setProgress(0);
    setAudioError(null);
    if (!track.audioUrl && !track.embedUrl && !track.externalUrl) { setAudioError("Esta faixa ainda não tem áudio publicado."); setIsPlaying(false); toast.info("Essa faixa ainda está em processamento."); return; }
    setIsPlaying(true);
    setRecentTrackIds(previous => [track.id, ...previous.filter(id => id !== track.id)].slice(0, 20));
    playMutation.mutate({ trackId: track.id });
  };
  const retryPlayback = () => { if (!currentTrack.audioUrl) return; setAudioError(null); setAudioLoading(true); setIsPlaying(true); const audio = audioRef.current; if (audio) { audio.load(); void audio.play().catch(() => { setIsPlaying(false); setAudioLoading(false); setAudioError("Não foi possível retomar a reprodução."); }); } };
  const nextTrack = () => { if (!content.tracks.length) { setSharedTrack(null); setIsPlaying(false); setProgress(0); return; } setSharedTrack(null); setCurrentTrackIndex(index => (index + 1) % playerTracks.length); setProgress(0); setIsPlaying(true); };
  const previousTrack = () => { if (!content.tracks.length) { if (sharedTrack && audioRef.current) audioRef.current.currentTime = 0; setProgress(0); setIsPlaying(Boolean(sharedTrack)); return; } setSharedTrack(null); setCurrentTrackIndex(index => (index - 1 + playerTracks.length) % playerTracks.length); setProgress(0); setIsPlaying(true); };
  const onFollow = (artistId: number) => { if (!isAuthenticated) { setShowAuth(true); return; } const wasFollowing = followed.includes(artistId); setFollowed(value => wasFollowing ? value.filter(id => id !== artistId) : [...value, artistId]); followMutation.mutate({ artistId }, { onSuccess: () => { void utils.scene.library.invalidate(); }, onError: () => { setFollowed(value => wasFollowing ? [...value, artistId] : value.filter(id => id !== artistId)); toast.error("Não foi possível atualizar esse follow agora."); } }); };
  const onInterest = (eventId: number) => { if (!isAuthenticated) { setShowAuth(true); return; } const wasInterested = interested.includes(eventId); setInterested(value => wasInterested ? value.filter(id => id !== eventId) : [...value, eventId]); interestMutation.mutate({ eventId }, { onSuccess: () => { void utils.scene.library.invalidate(); }, onError: () => { setInterested(value => wasInterested ? [...value, eventId] : value.filter(id => id !== eventId)); toast.error("Não foi possível atualizar esse interesse agora."); } }); };
  const onSaveTrack = (trackId: number) => { if (!isAuthenticated) { setSavedTracks(value => value.includes(trackId) ? value.filter(id => id !== trackId) : [...value, trackId]); setShowAuth(true); return; } const wasSaved = savedTracks.includes(trackId); setSavedTracks(value => wasSaved ? value.filter(id => id !== trackId) : [...value, trackId]); if (content.source === "database") saveTrackMutation.mutate({ trackId }, { onSuccess: () => { void utils.scene.library.invalidate(); }, onError: () => { setSavedTracks(value => wasSaved ? [...value, trackId] : value.filter(id => id !== trackId)); toast.error("Não foi possível salvar essa faixa agora."); } }); else toast.success(wasSaved ? "Faixa removida das salvas." : "Faixa salva nesta sessão."); };
  const share = async (label: string, path?: string) => { const link = new URL(path || window.location.pathname, window.location.origin).toString(); try { if (navigator.share) await navigator.share({ title: `CENA. — ${label}`, url: link }); else await navigator.clipboard.writeText(link); toast.success(`${label} pronto para compartilhar.`); } catch { toast.success(`Link de ${label.toLowerCase()} copiado.`); } };
  const installApp = async () => { if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); return; } toast.info("No Chrome Android, abra ⋮ e escolha 'Adicionar à tela inicial' ou 'Instalar app'."); };
  const requestNotifications = async () => { if (!("Notification" in window)) { toast.info("Este navegador não oferece notificações web."); return; } const permission = await Notification.requestPermission(); toast.info(permission === "granted" ? "Avisos ativados neste dispositivo." : "Avisos não foram ativados."); };
  const chooseRole = (nextRole: "listener" | "artist") => { setRole(nextRole); if (!isAuthenticated) { try { window.localStorage.setItem("cena-pending-role", nextRole); } catch { /* storage optional */ } startLogin(); return; } accountTypeMutation.mutate({ accountType: nextRole }, { onSuccess: () => { void utils.auth.me.invalidate(); setShowAuth(false); toast.success(nextRole === "artist" ? "Perfil de artista ativado." : "Perfil de ouvinte ativado."); } }); };
  const submitArtistProfile = () => { if (!artistDraft.name.trim() || !artistDraft.handle.trim() || !artistDraft.city.trim()) return; artistProfileMutation.mutate({ ...artistDraft, genre: artistDraft.genre || undefined, bio: artistDraft.bio || undefined, manifesto: artistDraft.manifesto || undefined, supportUrl: artistDraft.supportUrl || undefined, pixUrl: artistDraft.pixUrl || undefined, merchUrl: artistDraft.merchUrl || undefined }, { onSuccess: result => { void utils.scene.myArtistProfile.invalidate(); toast.success(result.persisted ? "Perfil de artista criado." : "Perfil salvo para a demonstração."); } }); };
  const saveArtistProfile = () => { updateArtistProfileMutation.mutate({ ...artistDraft, genre: artistDraft.genre || undefined, bio: artistDraft.bio || undefined, manifesto: artistDraft.manifesto || undefined, instagramUrl: artistDraft.instagramUrl || undefined, bandcampUrl: artistDraft.bandcampUrl || undefined, supportUrl: artistDraft.supportUrl || undefined, pixUrl: artistDraft.pixUrl || undefined, merchUrl: artistDraft.merchUrl || undefined }, { onSuccess: () => { void artistProfile.refetch(); toast.success("Perfil atualizado."); }, onError: error => toast.error(error.message) }); };
  const saveListenerProfile = () => { listenerProfileMutation.mutate({ ...listenerDraft, favoriteGenres: listenerDraft.favoriteGenres || undefined, publicBio: listenerDraft.publicBio || undefined }, { onSuccess: () => { void utils.auth.me.invalidate(); toast.success("Perfil de público atualizado."); }, onError: error => toast.error(error.message) }); };
  const addTrackToPlaylist = (playlistId: number) => { if (!trackToAdd) return; addTrackMutation.mutate({ playlistId, trackId: trackToAdd }, { onSuccess: result => { setTrackToAdd(null); toast.success(result.added ? "Faixa adicionada à playlist." : "Essa faixa já está na playlist."); void utils.scene.library.invalidate(); }, onError: error => toast.error(error.message) }); };
  const removeFromQueue = (trackId: number) => setQueue(value => value.filter(id => id !== trackId));
  const onQueueTrack = (trackId: number) => { setQueue(value => value.includes(trackId) ? value : [...value, trackId]); toast.success("Faixa adicionada à fila."); };
  const openAddToPlaylist = (trackId: number) => { if (!isAuthenticated) { setShowAuth(true); return; } if (!library?.data?.playlists?.length) { goTo("library"); toast.info("Crie uma playlist antes de adicionar faixas."); return; } setTrackToAdd(trackId); };
  const createPlaylist = () => { if (!playlistName.trim()) return; if (!isAuthenticated) { setShowAuth(true); return; } playlistMutation.mutate({ name: playlistName.trim(), collaborative }, { onSuccess: result => { void utils.scene.library.invalidate(); setShowPlaylist(false); setPlaylistName(""); toast.success(result.persisted ? "Playlist criada na sua biblioteca." : "Playlist salva para a demonstração."); } }); };
  const createEvent = (draft: { name: string; venue: string; city: string; address?: string; latitude?: number; longitude?: number; eventDate: string; collectiveId?: number | null; eventType: NonNullable<SceneEvent["eventType"]>; admissionType: NonNullable<SceneEvent["admissionType"]>; description: string; program: string; accessibility: string; safeSpace: boolean; ageRating: string; ticketUrl?: string }) => { if (!isAuthenticated) { setShowAuth(true); return; } if (!artistProfile.data) { toast.error("Complete seu perfil de artista antes de criar um evento."); goTo("profile"); return; } eventMutation.mutate({ ...draft, address: draft.address || undefined, latitude: draft.latitude ?? undefined, longitude: draft.longitude ?? undefined, ticketUrl: draft.ticketUrl || undefined, program: draft.program || undefined, accessibility: draft.accessibility || undefined, ageRating: draft.ageRating || undefined, eventDate: localDateTimeToISOString(draft.eventDate) ?? draft.eventDate, collectiveId: draft.collectiveId || undefined }, { onSuccess: result => { void utils.scene.discovery.invalidate(); toast.success(result.persisted ? "Evento publicado na agenda." : "Evento pronto para a demonstração."); } }); };
  const removeTrack = (id: number) => { if (!window.confirm("Remover esta faixa da Cena? Ela ficará indisponível publicamente.")) return; takedownMutation.mutate({ trackId: id }, { onSuccess: () => { void utils.scene.discovery.invalidate(); void artistStats.refetch(); toast.success("Faixa removida da publicação."); }, onError: error => toast.error(error.message) }); };
  const deleteEvent = (id: number) => { if (!window.confirm("Excluir este evento da agenda?")) return; deleteEventMutation.mutate({ id }, { onSuccess: () => { void managedEvents.refetch(); void utils.scene.discovery.invalidate(); toast.success("Evento excluído."); }, onError: error => toast.error(error.message) }); };
  const updateEvent = (draft: { id: number; name: string; venue: string; city: string; address?: string | null; latitude?: number | null; longitude?: number | null; eventDate: string; eventType: NonNullable<SceneEvent["eventType"]>; admissionType: NonNullable<SceneEvent["admissionType"]>; description: string; program: string; accessibility: string; safeSpace: boolean; ageRating: string; ticketUrl?: string }) => { updateEventMutation.mutate({ ...draft, address: draft.address === null ? null : draft.address || undefined, latitude: draft.latitude === null ? null : draft.latitude ?? undefined, longitude: draft.longitude === null ? null : draft.longitude ?? undefined, ticketUrl: draft.ticketUrl || undefined, program: draft.program || undefined, accessibility: draft.accessibility || undefined, ageRating: draft.ageRating || undefined, eventDate: localDateTimeToISOString(draft.eventDate) ?? draft.eventDate }, { onSuccess: () => { void managedEvents.refetch(); void utils.scene.discovery.invalidate(); toast.success("Evento atualizado."); }, onError: error => toast.error(error.message) }); };
  const cancelEvent = (id: number) => { if (!window.confirm("Cancelar este evento e avisar quem marcou interesse?")) return; cancelEventMutation.mutate({ id }, { onSuccess: () => { void managedEvents.refetch(); void utils.scene.discovery.invalidate(); toast.success("Evento cancelado e interessados avisados."); }, onError: error => toast.error(error.message) }); };
  const reportArtist = (artistId: number) => { if (!isAuthenticated) { setShowAuth(true); return; } const reason = window.prompt("Por que você quer reportar este perfil?", "Conteúdo impróprio ou assédio"); if (!reason) return; reportMutation.mutate({ targetType: "artist", targetId: artistId, reason }, { onSuccess: () => toast.success("Recebemos o reporte. Vamos revisar com cuidado."), onError: error => toast.error(error.message) }); };
  const uploadFile = async (file: File, kind: "audio" | "image", slot = "primary") => {
    const maxAttempts = 3;
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const uploadKey = `${uploadIdRef.current ?? "pending"}-${kind}-${slot}`;
        const response = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          headers: { ...readSessionAuthHeaders(), "Content-Type": file.type || (kind === "audio" ? "audio/mpeg" : "image/jpeg"), "X-Cena-Kind": kind, "X-Cena-File-Name": encodeURIComponent(file.name), "X-Cena-Upload-Key": uploadKey },
          body: file,
        });
        const rawResponse = await response.text().catch(() => "");
        let result: { stableUrl?: string; error?: string } = {};
        try { result = JSON.parse(rawResponse) as { stableUrl?: string; error?: string }; } catch { /* resposta não-JSON do proxy */ }
        if (response.ok && result.stableUrl) return result.stableUrl;
        const fallbackMessage = response.status === 401
          ? "Sua sessão expirou. Entre novamente antes de enviar o arquivo."
          : response.status === 413
            ? `O arquivo excede o limite de ${kind === "audio" ? "50 MB" : "10 MB"}.`
            : response.status >= 500
              ? "O servidor não conseguiu gravar o arquivo agora. Tente novamente em instantes."
              : `Não foi possível enviar o arquivo (tentativa ${attempt} de ${maxAttempts}).`;
        lastError = new Error(result.error || fallbackMessage);
        if (response.status >= 400 && response.status < 500) break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Falha de rede durante o envio.");
      }
      if (attempt < maxAttempts) {
        setUploadStatus(`${kind === "audio" ? "Áudio" : "Capa"}: tentando novamente (${attempt + 1}/${maxAttempts})...`);
        await new Promise(resolve => window.setTimeout(resolve, 700 * attempt));
      }
    }
    throw lastError ?? new Error("Não foi possível enviar o arquivo.");
  };
  const uploadArtistAsset = async (file: File, field: "avatarUrl" | "coverUrl") => {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) { toast.error("A imagem deve ser JPG, PNG ou WebP de até 10 MB."); return; }
    setUploadStatus(field === "avatarUrl" ? "Enviando foto do projeto..." : "Enviando capa do perfil...");
    try {
      const url = await uploadFile(file, "image", field);
      const nextDraft = { ...artistDraft, [field]: url };
      setArtistDraft(nextDraft);
      await updateArtistProfileMutation.mutateAsync({ ...nextDraft, genre: nextDraft.genre || undefined, bio: nextDraft.bio || undefined, manifesto: nextDraft.manifesto || undefined, avatarUrl: nextDraft.avatarUrl || undefined, coverUrl: nextDraft.coverUrl || undefined, instagramUrl: nextDraft.instagramUrl || undefined, bandcampUrl: nextDraft.bandcampUrl || undefined, supportUrl: nextDraft.supportUrl || undefined, pixUrl: nextDraft.pixUrl || undefined, merchUrl: nextDraft.merchUrl || undefined });
      await artistProfile.refetch();
      toast.success(field === "avatarUrl" ? "Foto do projeto atualizada." : "Capa do perfil atualizada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a imagem."); }
    finally { setUploadStatus(""); }
  };
  const submitUpload = async () => {
    if (!isAuthenticated) { setShowAuth(true); return; }
    if (!isArtist) { setShowAuth(true); return; }
    if (!artistProfile.data) { toast.error("Complete seu perfil de artista antes de enviar uma faixa."); goTo("profile"); return; }
    const isExternal = uploadDraft.sourceType !== "upload";
    const externalSource = uploadDraft.externalUrl ? parseExternalTrackUrl(uploadDraft.externalUrl) : null;
    if (!isExternal && (!uploadDraft.audio || !uploadDraft.rights)) { toast.error("Escolha um áudio e confirme os direitos autorais."); return; }
    if (isExternal && (!externalSource || externalSource.sourceType !== uploadDraft.sourceType || !uploadDraft.rights)) { toast.error("Cole um link válido do provedor escolhido e confirme que você tem autorização para divulgar esta publicação."); return; }
    if (!isExternal && (!uploadDraft.audio!.type.startsWith("audio/") || uploadDraft.audio!.size > 50 * 1024 * 1024)) { toast.error("Use um áudio compatível de até 50 MB."); return; }
    if (uploadDraft.cover && (uploadDraft.cover.size > 10 * 1024 * 1024 || !uploadDraft.cover.type.startsWith("image/"))) { toast.error("A capa deve ser uma imagem de até 10 MB."); return; }
    setUploadStatus(isExternal ? "Validando link..." : "Preparando o envio...");
    const uploadedPaths: string[] = [];
    const idempotencyKey = uploadIdRef.current ?? globalThis.crypto.randomUUID();
    uploadIdRef.current = idempotencyKey;
    try {
      let audioUrl: string | undefined;
      if (!isExternal) {
        setUploadStatus("Enviando áudio...");
        audioUrl = await uploadFile(uploadDraft.audio!, "audio");
        uploadedPaths.push(audioUrl);
      }
      let coverUrl: string | undefined;
      if (uploadDraft.cover) { setUploadStatus("Enviando capa..."); coverUrl = await uploadFile(uploadDraft.cover, "image", "cover"); uploadedPaths.push(coverUrl); }
      const bookletPages: string[] = [];
      for (const [index, page] of uploadDraft.bookletPages.entries()) { const pageUrl = await uploadFile(page, "image", `booklet-${index}`); bookletPages.push(pageUrl); uploadedPaths.push(pageUrl); }
      let durationSeconds: number | undefined;
      if (!isExternal) {
        setUploadStatus("Lendo duração do áudio...");
        durationSeconds = await new Promise<number>(resolve => { const audio = new Audio(); const url = URL.createObjectURL(uploadDraft.audio!); audio.onloadedmetadata = () => { resolve(Math.round(audio.duration || 0)); URL.revokeObjectURL(url); }; audio.onerror = () => { resolve(0); URL.revokeObjectURL(url); }; audio.src = url; });
      }
      setUploadStatus("Publicando sua faixa...");
      const trackInput = { idempotencyKey, title: uploadDraft.title, album: uploadDraft.album || undefined, genre: uploadDraft.genre, city: uploadDraft.city, collectiveId: uploadDraft.collectiveId ?? undefined, description: uploadDraft.description || undefined, releaseType: uploadDraft.releaseType, releaseDate: uploadDraft.releaseDate ? new Date(uploadDraft.releaseDate).toISOString() : undefined, visibility: uploadDraft.visibility, sourceType: uploadDraft.sourceType, externalUrl: isExternal ? externalSource!.externalUrl : undefined, creditsNote: uploadDraft.creditsNote || undefined, audioUrl, coverUrl, bookletPages, durationSeconds, rightsDeclared: true as const };
      let publication: Awaited<ReturnType<typeof trackMutation.mutateAsync>>;
      try { publication = await trackMutation.mutateAsync(trackInput); } catch (firstError) { setUploadStatus("Confirmando a publicação (tentativa 2/2)..."); await new Promise(resolve => window.setTimeout(resolve, 800)); try { publication = await trackMutation.mutateAsync(trackInput); } catch { throw firstError; } }
      await utils.scene.discovery.invalidate();
      await artistCatalog.refetch();
      toast.success(publication.duplicate ? "Publicação confirmada. A faixa já estava na Cena." : "Faixa publicada. A cidade vai ouvir.");
      uploadIdRef.current = null;
      setUploadStatus("");
      try { window.localStorage.removeItem("cena-upload-draft-v2"); } catch { /* storage opcional */ }
      setUploadDraft(previous => ({ ...previous, title: "", sourceType: "spotify", externalUrl: "", album: "", genre: "Punk", city: activeCity, description: "", releaseType: "single", releaseDate: "", visibility: "public", creditsNote: "", rights: false, audio: null, cover: null, bookletPages: [], collectiveId: null }));
      setShowArtistStudio(false);
      setView("profile");
      setLocation("/perfil?publicado=1");
    } catch (error) { if (uploadedPaths.length) cleanupUploadMutation.mutate({ paths: uploadedPaths }); setUploadStatus(""); toast.error(error instanceof Error ? error.message : "Não foi possível concluir a publicação."); }
  };

  const suggestTrackMetadata = () => {
    if (!uploadDraft.audio) { toast.error("Escolha um áudio antes de gerar a sugestão."); return; }
    suggestTrackMetadataMutation.mutate({ title: uploadDraft.title || uploadDraft.audio.name, album: uploadDraft.album || undefined, genre: uploadDraft.genre, city: uploadDraft.city, description: uploadDraft.description || undefined, releaseType: uploadDraft.releaseType, creditsNote: uploadDraft.creditsNote || undefined, audioName: uploadDraft.audio.name, artistName: artistProfile.data?.name, artistBio: artistProfile.data?.bio ?? undefined, artistGenre: artistProfile.data?.genre ?? undefined, profileType: artistProfile.data?.profileType ?? undefined });
  };
  const navItems: Array<{ id: View; label: string; icon: typeof HomeIcon }> = [{ id: "home", label: "Início", icon: HomeIcon }, { id: "search", label: "Buscar", icon: Search }, { id: "events", label: "Eventos", icon: CalendarDays }, { id: "library", label: "Biblioteca", icon: ListMusic }, { id: "profile", label: "Perfil", icon: UserRound }];
  const goTo = (nextView: View) => { setView(nextView); setLocation(pathFromView(nextView)); setSelectedArtist(null); setShowMenu(false); };
  const openArtist = (artist: SceneArtist) => { setSelectedArtist(null); setView("entityDetail"); setLocation(`/artistas/${encodeURIComponent(artist.handle.replace(/^@/, ""))}`); setShowMenu(false); };

  return <div className="scene-app"><a className="skip-link" href="#main-content">Pular para o conteúdo</a><audio ref={audioRef} crossOrigin="anonymous" preload="metadata" onLoadStart={() => setAudioLoading(true)} onCanPlay={() => { setAudioLoading(false); setAudioError(null); }} onError={() => { setIsPlaying(false); setAudioLoading(false); setAudioError("Não foi possível tocar esta faixa agora."); }} onTimeUpdate={event => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={event => { const nextDuration = event.currentTarget.duration || 0; setDuration(nextDuration); setAudioLoading(false); setAudioError(null); const stored = readStoredPlayerState(); if (stored.trackId === currentTrack.id && stored.position > 0 && stored.position < nextDuration) { event.currentTarget.currentTime = stored.position; setProgress(stored.position); } }} onEnded={nextTrack} /><aside className="side-rail"><button className="brand-lockup" onClick={() => goTo("home")}><span className="brand-mark"><Radio size={15} strokeWidth={3} /></span><span>CENA<span className="brand-dot">.</span></span></button><div className="rail-label">Sua cena</div><nav className="rail-nav">{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-item ${view === item.id && !selectedArtist ? "active" : ""}`} onClick={() => goTo(item.id)}><Icon size={18} /><span>{item.label}</span>{item.id === "events" && <span className="nav-badge">{content.events.length}</span>}</button>; })}</nav><div className="rail-divider" /><div className="rail-label">Atalhos</div><button className="nav-item" onClick={() => goTo("upload")}><UploadCloud size={18} /><span>Enviar som</span><span className="shortcut-plus">+</span></button><button className="nav-item" onClick={() => setShowPlaylist(true)}><Plus size={18} /><span>Nova playlist</span></button><div className="side-note"><span className="note-orb"><Sparkles size={15} /></span><p><strong>Sem anúncios.</strong><br />Só música feita perto de você.</p></div><button className="account-pill" onClick={() => isAuthenticated ? handleLogout() : setShowAuth(true)}><span className="avatar small">{isAuthenticated ? initials(user?.name || "Você") : "?"}</span><span className="account-copy"><strong>{isAuthenticated ? user?.name || "Sua conta" : "Entrar na Cena"}</strong><small>{isAuthenticated ? "Sair da conta" : "ou criar acesso"}</small></span>{isAuthenticated ? <LogOut size={16} /> : <LogIn size={16} />}</button></aside><main id="main-content" className="main-column"><header className="top-bar"><button className="mobile-brand brand-lockup" onClick={() => goTo("home")}><span className="brand-mark"><Radio size={14} strokeWidth={3} /></span><span>CENA<span className="brand-dot">.</span></span></button><div className="location-switch"><MapPin size={15} /><span>{displayCity(activeCity)}</span><ChevronRight size={14} /></div><span className={`data-mode ${content.source === "seed" ? "is-demo" : content.source === "database" ? "is-live" : content.source === "empty" ? "is-empty" : "is-unavailable"}`}>{content.source === "seed" ? "modo demonstração" : content.source === "empty" ? "cidade sem catálogo" : content.source === "unavailable" ? "dados indisponíveis" : "cena ao vivo"}</span><div className="top-actions">{!isAuthenticated && <div className="auth-entry-actions"><button className="top-auth-button" onClick={() => { setAuthIntent("login"); setShowAuth(true); }}>Entrar</button><button className="top-auth-button primary" onClick={() => { setAuthIntent("create"); setShowAuth(true); }}>Criar perfil</button></div>}<button className="icon-button notification-button" aria-label="Abrir notificações" aria-expanded={showNotifications} onClick={() => { setShowNotifications(value => !value); if (isAuthenticated) markNotificationsReadMutation.mutate(); }}><Bell size={18} />{Boolean(notifications.data?.some(item => !item.readAt)) && <span />}</button><button className="profile-trigger" onClick={() => isAuthenticated ? goTo("profile") : setShowAuth(true)}><span className="avatar">{isAuthenticated ? initials(user?.name || "Você") : "?"}</span><span className="profile-trigger-name">{isAuthenticated ? user?.name?.split(" ")[0] || "Você" : "Você"}</span></button><button className="icon-button mobile-menu" onClick={() => setShowMenu(value => !value)} aria-label="Abrir menu"><Menu size={19} /></button></div></header>{showNotifications && <div className="notification-panel" role="dialog" aria-label="Notificações"><div className="notification-panel-head"><strong>Sua cena</strong><button className="icon-button quiet" aria-label="Fechar notificações" onClick={() => setShowNotifications(false)}><X size={15} /></button></div>{!isAuthenticated ? <p className="notification-empty">Entre para receber avisos de lançamentos e shows.</p> : notifications.data?.length ? notifications.data.map(item => <a className={`notification-item ${item.readAt ? "is-read" : ""}`} key={item.id} href={item.href || "#"} onClick={() => setShowNotifications(false)}><span className="notification-kind"><Bell size={13} /></span><span><strong>{item.title}</strong><small>{item.body}</small></span></a>) : <p className="notification-empty">Você está em dia com a sua cena.</p>}<button className="install-hint" onClick={installApp}>Instalar como app</button></div>}{showMenu && <div className="mobile-menu-panel">{!isAuthenticated && <><button onClick={() => { setAuthIntent("login"); setShowAuth(true); setShowMenu(false); }}>Entrar</button><button onClick={() => { setAuthIntent("create"); setShowAuth(true); setShowMenu(false); }}>Criar perfil</button></>}{navItems.map(item => <button key={item.id} onClick={() => goTo(item.id)}>{item.label}</button>)}<button onClick={() => goTo("upload")}>Enviar som</button>{isAuthenticated && <button className="mobile-logout-button" onClick={handleLogout}><LogOut size={15} /> Sair</button>}<button onClick={installApp}>Instalar CENA.</button></div>}<div className="content-wrap">{sessionError && <div className="empty-card city-empty-card session-error-notice" role="alert"><MapPin size={22} /><strong>Não foi possível verificar sua sessão.</strong><span>Uma falha de conexão não confirma que você está desconectado. Tente verificar novamente.</span><button className="text-button empty-action" type="button" onClick={() => void refreshSession()}>Tentar novamente <ChevronRight size={14} /></button></div>}{(view === "home" || view === "search" || view === "events") && discovery.isLoading && <div className="empty-card city-empty-card" role="status"><CirclePlay size={22} /><strong>Carregando a cena de {activeCity}…</strong><span>Buscando faixas, artistas e eventos publicados.</span></div>}{(view === "home" || view === "search" || view === "events") && discovery.error && <div className="empty-card city-empty-card" role="alert"><MapPin size={22} /><strong>Não foi possível carregar a descoberta.</strong><span>A agenda e o catálogo não puderam ser consultados; isso não significa que sua cidade esteja vazia.</span><button className="text-button empty-action" type="button" onClick={() => void discovery.refetch()}>Tentar novamente <ChevronRight size={14} /></button></div>}{isAuthenticated && collectiveInvitePreview.data && inviteTokenFromUrl && <InviteConfirmation preview={collectiveInvitePreview.data} isSaving={acceptCollectiveInviteMutation.isPending} onAccept={() => acceptCollectiveInviteMutation.mutate({ token: inviteTokenFromUrl })} onClose={() => setLocation("/")} />}{view === "entityDetail" && !selectedArtist && <EntityDetailView path={location} content={content} interested={interested} savedTracks={savedTracks} onPlay={playTrack} onInterest={onInterest} onSaveTrack={onSaveTrack} onShare={share} onAddToPlaylist={openAddToPlaylist} onQueueTrack={onQueueTrack} onOpenArtist={openArtist} renderArtistProfile={(artist, tracks, events) => <ArtistProfile artist={artist} content={{ ...content, tracks, events }} followed={followed.includes(artist.id)} onFollow={() => onFollow(artist.id)} onPlay={playTrack} onShare={share} onReport={() => reportArtist(artist.id)} />} />}{view === "entityDetail" && selectedArtist && <><div className="demo-content-notice" role="note">{content.source === "seed" ? "Conteúdo de demonstração. Não representa publicação ou atividade real na CENA." : ""}</div><ArtistProfile artist={selectedArtist} content={content} followed={followed.includes(selectedArtist.id)} onFollow={() => onFollow(selectedArtist.id)} onPlay={playTrack} onShare={share} onReport={() => reportArtist(selectedArtist.id)} /></>}{view === "home" && !selectedArtist && !discovery.isLoading && !discovery.error && <HomeView content={content} activeGenre={activeGenre} setActiveGenre={setActiveGenre} activeCity={activeCity} setActiveCity={setActiveCity} setView={goTo} onPlay={playTrack} onOpenArtist={openArtist} followed={followed} onFollow={onFollow} interested={interested} onInterest={onInterest} onShare={share} savedTracks={savedTracks} onSaveTrack={onSaveTrack} onAddToPlaylist={openAddToPlaylist} onQueueTrack={onQueueTrack} personalization={{ city: user?.city, favoriteGenres: user?.favoriteGenres, recentTrackIds, interestedEventIds: interested, eventArtistIds: [], isAuthenticated }} />}{view === "search" && !selectedArtist && !discovery.isLoading && !discovery.error && <SearchView content={content} activeCity={activeCity} setActiveCity={setActiveCity} searchTerm={searchTerm} setSearchTerm={setSearchTerm} activeGenre={activeGenre} setActiveGenre={setActiveGenre} onPlay={playTrack} onOpenArtist={openArtist} followed={followed} onFollow={onFollow} interested={interested} onInterest={onInterest} onShare={share} savedTracks={savedTracks} onSaveTrack={onSaveTrack} onAddToPlaylist={openAddToPlaylist} onQueueTrack={onQueueTrack} />}{view === "events" && !selectedArtist && !discovery.isLoading && !discovery.error && <EventsView content={content} interested={interested} onInterest={onInterest} onShare={share} onCreateEvent={createEvent} isArtist={Boolean(isArtist && artistProfile.data)} managedEvents={managedEvents.data ?? undefined} onCancelEvent={cancelEvent} onUpdateEvent={updateEvent} collectives={(myCollectives.data ?? [])} />}{view === "library" && !selectedArtist && <LibraryView content={content} followed={followed} onPlay={playTrack} onOpenArtist={openArtist} onCreatePlaylist={() => setShowPlaylist(true)} isAuthenticated={isAuthenticated} library={library.data} recentTrackIds={recentTrackIds} savedTracks={savedTracks} onSaveTrack={onSaveTrack} onOpenPlaylist={id => { setView("entityDetail"); setSelectedArtist(null); setLocation(`/playlists/${id}`); setShowMenu(false); }} onShare={share} />}{view === "profile" && (selectedArtist ? <ArtistProfile artist={selectedArtist} content={content} followed={followed.includes(selectedArtist.id)} onFollow={() => onFollow(selectedArtist.id)} onPlay={playTrack} onShare={share} onReport={() => reportArtist(selectedArtist.id)} /> : <div className="page account-page"><div className="page-intro"><span className="eyebrow">seu perfil</span><h1>{isAuthenticated ? `Olá, ${user?.name?.split(" ")[0] || "ouvinte"}.` : "Encontre o seu lugar na cena."}</h1><p>{isAuthenticated ? "Escolha como você participa e mantenha sua biblioteca perto." : "Entre para seguir artistas, guardar playlists e receber os shows que combinam com você."}</p></div>{isAuthenticated && <AccountProfileView user={user} isArtist={isArtist} artistProfile={artistProfile.data} artistStats={artistStats.data} artistCatalog={{ tracks: artistProfileTracks, events: artistCatalog.data?.events ?? [] }} library={library.data} onEdit={() => { if (isArtist) setShowArtistStudio(true); else document.querySelector(".listener-profile-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} onUpload={() => goTo("upload")} onPlay={playTrack} onShare={() => share(`Perfil de ${isArtist && artistProfile.data ? artistProfile.data.name : user?.name || "usuário"}`, "/perfil")} />}{isAuthenticated && <button className="secondary-button account-logout-button" type="button" onClick={handleLogout}><LogOut size={16} /> Sair da conta</button>}{isAuthenticated && <AlertPreferences />}<PendingCollectiveInvites invites={(pendingCollectiveInvites.data ?? []) as Array<{ id: number; collectiveName: string; collectiveHandle: string; inviterName: string | null; permission: string; expiresAt: Date | string }>} isLoading={pendingCollectiveInvites.isLoading} onAccept={id => acceptPendingInviteMutation.mutate({ inviteId: id })} onDecline={id => declinePendingInviteMutation.mutate({ inviteId: id })} isSaving={acceptPendingInviteMutation.isPending || declinePendingInviteMutation.isPending} /><div className="role-panel"><div><span className="eyebrow">tipo de acesso</span><h2>Como você chega?</h2><p>Você pode mudar de papel depois, sem perder nada.</p></div><div className="role-options"><button className={user?.accountType === "listener" ? "selected" : ""} onClick={() => chooseRole("listener")}><Headphones size={22} /><strong>Ouvinte</strong><span>Descobrir, seguir e montar playlists.</span>{user?.accountType === "listener" && <Check size={16} />}</button><button className={user?.accountType === "artist" ? "selected" : ""} onClick={() => chooseRole("artist")}><Disc3 size={22} /><strong>Artista / banda</strong><span>Publicar faixas e colocar shows na agenda.</span>{user?.accountType === "artist" && <Check size={16} />}</button></div>{!isAuthenticated && <button className="primary-button" onClick={() => setShowAuth(true)}><LogIn size={16} /> Entrar com Manus</button>}</div></div>)}{isAuthenticated && user?.role === "admin" && <AdminNotificationComposer onSubmit={input => customNotificationMutation.mutate(input)} isSending={customNotificationMutation.isPending} />}{isAuthenticated && user?.role === "admin" && user?.adminRole !== "agenda" && <><ModerationQueue reports={(moderationReports.data ?? []) as ModerationReportItem[]} isLoading={moderationReports.isLoading} onResolve={(id, status) => updateModerationReportMutation.mutate({ id, status })} onHide={id => hideReportedContentMutation.mutate({ reportId: id })} isUpdating={updateModerationReportMutation.isPending || hideReportedContentMutation.isPending} /><AuditHistory logs={(auditLogs.data ?? []) as AuditLogItem[]} isLoading={auditLogs.isLoading} /></>}{view === "profile" && !selectedArtist && isAuthenticated && user?.accountType === "listener" && <ListenerProfileView draft={listenerDraft} setDraft={setListenerDraft} onSubmit={saveListenerProfile} isSaving={listenerProfileMutation.isPending} />}{view === "profile" && !selectedArtist && isAuthenticated && isArtist && !artistProfile.data && <ArtistSetupView draft={artistDraft} setDraft={setArtistDraft} onSubmit={submitArtistProfile} isSaving={artistProfileMutation.isPending} />}{view === "profile" && !selectedArtist && isAuthenticated && isArtist && artistProfile.data && <><button className="primary-button" type="button" onClick={() => setShowArtistStudio(value => !value)}>{showArtistStudio ? "Fechar estúdio" : "Abrir estúdio do artista"}</button>{showArtistStudio && <><ArtistStudioView profile={artistProfile.data} stats={artistStats.data} draft={artistDraft} setDraft={setArtistDraft} onSave={saveArtistProfile} onRemoveTrack={removeTrack} onUpload={() => goTo("upload")} onUploadAsset={uploadArtistAsset} isSaving={updateArtistProfileMutation.isPending} /><ArtistCommercePanel events={managedEvents.data ?? []} /></>}</>}{view === "profile" && !selectedArtist && isAuthenticated && isArtist && <CollectiveStudio collectives={(myCollectives.data ?? []).filter(collective => collective.permission === "owner")} selectedId={selectedCollectiveId} onSelect={setSelectedCollectiveId} members={(collectiveMembers.data ?? []) as Array<{ artistId: number; name: string; handle: string; permission: string; memberRole: string | null }>} isLoading={collectiveMembers.isLoading} onUpdate={(artistId, permission) => selectedCollectiveId && updateCollectiveMemberMutation.mutate({ collectiveId: selectedCollectiveId, artistId, permission })} onRemove={artistId => selectedCollectiveId && removeCollectiveMemberMutation.mutate({ collectiveId: selectedCollectiveId, artistId })} onInvite={(permission, email) => selectedCollectiveId && createCollectiveInviteMutation.mutate({ collectiveId: selectedCollectiveId, permission, email })} inviteLink={inviteLink} isSaving={updateCollectiveMemberMutation.isPending || removeCollectiveMemberMutation.isPending || createCollectiveInviteMutation.isPending} />}{view === "upload" && <UploadView draft={uploadDraft} setDraft={setUploadDraft} onSubmit={submitUpload} isArtist={Boolean(isArtist && artistProfile.data)} uploadStatus={uploadStatus} onOpenProfile={() => { if (!isAuthenticated) setShowAuth(true); else { chooseRole("artist"); goTo("profile"); } }} onRequestNotifications={requestNotifications} onSuggest={suggestTrackMetadata} isSuggesting={suggestTrackMetadataMutation.isPending} suggestion={trackSuggestion} collectives={(myCollectives.data ?? []).filter(collective => collective.permission === "owner" || collective.permission === "editor")} onApplyArtistBio={bio => setArtistDraft(previous => ({ ...previous, bio }))} />}</div></main>{hasPlaybackIntent && <Player track={currentTrack} isPlaying={isPlaying} onToggle={() => setIsPlaying(value => !value)} onNext={nextTrack} onPrevious={previousTrack} progress={progress} duration={duration} queueCount={queue.length} onQueueOpen={() => setShowQueue(true)} audioSettings={audioSettings} audioSupported={audioSupported} audioLoading={audioLoading} audioError={audioError} onRetry={retryPlayback} onPreset={preset => { const next = audioPresets.find(item => item.id === preset); if (next) setAudioSettings({ preset: next.id, bass: next.bass, mid: next.mid, treble: next.treble }); }} onBandChange={(band, value) => setAudioSettings(previous => ({ ...previous, preset: "flat", [band]: value }))} onSeek={value => { setProgress(value); if (audioRef.current) audioRef.current.currentTime = value; }} />}<nav className="bottom-nav">{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={view === item.id && !selectedArtist ? "active" : ""} onClick={() => goTo(item.id)}><Icon size={18} /><span>{item.label}</span></button>; })}</nav>{showQueue && <div className="modal-backdrop" onClick={() => setShowQueue(false)}><div className="small-modal" onClick={event => event.stopPropagation()}><button type="button" aria-label="Fechar" className="modal-close" onClick={() => setShowQueue(false)}><X size={18} /></button><span className="eyebrow">player</span><h2>Fila de reprodução.</h2>{queue.length ? <div className="playlist-picker">{queue.map(id => { const track = content.tracks.find(item => item.id === id); return track ? <div className="playlist-picker-item" key={id}><ListMusic size={18} /><span>{track.title}</span><button className="icon-button quiet" onClick={() => removeFromQueue(id)} aria-label={`Remover ${track.title} da fila`}><X size={15} /></button></div> : null; })}</div> : <EmptyState title="Sua fila está vazia." message="Use o ícone de fila em uma faixa para decidir o que vem depois." />}</div></div>}{showAuth && <div className="modal-backdrop" onClick={() => setShowAuth(false)}><div className="auth-modal" onClick={event => event.stopPropagation()}><button type="button" aria-label="Fechar" className="modal-close" onClick={() => setShowAuth(false)}><X size={18} /></button><span className="eyebrow lime">{authIntent === "create" ? "criar presença" : "entrar na cena"}</span><h2>{authIntent === "create" ? "Crie seu lugar na cena." : "Chegue do seu jeito."}</h2><p>{authIntent === "create" ? "Comece como ouvinte ou crie uma presença para publicar e distribuir cultura independente." : "Entre para ouvir, seguir artistas e acompanhar a agenda da sua região."}</p><div className="role-options modal-roles"><button className={role === "listener" ? "selected" : ""} onClick={() => chooseRole("listener")}><Headphones size={21} /><strong>Ouvinte</strong><span>Quero descobrir sons perto de mim.</span></button><button className={role === "artist" ? "selected" : ""} onClick={() => chooseRole("artist")}><Disc3 size={21} /><strong>Artista / banda</strong><span>Quero publicar meu trabalho.</span></button></div><div className="auth-role-note"><strong>Quem cria e distribui conteúdo?</strong><span>Artista, banda, MC, produtor, coletivo, selo, venue ou projeto cultural. Depois do acesso, você escolhe o formato do perfil.</span></div><button className="primary-button full-button" onClick={() => chooseRole(role)}><LogIn size={16} /> {authIntent === "create" ? "Criar acesso com Manus" : "Entrar com Manus"}</button></div></div>}{showPlaylist && <div className="modal-backdrop" onClick={() => setShowPlaylist(false)}><form className="small-modal" onSubmit={event => { event.preventDefault(); createPlaylist(); }} onClick={event => event.stopPropagation()}><button type="button" aria-label="Fechar" className="modal-close" onClick={() => setShowPlaylist(false)}><X size={18} /></button><span className="eyebrow">nova playlist</span><h2>Faça sua própria rota.</h2><input autoFocus required value={playlistName} onChange={event => setPlaylistName(event.target.value)} placeholder="Nome da playlist" /><label className="switch-line"><input type="checkbox" checked={collaborative} onChange={event => setCollaborative(event.target.checked)} /><span><strong>Playlist colaborativa</strong><small>Outras pessoas podem adicionar faixas.</small></span></label><button className="primary-button full-button" type="submit"><Plus size={16} /> Criar playlist</button></form></div>}{trackToAdd !== null && <div className="modal-backdrop" onClick={() => setTrackToAdd(null)}><div className="small-modal" onClick={event => event.stopPropagation()}><button type="button" aria-label="Fechar" className="modal-close" onClick={() => setTrackToAdd(null)}><X size={18} /></button><span className="eyebrow">adicionar faixa</span><h2>Escolha uma playlist.</h2>{library?.data?.playlists?.length ? <div className="playlist-picker">{library.data.playlists.map(playlist => <button key={playlist.id} className="playlist-picker-item" onClick={() => addTrackToPlaylist(playlist.id)}><ListMusic size={18} /><span>{playlist.name}</span><small>{playlist.trackIds.length} faixas</small></button>)}</div> : <EmptyState title="Você ainda não criou playlists." message="Crie uma playlist na Biblioteca para guardar esta faixa." />}</div></div>}</div>;
}
