export type ContentSource = "database" | "seed" | "empty" | "unavailable";

export type Track = {
  id: number;
  title: string;
  artist: string;
  artistId: number;
  handle?: string | null;
  genre?: string | null;
  city?: string | null;
  duration?: number | null;
  cover?: string | null;
  coverUrl?: string | null;
  accent?: string | null;
  audioUrl?: string | null;
  externalUrl?: string | null;
  _demo?: boolean;
  album?: string | null;
  releaseType?: string | null;
  description?: string | null;
  creditsNote?: string | null;
};

export type Artist = {
  id: number;
  name: string;
  handle: string;
  profileType?: string | null;
  genre?: string | null;
  bio?: string | null;
  manifesto?: string | null;
  city?: string | null;
  image?: string | null;
  avatarUrl?: string | null;
  accent?: string | null;
  followers?: string | number | null;
  supportUrl?: string | null;
  pixUrl?: string | null;
  merchUrl?: string | null;
  instagramUrl?: string | null;
  bandcampUrl?: string | null;
};

export type SceneEvent = {
  id: number;
  title: string;
  place?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  time?: string | null;
  day?: string | null;
  month?: string | null;
  isoDate?: string | null;
  eventDate?: string | Date | null;
  description?: string | null;
  color?: string | null;
  interest?: number | null;
  artistId: number;
  artist?: string | null;
  handle?: string | null;
  ticketUrl?: string | null;
  eventType?: string | null;
  admissionType?: string | null;
  accessibility?: string | null;
  safeSpace?: boolean | null;
  ageRating?: string | null;
  program?: string | null;
  canceledAt?: string | Date | null;
  cancelReason?: string | null;
};

export type DiscoveryResult = {
  tracks: Track[];
  artists: Artist[];
  events: SceneEvent[];
  source: ContentSource;
  city: string;
  genres: string[];
};

export type EventTicket = {
  id: number;
  eventId: number;
  name: string;
  price: string | number;
  quantityAvailable: number;
  quantityReserved?: number;
  available?: number;
  pixKey?: string | null;
};

export type MerchandiseItem = {
  id: number;
  artistId: number;
  title: string;
  description?: string | null;
  price: string | number;
  stock: number;
  imageUrl?: string | null;
  externalUrl?: string | null;
};

export type ArtistDetail = { artist: Artist & { merchandise?: MerchandiseItem[] }; tracks: Track[]; events: SceneEvent[] };
