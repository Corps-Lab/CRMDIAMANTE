# CRM DIAMANTE

Aplicacao React + Supabase com dois modos de execucao:

- `mock`: funciona local sem depender de banco.
- `online`: usa Supabase (auth + banco) e integra Notion via Edge Function.

## 1) Rodar local em modo mock

```bash
npm install
cp .env.example .env
# manter:
# VITE_APP_RUNTIME=mock
# VITE_USE_MOCK_AUTH=true
npm run dev -- --host 0.0.0.0 --port 3000
```

## 2) Rodar local em modo online (Supabase)

No `.env`:

```bash
VITE_APP_RUNTIME=online
VITE_USE_MOCK_AUTH=false
VITE_BASE_PATH=/
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY
```

Depois:

```bash
npm run dev -- --host 0.0.0.0 --port 3000
```

## 3) Banco de dados (Supabase)

Aplicar migrations no projeto remoto:

```bash
supabase db push --project-ref vrijkozdsituzznxhttx
```

> Se necessario, rode `supabase login` antes.

## 4) Integracao Notion (online)

Edge Function adicionada: `notion-sync`.

Deploy da function:

```bash
supabase functions deploy notion-sync --project-ref vrijkozdsituzznxhttx
```

Defina os secrets:

```bash
supabase secrets set NOTION_TOKEN=seu_token_notion --project-ref vrijkozdsituzznxhttx
supabase secrets set NOTION_DATABASE_CLIENTES_ID=seu_database_id --project-ref vrijkozdsituzznxhttx
```

No CRM, abra `Importar CSV` e use a secao **Sincronizar clientes via Notion** para:

1. Testar conexao;
2. Carregar previa;
3. Importar para clientes.

## 5) Hospedagem

### Vercel

1. Conecte o repositorio.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Configure env vars de producao:
   - `VITE_APP_RUNTIME=online`
   - `VITE_USE_MOCK_AUTH=false`
   - `VITE_BASE_PATH=/`
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`

O arquivo `vercel.json` ja inclui rewrite SPA.

### Netlify

`netlify.toml` ja inclui:
- build command `npm run build`
- publish `dist`
- redirect SPA para `index.html`

## 6) Simulador CAIXA oficial

O frontend usa `VITE_CAIXA_PROXY_BASE` (padrao `/api/caixa`) para consultar o simulador oficial.

- Local dev: proxy nativo do Vite (ja incluso).
- Deploy: aponte `VITE_CAIXA_PROXY_BASE` para um endpoint backend/proxy valido.
