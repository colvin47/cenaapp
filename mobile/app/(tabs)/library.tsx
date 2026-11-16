import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { TrackCard } from "@/components/TrackCard";
import { theme } from "@/components/theme";
import { useLocalLibrary } from "@/hooks/LocalLibrary";
import { useCenaAudio } from "@/hooks/CenaAudio";

export default function LibraryScreen() {
  const library = useLocalLibrary();
  const audio = useCenaAudio();
  return (
    <Screen>
      <View style={styles.header}><Text style={styles.eyebrow}>SÓ NESTE APARELHO</Text><Text style={styles.title}>Seu canto.</Text><Text style={styles.subtitle}>Faixas salvas ficam privadas aqui; não aparecem em perfil público e não são sincronizadas.</Text></View>
      <View style={styles.privateCard}><Text style={styles.privateTitle}>Biblioteca local e privada</Text><Text style={styles.privateBody}>Sem login, sem compartilhamento e sem escrita no servidor. Para remover uma faixa, toque no losango ao lado dela.</Text></View>
      {!library.ready && <View style={styles.loading}><ActivityIndicator color={theme.lime} /><Text style={styles.subtitle}>Abrindo biblioteca…</Text></View>}
      {library.ready && library.tracks.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>Ainda está vazia.</Text><Text style={styles.subtitle}>Salve uma faixa em Descobrir para encontrá-la aqui.</Text></View>}
      {library.tracks.map(track => <TrackCard key={`${track.id}-${track.artistId}-${track._demo ? "demo" : "real"}`} track={track} queue={library.tracks} isDemo={Boolean(track._demo)} />)}
      {audio.currentTrack && <Pressable onPress={audio.clearPlayer} style={styles.clearPlayer}><Text style={styles.clearText}>Parar reprodução</Text></Pressable>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  eyebrow: { color: theme.lavender, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: theme.text, fontSize: 31, fontWeight: "900", letterSpacing: -0.7 },
  subtitle: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  privateCard: { padding: 14, gap: 5, borderRadius: 15, borderWidth: 1, borderColor: "rgba(200,243,106,0.32)", backgroundColor: "rgba(200,243,106,0.07)" },
  privateTitle: { color: theme.lime, fontSize: 12, fontWeight: "900" },
  privateBody: { color: theme.text, fontSize: 11, lineHeight: 16 },
  loading: { flexDirection: "row", alignItems: "center", gap: 10 },
  empty: { padding: 18, gap: 8, backgroundColor: theme.surface, borderRadius: 16 },
  emptyTitle: { color: theme.text, fontSize: 17, fontWeight: "900" },
  clearPlayer: { alignSelf: "flex-start", borderWidth: 1, borderColor: theme.line, paddingVertical: 10, paddingHorizontal: 13, borderRadius: 12 },
  clearText: { color: theme.muted, fontSize: 11, fontWeight: "800" },
});
