-- Seed users (clients + agents) with deterministic UUIDs for local tests

-- clients
with users_to_insert as (
  select * from (
    values
      (
        '00000000-0000-0000-0000-0000000000a1'::uuid,
        '52998224725@portal.local'::text,
        '456789'::text
      ),
      (
        '00000000-0000-0000-0000-0000000000b2'::uuid,
        '11144477735@portal.local'::text,
        '112233'::text
      ),
      (
        '00000000-0000-0000-0000-0000000000c1'::uuid,
        'agent.ceo@crm.local'::text,
        'Agent@123'::text
      ),
      (
        '00000000-0000-0000-0000-0000000000c2'::uuid,
        'agent.finance@crm.local'::text,
        'Agent@123'::text
      )
  ) as t(id, email, pass)
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  crypt(u.pass, gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from users_to_insert u
on conflict (id) do nothing;

with users_to_insert as (
  select * from (
    values
      ('00000000-0000-0000-0000-0000000000a1'::uuid, '52998224725@portal.local'::text),
      ('00000000-0000-0000-0000-0000000000b2'::uuid, '11144477735@portal.local'::text),
      ('00000000-0000-0000-0000-0000000000c1'::uuid, 'agent.ceo@crm.local'::text),
      ('00000000-0000-0000-0000-0000000000c2'::uuid, 'agent.finance@crm.local'::text)
  ) as t(id, email)
)
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.email,
  now(),
  now(),
  now()
from users_to_insert u
on conflict (provider, provider_id) do nothing;

insert into public.profiles (
  user_id,
  cpf,
  full_name,
  phone_e164,
  phone_last6,
  client_external_id,
  email_contact,
  address_line,
  portal_access_enabled
)
values
  (
    '00000000-0000-0000-0000-0000000000a1',
    '52998224725',
    'Cliente A',
    '+5511993456789',
    '456789',
    'CRM-CLI-A',
    'clientea@exemplo.com',
    'Rua A, 100 - Sao Paulo/SP',
    true
  ),
  (
    '00000000-0000-0000-0000-0000000000b2',
    '11144477735',
    'Cliente B',
    '+5511981112233',
    '112233',
    'CRM-CLI-B',
    'clienteb@exemplo.com',
    'Rua B, 200 - Sao Paulo/SP',
    true
  )
on conflict (user_id) do update
set
  cpf = excluded.cpf,
  full_name = excluded.full_name,
  phone_e164 = excluded.phone_e164,
  phone_last6 = excluded.phone_last6,
  client_external_id = excluded.client_external_id,
  email_contact = excluded.email_contact,
  address_line = excluded.address_line,
  portal_access_enabled = excluded.portal_access_enabled;

insert into public.user_settings (user_id, email_notifications, whatsapp_notifications)
values
  ('00000000-0000-0000-0000-0000000000a1', true, true),
  ('00000000-0000-0000-0000-0000000000b2', true, false)
on conflict (user_id) do update
set
  email_notifications = excluded.email_notifications,
  whatsapp_notifications = excluded.whatsapp_notifications;

insert into public.agents (user_id, display_name, is_active)
values
  ('00000000-0000-0000-0000-0000000000c1', 'Agente CEO', true),
  ('00000000-0000-0000-0000-0000000000c2', 'Agente Financeiro', true)
on conflict (user_id) do update
set
  display_name = excluded.display_name,
  is_active = excluded.is_active;

insert into public.contracts (
  contract_number,
  user_id,
  development_id,
  development_name,
  unit_id,
  unit_label
)
values
  ('CTR-A-001', '00000000-0000-0000-0000-0000000000a1', 'DEV-ALFA', 'Residencial Alfa', 'U-101', 'Bloco A / 101'),
  ('CTR-B-001', '00000000-0000-0000-0000-0000000000b2', 'DEV-BETA', 'Residencial Beta', 'U-202', 'Bloco B / 202'),
  ('CTR-B-002', '00000000-0000-0000-0000-0000000000b2', 'DEV-GAMA', 'Residencial Gama', 'U-305', 'Torre 3 / 305')
on conflict (contract_number) do update
set
  user_id = excluded.user_id,
  development_id = excluded.development_id,
  development_name = excluded.development_name,
  unit_id = excluded.unit_id,
  unit_label = excluded.unit_label;

insert into public.news (contract_number, category, title, body, image_url, published_at)
values
  ('CTR-A-001', 'Work', 'Estrutura concluída', 'A estrutura da torre foi concluída com sucesso.', null, now() - interval '7 days'),
  ('CTR-B-001', 'Financial', 'Ajuste no cronograma financeiro', 'Houve atualização no calendário de cobrança.', null, now() - interval '5 days'),
  ('CTR-B-002', 'Communications', 'Comunicado de obra', 'Acesso ao canteiro será alterado nesta semana.', null, now() - interval '3 days');

insert into public.documents (contract_number, type, title, storage_path, published_at)
values
  ('CTR-A-001', 'contract', 'Contrato principal', 'CTR-A-001/11111111-1111-1111-1111-111111111111.pdf', now() - interval '30 days'),
  ('CTR-B-001', 'addendum', 'Aditivo 01', 'CTR-B-001/22222222-2222-2222-2222-222222222222.pdf', now() - interval '20 days'),
  ('CTR-B-002', 'notice', 'Aviso de entrega de fase', 'CTR-B-002/33333333-3333-3333-3333-333333333333.pdf', now() - interval '10 days');

insert into public.financial_bills (
  contract_number,
  status,
  amount_cents,
  due_date,
  competence,
  barcode_line,
  bill_pdf_path
)
values
  ('CTR-A-001', 'open', 250000, current_date + 10, '2026-02', '34191.79001 01043.510047 91020.150008 8 12340000025000', 'CTR-A-001/44444444-4444-4444-4444-444444444444.pdf'),
  ('CTR-A-001', 'paid', 250000, current_date - 20, '2026-01', '34191.79001 01043.510047 91020.150008 8 12340000025000', 'CTR-A-001/55555555-5555-5555-5555-555555555555.pdf'),
  ('CTR-B-001', 'overdue', 315000, current_date - 2, '2026-02', '34191.79001 01043.510047 91020.150008 8 12340000031500', 'CTR-B-001/66666666-6666-6666-6666-666666666666.pdf');

insert into public.financial_statement (contract_number, entry_date, description, entry_type, amount_cents, status)
values
  ('CTR-A-001', current_date - 45, 'Entrada sinal', 'credit', 1000000, 'confirmed'),
  ('CTR-A-001', current_date - 20, 'Parcela mensal', 'debit', 250000, 'paid'),
  ('CTR-B-001', current_date - 15, 'Parcela mensal', 'debit', 315000, 'overdue');

insert into public.requests (contract_number, request_type, payload, status, created_by_user)
values
  (
    'CTR-A-001',
    'anticipation',
    '{"requested_installments": 2, "note": "Antecipar duas parcelas"}'::jsonb,
    'in_review',
    '00000000-0000-0000-0000-0000000000a1'
  );

insert into public.construction_progress (contract_number, progress_percent, stages)
values
  (
    'CTR-A-001',
    58.50,
    '[{"stage":"Fundação","planned_date":"2025-08-01","actual_date":"2025-08-03","notes":"Concluída"},{"stage":"Estrutura","planned_date":"2025-12-01","actual_date":"2025-12-08","notes":"Concluída"},{"stage":"Acabamento","planned_date":"2026-03-01","actual_date":null,"notes":"Em andamento"}]'::jsonb
  ),
  (
    'CTR-B-001',
    42.00,
    '[{"stage":"Terraplanagem","planned_date":"2025-10-01","actual_date":"2025-10-02","notes":"Concluída"},{"stage":"Estrutura","planned_date":"2026-01-01","actual_date":null,"notes":"Em andamento"}]'::jsonb
  )
on conflict (contract_number) do update
set
  progress_percent = excluded.progress_percent,
  stages = excluded.stages,
  updated_at = now();

with gallery_dates as (
  select
    date_trunc('month', now())::date as current_month,
    (date_trunc('month', now()) - interval '1 month')::date as previous_month,
    (date_trunc('month', now()) + interval '1 month')::date as next_month
)
insert into public.photo_galleries (contract_number, month_ref, publication_at, title, description)
select * from (
  select
    'CTR-A-001'::text,
    gd.previous_month,
    (gd.previous_month + interval '9 days')::timestamptz,
    'Galeria mês anterior'::text,
    'Registro fotográfico do mês publicado'::text
  from gallery_dates gd
  union all
  select
    'CTR-A-001',
    gd.next_month,
    (gd.next_month + interval '9 days')::timestamptz,
    'Galeria próximo mês',
    'Registro ainda não publicado'
  from gallery_dates gd
) as g(contract_number, month_ref, publication_at, title, description)
on conflict (contract_number, month_ref) do update
set
  publication_at = excluded.publication_at,
  title = excluded.title,
  description = excluded.description;

insert into public.photo_gallery_items (gallery_id, contract_number, storage_path, caption, sort_order)
select
  g.id,
  g.contract_number,
  g.contract_number || '/' || to_char(g.month_ref, 'YYYY-MM') || '/77777777-7777-7777-7777-777777777777.jpg',
  'Vista da obra',
  1
from public.photo_galleries g
where g.contract_number = 'CTR-A-001'
on conflict do nothing;

insert into public.faq (category, question, answer, sort_order)
values
  ('finance', 'Como emitir segunda via?', 'Acesse Financial e clique no documento do boleto.', 1),
  ('support', 'Como abrir chamado?', 'Acesse Support e preencha o formulário de ticket.', 2),
  ('documents', 'Como baixar contrato?', 'Acesse Information > Documentos e clique em Abrir.', 3)
on conflict do nothing;

insert into public.tickets (contract_number, created_by_user, subject, category, message, status, protocol)
values
  (
    'CTR-A-001',
    '00000000-0000-0000-0000-0000000000a1',
    'Solicitação de vistoria',
    'support',
    'Preciso agendar vistoria da unidade.',
    'open',
    'TCK-SEED-0001'
  )
on conflict (protocol) do nothing;

insert into public.conversations (
  contract_number,
  user_id,
  status,
  priority,
  assigned_agent_id,
  last_message_at
)
values
  (
    'CTR-A-001',
    '00000000-0000-0000-0000-0000000000a1',
    'open',
    'normal',
    '00000000-0000-0000-0000-0000000000c1',
    now() - interval '1 hour'
  )
on conflict (contract_number) do update
set
  user_id = excluded.user_id,
  status = excluded.status,
  priority = excluded.priority,
  assigned_agent_id = excluded.assigned_agent_id,
  last_message_at = excluded.last_message_at;

insert into public.messages (conversation_id, contract_number, sender_type, sender_user_id, message_type, body_text, created_at)
select
  c.id,
  c.contract_number,
  'client',
  c.user_id,
  'text',
  'Olá, preciso de atualização sobre minha obra.',
  now() - interval '50 minutes'
from public.conversations c
where c.contract_number = 'CTR-A-001'
on conflict do nothing;

insert into public.messages (conversation_id, contract_number, sender_type, sender_user_id, message_type, body_text, created_at)
select
  c.id,
  c.contract_number,
  'agent',
  '00000000-0000-0000-0000-0000000000c1',
  'text',
  'Recebido. Vamos enviar atualização ainda hoje.',
  now() - interval '40 minutes'
from public.conversations c
where c.contract_number = 'CTR-A-001'
on conflict do nothing;

insert into public.messages (conversation_id, contract_number, sender_type, sender_user_id, message_type, body_text, created_at)
select
  c.id,
  c.contract_number,
  'agent',
  '00000000-0000-0000-0000-0000000000c1',
  'note',
  'Nota interna: cliente sensível ao prazo.',
  now() - interval '35 minutes'
from public.conversations c
where c.contract_number = 'CTR-A-001'
on conflict do nothing;

insert into public.macros (created_by_agent, title, body)
values
  ('00000000-0000-0000-0000-0000000000c1', 'Agradecimento padrão', 'Obrigado pelo contato. Vamos retornar em breve.'),
  ('00000000-0000-0000-0000-0000000000c1', 'Pedido de evidência', 'Poderia enviar fotos e detalhes para agilizar o atendimento?')
on conflict do nothing;
