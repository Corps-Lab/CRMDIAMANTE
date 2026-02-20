# CRM Principal + Portal do Cliente (Monorepo)

Projeto com CRM como app principal e Portal do Cliente como app interno vinculado.

- CRM principal: `apps/agent-crm`
- Portal do cliente: `apps/portal-web`
- Shared: `packages/shared`
- Backend: `supabase` (migrations, seed, edge functions)

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Supabase (Postgres + Auth + Storage + Realtime)
- Serverless: Supabase Edge Functions (Deno + TypeScript)

## Estrutura

```txt
apps/
  agent-crm/
  portal-web/
packages/
  shared/
supabase/
  migrations/
  seed.sql
  functions/
```

## Scripts principais

- `pnpm i`
- `pnpm dev` (CRM principal em `http://localhost:5173`)
- `pnpm dev:portal` (Portal em `http://localhost:5174`)
- `pnpm dev:all` (CRM + Portal juntos)
- `pnpm supabase:start`
- `pnpm db:reset`
- `pnpm supabase:functions:serve`

## Setup local completo

1. Instalar dependências:

```bash
pnpm i
```

2. Subir Supabase local:

```bash
pnpm supabase:start
```

3. Resetar DB + seed:

```bash
pnpm db:reset
```

4. Configurar env do CRM:

```bash
cp apps/agent-crm/.env.example apps/agent-crm/.env
```

5. Configurar env do Portal:

```bash
cp apps/portal-web/.env.example apps/portal-web/.env
```

6. Preencher variáveis (`supabase status` mostra a ANON KEY):

`apps/agent-crm/.env`

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY_LOCAL>
VITE_PORTAL_URL=http://localhost:5174/#
```

`apps/portal-web/.env`

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY_LOCAL>
VITE_EDGE_FUNCTIONS_BASE_URL=
```

7. Rodar Edge Functions localmente:

```bash
pnpm supabase:functions:serve
```

8. Rodar CRM principal e Portal:

```bash
pnpm dev:all
```

## Link do Portal enviado pelo CRM

No CRM (`apps/agent-crm`) existe bloco **Portal do Cliente** com:

- link gerado automaticamente para o cliente;
- botão **Copiar link**;
- botão **Copiar mensagem pronta**;
- botão **Ir para autenticacao do portal**.

O cliente ainda autentica com CPF + últimos 6 dígitos do telefone (regra de segurança mantida).

## URLs online (GitHub Pages)

- CRM principal: `https://corps-lab.github.io/CRMDIAMANTE/`
- Portal do cliente (auth): `https://corps-lab.github.io/CRMDIAMANTE/portal/#/login`

## Acesso automatico ao cliente ativo

A Edge Function `sync-client-from-crm` agora provisiona acesso automaticamente quando o cliente chega como ativo:

- cria usuario Auth com email sintetico `cpf@portal.local` (se nao existir);
- sincroniza senha com `phone_last6`;
- salva `profiles.portal_access_enabled = true`.

Campos aceitos para status de ativacao no payload de `profiles`:

- `portal_access_enabled` (boolean),
- `is_active` / `active` (boolean),
- ou `status` com valores como `ativo` / `active`.

Se vier como inativo, o perfil fica com `portal_access_enabled = false` e o login no portal retorna bloqueio.

## Credenciais seed (demo)

### Clientes (Portal: CPF + pass6)

- Cliente A: `52998224725` / `456789`
- Cliente B: `11144477735` / `112233`

### Agentes (CRM)

- `agent.ceo@crm.local` / `Agent@123`
- `agent.finance@crm.local` / `Agent@123`

## Segurança (RLS)

- RLS habilitado nas tabelas de domínio (FAQ leitura pública).
- Funções helper: `is_agent(uid)` e `owns_contract(contract_number, uid)`.
- Cliente só acessa dados dos contratos que possui.
- Galeria só aparece se `publication_at <= now()`.
- Mensagens internas (`message_type='note'`) não aparecem para cliente.
- Buckets privados com signed URL via Edge Function `signed-url`.
