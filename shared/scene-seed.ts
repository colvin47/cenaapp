export type SceneTrack = {
  id: number;
  title: string;
  artist: string;
  artistId: number;
  genre: string;
  city: string;
  duration: number;
  cover: string;
  bookletPages?: string[];
  accent: string;
  audioUrl?: string;
  sourceType?: "upload" | "spotify" | "youtube" | "bandcamp" | "soundcloud";
  externalUrl?: string;
  embedUrl?: string | null;
  releaseType?: "single" | "album" | "demo" | "live" | "split" | "compilation";
  creditsNote?: string;
};

export type SceneArtist = {
  id: number;
  name: string;
  handle: string;
  profileType?: "solo" | "band" | "mc" | "producer" | "dj" | "collective" | "label" | "venue";
  genre: string;
  bio: string;
  manifesto?: string;
  city: string;
  image: string;
  accent: string;
  followers: string;
  instagramUrl?: string;
  bandcampUrl?: string;
  supportUrl?: string;
  pixUrl?: string;
  merchUrl?: string;
};

export type SceneEvent = {
  id: number;
  day: string;
  month: string;
  title: string;
  place: string;
  city: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  time: string;
  description: string;
  color: "lime" | "coral" | "lavender";
  interest: number;
  artistId: number;
  isoDate?: string;
  ticketUrl?: string;
  eventType?: "show" | "battle" | "cypher" | "cultural_round" | "diy_festival" | "occupation" | "zine_fair" | "workshop" | "listening_party" | "release";
  admissionType?: "ticket" | "free" | "contribution";
  accessibility?: string;
  safeSpace?: boolean;
  ageRating?: string;
  program?: string;
};

const covers = {
  green: "/assets/cover-abstract.jpg",
  coral: "/assets/cover-splatter.jpg",
  violet: "/assets/live-crowd.jpg",
  amber: "/assets/vertical-crowd.jpg",
};

const audio = {
  one: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  two: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  three: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  four: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
};

export const sceneTracks: SceneTrack[] = [
  { id: 1, title: "Concreto Não Dorme", artist: "Linha de Frente", artistId: 1, genre: "Hardcore", city: "Campinas", duration: 373, cover: covers.coral, accent: "#ff765f", audioUrl: audio.one, releaseType: "single", creditsNote: "Voz e letra: Nega Jô · Produção: Porão 404 · Arte: Muro Sul" },
  { id: 2, title: "Demo da Ponte", artist: "Ruído Móvel", artistId: 2, genre: "Punk", city: "Campinas", duration: 426, cover: covers.green, accent: "#c8f36a", audioUrl: audio.two, releaseType: "demo", creditsNote: "Gravado ao vivo no ensaio · Mix: Estúdio Gambiarra" },
  { id: 3, title: "Marginalia", artist: "Beco 13", artistId: 3, genre: "Rap", city: "Campinas", duration: 344, cover: covers.violet, accent: "#a69aff", audioUrl: audio.three, releaseType: "single", creditsNote: "Beat: DJ Cinza · Mix e master: Lado B" },
  { id: 4, title: "Sem Grade", artist: "DallagBeats", artistId: 4, genre: "Beatmaker", city: "Campinas", duration: 303, cover: covers.amber, accent: "#f0bd74", audioUrl: audio.four, releaseType: "live", creditsNote: "Instrumental ao vivo · MPC: DallagBeats" },
  { id: 5, title: "Dois Lados do Muro", artist: "Linha de Frente", artistId: 1, genre: "Post-hardcore", city: "Campinas", duration: 373, cover: covers.coral, accent: "#ff765f", audioUrl: audio.one, releaseType: "split", creditsNote: "Split com Ruído Móvel · Selo: Trinca Discos" },
  { id: 6, title: "Campinas em Chamas", artist: "Coletivo Subsolo", artistId: 5, genre: "Compilação", city: "Campinas", duration: 426, cover: covers.green, accent: "#c8f36a", audioUrl: audio.two, releaseType: "compilation", creditsNote: "Linha de Frente · Beco 13 · Ruído Móvel · DallagBeats" },
  { id: 7, title: "Fora do Eixo", artist: "Beco 13", artistId: 3, genre: "Grime", city: "Campinas", duration: 344, cover: covers.violet, accent: "#a69aff", audioUrl: audio.three, releaseType: "single", creditsNote: "Voz: Kadu · Beat: DJ Cinza · Participação: Lua Nova" },
  { id: 8, title: "Cypher do Terminal", artist: "Lua Nova", artistId: 6, genre: "Hip hop", city: "Campinas", duration: 303, cover: covers.amber, accent: "#f0bd74", audioUrl: audio.four, releaseType: "live", creditsNote: "Registro da Batalha do Terminal · Captação: NINHO Audio" },
];

export const sceneArtists: SceneArtist[] = [
  { id: 1, name: "Linha de Frente", handle: "@linhadefrente", profileType: "band", genre: "Hardcore / punk", city: "Campinas, SP", bio: "Hardcore de bairro, letras de confronto e refrões para cantar em roda.", manifesto: "A rua é palco, a banda é coletiva e ninguém fica para trás.", image: covers.coral, accent: "#ff765f", followers: "684", instagramUrl: "https://instagram.com", bandcampUrl: "https://bandcamp.com", supportUrl: "https://apoia.se", pixUrl: "linhadefrente@pix.exemplo", merchUrl: "https://example.com/merch" },
  { id: 2, name: "Ruído Móvel", handle: "@ruidomovel", profileType: "band", genre: "Punk / post-hardcore", city: "Campinas, SP", bio: "Três acordes, amplificador emprestado e uma cidade inteira para atravessar.", manifesto: "DIY, turnê de van e som alto até a última tomada.", image: covers.green, accent: "#c8f36a", followers: "512", instagramUrl: "https://instagram.com", supportUrl: "https://apoia.se" },
  { id: 3, name: "Beco 13", handle: "@beco13", profileType: "mc", genre: "Rap / grime", city: "Campinas, SP", bio: "Rima de esquina, grave pesado e histórias que não cabem no feed.", manifesto: "Microfone aberto, beat compartilhado e memória de território.", image: covers.violet, accent: "#a69aff", followers: "1,1 mil", instagramUrl: "https://instagram.com", bandcampUrl: "https://bandcamp.com", pixUrl: "beco13@pix.exemplo" },
  { id: 4, name: "DallagBeats", handle: "@dallagbeats", profileType: "producer", genre: "Beatmaker / DJ", city: "Campinas, SP", bio: "Beats para cypher, pista e qualquer caixa que aguente o grave.", manifesto: "Produzir é abrir espaço para outras vozes chegarem.", image: covers.amber, accent: "#f0bd74", followers: "376", bandcampUrl: "https://bandcamp.com", merchUrl: "https://example.com/merch" },
  { id: 5, name: "Coletivo Subsolo", handle: "@coletivosubsolo", profileType: "collective", genre: "Coletivo / selo", city: "Campinas, SP", bio: "Selo, palco e rede de apoio para quem faz música independente no interior.", manifesto: "Circular, compartilhar equipamento, dividir o palco e documentar a cena.", image: covers.green, accent: "#c8f36a", followers: "2,3 mil", supportUrl: "https://apoia.se", pixUrl: "subsolo@pix.exemplo" },
  { id: 6, name: "Lua Nova", handle: "@luanovamc", profileType: "mc", genre: "Hip hop / freestyle", city: "Campinas, SP", bio: "MC e articuladora de batalhas, oficinas e rodas culturais.", manifesto: "Batalha também é cuidado, formação e ocupação do território.", image: covers.amber, accent: "#f0bd74", followers: "847", instagramUrl: "https://instagram.com", supportUrl: "https://apoia.se" },
];

export const sceneEvents: SceneEvent[] = [
  { id: 1, day: "08", month: "NOV", title: "Batalha do Terminal", place: "Praça do Terminal", city: "Campinas", time: "18:00", description: "Freestyle, DJ, roda aberta e arrecadação de alimentos para a rede do bairro.", color: "lime", interest: 312, artistId: 6, isoDate: "2026-11-08T18:00:00-03:00", eventType: "battle", admissionType: "free", accessibility: "Área térrea; intérprete de Libras na final.", safeSpace: true, ageRating: "Livre", program: "18h inscrições · 19h eliminatórias · 21h final" },
  { id: 2, day: "09", month: "NOV", title: "Subsolo em Chamas", place: "Goma Bar", city: "Campinas", time: "20:30", description: "Linha de Frente, Ruído Móvel e convidados em uma noite DIY de hardcore e punk.", color: "coral", interest: 186, artistId: 1, isoDate: "2026-11-09T20:30:00-03:00", eventType: "show", admissionType: "contribution", accessibility: "Banheiro acessível; produção disponível na entrada.", safeSpace: true, ageRating: "16 anos", program: "Linha de Frente · Ruído Móvel · set DJ Cinza" },
  { id: 3, day: "15", month: "NOV", title: "Feira de Selos e Zines", place: "Estação Cultura", city: "Campinas", time: "16:00", description: "Discos, fitas, camisetas, zines, discotecagem e shows ao pôr do sol.", color: "lavender", interest: 94, artistId: 5, isoDate: "2026-11-15T16:00:00-03:00", eventType: "zine_fair", admissionType: "free", accessibility: "Entrada nivelada e área de descanso.", safeSpace: true, ageRating: "Livre", program: "Feira · oficina de lambe · set Coletivo Subsolo" },
  { id: 4, day: "21", month: "NOV", title: "Cypher do Terminal", place: "Casa de Cultura", city: "Campinas", time: "19:00", description: "Cypher aberta com Lua Nova, Beco 13 e beatmakers da região.", color: "lime", interest: 121, artistId: 3, isoDate: "2026-11-21T19:00:00-03:00", eventType: "cypher", admissionType: "contribution", accessibility: "Rampa de acesso e microfone aberto com inscrição.", safeSpace: true, ageRating: "Livre", program: "19h beat set · 20h cypher aberta · 22h show Beco 13" },
  { id: 5, day: "28", month: "NOV", title: "Escuta Coletiva — Campinas em Chamas", place: "Estúdio Gambiarra", city: "Campinas", time: "15:00", description: "Primeira escuta da compilação, conversa sobre produção e sessão de créditos.", color: "coral", interest: 73, artistId: 5, isoDate: "2026-11-28T15:00:00-03:00", eventType: "listening_party", admissionType: "free", accessibility: "Vagas limitadas; confirmar necessidade de acessibilidade.", safeSpace: true, ageRating: "Livre", program: "Escuta · conversa · oficina de capa" },
];

export const sceneGenres = ["Tudo", "Punk", "Hardcore", "Post-hardcore", "Rap", "Grime", "Hip hop", "Beatmaker", "Compilação"];

export const scenePlaylists = [
  { id: 1, name: "Mapa do Subsolo", owner: "Curadoria local", collaborative: true, tracks: [1, 2, 3, 7], description: "Punk, rap e hardcore de quem faz a cidade circular." },
  { id: 2, name: "Antes da roda abrir", owner: "Lua Nova", collaborative: false, tracks: [3, 4, 8], description: "Grave, rima e concentração antes da batalha." },
  { id: 3, name: "Compilação Campinas em Chamas", owner: "Coletivo Subsolo", collaborative: true, tracks: [1, 2, 5, 6], description: "Vários projetos, um mesmo território." },
];

export const sceneActivity = [
  { id: 1, kind: "release", title: "Beco 13 lançou Fora do Eixo", time: "há 2h", accent: "#a69aff", artistId: 3 },
  { id: 2, kind: "event", title: "Batalha do Terminal abriu inscrições", time: "ontem", accent: "#f0bd74", artistId: 6 },
  { id: 3, kind: "collective", title: "Coletivo Subsolo publicou uma nova compilação", time: "há 3 dias", accent: "#c8f36a", artistId: 5 },
];
