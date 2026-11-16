import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { theme } from "@/components/theme";
import { CENA_API_BASE_URL } from "@/lib/cena-api";

const items = [
  { title: "Sem perfil público de ouvinte", body: "O app não cria nem publica perfil, identidade, cidade, favoritos ou atividade de escuta de ouvinte." },
  { title: "Cidade escolhida por você", body: "A cidade é digitada manualmente e guardada neste aparelho. O app não solicita GPS nem localização em segundo plano." },
  { title: "Busca anônima", body: "Ao buscar catálogo, o app envia a cidade e os filtros ao endpoint público do CENA. Não envia ID de usuário, lista de favoritos ou histórico de reprodução." },
  { title: "Biblioteca no aparelho", body: "Faixas salvas são mantidas no armazenamento local do app e não são sincronizadas com sua conta CENA nem compartilhadas. A transferência ou restauração dos dados do aparelho depende das configurações do sistema Android." },
  { title: "Sem microfone ou upload", body: "O app transmite faixas publicadas; não grava áudio, não acessa microfone e não faz upload nesta versão." },
  { title: "Compras fora do app", body: "Ingressos e merchandise são apenas informativos. Links externos podem abrir o site do artista ou produtor; CENA não recebe pagamento ou reserva." },
];

export default function PrivacyScreen() {
  return (
    <Screen>
      <View style={styles.header}><Text style={styles.eyebrow}>CONTROLE É PARTE DA ESCUTA</Text><Text style={styles.title}>Sua escuta é sua.</Text><Text style={styles.subtitle}>Sem perfil público de ouvinte. Você usa o catálogo sem entregar sua biblioteca.</Text></View>
      {items.map(item => <View key={item.title} style={styles.item}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.body}>{item.body}</Text></View>)}
      <View style={styles.endpoint}><Text style={styles.endpointLabel}>ORIGEM DO CATÁLOGO</Text><Text style={styles.endpointValue} selectable>{CENA_API_BASE_URL}</Text></View>
      <Text style={styles.footer}>Para alterar a origem da API, configure EXPO_PUBLIC_CENA_API_BASE_URL no perfil que importar este projeto.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, marginBottom: 2 },
  eyebrow: { color: theme.coral, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: theme.text, fontSize: 29, fontWeight: "900", letterSpacing: -0.7 },
  subtitle: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  item: { padding: 14, gap: 5, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface },
  itemTitle: { color: theme.lime, fontSize: 12, fontWeight: "900" },
  body: { color: theme.text, fontSize: 11, lineHeight: 17 },
  endpoint: { padding: 13, gap: 6, borderRadius: 13, backgroundColor: theme.surfaceRaised },
  endpointLabel: { color: theme.lavender, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  endpointValue: { color: theme.text, fontSize: 10 },
  footer: { color: theme.muted, fontSize: 10, lineHeight: 15, textAlign: "center" },
});
