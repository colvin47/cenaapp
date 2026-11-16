import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { TrackCard } from "@/components/TrackCard";
import { theme } from "@/components/theme";
import { getTrackDetail } from "@/lib/cena-api";
import { useCenaAudio } from "@/hooks/CenaAudio";
import type { Track } from "@/lib/types";

function durationLabel(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return "";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export default function TrackDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const audio = useCenaAudio();
  const idValue = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = Number(idValue);
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Este link não identifica uma faixa válida."); setLoading(false);
      return () => { active = false; };
    }
    setLoading(true); setTrack(null); setError(null);
    void getTrackDetail(id).then(value => { if (active) setTrack(value); }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar esta faixa.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  return (
    <Screen>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/" as never)} style={styles.back} accessibilityRole="button"><Text style={styles.backText}>‹  Voltar</Text></Pressable>
      {loading && <View style={styles.loading}><ActivityIndicator color={theme.lime} /><Text style={styles.body}>Carregando faixa…</Text></View>}
      {!loading && error && <View style={styles.panel}><Text style={styles.title}>Não foi possível abrir</Text><Text style={styles.body}>{error}</Text></View>}
      {!loading && !error && !track && <View style={styles.panel}><Text style={styles.title}>Faixa não encontrada</Text><Text style={styles.body}>Este link pode ter sido removido, ocultado ou não ser mais público. Nenhuma demo foi usada como substituta.</Text></View>}
      {track && <>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FAIXA PUBLICADA</Text>
          <Text style={styles.title}>{track.title}</Text>
          <Pressable disabled={!track.handle} onPress={() => track.handle && router.push(`/artist/${encodeURIComponent(track.handle.replace(/^@/, ""))}` as never)}><Text style={styles.artist}>{track.artist}</Text></Pressable>
          <Text style={styles.meta}>{[track.album, track.genre, track.city, durationLabel(track.duration)].filter(Boolean).join(" · ")}</Text>
          {track.description && <Text style={styles.body}>{track.description}</Text>}
          {track.creditsNote && <View style={styles.credits}><Text style={styles.creditsTitle}>CRÉDITOS E DIREITOS</Text><Text style={styles.body}>{track.creditsNote}</Text></View>}
        </View>
        <TrackCard track={track} queue={[track]} />
        {audio.error && audio.currentTrack?.id === track.id && <Text style={styles.errorText}>{audio.error}</Text>}
        <Text style={styles.footer}>O player não substitui esta faixa por amostras de ID coincidente.</Text>
      </>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", minHeight: 38, justifyContent: "center", paddingRight: 12 },
  backText: { color: theme.lime, fontSize: 13, fontWeight: "800" },
  header: { gap: 9, paddingTop: 8 },
  eyebrow: { color: theme.coral, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: theme.text, fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.7 },
  artist: { color: theme.lime, fontSize: 14, fontWeight: "800" },
  meta: { color: theme.lavender, fontSize: 10, fontWeight: "700" },
  body: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  loading: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 14 },
  panel: { padding: 15, borderRadius: 15, backgroundColor: theme.surface, gap: 8 },
  credits: { padding: 12, gap: 5, borderRadius: 12, backgroundColor: theme.surfaceRaised },
  creditsTitle: { color: theme.peach, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  errorText: { color: theme.coral, fontSize: 11 },
  footer: { color: theme.muted, fontSize: 10, textAlign: "center", lineHeight: 15 },
});
