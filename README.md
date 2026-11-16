# CENA — o som da sua cidade

Plataforma brasileira para descobrir e fazer circular música independente por cidade. O projeto reúne catálogo musical, perfis de artistas, agenda de eventos, playlists e reprodução de faixas.

## Tecnologias

- **Frontend:** React, TypeScript e Vite.
- **Backend:** Node.js, Express e tRPC.
- **Dados:** MySQL com Drizzle ORM e migrations versionadas.
- **Autenticação e arquivos:** Manus OAuth e armazenamento do projeto.
- **Build de produção:** Dockerfile na raiz; Node 22 e pnpm 10.18.0.

## Desenvolvimento local

Requisitos: Node.js 22 e Corepack habilitado.

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

O servidor de desenvolvimento usa a porta 3000 por padrão e respeita a variável `PORT`.

Comandos úteis:

```bash
pnpm check       # verificação TypeScript
pnpm test        # testes automatizados seguros
pnpm build       # build de frontend e servidor
pnpm start       # inicia o build de produção
pnpm db:migrate  # aplica migrations no banco configurado
```

`pnpm db:migrate` e `pnpm db:push` alteram o banco conectado. Não os execute contra produção sem autorização, revisão e backup. Testes de integração que escrevem dados devem usar um banco isolado por `TEST_DATABASE_URL`.

## Estrutura do repositório

- `client/`: aplicação React, páginas, componentes e estilos.
- `server/`: API Express/tRPC, autenticação, regras de acesso e consultas.
- `shared/`: tipos e regras compartilhadas entre cliente e servidor.
- `drizzle/`: schema e migrations do banco.
- `public/`: manifesto, rotas e arquivos públicos.
- `mobile/`: app Android Expo/React Native, consumidor da API CENA e configuração remota APK/AAB.
- `scripts/`: rotinas de manutenção.
- `Dockerfile`: build e inicialização do servidor em produção.
- `docs/`: documentação de operação e publicação.

## App Android principal e site complementar

O app Android, em `mobile/`, é o ponto principal de descoberta e reprodução. O site continua como complemento público e área de gestão para artistas; ambos usam a mesma API CENA e o site permanece acessível em `https://cenaapp-rgtrg8wt.manus.space`.

O repositório [`diego47colvin-debug/cena`](https://github.com/diego47colvin-debug/cena) guarda o código, mas o backend Express/tRPC e o banco MySQL precisam continuar em um ambiente de servidor. O workflow atual de GitHub Pages não executa esse backend; um push ao GitHub não atualiza, por si só, o site publicado. A configuração `mobile/eas.json` prepara um perfil remoto `preview` para APK, mas o APK só existe depois que a compilação é executada no Dashboard Expo/EAS ligado à conta correta.

Veja [`docs/publicacao.md`](docs/publicacao.md) antes de publicar. Migrations são versionadas no repositório; não rode `pnpm db:migrate` ou `pnpm db:push` contra o banco compartilhado sem a autorização/revisão operacional correspondente.

## Segurança

Não envie arquivos `.env`, senhas, tokens, chaves, dados de usuários ou arquivos de produção para o Git. Configure segredos no ambiente de hospedagem. Revise cada migration e cada mudança de schema antes de aplicá-la ao banco de produção.
