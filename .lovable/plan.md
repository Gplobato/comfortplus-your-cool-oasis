# Auditoria da integração Meta Ads

## 1. Causa raiz

O OAuth, `meta_connections` e `meta_assets` funcionam. Mas **nenhuma tela além de `/integracoes` consulta esses dados**. Não existe:

- fonte de verdade compartilhada da integração Meta;
- endpoint de dashboard/campanhas que consulte a Marketing API;
- normalização de IDs (`act_` vs external_id);
- persistência utilizada pelas demais páginas.

Cada página tem seu próprio estado local baseado em `demoMode` + mocks de `src/mocks/data.ts`.

## 2. Arquivos envolvidos (estado atual)

| Área | Arquivo | Fonte de dados hoje |
|---|---|---|
| Conexão OAuth | `supabase/functions/meta-oauth-start`, `meta-oauth-callback` | OK — grava `meta_connections` + `meta_assets` |
| Gerência da conexão | `supabase/functions/meta-connection` | OK — status/select_account/test/disconnect |
| Página Integrações | `src/pages/proads/IntegrationsPage.tsx` (`MetaCard`) | Chama `meta-connection?action=status` — **única página real** |
| Visão Geral | `src/pages/proads/DashboardPage.tsx` | Mock `analyticsService` + string hard-coded "Não conectada" |
| Campanhas | `src/pages/proads/CampaignsPage.tsx` | Mock `campaignService.list()` |
| Agente IA | `AgentPage.tsx` + `nanogpt-chat` | Não recebe contexto Meta |
| Estado global | Não existe hook/contexto de integração Meta | — |

## 3. Divergências encontradas

1. **Seletor da Dashboard** é decorativo — usa `demoMode`, não consulta `meta_connections`.
2. **`Atualizar`** apenas re-executa mock; **`Sincronizar CRM`** é `setTimeout` puro.
3. **IDs**: `meta_assets.external_id` já vem como `act_123` do OAuth callback, mas nenhum consumidor normaliza; helpers inexistentes.
4. **Cache/React Query**: `queryClient` existe mas não é usado nas páginas problemáticas.
5. **Conexão "ativa"** só considera `status='active'` — não valida existência de asset `selected`.
6. **Nenhum endpoint de dashboard/insights/campaigns** consulta Graph API.

## 4. Endpoints faltantes

- `GET meta-integration/status` (unificado com o formato pedido no item 5 do briefing)
- `GET meta-dashboard` (insights de conta + série temporal)
- `GET meta-campaigns` (lista de campaigns/adsets/ads)
- `POST meta-sync` (materializa último snapshot; hoje inexistente)

## 5. Plano de correção (steps 1–7 do briefing)

### 5.1 Backend — nova edge function `meta-integration`
Consolida status enriquecido. Retorna o payload do briefing (§5) incluindo `selected_ad_account`, `token_status`, `data_source`, `requires_account_selection`.

### 5.2 Backend — helpers compartilhados
`supabase/functions/_shared/meta-ids.ts` com:
- `normalizeMetaAdAccountId(x)` → sem prefixo
- `toGraphAdAccountId(x)` → com `act_`
- `getActiveSelection(admin, orgId)` → `{ connection, token, account }` ou erro tipado

### 5.3 Backend — `meta-dashboard`
`GET ?organization_id&date_from&date_to&campaign_status` → chama Graph `act_<id>/insights` (fields: spend, impressions, reach, clicks, ctr, cpc, cpm, frequency, actions) e `act_<id>/campaigns?fields=effective_status` para contagem ativa. Series por dia com `time_increment=1`. Métricas ausentes → `null` (não zero forçado). Valida ownership do account.

### 5.4 Backend — `meta-campaigns`
`GET ?organization_id&status&limit` → Graph `act_<id>/campaigns` + insights por campaign (spend, impressions, clicks, leads via actions). Normaliza para o shape usado pela UI (`Campaign`-like).

### 5.5 Backend — `meta-sync`
`POST { organization_id }` → refaz discovery de assets + roda um `meta-dashboard` warm e grava `last_sync_at` na conexão + audit_log. Reutiliza pela Visão Geral (botão Sincronizar).

### 5.6 Migration
Adicionar `last_sync_at timestamptz` em `meta_connections` (se não existir). GRANTs já OK.

### 5.7 Frontend — fonte única de verdade
Novo `src/contexts/MetaIntegrationContext.tsx` + hook `useMetaIntegration()` expondo exatamente o shape pedido no briefing. Wrappa em `App.tsx` dentro de `OrganizationProvider`. Consome `meta-integration` via React Query (`['meta','status', orgId]`). Ações:
- `selectAdAccount(id)` → chama `meta-connection?action=select_account` e invalida `['meta',*]`.
- `sync()` → chama `meta-sync` e invalida caches de dashboard/campanhas.
- `refreshStatus()` → invalida `['meta','status']`.

### 5.8 Frontend — hooks de dados
- `useMetaDashboard({ period })` → React Query em `meta-dashboard`, disabled se sem `selectedAdAccount`.
- `useMetaCampaigns({ status })` → idem em `meta-campaigns`.

### 5.9 Frontend — DashboardPage
Substituir:
- "Conta Meta / Não conectada" → estado real do contexto (Conectada/`display_name` / "Selecione uma conta" / "Não conectada").
- Seletor de conta funcional (mesmas opções da Integrações, `selectAdAccount` persiste).
- KPIs e gráfico consumindo `useMetaDashboard` (null → "—").
- "Atualizar" → `queryClient.invalidateQueries(['meta','dashboard'])`.
- "Sincronizar CRM" → renomeado "Sincronizar Meta", chama `sync()`.
- Modo demo preservado como fallback quando `!connected`.

### 5.10 Frontend — CampaignsPage
Consumir `useMetaCampaigns` quando conectado; cair para mock quando `demoMode` e sem conexão. Sem quebrar detalhe/criação (mantém mocks localmente até steps futuros).

### 5.11 AgentPage (mínimo agora)
Injetar `selectedAdAccount + kpis` no system prompt de `nanogpt-chat` (via body). Uso pleno das ferramentas fica para os steps 8+.

## 6. Segurança
- Todas as functions revalidam JWT + `is_org_member`.
- Nunca retornar tokens. Erros de Graph sanitizados a 200 chars.
- Warnings (ex.: `ads_read` ausente) enviados no array `warnings`.

## 7. O que NÃO faço agora
- Persistir insights em tabela dedicada (só cache in-memory via React Query). Se quiser materialização, entra num step futuro.
- Reescrever detalhe de campanha/criativos (mocks continuam até você mandar).
- Implementar CRM (renomeio botão).

## Resumo executável

Nesta rodada eu vou:
1. Criar migration `last_sync_at`.
2. Criar 3 novas edge functions: `meta-integration`, `meta-dashboard`, `meta-campaigns`, `meta-sync` + shared `meta-ids.ts`.
3. Criar `MetaIntegrationContext` + hooks React Query.
4. Reescrever `DashboardPage` e `CampaignsPage` para consumirem dados reais (com fallback a `demoMode`).
5. Ajustar `IntegrationsPage` (`MetaCard`) para usar o mesmo contexto (evita duplicação de fetch).
6. Passar contexto Meta básico ao Agent.

Confirma para eu executar tudo isso na próxima resposta?
