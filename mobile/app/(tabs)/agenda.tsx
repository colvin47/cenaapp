import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { theme } from "@/components/theme";
import { getDiscovery } from "@/lib/cena-api";
import type { ContentSource, SceneEvent } from "@/lib/types";
import { useLocalCity } from "@/hooks/LocalCity";

function formatDate(event: SceneEvent) {
  const raw = event.isoDate || event.eventDate;
  if (raw) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return `${date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long" })} · ${event.time || date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return [event.day, event.month, event.time].filter(Boolean).join(" · ") || "Data a confirmar";
}

export default function AgendaScreen() {
  const router = useRouter();
  const { city, ready } = useLocalCity();
  const [events, setEvents] = useState<SceneEvent[]>([]);
  const [source, setSource] = useState<ContentSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setError(null);
    void getDiscovery({ city }).then(result => {
      if (active) { setEvents(result.events); setSource(result.source); }
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a agenda.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [city, ready]);

  const isDemo = source === "seed";
  return (
    <Screen>
      <View style={styles.brand}><Text style={styles.eyebrow}>CENA · AGENDA</Text><Text style={styles.title}>Onde a cena se encontra.</Text><Text style={styles.subtitle}>{city} · eventos publicados na sua região.</Text></View>
      {isDemo && <View style={styles.demo}><Text style={styles.demoTitle}>AMOSTRA DE DEMONSTRAÇÃO</Text><Text style={styles.body}>Eventos ilustrativos. Não são eventos reais publicados por artistas.</Text></View>}
      {source === "empty" && <View style={styles.empty}><Text style={styles.emptyTitle}>Sem eventos publicados por aqui.</Text><Text style={styles.body}>Experimente outra cidade na aba Descobrir.</Text></View>}
      {source === "unavailable" && <View style={styles.error}><Text style={styles.errorTitle}>Agenda indisponível</Text><Text style={styles.body}>O serviço não respondeu. Tente novamente mais tarde.</Text></View>}
      {error && <View style={styles.error}><Text style={styles.errorTitle}>Não foi possível conectar</Text><Text style={styles.body}>{error}</Text></View>}
      {loading && <View style={styles.loading}><ActivityIndicator color={theme.lime} /><Text style={styles.body}>Buscando eventos…</Text></View>}
      {events.map(event => <Pressable key={`${event.id}-${isDemo ? "demo" : "real"}`} disabled={isDemo} style={styles.event} onPress={() => router.push(`/event/${event.id}` as never)} accessibilityRole={isDemo ? undefined : "link"}>
        <Text style={styles.date}>{formatDate(event)}</Text>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.body}>{event.place || "Local a confirmar"} · {event.city || city}</Text>
        {event.artist && <Text style={styles.artist}>Por {event.artist}</Text>}
        {isDemo && <Text style={styles.demoPill}>AMOSTRA</Text>}
      </Pressable>)}
      {!loading && source === "database" && events.length === 0 && <Text style={styles.body}>Nenhum evento corresponde a esta cidade.</Text>}
      <Text style={styles.footer}>Ingressos e disponibilidade são informativos; compra ou reserva ocorre fora do CENA.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { gap: 8, marginBottom: 2 },
  eyebrow: { color: theme.coral, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: theme.text, fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { color: theme.muted, fontSize: 12 },
  event: { position: "relative", overflow: "hidden", padding: 15, gap: 7, borderRadius: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line },
  date: { color: theme.lavender, fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  eventTitle: { color: theme.text, fontSize: 17, fontWeight: "900" },
  body: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  artist: { color: theme.lime, fontSize: 11, fontWeight: "700" },
  demo: { padding: 12, borderLeftWidth: 3, borderLeftColor: theme.peach, backgroundColor: "rgba(240,189,116,0.1)", gap: 4 },
  demoTitle: { color: theme.peach, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  demoPill: { color: theme.peach, fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 4 },
  empty: { padding: 16, backgroundColor: theme.surface, borderRadius: 15, gap: 6 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "900" },
  error: { padding: 14, borderLeftWidth: 3, borderLeftColor: theme.coral, backgroundColor: "rgba(255,118,95,0.1)", gap: 5 },
  errorTitle: { color: theme.coral, fontSize: 12, fontWeight: "900" },
  loading: { flexDirection: "row", gap: 10, alignItems: "center" },
  footer: { color: theme.muted, fontSize: 10, lineHeight: 15, textAlign: "center", paddingTop: 4 },
});
