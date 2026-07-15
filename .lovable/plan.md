
# Integração Meta Ads (MCP oficial) no ProAds

Este é um escopo muito grande (dezenas de arquivos, várias tabelas, OAuth completo, cliente MCP, motor de propostas/aprovação/execução/verificação, jobs, observabilidade). Vou entregar em **fases incrementais e testáveis**, não tudo de uma vez — assim você aprova cada etapa antes de seguir.

## 1. Auditoria do projeto atual

- **Frontend:** React 18 + Vite + TS + Tailwind + shadcn, rotas em `src/App.tsx` (React Router).
- **Backend:** Lovable Cloud (Supabase). Já existem Edge Functions `nanogpt-chat` e `nanogpt-video-status`.
- **Auth:** ainda **não há autenticação de usuário** implementada — o app opera em "Demo Mode" (`DemoModeContext`). Não há `auth.users` sendo usado, nem tabelas, nem RLS.
- **Secrets:** `NANOGPT_API_KEY`, `LOVABLE_API_KEY`, `SUPABASE_*` — gerenciados via `add_secret`.
- **Serviços frontend:** `src/services/index.ts` retorna dados de `src/mocks/data.ts` com `delay()` — tudo mock.
- **Páginas relevantes:** `IntegrationsPage` (cards mock genéricos), `AgentPage`, `ApprovalsPage`, `HistoryPage`, `CampaignsPage`, `DashboardPage` — todas consumindo mocks.
- **Banco:** vazio (sem tabelas, sem triggers).
- **Multitenancy:** inexistente hoje.

## 2. Bloqueios que precisam ser resolvidos ANTES

Para atender aos critérios de aceite (multitenancy, RLS, "usuário X não vê org Y", auditoria por usuário, aprovações registradas com `reviewed_by_user_id`), o app **precisa de autenticação de usuário e modelo de organizações**. Hoje isso não existe.

Além disso, para o servidor MCP oficial da Meta:

- Não existe hoje um "servidor MCP remoto oficial mantido pela Meta" com URL pública documentada por eles. O que existe publicamente são MCP servers **de terceiros** para Marketing API (ex.: `pipeboard-co/meta-ads-mcp`) que rodam local/self-hosted. **Preciso da URL do servidor MCP que você quer usar** (ou concordar em auto-hospedar um). Sem essa URL a integração não pode ser "oficial" — seria inventar endpoint, coisa que o próprio prompt proíbe.
- OAuth com Meta exige **App ID/Secret do Facebook Developers** criados por você, com `redirect_uri` server-side apontando para a Edge Function de callback.

## 3. Plano faseado proposto

### Fase 0 — Fundação (pré-requisitos)
1. Confirmar/entregar: URL do MCP Meta Ads, Meta App ID, Meta App Secret.
2. Habilitar autenticação (email/senha + Google) e criar tabelas `organizations`, `organization_members`, `user_roles` com RLS + `has_role()`.
3. Migrar a UI existente para exigir login e escopo por organização (sem quebrar Demo Mode como fallback visual).

### Fase 1 — Modelo de dados + Secrets
Migração criando: `meta_connections`, `meta_assets`, `mcp_tool_catalog`, `mcp_sessions`, `action_proposals`, `action_executions`, `audit_logs` — todas com RLS por `organization_id`, GRANTs corretos, tokens em colunas **nunca lidas pelo frontend** (acessadas só via Edge Function com service role). Adicionar secrets: `META_APP_ID`, `META_APP_SECRET`, `META_MCP_URL`, `META_TOKEN_ENCRYPTION_KEY`, `META_OAUTH_STATE_SECRET`.

### Fase 2 — OAuth Meta (server-side)
Edge Functions: `meta-oauth-start`, `meta-oauth-callback`, `meta-disconnect`, `meta-test-connection`. PKCE, state HMAC, criptografia AES-GCM de tokens, allowlist de redirect. UI: botão "Conectar Meta" em `IntegrationsPage` (substitui o card mock). Sem token no frontend.

### Fase 3 — Cliente MCP (Streamable HTTP)
Edge Function `meta-mcp-gateway` com módulo `MetaMcpClient`: initialize → notifications/initialized → tools/list → cache do catálogo em `mcp_tool_catalog` com `schema_hash` e `risk_level` classificado server-side por allowlist (não pelo modelo). Tela "Capacidades MCP" em Integrações.

### Fase 4 — Leitura (Risco 0)
Endpoints tipados: `/meta/ad-accounts`, `/meta/campaigns`, `/meta/campaigns/:id/insights`. Adaptadores `mcp*ToProAds*`. Dashboard e página Campanhas passam a ler dados reais quando houver conexão, mantendo estados: carregando / vazio / erro / permissão insuficiente / reconexão. Demo Mode continua isolado.

### Fase 5 — Propostas + Aprovação humana
Endpoints `action-proposals` (create/list/approve/reject/execute). Chat do agente cria proposta em vez de executar. Página Aprovações mostra diff (estado atual re-consultado no MCP), impacto, risco, agente, botões aprovar/rejeitar/editar.

### Fase 6 — Execução + Verificação + Auditoria
`meta-execute-action` com idempotency_key, re-fetch antes de aplicar, re-fetch depois para confirmar, invalida aprovação se estado mudou, registra `action_executions` + `audit_logs`. Guardrails server-side (limites de orçamento, ações destrutivas bloqueadas).

### Fase 7 — Jobs, observabilidade, hardening
Cron (`pg_cron` + `pg_net`): health-check 15min, refresh catálogo diário, verificação de execuções pendentes. Logs estruturados com `request_id`/`trace_id`. Tela Diagnóstico. Defesas anti-prompt-injection e SSRF (allowlist de hosts MCP).

## 4. Riscos e limitações honestas

- Sem URL oficial confirmada do MCP Meta, Fases 3+ ficam bloqueadas.
- Sem autenticação real hoje, os critérios de multitenancy e "não vazar dados entre orgs" **não podem** ser atendidos até a Fase 0 concluir.
- O escopo total ~ 40+ arquivos novos, 7+ tabelas, 8+ Edge Functions. Vai levar várias interações — não é uma entrega monolítica.
- Nada de dados reais alterados durante desenvolvimento; toda escrita começa desabilitada por política (`META_DEFAULT_WRITE_MODE=approval_required`, `META_ALLOW_AUTOMATIC_PUBLISH=false`).

## 5. Preciso de você para começar

Antes de a Fase 0 rodar, responda:

1. **URL do MCP Meta Ads** que devo usar (oficial da Meta, self-hosted, ou de terceiros como pipeboard). Sem isso não implemento chamadas MCP.
2. Você tem um **App na Meta for Developers** com App ID/Secret? (Se não, te oriento a criar antes da Fase 2.)
3. **Autenticação de usuários**: posso ativar email/senha + Google agora (Fase 0)? Isso é bloqueante para multitenancy.
4. Confirmo começar pela **Fase 0 + Fase 1** (auth + schema) nesta próxima rodada, sem tocar em Meta ainda?

Quando você responder esses quatro pontos, sigo com Fase 0/1 já implementando.
