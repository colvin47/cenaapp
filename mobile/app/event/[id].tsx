import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { theme } from "@/components/theme";
import { getEventDetail, getEventTickets } from "@/lib/cena-api";
import { openExternalUrl, safeExternalUrl } from "@/lib/external-links";
import type { EventTicket, SceneEvent } from "@/lib/types";

function price(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Preço informado pelo produtor";
  return amount === 0 ? "Grátis" : amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateLabel(event: SceneEvent) {
  const raw = event.isoDate || event.eventDate;
  if (!raw) return [event.day, event.month, event.time].filter(Boolean).join(" · ") || "Data a confirmar";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "Data a confirmar" : `${date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}${event.time ? ` · ${event.time}` : ""}`;
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const idText = Array.isArray(params.id) ? params.id[0] : params.id;
  const eventId = Number(idText);
  const [event, setEvent] = useState<SceneEvent | null>(null);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!Number.isSafeInteger(eventId) || eventId <= 0) {
      setEvent(null); setTickets([]); setTicketsLoading(false); setError("Este evento não tem um identificador válido."); setLoading(false);
      return () => { active = false; };
    }
    setLoading(true); setTicketsLoading(false); setEvent(null); setTickets([]); setError(null); setTicketsError(null);
    void getEventDetail(eventId).then(value => {
      if (!active) return;
      setEvent(value);
      if (!value) return;
      setTicketsLoading(true);
      void getEventTickets(eventId).then(lots => {
        if (active) setTickets(lots);
      }).catch(() => {
        if (active) setTicketsError("A lista de lotes está temporariamente indisponível.");
      }).finally(() => {
        if (active) setTicketsLoading(false);
      });
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar este evento.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);

  const openTicketSite = async () => {
    setLinkError(null);
    if (!await openExternalUrl(event?.ticketUrl)) setLinkError("O destino externo não está disponível ou não usa HTTP(S).");
  };
  const ticketUrl = safeExternalUrl(event?.ticketUrl);
  const mapQuery = event ? (event.latitude != null && event.longitude != null ? `${event.latitude},${event.longitude}` : [event.address, event.place, event.city].filter(Boolean).join(", ")) : "";
  const mapUrl = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : null;
  const openMap = async () => {
    setLinkError(null);
    if (!await openExternalUrl(mapUrl)) setLinkError("Não foi possível abrir a localização.");
  };

  return (
    <Screen>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/" as never)} style={styles.back} accessibilityRole="button"><Text style={styles.backText}>‹  Voltar</Text></Pressable>
      {loading && <View style={styles.loading}><ActivityIndicator color={theme.lime} /><Text style={styles.body}>Carregando evento…</Text></View>}
      {!loading && error && <View style={styles.error}><Text style={styles.title}>Não foi possível abrir</Text><Text style={styles.body}>{error}</Text></View>}
      {!loading && !error && !event && <View style={styles.empty}><Text style={styles.title}>Evento não encontrado</Text><Text style={styles.body}>O evento pode ter sido removido, ocultado ou não estar mais disponível.</Text></View>}
      {event && <>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AGENDA CENA</Text>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.date}>{dateLabel(event)}</Text>
          <Text style={styles.body}>{event.place || "Local a confirmar"} · {event.city || "Cidade a confirmar"}</Text>
          {event.address && <Text style={styles.body}>{event.address}</Text>}
          {mapUrl && <Pressable style={styles.mapButton} onPress={openMap} accessibilityRole="button"><Text style={styles.mapButtonText}>Abrir local no mapa</Text></Pressable>}
          {event.artist && <Pressable disabled={!event.handle} onPress={() => event.handle && router.push(`/artist/${encodeURIComponent(event.handle.replace(/^@/, ""))}` as never)}><Text style={styles.artist}>Por {event.artist}</Text></Pressable>}
        </View>
        {event.canceledAt && <View style={styles.cancelled}><Text style={styles.cancelledTitle}>Evento cancelado</Text><Text style={styles.body}>{event.cancelReason || "Consulte a organização para mais informações."}</Text></View>}
        {event.description && <View style={styles.description}><Text style={styles.sectionTitle}>Sobre</Text><Text style={styles.body}>{event.description}</Text></View>}
        <View style={styles.infoGrid}>
          {event.accessibility && <View style={styles.infoCard}><Text style={styles.infoLabel}>ACESSIBILIDADE</Text><Text style={styles.infoValue}>{event.accessibility}</Text></View>}
          {event.ageRating && <View style={styles.infoCard}><Text style={styles.infoLabel}>CLASSIFICAÇÃO</Text><Text style={styles.infoValue}>{event.ageRating}</Text></View>}
          {event.safeSpace && <View style={styles.infoCard}><Text style={styles.infoLabel}>CUIDADO COLETIVO</Text><Text style={styles.infoValue}>Espaço seguro informado pelo produtor</Text></View>}
        </View>
        {event.program && <View style={styles.description}><Text style={styles.sectionTitle}>Programação</Text><Text style={styles.body}>{event.program}</Text></View>}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingressos</Text>
          <Text style={styles.body}>Valores e estoque são informativos. O CENA não vende nem reserva ingressos.</Text>
          {ticketsLoading && <Text style={styles.body}>Carregando lotes…</Text>}
          {tickets.map(ticket => <TicketRow key={ticket.id} ticket={ticket} />)}
          {ticketsError && <Text style={styles.linkError}>{ticketsError}</Text>}
          {!ticketsLoading && !ticketsError && tickets.length === 0 && <Text style={styles.body}>{event.canceledAt ? "Não há lotes disponíveis para este evento cancelado." : "Nenhum lote disponível foi informado."}</Text>}
          {ticketUrl && <Pressable style={styles.cta} onPress={openTicketSite} accessibilityRole="button"><Text style={styles.ctaText}>Abrir informações externas</Text></Pressable>}
          {linkError && <Text style={styles.linkError}>{linkError}</Text>}
        </View>
      </>}
    </Screen>
  );
}

function TicketRow({ ticket }: { ticket: EventTicket }) {
  return <View style={styles.ticket}>
    <View style={styles.ticketTop}><Text style={styles.ticketName}>{ticket.name}</Text><Text style={styles.ticketPrice}>{price(ticket.price)}</Text></View>
    <Text style={styles.body}>{ticket.available ?? ticket.quantityAvailable} disponíveis</Text>
    {ticket.pixKey && <Text selectable style={styles.pix}>Chave PIX informada pelo produtor: {ticket.pixKey}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", minHeight: 38, justifyContent: "center", paddingRight: 12 },
  backText: { color: theme.lime, fontSize: 13, fontWeight: "800" },
  header: { gap: 9, paddingTop: 8 },
  eyebrow: { color: theme.coral, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: theme.text, fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -0.7 },
  date: { color: theme.lavender, fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  artist: { color: theme.lime, fontSize: 12, fontWeight: "800" },
  mapButton: { alignSelf: "flex-start", minHeight: 38, borderWidth: 1, borderColor: theme.line, borderRadius: 12, justifyContent: "center", paddingHorizontal: 12 },
  mapButtonText: { color: theme.lime, fontSize: 10, fontWeight: "800" },
  body: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  loading: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 14 },
  error: { padding: 15, borderRadius: 15, backgroundColor: theme.surface, gap: 7 },
  empty: { padding: 16, borderRadius: 15, backgroundColor: theme.surface, gap: 7 },
  description: { padding: 14, borderRadius: 14, backgroundColor: theme.surface, gap: 7 },
  section: { gap: 9 },
  sectionTitle: { color: theme.text, fontSize: 17, fontWeight: "900" },
  infoGrid: { gap: 8 },
  infoCard: { padding: 12, borderRadius: 12, backgroundColor: theme.surfaceRaised, gap: 5 },
  infoLabel: { color: theme.lavender, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  infoValue: { color: theme.text, fontSize: 11 },
  cancelled: { padding: 13, borderLeftWidth: 3, borderLeftColor: theme.coral, backgroundColor: "rgba(255,118,95,0.1)", gap: 5 },
  cancelledTitle: { color: theme.coral, fontSize: 12, fontWeight: "900" },
  ticket: { padding: 13, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, gap: 6 },
  ticketTop: { flexDirection: "row", gap: 8, justifyContent: "space-between", alignItems: "center" },
  ticketName: { flex: 1, color: theme.text, fontSize: 13, fontWeight: "800" },
  ticketPrice: { color: theme.lime, fontSize: 13, fontWeight: "900" },
  pix: { color: theme.peach, fontSize: 10, lineHeight: 15 },
  cta: { minHeight: 45, borderRadius: 13, backgroundColor: theme.lime, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  ctaText: { color: theme.background, fontSize: 12, fontWeight: "900" },
  linkError: { color: theme.coral, fontSize: 10 },
});
