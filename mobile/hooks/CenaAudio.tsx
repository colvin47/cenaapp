import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { absoluteMediaUrl, CENA_API_BASE_URL } from "@/lib/cena-api";
import { directAudioUrl } from "@/lib/media-urls";
import type { Track } from "@/lib/types";

type CenaAudioValue = {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  playing: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (seconds: number) => void;
  clearPlayer: () => void;
};

const CenaAudioContext = createContext<CenaAudioValue | null>(null);

function sameTrack(a: Track | null | undefined, b: Track | null | undefined) {
  return Boolean(a && b && a.id === b.id && a.artistId === b.artistId && Boolean(a._demo) === Boolean(b._demo));
}

export function CenaAudioProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 500, preferredForwardBufferDuration: 12 });
  const status = useAudioPlayerStatus(player);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const finishedRef = useRef(false);

  useEffect(() => {
    void setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: "doNotMix",
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    }).catch(() => setError("Não foi possível preparar o áudio neste aparelho."));
  }, []);

  const loadTrack = useCallback((track: Track) => {
    const url = directAudioUrl(track.audioUrl, CENA_API_BASE_URL, typeof __DEV__ !== "undefined" && __DEV__);
    if (!url) {
      setError("Não há um arquivo de áudio direto compatível. Use o link da fonte externa, se disponível.");
      return;
    }
    setError(null);
    setCurrentTrack(track);
    finishedRef.current = false;
    player.replace({ uri: url, name: track.title });
    player.setActiveForLockScreen(true, {
      title: track.title,
      artist: track.artist,
      artworkUrl: absoluteMediaUrl(track.cover || track.coverUrl),
    });
    player.play();
  }, [player]);

  const playAt = useCallback((index: number) => {
    const next = queueRef.current[index];
    if (!next) return;
    indexRef.current = index;
    setQueueIndex(index);
    loadTrack(next);
  }, [loadTrack]);

  const playNext = useCallback(() => {
    const nextIndex = indexRef.current + 1;
    if (nextIndex >= queueRef.current.length) {
      player.pause();
      return;
    }
    playAt(nextIndex);
  }, [playAt, player]);

  const playPrevious = useCallback(() => {
    if (status.currentTime > 3) {
      void player.seekTo(0);
      return;
    }
    playAt(Math.max(0, indexRef.current - 1));
  }, [playAt, player, status.currentTime]);

  useEffect(() => {
    if (status.didJustFinish && !finishedRef.current) {
      finishedRef.current = true;
      playNext();
    } else if (!status.didJustFinish) {
      finishedRef.current = false;
    }
  }, [playNext, status.didJustFinish]);

  const playTrack = useCallback((track: Track, tracks: Track[] = [track]) => {
    const matchingIndex = tracks.findIndex(item => sameTrack(item, track));
    const nextQueue = matchingIndex >= 0 ? tracks : [track, ...tracks];
    const nextIndex = matchingIndex >= 0 ? matchingIndex : 0;
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    indexRef.current = nextIndex;
    setQueueIndex(nextIndex);
    loadTrack(track);
  }, [loadTrack]);

  const togglePlayback = useCallback(() => {
    if (!currentTrack) return;
    setError(null);
    if (status.playing) player.pause();
    else player.play();
  }, [currentTrack, player, status.playing]);

  const seekTo = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || !status.duration) return;
    void player.seekTo(Math.max(0, Math.min(seconds, status.duration)));
  }, [player, status.duration]);

  const clearPlayer = useCallback(() => {
    player.pause();
    player.clearLockScreenControls();
    player.replace(null);
    queueRef.current = [];
    indexRef.current = -1;
    setQueue([]);
    setQueueIndex(-1);
    setCurrentTrack(null);
    setError(null);
  }, [player]);

  const value = useMemo<CenaAudioValue>(() => ({
    currentTrack,
    queue,
    queueIndex,
    playing: status.playing,
    buffering: status.isBuffering || (!!currentTrack && !status.isLoaded),
    currentTime: status.currentTime,
    duration: status.duration,
    error: error || status.error,
    playTrack,
    togglePlayback,
    playNext,
    playPrevious,
    seekTo,
    clearPlayer,
  }), [clearPlayer, currentTrack, error, playNext, playPrevious, playTrack, queue, queueIndex, seekTo, status.currentTime, status.duration, status.error, status.isBuffering, status.isLoaded, status.playing, togglePlayback]);

  return <CenaAudioContext.Provider value={value}>{children}</CenaAudioContext.Provider>;
}

export function useCenaAudio() {
  const value = useContext(CenaAudioContext);
  if (!value) throw new Error("useCenaAudio precisa estar dentro de CenaAudioProvider.");
  return value;
}
