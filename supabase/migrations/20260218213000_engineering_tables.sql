-- Engineering domain tables and storage for CRM DIAMANTE

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text not null,
  inicio_previsto date,
  entrega_prevista date,
  status text not null check (status in ('planejamento','em_obra','entregue')),
  progresso numeric(5,2) default 0,
  orcamento numeric(14,2) default 0,
  gasto numeric(14,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
create policy if not exists "Projects read" on public.projects for select using (auth.uid() is not null);
create policy if not exists "Projects manage" on public.projects for all using (public.is_manager(auth.uid()));
create trigger if not exists update_projects_updated_at before update on public.projects
  for each row execute function public.update_updated_at_column();

-- Units linked to projects
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  nome text not null,
  area numeric(10,2) default 0,
  preco numeric(14,2) default 0,
  status text not null check (status in ('disponivel','reservado','vendido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_units_project on public.units(project_id);
alter table public.units enable row level security;
create policy if not exists "Units read" on public.units for select using (auth.uid() is not null);
create policy if not exists "Units manage" on public.units for all using (public.is_manager(auth.uid()));
create trigger if not exists update_units_updated_at before update on public.units
  for each row execute function public.update_updated_at_column();

-- Leads (pipeline de vendas)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome_cliente text not null,
  contato text not null,
  origem text,
  etapa text not null check (etapa in ('lead','proposta','reserva','contrato')),
  valor numeric(14,2) default 0,
  unidade text,
  corretor text,
  observacoes text,
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy if not exists "Leads read" on public.leads for select using (auth.uid() is not null);
create policy if not exists "Leads manage" on public.leads for all using (public.is_manager(auth.uid()));

-- RFIs
create table if not exists public.rfis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  titulo text not null,
  pergunta text not null,
  solicitante text not null,
  responsavel text not null,
  prazo date,
  status text not null check (status in ('aberto','respondido','fechado')),
  resposta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rfis_project on public.rfis(project_id);
alter table public.rfis enable row level security;
create policy if not exists "RFIs read" on public.rfis for select using (auth.uid() is not null);
create policy if not exists "RFIs manage" on public.rfis for all using (public.is_manager(auth.uid()));
create trigger if not exists update_rfis_updated_at before update on public.rfis
  for each row execute function public.update_updated_at_column();

-- RDOs
create table if not exists public.rdos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  data date not null,
  clima text,
  equipe text,
  horas_trabalhadas numeric(6,2) default 0,
  atividades text not null,
  impedimentos text,
  observacoes text,
  fotos jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rdos_project on public.rdos(project_id);
alter table public.rdos enable row level security;
create policy if not exists "RDO read" on public.rdos for select using (auth.uid() is not null);
create policy if not exists "RDO manage" on public.rdos for all using (public.is_manager(auth.uid()));
create trigger if not exists update_rdos_updated_at before update on public.rdos
  for each row execute function public.update_updated_at_column();

-- Storage bucket for RDO photos
insert into storage.buckets (id, name, public)
values ('rdo-fotos', 'rdo-fotos', true)
on conflict (id) do nothing;

-- Policies for rdo-fotos bucket
create policy if not exists "Public read rdo-fotos" on storage.objects for select
  using (bucket_id = 'rdo-fotos');
create policy if not exists "Auth upload rdo-fotos" on storage.objects for insert
  with check (bucket_id = 'rdo-fotos' and auth.role() = 'authenticated');
create policy if not exists "Auth update rdo-fotos" on storage.objects for update
  using (bucket_id = 'rdo-fotos' and auth.role() = 'authenticated');
create policy if not exists "Auth delete rdo-fotos" on storage.objects for delete
  using (bucket_id = 'rdo-fotos' and auth.role() = 'authenticated');
