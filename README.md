# ProAds Marketing OS

## Arquitetura de deploy

```
┌────────────────────────────┐     ┌──────────────────────────────────┐
│  Cloudflare Workers        │     │  Supabase (via Lovable)          │
│  Frontend estático (Vite)  │────▶│  Auth · Postgres · Storage       │
│  SPA + cache + _headers    │     │  Edge Functions (Meta, NanoGPT)  │
└────────────────────────────┘     └──────────────────────────────────┘
         ▲                                        ▲
         │ push-lovable.ps1                       │ deploy backend
         │ (GitHub sync)                          │ (Lovable Cloud)
         └──────────── Cursor edita ──────────────┘
```

| Camada | Onde roda | Responsável |
|--------|-----------|-------------|
| React / Vite / UI | Cloudflare Workers Static Assets | Cursor → GitHub → Cloudflare |
| Auth, DB, Storage, Edge Functions | Supabase `rqdrdcwnxwcfvqxukrbx` | Lovable |
| Meta OAuth / NanoGPT / wizard-preview | Supabase Edge Functions | Lovable |

Não misture secrets de servidor no Cloudflare. Variáveis `VITE_*` são públicas e entram no bundle no build.

## Desenvolvimento local

Node 20+ (22 recomendado — `.nvmrc` / `.node-version`).

```sh
cp .env.example .env   # preencha VITE_SUPABASE_*
npm ci
npm run dev
```

## Validação

```sh
npm run build
npm test
npx tsc --noEmit
npm run cf:dry-run     # empacota o Worker sem publicar
```

## Cloudflare Workers (frontend)

Configuração em `wrangler.jsonc`:

- Assets: `./dist`
- SPA: `not_found_handling = single-page-application`
- Observability ligada
- Headers em `public/_headers` (copiados para `dist` no build)

### Workers Builds (Git)

1. Cloudflare → **Workers & Pages → Create → Import a repository**
2. Repo: o mesmo do Lovable / GitHub
3. Branch de produção: `main`
4. **Build command:** `npm run build`
5. **Deploy command:** `npx wrangler deploy`
6. **Build variable:** `NODE_VERSION=22`
7. **Build variables (obrigatórias):**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

Essas duas precisam ser **build variables** (não só runtime), porque o Vite embute no JS.

### Deploy manual

```sh
npm ci
npm run cf:deploy
```

Scripts equivalentes: `cf:dev`, `cf:dry-run`, `deploy:cloudflare`.

### Domínio e Auth

Depois do primeiro deploy (`*.workers.dev` ou domínio custom):

1. Supabase → Authentication → URL Configuration  
   - Site URL = URL do Cloudflare  
   - Redirect URLs:  
     - `https://SEU_DOMINIO/auth/confirm`  
     - `https://SEU_DOMINIO/redefinir-senha`  
     - `https://SEU_DOMINIO/**` (se preferir wildcard)
2. Meta OAuth / return origin usam `window.location.origin` — passam a apontar para o Cloudflare automaticamente.

## Backend (Lovable / Supabase)

Continua no fluxo paralelo:

1. Cursor edita frontend + arquivos `supabase/`
2. `.\scripts\push-lovable.ps1` envia ao GitHub
3. Lovable aplica migrations e Edge Functions

Cloudflare **não** substitui o Supabase.

## Checklist de go-live

- [ ] `npm run cf:dry-run` ok localmente
- [ ] Worker criado no Cloudflare com Git + build/deploy commands
- [ ] Build vars `VITE_SUPABASE_*` e `NODE_VERSION=22`
- [ ] Deploy de produção ok
- [ ] Supabase redirect URLs atualizadas
- [ ] Lovable aplicou migrations (`creatives`, `organization_ai_settings`, wizard, etc.)
- [ ] Smoke: `/login`, `/wizard`, `/criativos`, Configurações de IA
