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

## 5) Integracao WhatsApp (assistencia, cobranca e leads de anuncio)

Edge Function adicionada: `whatsapp-gateway`.

Deploy da function:

```bash
supabase functions deploy whatsapp-gateway --project-ref vrijkozdsituzznxhttx
```

Secrets para envio real pelo Meta WhatsApp Cloud API:

```bash
supabase secrets set WHATSAPP_TOKEN=seu_token_meta --project-ref vrijkozdsituzznxhttx
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id --project-ref vrijkozdsituzznxhttx
supabase secrets set WHATSAPP_VERIFY_TOKEN=seu_verify_token_webhook --project-ref vrijkozdsituzznxhttx
supabase secrets set WHATSAPP_DEFAULT_COUNTRY=55 --project-ref vrijkozdsituzznxhttx
```

Webhook para configurar no Meta:

```txt
https://vrijkozdsituzznxhttx.functions.supabase.co/whatsapp-gateway
```

No CRM:
- Assistencia Tecnica: botao `WhatsApp` em cada chamado.
- Financeiro: botao de cobranca por WhatsApp nas entradas mensais.
- Funil de Vendas: card com endpoint para leads de anuncio via WhatsApp.

## 6) Hospedagem

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

## 7) Simulador CAIXA oficial

O frontend usa `VITE_CAIXA_PROXY_BASE` (padrao `/api/caixa`) para consultar o simulador oficial.

- Local dev: proxy nativo do Vite (ja incluso).
- Deploy: aponte `VITE_CAIXA_PROXY_BASE` para um endpoint backend/proxy valido.
