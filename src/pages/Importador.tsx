import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { parseCsv } from "@/lib/csv";
import { useClients } from "@/contexts/ClientContext";
import { useSuppliers } from "@/contexts/SupplierContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useSales } from "@/contexts/SalesContext";
import { useAssist } from "@/contexts/AssistContext";
import { useRdo } from "@/contexts/RdoContext";
import { useRfi } from "@/contexts/RfiContext";
import { useAgency } from "@/contexts/AgencyContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type DatasetKey = "clientes" | "fornecedores" | "obras" | "unidades" | "leads" | "assistencia" | "rdo" | "rfis";

interface NotionClientPreview {
  notionPageId: string;
  razaoSocial: string;
  cnpj: string;
  cpf: string | null;
  endereco: string;
  valorPago: number;
  recorrencia:
    | "a_vista"
    | "parcelado"
    | "boleto"
    | "financiamento"
    | "consorcio"
    | "permuta"
    | "mensal"
    | "trimestral"
    | "semestral"
    | "anual";
  responsavel: string;
  contatoInterno: string;
}

const datasetFields: Record<DatasetKey, { key: string; label: string; required?: boolean; fallback?: string }[]> = {
  clientes: [
    { key: "razaoSocial", label: "razaoSocial", required: true },
    { key: "cnpj", label: "cnpj", required: true },
    { key: "cpf", label: "cpf" },
    { key: "endereco", label: "endereco", required: true },
    { key: "valorPago", label: "valorPago" },
    { key: "recorrencia", label: "formaPagamento (ou recorrencia)", fallback: "parcelado" },
    { key: "responsavel", label: "responsavel" },
    { key: "contatoInterno", label: "contatoInterno" },
  ],
  fornecedores: [
    { key: "razaoSocial", label: "razaoSocial", required: true },
    { key: "docTipo", label: "docTipo", fallback: "cnpj" },
    { key: "documento", label: "documento", required: true },
    { key: "endereco", label: "endereco" },
    { key: "responsavel", label: "responsavel" },
    { key: "contato", label: "contato" },
  ],
  obras: [
    { key: "nome", label: "nome", required: true },
    { key: "cidade", label: "cidade", required: true },
    { key: "inicioPrevisto", label: "inicioPrevisto" },
    { key: "entregaPrevista", label: "entregaPrevista" },
    { key: "status", label: "status", fallback: "planejamento" },
    { key: "progresso", label: "progresso", fallback: "0" },
    { key: "orcamento", label: "orcamento" },
    { key: "gasto", label: "gasto" },
  ],
  unidades: [
    { key: "projectId", label: "projectId", fallback: "" },
    { key: "nome", label: "nome", required: true },
    { key: "area", label: "area" },
    { key: "preco", label: "preco" },
    { key: "status", label: "status", fallback: "disponivel" },
  ],
  leads: [
    { key: "nomeCliente", label: "nomeCliente", required: true },
    { key: "contato", label: "contato", required: true },
    { key: "origem", label: "origem" },
    { key: "etapa", label: "etapa", fallback: "lead" },
    { key: "valor", label: "valor" },
    { key: "unidade", label: "unidade" },
    { key: "corretor", label: "corretor" },
    { key: "observacoes", label: "observacoes" },
  ],
  assistencia: [
    { key: "unidade", label: "unidade", required: true },
    { key: "cliente", label: "cliente", required: true },
    { key: "contato", label: "contato", required: true },
    { key: "tipo", label: "tipo", fallback: "acabamento" },
    { key: "status", label: "status", fallback: "aberto" },
    { key: "prazo", label: "prazo" },
    { key: "descricao", label: "descricao", required: true },
    { key: "responsavel", label: "responsavel" },
  ],
  rdo: [
    { key: "projectId", label: "projectId", fallback: "" },
    { key: "data", label: "data" },
    { key: "clima", label: "clima", required: true },
    { key: "equipe", label: "equipe", required: true },
    { key: "horasTrabalhadas", label: "horasTrabalhadas" },
    { key: "atividades", label: "atividades", required: true },
    { key: "impedimentos", label: "impedimentos" },
    { key: "observacoes", label: "observacoes" },
  ],
  rfis: [
    { key: "projectId", label: "projectId", fallback: "" },
    { key: "titulo", label: "titulo", required: true },
    { key: "pergunta", label: "pergunta", required: true },
    { key: "solicitante", label: "solicitante", required: true },
    { key: "responsavel", label: "responsavel", required: true },
    { key: "prazo", label: "prazo" },
    { key: "status", label: "status", fallback: "aberto" },
    { key: "resposta", label: "resposta" },
  ],
};

const datasets = Object.entries(datasetFields).map(([key, value]) => ({ key: key as DatasetKey, label: value[0]?.label ? key.charAt(0).toUpperCase() + key.slice(1) : key }));

export default function Importador() {
  const { addClient, clients } = useClients();
  const { addSupplier } = useSuppliers();
  const { addProject, addUnit, projects } = useProjects();
  const { addLead } = useSales();
  const { addTicket } = useAssist();
  const { addRdo } = useRdo();
  const { addRfi } = useRfi();
  const { isIsolated } = useAgency();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<DatasetKey>("clientes");
  const [processing, setProcessing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionStatus, setNotionStatus] = useState<string>("");
  const [notionLimit, setNotionLimit] = useState(20);
  const [notionPreview, setNotionPreview] = useState<NotionClientPreview[]>([]);

  const sanitizeDoc = (value: string | null | undefined) => (value || "").replace(/\D/g, "");

  const callNotionSync = async (action: "status" | "preview_clients", limit = 20) => {
    const { data, error } = await supabase.functions.invoke("notion-sync", {
      body: { action, limit },
    });

    if (error) {
      throw new Error(error.message || "Falha ao chamar function do Notion.");
    }

    const payload = (data || {}) as {
      ok?: boolean;
      error?: string;
      data?: Record<string, unknown>;
    };

    if (!payload.ok) {
      throw new Error(payload.error || "Resposta invalida da function do Notion.");
    }

    return payload.data || {};
  };

  const handleTestNotion = async () => {
    if (isIsolated) {
      toast({
        title: "Modo mock local",
        description: "Troque para ambiente online para testar Notion.",
      });
      return;
    }

    setNotionLoading(true);
    try {
      const data = await callNotionSync("status");
      const configured = Boolean(data.configured);
      const message = String(data.message || (configured ? "Notion pronto." : "Notion nao configurado."));
      setNotionStatus(message);
      toast({
        title: configured ? "Notion conectado" : "Notion pendente",
        description: message,
        variant: configured ? "default" : "destructive",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao testar Notion.";
      setNotionStatus(message);
      toast({ title: "Erro no Notion", description: message, variant: "destructive" });
    } finally {
      setNotionLoading(false);
    }
  };

  const handleLoadNotionPreview = async () => {
    if (isIsolated) {
      toast({
        title: "Modo mock local",
        description: "Troque para ambiente online para carregar dados do Notion.",
      });
      return;
    }

    setNotionLoading(true);
    try {
      const data = await callNotionSync("preview_clients", notionLimit);
      const list = (data.clients || []) as NotionClientPreview[];
      const fetched = Number(data.fetched || list.length);
      const skipped = Number(data.skipped || 0);
      setNotionPreview(list);
      toast({
        title: "Previa carregada",
        description: `${list.length} clientes validos de ${fetched} registros (${skipped} ignorados).`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar previa.";
      toast({ title: "Erro no Notion", description: message, variant: "destructive" });
    } finally {
      setNotionLoading(false);
    }
  };

  const handleImportNotionPreview = async () => {
    if (!notionPreview.length) {
      toast({ title: "Carregue a previa do Notion antes de importar." });
      return;
    }

    setNotionLoading(true);
    try {
      const existingDocs = new Set(
        clients
          .flatMap((client) => [sanitizeDoc(client.cnpj), sanitizeDoc(client.cpf || null)])
          .filter(Boolean),
      );
      let imported = 0;
      let skipped = 0;

      for (const entry of notionPreview) {
        const cnpj = sanitizeDoc(entry.cnpj);
        const cpf = sanitizeDoc(entry.cpf);
        const primaryDoc = cnpj || cpf;

        if (!primaryDoc || existingDocs.has(primaryDoc)) {
          skipped += 1;
          continue;
        }

        await addClient({
          razaoSocial: entry.razaoSocial,
          cnpj: cnpj || cpf,
          cpf: cpf || undefined,
          endereco: entry.endereco || "Nao informado",
          valorPago: Number(entry.valorPago || 0),
          recorrencia: entry.recorrencia || "parcelado",
          responsavel: entry.responsavel || "Nao informado",
          contatoInterno: entry.contatoInterno || "nao-informado@diamante.local",
        });

        imported += 1;
        if (cnpj) existingDocs.add(cnpj);
        if (cpf) existingDocs.add(cpf);
      }

      toast({
        title: "Importacao do Notion concluida",
        description: `${imported} importados, ${skipped} ignorados (duplicados/invalidos).`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao importar clientes do Notion.";
      toast({ title: "Erro no Notion", description: message, variant: "destructive" });
    } finally {
      setNotionLoading(false);
    }
  };

  const loadPreview = async (csvFile: File, dataset: DatasetKey) => {
    const parsed = await parseCsv(csvFile);
    setRows(parsed);
    const hdrs = parsed.length ? Object.keys(parsed[0]) : [];
    setHeaders(hdrs);
    const defaults: Record<string, string> = {};
    datasetFields[dataset].forEach((f) => {
      const found = hdrs.find((h) => h.toLowerCase() === f.key.toLowerCase());
      if (found) defaults[f.key] = found;
    });
    setMapping(defaults);
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: "Selecione um CSV", variant: "destructive" });
      return;
    }
    if (!rows.length) {
      await loadPreview(file, target);
    }
    setProcessing(true);
    setLog([]);
    try {
      let ok = 0;
      let fail = 0;

      for (const row of rows) {
        try {
          const fieldVal = (field: string, fallback?: string) => {
            const column = mapping[field] || field;
            const v = column ? row[column] : "";
            return v !== undefined && v !== null && v !== "" ? v : fallback ?? "";
          };
          const clientPaymentValue = () =>
            (
              fieldVal("recorrencia") ||
              fieldVal("formaPagamento") ||
              fieldVal("forma_pagamento") ||
              fieldVal("forma de pagamento")
            ) as string;
          switch (target) {
            case "clientes": {
              await addClient({
                razaoSocial: fieldVal("razaoSocial"),
                cnpj: fieldVal("cnpj"),
                cpf: fieldVal("cpf") || undefined,
                endereco: fieldVal("endereco"),
                valorPago: Number(fieldVal("valorPago") || 0),
                recorrencia: (clientPaymentValue() as any) || "parcelado",
                responsavel: fieldVal("responsavel"),
                contatoInterno: fieldVal("contatoInterno") || fieldVal("contato"),
              });
              break;
            }
            case "fornecedores": {
              await addSupplier({
                razaoSocial: fieldVal("razaoSocial") || fieldVal("nome"),
                docTipo: (fieldVal("docTipo") || "cnpj") as any,
                documento: fieldVal("documento") || fieldVal("cnpj") || fieldVal("cpf"),
                endereco: fieldVal("endereco"),
                responsavel: fieldVal("responsavel"),
                contato: fieldVal("contato"),
              });
              break;
            }
            case "obras": {
              await addProject({
                nome: fieldVal("nome"),
                cidade: fieldVal("cidade"),
                inicioPrevisto: fieldVal("inicioPrevisto") || fieldVal("inicio"),
                entregaPrevista: fieldVal("entregaPrevista") || fieldVal("entrega"),
                status: (fieldVal("status") as any) || "planejamento",
                progresso: Number(fieldVal("progresso") || 0),
                orcamento: Number(fieldVal("orcamento") || 0),
                gasto: Number(fieldVal("gasto") || 0),
              });
              break;
            }
            case "unidades": {
              await addUnit({
                projectId: fieldVal("projectId", projects[0]?.id || ""),
                nome: fieldVal("nome"),
                area: Number(fieldVal("area") || 0),
                preco: Number(fieldVal("preco") || 0),
                status: (fieldVal("status") as any) || "disponivel",
              });
              break;
            }
            case "leads": {
              await addLead({
                nomeCliente: fieldVal("nomeCliente") || fieldVal("cliente"),
                contato: fieldVal("contato"),
                origem: fieldVal("origem"),
                etapa: (fieldVal("etapa") as any) || "lead",
                valor: Number(fieldVal("valor") || 0),
                unidade: fieldVal("unidade") || undefined,
                corretor: fieldVal("corretor") || undefined,
                observacoes: fieldVal("observacoes") || undefined,
              });
              break;
            }
            case "assistencia": {
              await addTicket({
                unidade: fieldVal("unidade"),
                cliente: fieldVal("cliente"),
                contato: fieldVal("contato"),
                tipo: (fieldVal("tipo") as any) || "acabamento",
                status: (fieldVal("status") as any) || "aberto",
                prazo: fieldVal("prazo") || new Date().toISOString().slice(0,10),
                descricao: fieldVal("descricao"),
                responsavel: fieldVal("responsavel") || undefined,
              });
              break;
            }
            case "rdo": {
              await addRdo({
                projectId: fieldVal("projectId", projects[0]?.id || ""),
                data: fieldVal("data") || new Date().toISOString().slice(0,10),
                clima: fieldVal("clima") || "",
                equipe: fieldVal("equipe") || "",
                horasTrabalhadas: Number(fieldVal("horasTrabalhadas") || 0),
                atividades: fieldVal("atividades") || "",
                impedimentos: fieldVal("impedimentos") || undefined,
                observacoes: fieldVal("observacoes") || undefined,
                fotos: null,
              });
              break;
            }
            case "rfis": {
              await addRfi({
                projectId: fieldVal("projectId", projects[0]?.id || ""),
                titulo: fieldVal("titulo"),
                pergunta: fieldVal("pergunta"),
                solicitante: fieldVal("solicitante"),
                responsavel: fieldVal("responsavel"),
                prazo: fieldVal("prazo") || new Date().toISOString().slice(0,10),
                status: (fieldVal("status") as any) || "aberto",
                resposta: fieldVal("resposta") || undefined,
              });
              break;
            }
          }
          ok++;
        } catch (err: any) {
          fail++;
          setLog((prev) => [...prev, `Erro na linha ${ok + fail}: ${err?.message || err}`]);
        }
      }

      toast({ title: "Importação concluída", description: `${ok} registros ok, ${fail} falharam` });
    } catch (err: any) {
      toast({ title: "Erro ao ler CSV", description: err?.message || "Verifique o arquivo" , variant: "destructive"});
    } finally {
      setProcessing(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 max-w-3xl mx-auto">
        <Card className="border-border bg-card/90">
          <CardHeader>
            <CardTitle>Importar dados via CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de dado</Label>
                <select
                  className="h-10 rounded-md border border-border bg-secondary px-3"
                  value={target}
                  onChange={(e) => setTarget(e.target.value as DatasetKey)}
                >
                  {datasets.map((d) => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Arquivo CSV</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                    if (f) await loadPreview(f, target);
                  }}
                />
              </div>
            </div>

            {headers.length > 0 && (
              <div className="space-y-2">
                <Label>Mapeamento de colunas</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {datasetFields[target].map((field) => (
                    <div key={field.key} className="space-y-1">
                      <div className="text-sm text-foreground font-medium">
                        {field.label} {field.required ? "*" : ""}
                      </div>
                      <select
                        className="h-10 rounded-md border border-border bg-secondary px-3"
                        value={mapping[field.key] || ""}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      >
                        <option value="">— escolher coluna —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              Campos esperados por tipo:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Clientes</strong>: razaoSocial, cnpj, cpf (opcional), endereco, valorPago, formaPagamento (ou recorrencia), responsavel, contatoInterno</li>
                <li><strong>Fornecedores</strong>: razaoSocial, docTipo (cpf/cnpj), documento, endereco, responsavel, contato</li>
                <li><strong>Obras</strong>: nome, cidade, inicioPrevisto, entregaPrevista, status, progresso, orcamento, gasto</li>
                <li><strong>Unidades</strong>: projectId, nome, area, preco, status</li>
                <li><strong>Funil</strong>: nomeCliente, contato, origem, etapa, valor, unidade, corretor, observacoes</li>
                <li><strong>Assistência/Vistoria</strong>: unidade, cliente, contato, tipo, status, prazo, descricao, responsavel</li>
                <li><strong>RDO</strong>: projectId, data, clima, equipe, horasTrabalhadas, atividades, impedimentos, observacoes</li>
                <li><strong>RFIs</strong>: projectId, titulo, pergunta, solicitante, responsavel, prazo, status, resposta</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleImport} disabled={processing || !file}>{processing ? "Importando..." : "Importar"}</Button>
              {file && <span className="text-sm text-muted-foreground">Selecionado: {file.name}</span>}
            </div>

            {log.length > 0 && (
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm max-h-48 overflow-auto">
                {log.map((l, idx) => (
                  <div key={idx} className="text-destructive">{l}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/90">
          <CardHeader>
            <CardTitle>Sincronizar clientes via Notion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isIsolated && (
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
                Esta tela esta em modo mock local. Para testar Notion online, publique com{" "}
                <code>VITE_APP_RUNTIME=online</code> e faca login no Supabase.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1 space-y-2">
                <Label>Limite de leitura</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={notionLimit}
                  onChange={(e) => setNotionLimit(Math.min(100, Math.max(1, Number(e.target.value || 20))))}
                />
              </div>
              <div className="md:col-span-3 flex flex-wrap gap-2 items-end">
                <Button onClick={handleTestNotion} disabled={notionLoading}>
                  {notionLoading ? "Testando..." : "Testar conexao"}
                </Button>
                <Button variant="secondary" onClick={handleLoadNotionPreview} disabled={notionLoading}>
                  {notionLoading ? "Carregando..." : "Carregar previa"}
                </Button>
                <Button onClick={handleImportNotionPreview} disabled={notionLoading || notionPreview.length === 0}>
                  {notionLoading ? "Importando..." : "Importar previa"}
                </Button>
              </div>
            </div>

            {notionStatus && <div className="text-sm text-muted-foreground">{notionStatus}</div>}

            {notionPreview.length > 0 && (
              <div className="rounded-md border border-border overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-secondary/40">
                    <tr>
                      <th className="text-left p-2">Razao social</th>
                      <th className="text-left p-2">CNPJ/CPF</th>
                      <th className="text-left p-2">Responsavel</th>
                      <th className="text-left p-2">Contato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notionPreview.map((item) => (
                      <tr key={item.notionPageId} className="border-t border-border">
                        <td className="p-2">{item.razaoSocial}</td>
                        <td className="p-2">{item.cnpj || item.cpf || "-"}</td>
                        <td className="p-2">{item.responsavel || "-"}</td>
                        <td className="p-2">{item.contatoInterno || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
