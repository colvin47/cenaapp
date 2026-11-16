import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { absoluteMediaUrl } from "@/lib/cena-api";
import { useCenaAudio } from "@/hooks/CenaAudio";
import { theme } from "@/components/theme";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function MiniPlayer() {
  const router = useRouter();
  const audio = useCenaAudio();
  const track = audio.currentTrack;
  if (!track) return null;
  const progress = audio.duration > 0 ? Math.min(100, (audio.currentTime / audio.duration) * 100) : 0;
  const cover = absoluteMediaUrl(track.cover || track.coverUrl);

  return (
    <View style={styles.shell} accessibilityLabel="Player persistente">
      <View style={styles.trackRow}>
        <Pressable style={styles.trackInfo} onPress={() => router.push(`/track/${track.id}` as never)} accessibilityRole="button" accessibilityLabel={`Detalhes de ${track.title}`}>
          {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : <View style={[styles.cover, styles.coverFallback]}><Text style={styles.coverMark}>C.</Text></View>}
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.title}>{track.title}</Text>
            <Text numberOfLines={1} style={styles.artist}>{track.artist}</Text>
          </View>
        </Pressable>
        <View style={styles.controls}>
          <Pressable onPress={audio.playPrevious} style={styles.smallControl} accessibilityRole="button" accessibilityLabel="Faixa anterior"><Text style={styles.controlText}>|◀</Text></Pressable>
          <Pressable onPress={audio.togglePlayback} style={styles.playControl} accessibilityRole="button" accessibilityLabel={audio.playing ? "Pausar" : "Reproduzir"}><Text style={styles.playText}>{audio.buffering ? "…" : audio.playing ? "Ⅱ" : "▶"}</Text></Pressable>
          <Pressable onPress={audio.playNext} style={styles.smallControl} accessibilityRole="button" accessibilityLabel="Próxima faixa"><Text style={styles.controlText}>▶|</Text></Pressable>
        </View>
      </View>
      <View style={styles.timeline} accessibilityLabel={`Progresso ${formatTime(audio.currentTime)} de ${formatTime(audio.duration)}`}>
        <View style={[styles.progress, { width: `${progress}%` }]} />
      </View>
      {audio.error && <Text numberOfLines={1} style={styles.error}>{audio.error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.line, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 8 },
  trackRow: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  trackInfo: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  cover: { width: 40, height: 40, borderRadius: 8, backgroundColor: theme.surfaceRaised },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  coverMark: { color: theme.lime, fontWeight: "900" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: theme.text, fontSize: 13, fontWeight: "800" },
  artist: { color: theme.muted, fontSize: 11 },
  controls: { flexDirection: "row", alignItems: "center", gap: 9 },
  smallControl: { minWidth: 30, minHeight: 38, alignItems: "center", justifyContent: "center" },
  controlText: { color: theme.text, fontSize: 14, fontWeight: "800" },
  playControl: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.lime },
  playText: { color: theme.background, fontSize: 16, fontWeight: "900" },
  timeline: { height: 2, marginTop: 8, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.12)" },
  progress: { height: 2, backgroundColor: theme.lime },
  error: { color: theme.coral, fontSize: 10, marginTop: 4 },
});
