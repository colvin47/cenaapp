import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Track } from "@/lib/types";

const STORAGE_KEY = "cena.local-library.v1";

type LocalLibraryValue = {
  tracks: Track[];
  ready: boolean;
  isSaved: (track: Track) => boolean;
  toggleSaved: (track: Track) => void;
};

const LocalLibraryContext = createContext<LocalLibraryValue | null>(null);

function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<Track>;
  return Number.isSafeInteger(track.id) && Number.isSafeInteger(track.artistId) && typeof track.title === "string" && typeof track.artist === "string";
}

function sameTrack(a: Track, b: Track) {
  return a.id === b.id && a.artistId === b.artistId && Boolean(a._demo) === Boolean(b._demo);
}

export function LocalLibraryProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!mounted) return;
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setTracks(parsed.filter(isTrack));
        } catch {
          setTracks([]);
        }
      }
      setReady(true);
    }).catch(() => {
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracks)).catch(() => undefined);
  }, [ready, tracks]);

  const isSaved = useCallback((track: Track) => tracks.some(item => sameTrack(item, track)), [tracks]);
  const toggleSaved = useCallback((track: Track) => {
    if (!ready) return;
    setTracks(current => current.some(item => sameTrack(item, track))
      ? current.filter(item => !sameTrack(item, track))
      : [track, ...current]);
  }, [ready]);

  const value = useMemo(() => ({ tracks, ready, isSaved, toggleSaved }), [isSaved, ready, tracks, toggleSaved]);
  return <LocalLibraryContext.Provider value={value}>{children}</LocalLibraryContext.Provider>;
}

export function useLocalLibrary() {
  const value = useContext(LocalLibraryContext);
  if (!value) throw new Error("useLocalLibrary precisa estar dentro de LocalLibraryProvider.");
  return value;
}
