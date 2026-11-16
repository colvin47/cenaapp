# QA offline do CENA

## Como executar

Na raiz do repositório, rode:

```bash
bash scripts/qa-offline.sh
```

O script executa typecheck e build do site/backend, testes unitários dos dois projetos, validação da configuração Expo e checagem estática das migrations. Ele remove `TEST_DATABASE_URL` do processo e exclui deliberadamente testes de integração que gravam no MySQL. Os testes do app substituem `fetch` por mocks; não chamam a API do CENA.

## Escopo validado nesta rodada

Na branch `feat/native-first-app-commerce`, as verificações executadas passaram:

- Site/backend: TypeScript, build de produção, Vitest — 36 testes unitários passaram; 2 testes de integração de convites ficaram ignorados.
- App Expo: TypeScript, configuração Expo e Vitest offline — 7 testes passaram.
- Drizzle: `drizzle-kit check` passou sem conexão à base.
- `git diff --check` passou.

O build web ainda informa dois avisos não bloqueantes: o script `/api/platform/config.js` não pode ser empacotado sem `type="module"` e o chunk principal minificado excede 500 kB.

## Melhorias funcionais cobertas

Foram corrigidos e/ou cobertos: player web que desaparecia ao pausar; encaminhamento indevido de URLs de páginas externas para players de áudio; conversão de horário local em edição de evento; consentimento explícito antes de usar a posição atual do dispositivo como local do evento; navegação dos cartões de evento para detalhes; estados de carregamento/erro/vazio e atualização de lotes; falha de sessão distinguida de usuário anônimo; validação de preço e coordenadas; preservação de endereço/coordenadas omitidos e limpeza explícita em PATCH; filtro de faixa privada/não publicada nos analytics; favoritos durante a hidratação local; validação de URLs HTTPS do app; retorno de deep link sem histórico.

## Limites antes de atualizar o site/base publicada

A migration `0015_cena_mobile_commerce_analytics.sql` foi corrigida para não repetir DDL das migrations anteriores, mas **não foi aplicada nem testada contra o schema da base publicada**. Antes de publicar o backend, é necessário consultar o histórico de migrations e comparar o schema real do ambiente. Se uma versão anterior da 0015 tiver sido parcialmente executada, não reaplique cegamente o arquivo corrigido: reconcilie o banco primeiro.

Os testes que alteram dados foram deixados de fora. Os 2 testes MySQL de convites devem ser executados somente em uma base descartável isolada, com `TEST_DATABASE_URL` que não aponte para produção. O APK/emulador Android, codecs do aparelho, navegação nativa e persistência real não foram testados nesta rodada.

## Roteiro manual recomendado em homologação isolada

1. **Descoberta e player:** testar carregamento, erro, vazio, pausar/retomar, fila e uma fonte de áudio direto; confirmar que Spotify/YouTube/Bandcamp/SoundCloud abrem como links externos e não como arquivo de áudio.
2. **Eventos:** criar/editar evento de teste, verificar horário antes/depois de abrir e salvar, endereço, coordenadas completas, confirmação de geolocalização e navegação cartão → detalhe → mapa.
3. **Ingressos e produtos:** criar lote/produto de teste, verificar atualização imediata, preço com até duas casas, preço gratuito, estoque zero e estados erro/vazio. Não abrir checkout real.
4. **Permissões e API:** testar artista dono, artista diferente, usuário ouvinte e visitante anônimo; verificar faixas públicas/privadas/não publicadas e eventos cancelados.
5. **Android:** em emulador/dispositivo de homologação, testar favoritos após reiniciar, deep link com retorno à aba raiz, links externos, áudio em segundo plano, controles de tela bloqueada, teclado, safe areas e leitor de tela.

Não use dados reais de ingressos ou pagamentos durante a homologação.
