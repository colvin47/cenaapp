# TODO — Cena
## Entregue no ciclo 1
- [x] Shell responsivo escura, navegação desktop/mobile, player persistente e PWA.
- [x] Login Manus OAuth com escolha de ouvinte ou artista/banda.
- [x] Descoberta regional, busca, filtros de cidade/gênero e estados de catálogo vazio/indisponível.
- [x] Player com play/pause, próxima, anterior, progresso e fila.
- [x] Perfil de artista, upload com declaração de direitos e agenda de eventos.
- [x] Playlists, follows, interesse em eventos, faixas salvas, notificações e métricas iniciais.
- [x] Banco gerenciado, storage de áudio/imagem, autorização server-side e manifest PWA/rotas.
## Ciclo 2 — Produto de cena underground
### Catálogo e descoberta contextual
- [x] O catálogo seed deve representar Campinas com punk, hardcore, rap, grime, post-hardcore, emo, beatmaker e DJ, além de demo, faixa ao vivo, split e compilação.
- [x] A descoberta deve comunicar por que uma faixa apareceu, oferecer filtros de subgênero/formato e apresentar rotas de circulação, compilações e atividade de coletivos.
- [x] A busca deve aceitar artista, banda, MC, produtor, beatmaker, selo, coletivo, faixa, gênero e cidade sem misturar cidades sem aviso.
### Perfis, coletivos e apoio direto
- [x] O perfil deve identificar se é banda, MC, produtor, DJ, coletivo ou selo e exibir manifesto, membros, créditos relacionados e agenda.
- [x] O artista/coletivo deve poder informar links de Pix, merch, Bandcamp, vaquinha e redes; o perfil público deve oferecer esses apoios sem anúncios.
- [ ] O modelo deve permitir associar membros e créditos de vocal, beat, produção, gravação, mixagem, masterização, arte, foto e vídeo.
### Upload, direitos e player
- [x] O upload deve aceitar e exibir formato single, demo, ao vivo, split ou compilação; a declaração de direitos continua obrigatória.
- [x] A duração deve ser obtida do metadata do áudio no upload e ser a mesma no card, player, histórico e métricas.
- [x] Ao trocar de cidade, o player deve explicar a permanência da fila anterior ou limpar a fila, sem sugerir mistura do catálogo regional.
- [x] Falhas de upload devem ter retry seguro, limpeza best-effort, estado de processamento e publicação idempotente.
### Agenda e circulação
- [x] O artista deve criar eventos do tipo show, batalha, cypher, roda cultural, festival DIY, ocupação, feira de zines, workshop, listening party ou lançamento.
- [x] O evento deve suportar entrada gratuita/contribuição, acessibilidade, espaço seguro, classificação e programação/participantes.
- [ ] A agenda deve oferecer rotas de circulação, casas/espaços, selos e coletivos relacionados, além de interesse, calendário e compartilhamento.
- [x] Exclusão deve ser substituída por cancelamento notificável aos interessados.
### Comunidade e segurança
- [x] Usuários devem poder denunciar faixa, perfil ou evento; o servidor deve registrar motivo, status e referência.
- [ ] O sistema deve permitir bloquear conteúdo denunciado e comunicar retorno básico de moderação.
- [ ] Playlists colaborativas devem exibir contribuição de cada usuário e compilações podem reunir faixas de vários artistas.
- [x] O produto deve comunicar regras contra assédio, racismo, LGBTfobia e violência e oferecer espaços seguros.
### Qualidade e validação
- [ ] Completar testes de autorização, isolamento por cidade, upload, duração, biblioteca, playlists, eventos, denúncias e cancelamentos.
- [x] Validar build, TypeScript, migração, health check, `manus-routes.json`, manifesto PWA e fluxo público depois do ciclo.
- [ ] Login autenticado no Chrome/My Browser ainda precisa ser validado com a sessão do navegador conectada; o Preview Sandbox continua deslogado por padrão.
## Pré-lançamento
- [x] Rotas públicas de termos de uso, privacidade, regras da comunidade, direitos autorais e contato/suporte foram adicionadas ao app.
- [x] O documento único `HANDOFF_CENA.md` registra checkpoint, arquitetura, comandos, validações, pendências e roteiro do primeiro piloto.
- [ ] Substituir o texto de canal de contato do piloto pelo e-mail oficial e revisar os documentos com a pessoa responsável pelo projeto antes da abertura pública.
- [x] Administradores podem criar notificações personalizadas com título, mensagem e link opcional; o aviso é persistido para todas as contas e aparece no centro de notificações.
## Ciclo 3 — cobertura nacional
- [x] Descoberta e formulários usam busca de municípios brasileiros via API oficial do IBGE, aceitando cidade com UF como `Porto Alegre, RS` e sem restringir o app a São Paulo.
- [x] A cidade escolhida é reaproveitada no filtro regional, cadastro de ouvinte, perfil de artista, upload e criação de eventos; cidades sem catálogo mostram estado vazio sem misturar seed de Campinas.

## Ciclo 4 — utilidade real, confiabilidade e acessibilidade
- [x] A home deve diferenciar curadoria, catálogo ao vivo, demonstração e indisponibilidade; não deve afirmar personalização quando não houver sinais reais.
- [x] Estados vazios de catálogo e agenda devem orientar a próxima ação, mostrar a cidade escolhida e permitir continuar explorando sem parecer uma falha silenciosa.
- [x] A busca deve ser tolerante a acentos, preservar a cidade ativa, incluir faixas, artistas e eventos e oferecer uma saída clara quando não houver resultado.
- [x] O player deve informar carregamento, ausência de áudio e erro de reprodução com recuperação manual; a posição e a fila continuam persistidas localmente.
- [x] Imagens informativas devem ter texto alternativo; controles clicáveis devem ter foco visível, nomes acessíveis e alvos confortáveis no Android.
- [x] A troca de cidade deve persistir no dispositivo e nunca misturar silenciosamente filas de cidades diferentes.
- [x] O upload deve comunicar etapas, limites, leitura técnica, retry idempotente e limpeza best-effort sem perder a declaração de direitos.
- [x] Validar TypeScript, testes, build, manifesto/rotas e publicação após as alterações.

## Ciclo 5 — piloto funcional para artistas
- [ ] O banco gerenciado deve conter `tracks.sourceType` e `tracks.externalUrl`, alinhados ao schema e ao fluxo de links externos, sem alterar dados existentes.
- [ ] A descoberta pública deve responder HTTP 200 para Campinas e para cidades nacionais sem catálogo, e a interface deve separar indisponibilidade técnica de catálogo vazio.
- [ ] O domínio oficial deve ser usado no canonical e nas prévias de compartilhamento.
- [ ] O fluxo publicado deve permitir validar autenticação, criação/edição de perfil, upload ou link externo, publicação e aparição pública sem quebrar player, agenda, biblioteca ou notificações.


## Ciclo 6 — perfil central e publicação visível
- [x] A página `/perfil` deve apresentar uma visão geral permanente, com nome, cidade, tipo de conta, status, edição e compartilhamento.
- [x] O perfil de artista/banda deve exibir métricas, bio, atividade, faixas publicadas, próximos eventos e botão destacado para enviar nova faixa.
- [x] O perfil de ouvinte deve exibir cidade, bio, gêneros, artistas seguidos, faixas salvas, playlists, eventos de interesse e edição do perfil.
- [x] O catálogo próprio do artista deve ser consultado sem depender da cidade ou gênero selecionados na Home.
- [x] Depois do upload, o fluxo deve atualizar o catálogo próprio e levar o artista ao perfil, onde a faixa publicada pode ser tocada diretamente.
- [ ] Publicar a versão integrada no projeto do site público informado pelo usuário (`https://cenaapp-rgtrg8wt.manus.space`); o vínculo Webdev está indisponível para a identidade atual da sessão e requer acesso autorizado.


## Ciclo 7 — app Android principal e site complementar
- [x] “A ideia é transformar o projeto; o ideal é criar um app e o site ser um auxiliar do app, assim como o Spotify.” O plano e a documentação passam a tratar o app Android como experiência principal e o site responsivo como complemento público e de gestão artística.
- [x] O app Expo permanece em `mobile/`, consulta a API CENA existente e não cria outro banco, sistema de contas, uploads ou compras.
- [x] Eventos aceitam endereço e coordenadas opcionais; organizadores capturam a localização deliberadamente, e o app/site oferecem acesso ao mapa quando o ponto existe.
- [x] O estúdio do site cadastra produtos e lotes de ingresso; app e site exibem preço/estoque e destinos externos sem checkout/reserva dentro da CENA.
- [x] `mobile/eas.json` define perfil remoto `preview` para APK instalável e `production` para AAB; checks TypeScript, testes do site e builds web passaram nesta cópia.
- [ ] Aplicar a migration `drizzle/0015_cena_mobile_commerce_analytics.sql` no banco do ambiente Webdev após revisão operacional. Ela foi gerada localmente, não executada neste trabalho.
- [ ] Publicar o backend/site atualizado no domínio informado pelo usuário; o projeto Webdev correspondente não pôde ser vinculado à identidade atual da sessão.
- [x] Vincular o app a uma conta/projeto Expo/EAS autorizado e concluir um build Android `preview`; o APK atualizado está registrado no ciclo 8.

## Ciclo 8 — correções funcionais e QA offline
- [x] O player web permanece visível ao pausar e provedores de página não são tratados como streams diretos; eventos têm conversão local de horário, navegação ao detalhe, consentimento explícito para geolocalização e estados distintos de carregamento/erro/vazio.
- [x] O backend preserva campos de localização omitidos em PATCH, permite removê-los explicitamente em par, valida faixa/centavos e só conta plays elegíveis (públicos, publicados, não removidos e liberados).
- [x] O app Expo rejeita origem HTTP remota, só encaminha áudio direto validado ao player, evita perder favoritos durante hidratação e retorna ao início em deep links sem histórico.
- [x] `scripts/qa-offline.sh` valida site/backend/app sem acessar APIs ou banco publicados; 36 testes web/backend e 7 testes mobile passaram nesta cópia.
- [x] Gerar o APK `preview` atualizado para o commit `774b469` (build EAS `9736622f-44ec-44e9-85a0-0f1f7c5edbfc`); distribuir pelo artefacto oficial Expo.
- [ ] Publicar backend/site e aplicar a migration após vincular o projeto Webdev correto e validar o histórico/schema real do banco; nenhum dado ou serviço publicado foi alterado nesta rodada.
