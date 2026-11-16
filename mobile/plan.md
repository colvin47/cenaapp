# Plano — CENA Mobile

## Objetivo e limites

Criar um aplicativo Android nativo com React Native e Expo — a experiência principal da CENA — mantendo o site existente como alternativa para ouvir em outros dispositivos. Não usar WebView como interface do app. Esta entrega será uma fonte Expo portátil em pasta/arquivo para ser importada no outro perfil Manus; não é um projeto Mobile gerenciado nesta sessão e não contém APK. O artefato de instalação deverá ser produzido depois no Dashboard do projeto Mobile importado.

A aplicação consultará a API pública atual do CENA por HTTPS, configurável por `EXPO_PUBLIC_CENA_API_BASE_URL` e inicialmente apontada para a origem existente. Não criará dados de teste nem fará mutations/arquivos de upload em produção. Conteúdo de demonstração deve permanecer identificado como amostra; catálogo vazio e indisponibilidade de API terão estados distintos. Detalhes públicos de eventos/artistas também poderão consultar os endpoints `scene.eventTickets` e `scene.artistMerchandise`; o app apenas informa preço/estoque e abre o destino externo, sem venda, reserva ou checkout.

O servidor atual aceita sessões Bearer, mas o OAuth existente conclui em cookie do site. Não implementar login falso, não colocar JWT em deep link e não contornar o acesso. Biblioteca pessoal, perfis autenticados, upload e moderação ficam bloqueados até a integração receber um fluxo OAuth nativo seguro com código de uso único/PKCE no backend CENA. O perfil de ouvinte continuará privado.

## Implementação e integração

Usar Expo Router, React Native, TypeScript e componentes nativos. A camada `lib/cena-api.ts` chamará as queries públicas tRPC `scene.discovery`, `scene.trackDetail`, `scene.artistDetail` e `scene.eventDetail`, usando o serializador SuperJSON compatível com o cliente Web. A origem da API será configurável, sem credenciais no bundle.

A navegação principal terá Descobrir, Agenda, Salvos e Privacidade; a busca por texto fica integrada à tela Descobrir. A descoberta permitirá cidade e gênero, apresentará estados de carregamento, erro, vazio e demonstração, e ligará itens às páginas nativas de faixa, artista e evento. Um player nativo persistente ficará disponível entre telas; deverá usar a URL exata da faixa selecionada, pausar ao fim de faixa compartilhada fora do catálogo e nunca avançar silenciosamente para uma amostra.

A etapa atual implementa apenas leitura pública e reprodução. Mutations de conta, biblioteca e upload não serão chamadas até o fluxo nativo de autenticação estar implementado e validado no backend do CENA. Dados persistentes continuam sob responsabilidade do backend existente; o app não terá banco paralelo que divida contas ou catálogo.

## Estrutura do projeto

- `app/`: rotas Expo Router para abas, descoberta e detalhes.
- `components/`: cartões de faixa/artista/evento, controles e player persistente.
- `hooks/`: consultas e estado de reprodução compartilhado.
- `lib/`: cliente tRPC, tipos de resposta, configuração de origem e helpers puros.
- `assets/images/`: ícone/splash nativos usando a identidade existente da CENA.
- `tests/`: regressões de serialização, estados vazios/demo e seleção de faixa.
- `plan.md` e `TODO.md`: decisões aceitas e resultados ainda abertos.

## Design

Reutilizar a identidade visual da CENA existente; não rebatizar o produto nem copiar a interface Web para um WebView.

- **Movimento:** editorial de fanzine musical independente com acabamento de app de player contemporâneo.
- **Princípios:** descoberta local em primeiro plano; controles confortáveis para uma mão; conteúdo real nunca confundido com amostra; áudio sempre sob controle explícito da pessoa.
- **Filosofia de cor:** fundo ameixa quase preto (`#050507`), superfícies escuras e texto creme para leitura noturna; lima (`#C8F36A`) marca descoberta e ação; coral (`#FF765F`) sinaliza novidade/ao vivo; lavanda é acento secundário.
- **Paradigma de layout:** fluxo vertical de descoberta, filtros horizontais curtos e player fixo inferior; sem dashboards centralizados nem grade de cartões como estrutura dominante.
- **Elementos assinatura:** barras de onda verticais do logo, detalhe de canto assimétrico e selo de cidade/estado.
- **Interação:** alvos táteis grandes, busca clara, filtros de toque rápido, play/pause previsível e nenhum autoplay escondido.
- **Animação:** transições curtas e discretas; pulso de onda somente durante playback; respeitar redução de movimento e não atrasar resposta dos controles.
- **Tipografia:** sistema sans-serif nativo para texto e metadados; títulos grandes e compactos com peso alto, hierarquia curta para telas pequenas.
- **Essência:** música independente de cada cidade, direto no bolso de quem escuta e de quem faz; personalidade curiosa, direta e próxima.
- **Voz:** headlines e microcopy curtas, brasileiras e locais. Exemplos: “O som daqui, sem pedir licença.” / “Ainda não tem faixa publicada nesta cidade.”
- **Wordmark/ícone:** manter o símbolo de barras verticais da CENA e o ponto coral; gerar ícones quadrados sem cantos arredondados embutidos e preservar as referências de marca no `app.config.ts`.
- **Cor proprietária:** lima CENA `#C8F36A`.

## Handoff e build

Entregar fonte portátil e instruções de importação, sem segredo, banco, uploads reais ou artefato de build. Após importação em um projeto Manus Mobile Expo do outro perfil, validar Preview/Expo Go; então salvar checkpoint e solicitar o build Android no Dashboard. Só afirmar APK pronto depois do resultado real desse build. O site CENA existente permanece intacto.
