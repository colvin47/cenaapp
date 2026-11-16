import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { TrackCard } from "@/components/TrackCard";
import { theme } from "@/components/theme";
import { absoluteMediaUrl, CENA_API_BASE_URL, getArtistDetail, getArtistMerchandise } from "@/lib/cena-api";
import { openExternalUrl, safeExternalUrl } from "@/lib/external-links";
import type { ArtistDetail, MerchandiseItem } from "@/lib/types";

function price(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Preço informado pelo artista";
}

export default function ArtistDetailScreen() {
  const params = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const handleParam = Array.isArray(params.handle) ? params.handle[0] : params.handle;
  const handle = (handleParam || "").replace(/^@/, "");
  const [detail, setDetail] = useState<ArtistDetail | null>(null);
  const [merch, setMerch] = useState<MerchandiseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merchLoading, setMerchLoading] = useState(false);
  const [merchError, setMerchError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!/^[a-zA-Z0-9_]{1,80}$/.test(handle)) {
      setDetail(null); setError("Este perfil não possui um identificador válido."); setLoading(false); setMerchLoading(false);
      return () => { active = false; };
    }
    setLoading(true); setMerchLoading(false); setDetail(null); setMerch([]); setError(null); setMerchError(null);
    void getArtistDetail(handle).then(value => {
      if (!active) return;
      setDetail(value);
      if (!value) return;
      setMerchLoading(true);
      void getArtistMerchandise(value.artist.id).then(items => {
        if (active) setMerch(items);
      }).catch(() => {
        if (active) setMerchError("Merchandise temporariamente indisponível.");
      }).finally(() => {
        if (active) setMerchLoading(false);
      });
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar este perfil.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [handle]);

  const tracks = useMemo(() => detail ? detail.tracks.map(track => ({ ...track, handle: detail.artist.handle })) : [], [detail]);
  const artist = detail?.artist;

  const shareArtist = async () => {
    if (!artist) return;
    await Share.share({ message: `${artist.name} no CENA\n${CENA_API_BASE_URL}/artistas/${encodeURIComponent(artist.handle.replace(/^@/, ""))}` });
  };
  const openMerch = async (item: MerchandiseItem) => {
    setLinkError(null);
    if (!await openExternalUrl(item.externalUrl)) setLinkError(`O link de “${item.title}” não está disponível ou não usa HTTP(S).`);
  };
  const openSupport = async (url?: string | null) => {
    setLinkError(null);
    if (!await openExternalUrl(url)) setLinkError("Este destino externo não está disponível ou não usa HTTP(S).");
  };

  return (
    <Screen>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/" as never)} style={styles.back} accessibilityRole="button"><Text style={styles.backText}>‹  Voltar</Text></Pressable>
      {loading && <View style={styles.loading}><ActivityIndicator color={theme.lime} /><Text style={styles.body}>Carregando perfil…</Text></View>}
      {!loading && error && <View style={styles.error}><Text style={styles.title}>Não foi possível abrir</Text><Text style={styles.body}>{error}</Text></View>}
      {!loading && !error && !detail && <View style={styles.error}><Text style={styles.title}>Perfil não encontrado</Text><Text style={styles.body}>Este perfil pode ter sido ocultado, removido ou estar indisponível.</Text></View>}
      {artist && <>
        <View style={styles.profile}>
          {absoluteMediaUrl(artist.image || artist.avatarUrl) ? <Image source={{ uri: absoluteMediaUrl(artist.image || artist.avatarUrl) }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{artist.name.slice(0, 1).toUpperCase()}</Text></View>}
          <Text style={styles.eyebrow}>PERFIL ARTÍSTICO PÚBLICO</Text>
          <Text style={styles.title}>{artist.name}</Text>
          <Text style={styles.meta}>{artist.handle} · {artist.city || "Cidade não informada"}{artist.genre ? ` · ${artist.genre}` : ""}</Text>
          {artist.bio && <Text style={styles.body}>{artist.bio}</Text>}
          {artist.manifesto && <Text style={styles.manifesto}>“{artist.manifesto}”</Text>}
          <View style={styles.profileActions}>
            <Pressable onPress={shareArtist} style={styles.outlineButton}><Text style={styles.outlineText}>Compartilhar artista</Text></Pressable>
            {safeExternalUrl(artist.supportUrl || artist.pixUrl) && <Pressable onPress={() => openSupport(artist.supportUrl || artist.pixUrl)} style={styles.supportButton}><Text style={styles.supportText}>Apoiar fora do CENA</Text></Pressable>}
          </View>
          {linkError && <Text style={styles.linkError}>{linkError}</Text>}
        </View>

        {!!tracks.length && <View style={styles.section}><Text style={styles.sectionTitle}>Faixas</Text>{tracks.map(track => <TrackCard key={`${track.id}-${track.artistId}`} track={track} queue={tracks} />)}</View>}

        {!!detail?.events.length && <View style={styles.section}><Text style={styles.sectionTitle}>Agenda</Text>{detail.events.filter(event => !event.canceledAt).map(event => <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}` as never)} style={styles.eventCard}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.body}>{event.place || "Local a confirmar"} · {event.city || artist.city || ""}</Text></Pressable>)}</View>}

        {(merchLoading || merchError || merch.length > 0) && <View style={styles.section}><Text style={styles.sectionTitle}>Merchandise</Text><Text style={styles.body}>Preço e estoque são informativos. A compra ocorre fora do CENA.</Text>{merchLoading && <Text style={styles.body}>Carregando merchandise…</Text>}{merchError && <Text style={styles.linkError}>{merchError}</Text>}{merch.map(item => <View key={item.id} style={styles.product}>
          <View style={styles.productTop}><Text style={styles.productName}>{item.title}</Text><Text style={styles.productPrice}>{price(item.price)}</Text></View>
          {item.description && <Text style={styles.body}>{item.description}</Text>}
          <Text style={styles.stock}>{item.stock} disponíveis</Text>
          {safeExternalUrl(item.externalUrl) && <Pressable onPress={() => openMerch(item)} style={styles.productButton}><Text style={styles.productButtonText}>Ver fora do CENA</Text></Pressable>}
        </View>)}{linkError && <Text style={styles.linkError}>{linkError}</Text>}</View>}
      </>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", minHeight: 38, justifyContent: "center", paddingRight: 12 },
  backText: { color: theme.lime, fontSize: 13, fontWeight: "800" },
  profile: { alignItems: "flex-start", gap: 8, paddingTop: 7 },
  avatar: { width: 90, height: 90, borderRadius: 28, backgroundColor: theme.surfaceRaised },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.lime, fontSize: 36, fontWeight: "900" },
  eyebrow: { color: theme.coral, fontSize: 9, fontWeight: "900", letterSpacing: 1.4, marginTop: 6 },
  title: { color: theme.text, fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -0.7 },
  meta: { color: theme.lavender, fontSize: 10, fontWeight: "800" },
  body: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  manifesto: { color: theme.text, fontSize: 14, fontStyle: "italic", lineHeight: 21, marginTop: 2 },
  profileActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  outlineButton: { borderWidth: 1, borderColor: theme.line, borderRadius: 12, minHeight: 40, justifyContent: "center", paddingHorizontal: 12 },
  outlineText: { color: theme.text, fontSize: 10, fontWeight: "800" },
  supportButton: { backgroundColor: theme.lime, borderRadius: 12, minHeight: 40, justifyContent: "center", paddingHorizontal: 12 },
  supportText: { color: theme.background, fontSize: 10, fontWeight: "900" },
  loading: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 14 },
  error: { padding: 15, borderRadius: 15, backgroundColor: theme.surface, gap: 7 },
  section: { gap: 9 },
  sectionTitle: { color: theme.text, fontSize: 17, fontWeight: "900" },
  eventCard: { padding: 13, gap: 6, borderRadius: 13, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line },
  eventTitle: { color: theme.text, fontSize: 13, fontWeight: "800" },
  product: { padding: 13, gap: 7, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface },
  productTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  productName: { color: theme.text, flex: 1, fontSize: 13, fontWeight: "900" },
  productPrice: { color: theme.lime, fontSize: 12, fontWeight: "900" },
  stock: { color: theme.peach, fontSize: 10, fontWeight: "800" },
  productButton: { alignSelf: "flex-start", paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: 10, backgroundColor: theme.surfaceRaised },
  productButtonText: { color: theme.lime, fontSize: 10, fontWeight: "900" },
  linkError: { color: theme.coral, fontSize: 10 },
});
