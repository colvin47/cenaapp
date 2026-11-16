import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { absoluteMediaUrl } from "@/lib/cena-api";
import { openExternalUrl, safeExternalUrl } from "@/lib/external-links";
import { useCenaAudio } from "@/hooks/CenaAudio";
import { useLocalLibrary } from "@/hooks/LocalLibrary";
import { theme } from "@/components/theme";
import type { Track } from "@/lib/types";

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds < 1) return "";
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function TrackCard({ track, queue, isDemo = false }: { track: Track; queue: Track[]; isDemo?: boolean }) {
  const router = useRouter();
  const audio = useCenaAudio();
  const library = useLocalLibrary();
  const cover = absoluteMediaUrl(track.cover || track.coverUrl);
  const demo = isDemo || Boolean(track._demo);
  const isCurrent = audio.currentTrack?.id === track.id && audio.currentTrack.artistId === track.artistId && Boolean(audio.currentTrack._demo) === Boolean(track._demo);
  const saved = library.isSaved(track);
  const sourceUrl = safeExternalUrl(track.externalUrl);

  return (
    <View style={[styles.card, isCurrent && styles.cardActive]}>
      <Pressable onPress={() => audio.playTrack(track, queue)} style={styles.playButton} accessibilityRole="button" accessibilityLabel={`Reproduzir ${track.title}`}>
        {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : <View style={[styles.cover, styles.coverFallback]}><Text style={styles.coverMark}>C.</Text></View>}
        <View style={styles.playOverlay}><Text style={styles.playGlyph}>{isCurrent && audio.playing ? "Ⅱ" : "▶"}</Text></View>
      </Pressable>
      <View style={styles.copy}>
        <Pressable disabled={demo} onPress={() => router.push(`/track/${track.id}` as never)} accessibilityRole={demo ? undefined : "link"}><Text numberOfLines={1} style={[styles.title, isCurrent && styles.activeText]}>{track.title}</Text></Pressable>
        <Pressable disabled={!track.handle || demo} onPress={() => track.handle && router.push(`/artist/${encodeURIComponent(track.handle.replace(/^@/, ""))}` as never)} accessibilityRole={track.handle && !demo ? "link" : undefined}><Text numberOfLines={1} style={styles.artist}>{track.artist} · {track.genre || "Música independente"}</Text></Pressable>
        <View style={styles.meta}><Text style={styles.metaText}>{track.city || "CENA"}</Text>{formatDuration(track.duration) ? <Text style={styles.metaText}>{formatDuration(track.duration)}</Text> : null}{demo && <Text style={styles.demo}>AMOSTRA</Text>}</View>
      </View>
      {sourceUrl && <Pressable onPress={() => { void openExternalUrl(sourceUrl); }} style={styles.sourceButton} accessibilityRole="link" accessibilityLabel={`Abrir fonte externa de ${track.title}`}><Text style={styles.sourceGlyph}>↗</Text></Pressable>}
      <Pressable disabled={!library.ready} onPress={() => library.toggleSaved(track)} style={[styles.saveButton, !library.ready && styles.saveDisabled]} accessibilityRole="button" accessibilityState={{ disabled: !library.ready }} accessibilityLabel={!library.ready ? "Carregando biblioteca" : saved ? "Remover da biblioteca local" : "Salvar neste aparelho"}><Text style={[styles.saveGlyph, saved && styles.activeText]}>{saved ? "◆" : "◇"}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderWidth: 1, borderColor: theme.line, borderRadius: 15, backgroundColor: theme.surface },
  cardActive: { borderColor: "rgba(197,38,66,0.5)", backgroundColor: "#24142F" },
  playButton: { width: 54, height: 54, borderRadius: 11, overflow: "hidden", backgroundColor: theme.surfaceRaised },
  cover: { width: 54, height: 54 },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  coverMark: { color: theme.lime, fontSize: 18, fontWeight: "900" },
  playOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,7,10,0.28)" },
  playGlyph: { color: "white", fontSize: 17, fontWeight: "900" },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: theme.text, fontSize: 14, fontWeight: "800" },
  activeText: { color: theme.lime },
  artist: { color: theme.muted, fontSize: 11 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 9, alignItems: "center" },
  metaText: { color: theme.muted, fontSize: 10 },
  demo: { color: theme.peach, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  saveButton: { minWidth: 38, minHeight: 42, alignItems: "center", justifyContent: "center" },
  saveDisabled: { opacity: 0.45 },
  sourceButton: { minWidth: 32, minHeight: 42, alignItems: "center", justifyContent: "center" },
  sourceGlyph: { color: theme.lavender, fontSize: 19, fontWeight: "900" },
  saveGlyph: { color: theme.muted, fontSize: 21, fontWeight: "700" },
});
