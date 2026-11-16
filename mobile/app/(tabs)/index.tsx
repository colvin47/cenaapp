import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { TrackCard } from "@/components/TrackCard";
import { theme } from "@/components/theme";
import { absoluteMediaUrl, getDiscovery } from "@/lib/cena-api";
import type { DiscoveryResult, SceneEvent } from "@/lib/types";
import { useLocalCity } from "@/hooks/LocalCity";

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Text style={styles.sectionAction}>{action}</Text> : null}</View>;
}

function eventDate(event: SceneEvent) {
  const dateValue = event.isoDate || event.eventDate;
  if (dateValue) {
    const date = new Date(dateValue);
    if (!Number.isNaN(date.getTime())) return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · ${event.time || date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return [event.day, event.month, event.time].filter(Boolean).join(" · ") || "Data a confirmar";
}

export default function DiscoverScreen() {
  const router = useRouter();
  const cityState = useLocalCity();
  const [cityDraft, setCityDraft] = useState(cityState.city);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("Tudo");
  const [customGenre, setCustomGenre] = useState("");
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const filterGenre = customGenre.trim() || genre;

  useEffect(() => setCityDraft(cityState.city), [cityState.city]);

  useEffect(() => {
    if (!cityState.ready || !cityState.city) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      void getDiscovery({ city: cityState.city, genre: filterGenre, search }).then(value => {
        if (active) setResult(value);
      }).catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a descoberta.");
      }).finally(() => { if (active) setLoading(false); });
    }, 280);
    return () => { active = false; clearTimeout(timer); };
  }, [cityState.city, cityState.ready, filterGenre, refreshKey, search]);

  const genreSuggestions = [
    "Rock", "Punk", "Hardcore", "Post-hardcore", "Screamo", "Emo", "Metal", "Ska",
    "Reggae", "Dub", "Dancehall", "Rap", "Hip hop", "Grime", "Trap", "Drill", "Boom bap",
    "Funk", "Funk carioca", "Soul", "R&B", "Jazz", "Blues", "Pop", "Indie pop", "Beatmaker", "DJ",
    "Indie rock", "Shoegaze", "Alternativo", "Experimental", "Eletrônica", "House", "Techno",
    "Trance", "Drum and bass", "Ambient", "MPB", "Samba", "Pagode", "Forró", "Brega",
    "Maracatu", "Afoxé", "Afrobeat", "Sertanejo", "Gospel", "Folk", "Country",
  ];
  const genres = useMemo(() => Array.from(new Set(["Tudo", ...genreSuggestions, ...(result?.genres || []).filter(value => value && value !== "Tudo")])), [result?.genres]);
  const demo = result?.source === "seed";

  return (
    <Screen>
      <View style={styles.brandLine}><Text style={styles.wordmark}>CENA<Text style={styles.wordmarkDot}>.</Text></Text><Text style={styles.brandLabel}>MÚSICA DE PERTO</Text></View>
      <View style={styles.heroBlock}>
        <Text style={styles.eyebrow}>DESCUBRA A CENA LOCAL</Text>
        <Text style={styles.hero}>O som daqui.{"\n"}Sem pedir licença.</Text>
        <Text style={styles.subtitle}>Faixas, artistas e encontros independentes na sua cidade.</Text>
      </View>

      <View style={styles.cityCard}>
        <Text style={styles.fieldLabel}>SUA CIDADE · ESCOLHA MANUAL</Text>
        <View style={styles.cityRow}>
          <TextInput value={cityDraft} onChangeText={setCityDraft} onSubmitEditing={() => cityState.setCity(cityDraft)} placeholder="Cidade, UF" placeholderTextColor={theme.muted} returnKeyType="search" style={styles.cityInput} accessibilityLabel="Cidade para descoberta" />
          <Pressable style={styles.cityButton} onPress={() => cityState.setCity(cityDraft)} accessibilityRole="button"><Text style={styles.cityButtonText}>VER</Text></Pressable>
        </View>
        <Text style={styles.cityNote}>Localização não é coletada automaticamente.</Text>
      </View>

      <TextInput value={search} onChangeText={setSearch} placeholder="Buscar artista, faixa, gênero ou evento" placeholderTextColor={theme.muted} returnKeyType="search" style={styles.searchInput} accessibilityLabel="Buscar música independente" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow}>
        {genres.map(item => <Pressable key={item} onPress={() => { setGenre(item); setCustomGenre(""); }} style={[styles.genreChip, !customGenre.trim() && genre === item && styles.genreChipActive]}><Text style={[styles.genreText, !customGenre.trim() && genre === item && styles.genreTextActive]}>{item}</Text></Pressable>)}
      </ScrollView>
      <TextInput value={customGenre} onChangeText={setCustomGenre} placeholder="Ou digite um gênero (ex.: dub, post-punk)" placeholderTextColor={theme.muted} returnKeyType="search" style={styles.searchInput} accessibilityLabel="Filtrar por gênero digitado" />

      {demo && <View style={styles.noticeDemo}><Text style={styles.noticeTitle}>AMOSTRA DE DEMONSTRAÇÃO</Text><Text style={styles.noticeCopy}>Estes itens são ilustrativos e não representam uploads ou atividade real.</Text></View>}
      {result?.source === "unavailable" && <View style={styles.noticeError}><Text style={styles.noticeTitle}>CATÁLOGO INDISPONÍVEL</Text><Text style={styles.noticeCopy}>O serviço de descoberta não respondeu. Tente novamente em instantes.</Text></View>}
      {error && <View style={styles.noticeError}><Text style={styles.noticeTitle}>NÃO FOI POSSÍVEL CONECTAR</Text><Text style={styles.noticeCopy}>{error}</Text><Pressable onPress={() => setRefreshKey(value => value + 1)}><Text style={styles.retry}>Tentar novamente</Text></Pressable></View>}

      <View style={styles.section}>
        <SectionTitle title="Faixas para ouvir" action={cityState.city} />
        {loading && !result ? <View style={styles.loading}><ActivityIndicator color={theme.lime} /><Text style={styles.emptyCopy}>Procurando música perto de você…</Text></View> : null}
        {loading && result ? <Text style={styles.refreshing} accessibilityLiveRegion="polite">Atualizando a busca…</Text> : null}
        {result?.tracks.map(track => <TrackCard key={`${track.id}-${track.artistId}-${track._demo ? "demo" : "real"}`} track={track} queue={result.tracks} isDemo={demo} />)}
        {!loading && result && result.tracks.length === 0 && <Text style={styles.emptyCopy}>{result.source === "empty" ? `Ainda não há faixas publicadas para ${cityState.city}. Experimente outra cidade ou ajuste a busca.` : "Nenhuma faixa corresponde a estes filtros."}</Text>}
      </View>

      {!!result?.artists.length && <View style={styles.section}>
        <SectionTitle title="Artistas daqui" />
        {result.artists.map(artist => {
          const image = absoluteMediaUrl(artist.image || artist.avatarUrl);
          return <Pressable disabled={demo} key={`${artist.id}-${demo ? "demo" : "real"}`} style={styles.artistCard} onPress={() => router.push(`/artist/${encodeURIComponent(artist.handle.replace(/^@/, ""))}` as never)} accessibilityRole={demo ? undefined : "link"}>
            {image ? <Image source={{ uri: image }} style={styles.artistImage} /> : <View style={[styles.artistImage, styles.artistFallback]}><Text style={styles.artistInitial}>{artist.name.slice(0, 1).toUpperCase()}</Text></View>}
            <View style={styles.artistCopy}><Text style={styles.artistName}>{artist.name}</Text><Text style={styles.artistMeta}>{artist.city || cityState.city} · {artist.genre || "Independente"}</Text></View>
            {demo && <Text style={styles.demoTag}>AMOSTRA</Text>}
          </Pressable>;
        })}
      </View>}

      {!!result?.events.length && <View style={styles.section}>
        <SectionTitle title="Próximos encontros" />
        {result.events.map(event => <Pressable disabled={demo} key={`${event.id}-${demo ? "demo" : "real"}`} style={styles.eventCard} onPress={() => router.push(`/event/${event.id}` as never)} accessibilityRole={demo ? undefined : "link"}>
          <View style={styles.eventDate}><Text style={styles.eventDateText}>{eventDate(event)}</Text></View>
          <Text style={styles.eventName}>{event.title}</Text>
          <Text style={styles.eventMeta}>{event.place || "Local a confirmar"} · {event.city || cityState.city}</Text>
          {demo && <Text style={styles.demoTag}>AMOSTRA</Text>}
        </Pressable>)}
      </View>}

      {result?.source === "empty" && <View style={styles.emptyCard}><Text style={styles.emptyTitle}>A cena cresce com quem faz.</Text><Text style={styles.emptyCopy}>Ainda não há publicações nesta região. Volte mais tarde ou procure uma cidade próxima.</Text></View>}
      <Text style={styles.footer}>CENA · MÚSICA INDEPENDENTE, PERTO DE VOCÊ</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { color: theme.text, fontSize: 26, fontWeight: "900", letterSpacing: -1.2 },
  wordmarkDot: { color: theme.coral },
  brandLabel: { color: theme.lime, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  heroBlock: { gap: 7, paddingTop: 8 },
  eyebrow: { color: theme.coral, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  hero: { color: theme.text, fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1.2 },
  subtitle: { color: theme.muted, fontSize: 13, lineHeight: 19, maxWidth: 310 },
  cityCard: { backgroundColor: theme.surface, borderColor: theme.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  fieldLabel: { color: theme.lavender, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cityInput: { flex: 1, minHeight: 42, color: theme.text, fontSize: 15, fontWeight: "700", borderBottomWidth: 1, borderBottomColor: theme.line, paddingVertical: 8 },
  cityButton: { minHeight: 40, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: theme.lime },
  cityButtonText: { color: theme.background, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  cityNote: { color: theme.muted, fontSize: 10 },
  searchInput: { minHeight: 48, backgroundColor: theme.surface, borderColor: theme.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, color: theme.text, fontSize: 13 },
  genreRow: { gap: 8, paddingRight: 18 },
  genreChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface },
  genreChipActive: { borderColor: theme.lime, backgroundColor: "rgba(197,38,66,0.12)" },
  genreText: { color: theme.muted, fontSize: 11, fontWeight: "700" },
  genreTextActive: { color: theme.lime },
  noticeDemo: { backgroundColor: "rgba(240,90,114,0.10)", borderLeftWidth: 3, borderLeftColor: theme.peach, padding: 12, gap: 4 },
  noticeError: { backgroundColor: "rgba(240,90,114,0.10)", borderLeftWidth: 3, borderLeftColor: theme.coral, padding: 12, gap: 4 },
  noticeTitle: { color: theme.peach, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  noticeCopy: { color: theme.text, fontSize: 11, lineHeight: 16 },
  retry: { color: theme.lime, fontSize: 12, fontWeight: "800", marginTop: 5 },
  section: { gap: 10 },
  sectionTitleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { color: theme.text, fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  sectionAction: { color: theme.muted, fontSize: 10 },
  loading: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 14 },
  refreshing: { color: theme.muted, fontSize: 10, paddingVertical: 4 },
  emptyCopy: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  artistCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface },
  artistImage: { width: 46, height: 46, borderRadius: 15, backgroundColor: theme.surfaceRaised },
  artistFallback: { alignItems: "center", justifyContent: "center" },
  artistInitial: { color: theme.lime, fontSize: 19, fontWeight: "900" },
  artistCopy: { flex: 1, gap: 4 },
  artistName: { color: theme.text, fontSize: 13, fontWeight: "800" },
  artistMeta: { color: theme.muted, fontSize: 10 },
  demoTag: { color: theme.peach, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  eventCard: { padding: 13, gap: 5, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface },
  eventDate: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(36,20,47,0.12)" },
  eventDateText: { color: theme.lavender, fontSize: 9, fontWeight: "900" },
  eventName: { color: theme.text, fontSize: 14, fontWeight: "900" },
  eventMeta: { color: theme.muted, fontSize: 10 },
  emptyCard: { padding: 16, gap: 7, borderRadius: 15, backgroundColor: theme.surfaceRaised },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "900" },
  footer: { color: theme.muted, fontSize: 8, letterSpacing: 1.1, textAlign: "center", paddingVertical: 8 },
});
