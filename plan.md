# Plano — Cena

## Escopo de implementação
O produto é mobile-first: o app Android nativo em Expo/React Native é a experiência principal para descoberta, reprodução e agenda; o site responsivo/PWA é complementar, oferecendo presença pública, administração artística e acesso via navegador. Ambos consomem a mesma API Express/tRPC e o mesmo banco MySQL. O app atual é deliberadamente público/leitor: autenticação nativa e mutações de usuário ficam fora desta fase, enquanto uploads, edição do catálogo, perfis e agenda permanecem no site. O MVP prioriza descoberta regional, player persistente, perfil de artista/banda, upload com declaração de direitos e eventos.

## Direção visual
Três caminhos considerados: **A. Pós-punk caloroso de bairro** (0,07): preto azulado, coral queimado, adesivos e recortes de cartaz. **B. Rádio comunitária editorial** (0,06): marfim, vinho e tipografia de jornal, com foco em agenda. **C. Noite neon da cena local** (0,08): fundo ameixa, lima elétrica, lavanda e cartões de capa como fitas de palco. Escolha: **C**, por equilibrar energia de streaming com calor de cena independente.

- **Movimento:** neo-brutalismo suave com referências de flyers de show, capas de fita e interfaces de rádio pirata.
- **Princípios:** a cidade aparece em primeiro lugar; capas e rostos têm protagonismo; ações principais são imediatas; densidade editorial sem parecer dashboard.
- **Filosofia de cor:** ameixa quase preta para criar uma noite acolhedora; lima como assinatura de descoberta e “ao vivo”; coral para presença humana e urgência de show; lavanda para navegação e estados selecionados.
- **Paradigma de layout:** trilho lateral no desktop, navegação inferior no mobile e seções horizontais que lembram uma banca de discos; o conteúdo principal alterna blocos largos e listas compactas, evitando uma grade centralizada genérica.
- **Elementos assinatura:** palavra-marca “CENA.” com ponto fluorescente; chips de cidade com ícone de sinal; cartões de evento com data destacada em bloco de cor.
- **Interação:** tocar uma música deve ser instantâneo e nunca tirar o usuário da tela; seguir, interessar-se e salvar têm resposta visual curta; filtros preservam contexto regional.
- **Animação:** entrada por fade/slide de 160–220ms; capas em hover ganham escala 1,03 e brilho; player usa pulsação discreta quando tocando; nada deve competir com a leitura.
- **Tipografia:** Geist/Inter para interface e títulos utilitários; serif editorial opcional para chamadas de agenda. Hierarquia com títulos grandes, labels em caixa alta e metadados compactos.
- **Essência:** “o som da sua cidade, feito por quem vive nela”; personalidade: próxima, elétrica, generosa.
- **Voz:** direta, local e convidativa. Exemplos: “A cidade tem som novo.” e “Chegue antes do refrão.”
- **Wordmark:** CENA. em caixa alta com ponto lima como sinal de atividade; ícone auxiliar formado por três barras de equalizador irregulares.
- **Cor proprietária:** Lima Cena `#c8f36a`.

## Arquitetura
- `client/src/App.tsx`: shell responsivo, navegação, estado de telas, modal de login e player persistente.
- `client/src/pages/Home.tsx`: experiência principal e componentes de descoberta, perfil, busca, eventos, biblioteca e upload em um fluxo navegável de MVP.
- `mobile/`: app Android Expo Router/React Native, que consome as consultas públicas da API CENA e apresenta descoberta, reprodução, eventos, tickets informativos e merchandise.
- `client/src/index.css`: tokens de cor, tipografia, layout desktop/mobile, player e componentes editoriais.
- `client/public/`: manifesto PWA, service worker, manifest de rotas e assets demonstrativos.
- `drizzle/schema.ts`, `server/db.ts`, `server/routers.ts`: tabelas e contratos iniciais para artistas, faixas, eventos, playlists e follows, com procedimentos públicos/protegidos básicos.

## Construção e publicação
1. Configurar assets, manifesto PWA e metadata de projeto.
2. Implementar a shell e o fluxo visual principal com dados seed fictícios de Campinas, SP.
3. Adicionar schema Drizzle e endpoints tRPC para leitura do usuário e mutações de demonstração.
4. Iniciar o servidor na porta gerenciada, validar `manus-routes.json`, checar TypeScript e build web e nativo.
5. Publicar o servidor/site pelo projeto Webdev e gerar APK pelo Dashboard Expo/EAS após vincular o app a uma conta autorizada; não gerar APK no Sandbox.

## Ciclo 2 — Cena underground brasileira
O segundo ciclo transforma o MVP de streaming regional em infraestrutura de cena para punk, hardcore, hip hop e derivados alternativos. A implementação será incremental e compatível com o banco atual: preservar entidades existentes, adicionar campos e tabelas para perfis de coletivo, créditos, apoio direto, tipos/contexto de evento e denúncias; atualizar discovery/seed para representar a cena; e tornar upload, player e ações comunitárias coerentes.

### Entregas de produto
- Corrigir fonte de verdade da duração: metadata lida no upload e player/card sincronizados; ao trocar de cidade, explicar ou limpar a fila anterior sem misturar contexto.
- Substituir o seed genérico por catálogo fictício de Campinas com punk, hardcore, rap, grime, post-hardcore, emo, beatmaker, DJ, selo, batalha de rima, cypher, show DIY e feira de zines.
- Expandir perfis para banda, MC, produtor, coletivo e selo, com manifesto, membros e links de apoio (Pix, merch, Bandcamp, vaquinha).
- Registrar créditos de faixa e formatos demo, ao vivo, split e compilação.
- Expandir eventos com tipo cultural, gratuidade/contribuição, acessibilidade, espaço seguro e descrição de programação.
- Adicionar descoberta contextual, rotas de circulação, compilação coletiva e atividade de cena.
- Adicionar denúncia básica de conteúdo/perfil/evento, bloqueio de publicação e feedback de moderação.
- Manter regras de direitos autorais, isolamento por cidade e autorização no servidor.

### Estrutura
- `shared/scene-seed.ts`: catálogo underground demonstrativo e tipos de cena.
- `drizzle/schema.ts`: colunas de perfil/apoio, créditos, contexto de eventos e denúncias.
- `server/db.ts` e `server/routers.ts`: persistência, autorização, discovery contextual e moderação.
- `client/src/pages/Home.tsx`: cards, formulários, estúdio, perfil público e player coerentes com o novo domínio.
- `client/src/index.css`: badges, créditos, apoio, contexto de evento e estados de moderação.


## Ciclo 3 — cobertura nacional
A localização deixa de ser uma lista fixa de cidades paulistas. O cliente consulta a lista oficial de municípios do IBGE, exibe município com UF e reutiliza o mesmo campo em descoberta, cadastro de ouvinte, perfil de artista, upload e agenda. O backend preserva a cidade como texto normalizado para manter compatibilidade com o banco existente; cidades sem dados persistidos exibem vazio regional, sem fallback indevido para Campinas. O caso de validação prioritário é Porto Alegre, RS.


## Ciclo 7 — app móvel como experiência principal
A direção aprovada pelo usuário é aproximar o CENA de um serviço mobile-first de música: o app Android é a experiência principal para descobrir, ouvir e acompanhar a cena; o site é um complemento para navegação pública e gestão dos projetos artísticos. O app deve consultar a API existente, sem criar um segundo banco, duplicar uploads ou inventar um sistema de compra. Tickets e merchandise são informativos e encaminham para a produção/destino externo; a CENA não processa pagamentos nem reservas. Endereço e coordenadas de evento são opcionais e aparecem publicamente somente quando o organizador informa. A distribuição de APK instalável depende de compilação remota no Expo/EAS Dashboard; a fonte/configuração não equivalem a um APK gerado, e a migration do servidor precisa ser aplicada no ambiente de destino mediante revisão operacional.
