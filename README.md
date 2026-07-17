# ProAds Marketing OS

Aplicação React/Vite do ProAds. O frontend é estático e está preparado para
Cloudflare Workers Static Assets. Autenticação, banco, Storage e Edge Functions
continuam no Supabase.

## Desenvolvimento

Requisitos: Node.js 20 ou superior (Node 22 recomendado).

```sh
npm ci
npm run dev
```

Crie o arquivo `.env` a partir de `.env.example` e informe:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Validação

```sh
npm run build
npm test
npx tsc --noEmit
```

## Cloudflare Workers

O arquivo `wrangler.jsonc` publica a pasta `dist` como Static Assets e configura
fallback nativo de SPA. Assim, rotas como `/dashboard`, `/campanhas/:id` e
`/wizard` continuam funcionando quando abertas diretamente.

### Git integration / Workers Builds

1. No Cloudflare, escolha **Workers & Pages → Create → Import a repository**.
2. Selecione este repositório e mantenha a branch de produção `main`.
3. Use `npm run build` como comando de build.
4. Use `npx wrangler deploy` como comando de deploy.
5. Configure `NODE_VERSION=22`.
6. Cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente
   de build.

O output é `dist`. O nome inicial do Worker é `proads-marketing-os` e pode ser
alterado em `wrangler.jsonc` antes da primeira publicação.

### Publicação manual

```sh
npm ci
npm run deploy:cloudflare
```

O arquivo `public/_headers` adiciona cabeçalhos de segurança e cache imutável
para os assets versionados pelo Vite.

## Backend

Cloudflare hospeda somente o frontend. As migrations e funções em `supabase/`
devem ser publicadas no projeto Supabase separadamente. Nenhuma chave secreta de
servidor deve ser cadastrada como variável `VITE_*`.
