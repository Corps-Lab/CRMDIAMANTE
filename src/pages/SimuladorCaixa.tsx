import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useClients } from "@/contexts/ClientContext";
import { useAgency } from "@/contexts/AgencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, ExternalLink, Save, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type SistemaAmortizacao = "price" | "sac";
type ValidationStatus = "sem_conferencia" | "conferido" | "divergente";

interface SimulationFormState {
  clientId: string;
  pessoa: "F" | "J";
  tipoImovel: string;
  grupoTipoFinanciamento: string;
  uf: string;
  cidadeCodigo: string;
  dataNascimento: string;
  valorImovel: number;
  entrada: number;
  subsidio: number;
  despesasFinanciadas: number;
  prazoMeses: number;
  taxaAnualContrato: number;
  trAnual: number;
  sistema: SistemaAmortizacao;
  segurosMensais: number;
  taxaAdministracaoMensal: number;
  rendaMensal: number;
  parcelaOficialCaixa: number;
}

interface SimulationResult {
  valorFinanciado: number;
  taxaMensalContrato: number;
  taxaMensalTr: number;
  taxaMensalEfetiva: number;
  parcelaBaseInicial: number;
  parcelaBaseFinal: number;
  parcelaInicial: number;
  parcelaFinal: number;
  parcelaMedia: number;
  totalPago: number;
  totalJurosContrato: number;
  totalEncargosFixos: number;
  comprometimentoRenda: number | null;
  parcelaOficialCaixa: number | null;
  diferencaParcelaOficial: number | null;
  validationStatus: ValidationStatus;
}

interface SavedSimulation extends SimulationFormState, SimulationResult {
  id: string;
  clientName: string;
  createdAt: string;
}

interface OfficialSimulationResponse {
  parcelaOficial: number;
  ultimaParcela: number | null;
  prazoMeses: number;
  valorFinanciamento: number;
  jurosNominalAnual: number | null;
  segurosMensais: number;
  taxaAdministracaoMensal: number;
  sistemaAmortizacaoCodigo: number | null;
  sistemaAmortizacaoNome: string | null;
  seguradora: string | null;
}

interface CityOption {
  codigo: string;
  nome: string;
}

const tipoImovelOptions = [
  { value: "1", label: "Residencial" },
  { value: "2", label: "Comercial" },
  { value: "5", label: "Rural" },
];

const categoriaFinanciamentoOptions = [
  { value: "1", label: "Aquisicao de Imovel Novo" },
  { value: "4", label: "Aquisicao de Imovel Usado" },
  { value: "6", label: "Aquisicao de Terreno" },
  { value: "2", label: "Construcao" },
  { value: "7", label: "Emprestimo com Garantia de Imovel" },
  { value: "11", label: "Imoveis CAIXA" },
  { value: "3", label: "Reforma e/ou Ampliacao" },
];

const ufOptions = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

const OFFICIAL_CAIXA_URL =
  "https://www.caixa.gov.br/voce/habitacao/financiamento/aquisicao-imovel-novo/Paginas/default.aspx#simulador-caixa";
const CAIXA_PROXY_BASE = import.meta.env.VITE_CAIXA_PROXY_BASE || "/api/caixa";

const initialFormState: SimulationFormState = {
  clientId: "",
  pessoa: "F",
  tipoImovel: "1",
  grupoTipoFinanciamento: "1",
  uf: "SP",
  cidadeCodigo: "3550308",
  dataNascimento: "01/01/1985",
  valorImovel: 450000,
  entrada: 90000,
  subsidio: 0,
  despesasFinanciadas: 0,
  prazoMeses: 360,
  taxaAnualContrato: 10.5,
  trAnual: 0,
  sistema: "price",
  segurosMensais: 320,
  taxaAdministracaoMensal: 25,
  rendaMensal: 12000,
  parcelaOficialCaixa: 0,
};

const maxDifferenceToConfirm = 0.01;

export default function SimuladorCaixa() {
  const { clients } = useClients();
  const { currentAgency } = useAgency();
  const { user } = useAuth();
  const [form, setForm] = useState<SimulationFormState>(initialFormState);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<SavedSimulation[]>([]);
  const [officialData, setOfficialData] = useState<OfficialSimulationResponse | null>(null);
  const [isOfficialLoading, setIsOfficialLoading] = useState(false);
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [isCitiesLoading, setIsCitiesLoading] = useState(false);
  const [cityLoadError, setCityLoadError] = useState(false);

  const storageKey = useMemo(
    () => `crm_${currentAgency.id}_${user?.id ?? "anon"}_simulador_caixa`,
    [currentAgency.id, user?.id],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed: SavedSimulation[] = raw ? JSON.parse(raw) : [];
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, [storageKey]);

  useEffect(() => {
    const normalizedUf = form.uf.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    if (normalizedUf !== form.uf) {
      setForm((prev) => ({ ...prev, uf: normalizedUf }));
      return;
    }

    if (normalizedUf.length !== 2) {
      setCityOptions([]);
      setCityLoadError(false);
      return;
    }

    let active = true;
    setIsCitiesLoading(true);
    setCityLoadError(false);

    fetch(`${CAIXA_PROXY_BASE}/cidades?uf=${normalizedUf}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload?.ok || !Array.isArray(payload?.data)) {
          throw new Error(payload?.error || "Falha ao carregar cidades.");
        }

        if (!active) return;
        const cities = payload.data as CityOption[];
        setCityOptions(cities);
        setForm((prev) => {
          const cityStillValid = cities.some((city) => city.codigo === prev.cidadeCodigo);
          if (cityStillValid || !prev.cidadeCodigo) return prev;
          return { ...prev, cidadeCodigo: "" };
        });
      })
      .catch(() => {
        if (!active) return;
        setCityOptions([]);
        setCityLoadError(true);
      })
      .finally(() => {
        if (!active) return;
        setIsCitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.uf]);

  const saveHistory = (nextHistory: SavedSimulation[]) => {
    setHistory(nextHistory);
    localStorage.setItem(storageKey, JSON.stringify(nextHistory));
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));

  const numberInput =
    <K extends keyof SimulationFormState>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setForm((prev) => ({
        ...prev,
        [key]: raw === "" ? 0 : Number(raw),
      }));
    };

  const textInput =
    <K extends keyof SimulationFormState>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({
        ...prev,
        [key]: event.target.value,
      }));
    };

  const simulate = (state: SimulationFormState): SimulationResult => {
    const valorImovel = Number(state.valorImovel);
    const entrada = Number(state.entrada);
    const subsidio = Number(state.subsidio);
    const despesasFinanciadas = Number(state.despesasFinanciadas);
    const prazoMeses = Math.round(Number(state.prazoMeses));
    const taxaAnualContrato = Number(state.taxaAnualContrato);
    const trAnual = Number(state.trAnual);
    const rendaMensal = Number(state.rendaMensal);
    const segurosMensais = Number(state.segurosMensais);
    const taxaAdministracaoMensal = Number(state.taxaAdministracaoMensal);
    const parcelaOficialCaixa = Number(state.parcelaOficialCaixa);

    if (valorImovel <= 0) throw new Error("Informe um valor de imovel valido.");
    if (entrada < 0) throw new Error("Entrada nao pode ser negativa.");
    if (subsidio < 0) throw new Error("Subsidio nao pode ser negativo.");
    if (despesasFinanciadas < 0) throw new Error("Despesas financiadas nao podem ser negativas.");
    if (prazoMeses < 12 || prazoMeses > 420) throw new Error("Prazo deve ficar entre 12 e 420 meses.");
    if (taxaAnualContrato < 0 || taxaAnualContrato > 40) throw new Error("Taxa anual invalida.");
    if (trAnual < 0 || trAnual > 20) throw new Error("TR anual invalida.");
    if (segurosMensais < 0 || taxaAdministracaoMensal < 0) {
      throw new Error("Seguros e taxa administrativa nao podem ser negativos.");
    }

    const valorFinanciado = valorImovel + despesasFinanciadas - entrada - subsidio;
    if (valorFinanciado <= 0) {
      throw new Error("Valor financiado deve ser maior que zero.");
    }

    const taxaMensalContrato = Math.pow(1 + taxaAnualContrato / 100, 1 / 12) - 1;
    const taxaMensalTr = Math.pow(1 + trAnual / 100, 1 / 12) - 1;
    const taxaMensalEfetiva = (1 + taxaMensalContrato) * (1 + taxaMensalTr) - 1;

    const encargosFixosMensais = segurosMensais + taxaAdministracaoMensal;
    let parcelaBaseInicial = 0;
    let parcelaBaseFinal = 0;
    let totalPagoBase = 0;

    if (state.sistema === "price") {
      if (taxaMensalEfetiva <= 0) {
        parcelaBaseInicial = valorFinanciado / prazoMeses;
      } else {
        const fator = Math.pow(1 + taxaMensalEfetiva, prazoMeses);
        parcelaBaseInicial = valorFinanciado * ((taxaMensalEfetiva * fator) / (fator - 1));
      }
      parcelaBaseFinal = parcelaBaseInicial;
      totalPagoBase = parcelaBaseInicial * prazoMeses;
    } else {
      const amortizacaoMensal = valorFinanciado / prazoMeses;
      parcelaBaseInicial = amortizacaoMensal + valorFinanciado * taxaMensalEfetiva;
      parcelaBaseFinal = amortizacaoMensal + amortizacaoMensal * taxaMensalEfetiva;
      totalPagoBase = ((parcelaBaseInicial + parcelaBaseFinal) / 2) * prazoMeses;
    }

    const parcelaInicial = parcelaBaseInicial + encargosFixosMensais;
    const parcelaFinal = parcelaBaseFinal + encargosFixosMensais;
    const parcelaMedia = (parcelaInicial + parcelaFinal) / 2;
    const totalEncargosFixos = encargosFixosMensais * prazoMeses;
    const totalPago = totalPagoBase + totalEncargosFixos;
    const totalJurosContrato = totalPagoBase - valorFinanciado;
    const comprometimentoRenda = rendaMensal > 0 ? (parcelaInicial / rendaMensal) * 100 : null;

    const parcelaOficial = parcelaOficialCaixa > 0 ? parcelaOficialCaixa : null;
    const diferencaParcelaOficial =
      parcelaOficial === null ? null : parcelaInicial - parcelaOficial;
    const validationStatus: ValidationStatus =
      parcelaOficial === null
        ? "sem_conferencia"
        : Math.abs(diferencaParcelaOficial ?? 0) <= maxDifferenceToConfirm
          ? "conferido"
          : "divergente";

    return {
      valorFinanciado,
      taxaMensalContrato,
      taxaMensalTr,
      taxaMensalEfetiva,
      parcelaBaseInicial,
      parcelaBaseFinal,
      parcelaInicial,
      parcelaFinal,
      parcelaMedia,
      totalPago,
      totalJurosContrato,
      totalEncargosFixos,
      comprometimentoRenda,
      parcelaOficialCaixa: parcelaOficial,
      diferencaParcelaOficial,
      validationStatus,
    };
  };

  const handleCalculate = () => {
    try {
      const next = simulate(form);
      setResult(next);
      if (next.validationStatus === "divergente") {
        toast.warning("Divergencia com o valor oficial informado. Revise os parametros.");
      } else {
        toast.success("Simulacao calculada.");
      }
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao calcular simulacao.";
      toast.error(message);
      return null;
    }
  };

  const handleFetchOfficial = async () => {
    if (form.valorImovel <= 0 || form.rendaMensal <= 0 || !form.cidadeCodigo) {
      toast.error("Preencha valor do imovel, renda e cidade para consultar a CAIXA.");
      return;
    }

    setIsOfficialLoading(true);
    try {
      const response = await fetch(`${CAIXA_PROXY_BASE}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valorImovel: form.valorImovel,
          recursosProprios: Math.max(0, form.entrada),
          prazoMeses: form.prazoMeses,
          rendaMensal: form.rendaMensal,
          dataNascimento: form.dataNascimento,
          uf: form.uf,
          cidadeCodigo: form.cidadeCodigo,
          pessoa: form.pessoa,
          tipoImovel: form.tipoImovel,
          grupoTipoFinanciamento: form.grupoTipoFinanciamento,
          sistema: form.sistema,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload?.data) {
        throw new Error(payload?.error || "Nao foi possivel consultar o simulador oficial.");
      }

      const official = payload.data as OfficialSimulationResponse;
      setOfficialData(official);

      const nextForm: SimulationFormState = {
        ...form,
        parcelaOficialCaixa: official.parcelaOficial,
        prazoMeses: official.prazoMeses || form.prazoMeses,
        taxaAnualContrato:
          official.jurosNominalAnual && official.jurosNominalAnual > 0
            ? official.jurosNominalAnual
            : form.taxaAnualContrato,
        segurosMensais: official.segurosMensais > 0 ? official.segurosMensais : form.segurosMensais,
        taxaAdministracaoMensal:
          official.taxaAdministracaoMensal > 0 ? official.taxaAdministracaoMensal : form.taxaAdministracaoMensal,
      };

      setForm(nextForm);
      const nextResult = simulate(nextForm);
      setResult(nextResult);

      if (form.sistema === "sac" && official.sistemaAmortizacaoCodigo !== 30) {
        toast.warning("A consulta oficial retornou PRICE. Para SAC, confira manualmente no simulador oficial.");
      } else {
        toast.success("Parcela oficial da CAIXA preenchida automaticamente.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao consultar simulador oficial.";
      toast.error(message);
    } finally {
      setIsOfficialLoading(false);
    }
  };

  const handleSave = () => {
    const calculated = result ?? handleCalculate();
    if (!calculated) return;

    if (calculated.validationStatus === "sem_conferencia") {
      toast.error("Informe a parcela oficial da CAIXA para salvar com conferencia.");
      return;
    }
    if (calculated.validationStatus === "divergente") {
      toast.error("A simulacao diverge da CAIXA. Ajuste os parametros antes de salvar.");
      return;
    }

    const clientName =
      clients.find((client) => client.id === form.clientId)?.razaoSocial || "Nao vinculado";

    const record: SavedSimulation = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      ...form,
      ...calculated,
      clientName,
      createdAt: new Date().toISOString(),
    };

    saveHistory([record, ...history].slice(0, 80));
    toast.success("Simulacao salva com sucesso.");
  };

  const handleClear = () => {
    setForm(initialFormState);
    setResult(null);
    setOfficialData(null);
  };

  const handleDelete = (id: string) => {
    saveHistory(history.filter((item) => item.id !== id));
  };

  const restoreFromHistory = (item: SavedSimulation) => {
    setForm({
      clientId: item.clientId,
      pessoa: item.pessoa || initialFormState.pessoa,
      tipoImovel: item.tipoImovel || initialFormState.tipoImovel,
      grupoTipoFinanciamento: item.grupoTipoFinanciamento || initialFormState.grupoTipoFinanciamento,
      uf: item.uf || initialFormState.uf,
      cidadeCodigo: item.cidadeCodigo || initialFormState.cidadeCodigo,
      dataNascimento: item.dataNascimento || initialFormState.dataNascimento,
      valorImovel: item.valorImovel,
      entrada: item.entrada,
      subsidio: item.subsidio,
      despesasFinanciadas: item.despesasFinanciadas,
      prazoMeses: item.prazoMeses,
      taxaAnualContrato: item.taxaAnualContrato,
      trAnual: item.trAnual,
      sistema: item.sistema,
      segurosMensais: item.segurosMensais,
      taxaAdministracaoMensal: item.taxaAdministracaoMensal,
      rendaMensal: item.rendaMensal,
      parcelaOficialCaixa: item.parcelaOficialCaixa || 0,
    });
    setResult(item);
    setOfficialData(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Simulador CAIXA</h1>
            <p className="text-sm text-muted-foreground">
              Modo precisao: simule, confira com a CAIXA oficial e salve apenas quando bater.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2 self-start lg:self-auto">
            <a href={OFFICIAL_CAIXA_URL} target="_blank" rel="noreferrer">
              Abrir simulador oficial CAIXA
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2 border border-primary/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5 text-primary" />
                Dados da simulacao
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Cliente (opcional)</Label>
                  <Select
                    value={form.clientId || "none"}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, clientId: value === "none" ? "" : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nao vincular cliente</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.razaoSocial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 rounded-lg border border-border/70 p-3 md:col-span-2">
                  <p className="text-sm font-medium text-foreground">Parametros oficiais CAIXA (consulta automatica)</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Pessoa</Label>
                      <Select
                        value={form.pessoa}
                        onValueChange={(value: "F" | "J") =>
                          setForm((prev) => ({ ...prev, pessoa: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="F">Fisica</SelectItem>
                          <SelectItem value="J">Juridica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de imovel</Label>
                      <Select
                        value={form.tipoImovel}
                        onValueChange={(value) =>
                          setForm((prev) => ({ ...prev, tipoImovel: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {tipoImovelOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Categoria de financiamento</Label>
                      <Select
                        value={form.grupoTipoFinanciamento}
                        onValueChange={(value) =>
                          setForm((prev) => ({ ...prev, grupoTipoFinanciamento: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriaFinanciamentoOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>UF</Label>
                      <Select
                        value={form.uf}
                        onValueChange={(value) =>
                          setForm((prev) => ({ ...prev, uf: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {ufOptions.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Cidade (IBGE)</Label>
                      <Select
                        value={form.cidadeCodigo || "none"}
                        onValueChange={(value) =>
                          setForm((prev) => ({ ...prev, cidadeCodigo: value === "none" ? "" : value }))
                        }
                        disabled={isCitiesLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isCitiesLoading ? "Carregando cidades..." : "Selecione a cidade"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione a cidade</SelectItem>
                          {cityOptions.map((city) => (
                            <SelectItem key={city.codigo} value={city.codigo}>
                              {city.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isCitiesLoading && (
                        <p className="text-xs text-muted-foreground">Buscando cidades oficiais da CAIXA...</p>
                      )}
                      {(cityLoadError || cityOptions.length === 0) && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Nao foi possivel carregar a lista agora. Informe o codigo IBGE manualmente.
                          </p>
                          <Input
                            placeholder="Ex.: 3550308"
                            value={form.cidadeCodigo}
                            onChange={textInput("cidadeCodigo")}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Data de nascimento (DD/MM/AAAA)</Label>
                      <Input value={form.dataNascimento} onChange={textInput("dataNascimento")} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Valor do imovel (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={form.valorImovel} onChange={numberInput("valorImovel")} />
                </div>

                <div className="space-y-2">
                  <Label>Entrada (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={form.entrada} onChange={numberInput("entrada")} />
                </div>

                <div className="space-y-2">
                  <Label>Subsidio (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={form.subsidio} onChange={numberInput("subsidio")} />
                </div>

                <div className="space-y-2">
                  <Label>Despesas financiadas (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.despesasFinanciadas}
                    onChange={numberInput("despesasFinanciadas")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Prazo (meses)</Label>
                  <Input type="number" min={12} max={420} value={form.prazoMeses} onChange={numberInput("prazoMeses")} />
                </div>

                <div className="space-y-2">
                  <Label>Sistema de amortizacao</Label>
                  <Select
                    value={form.sistema}
                    onValueChange={(value: SistemaAmortizacao) =>
                      setForm((prev) => ({ ...prev, sistema: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price">PRICE (parcela constante)</SelectItem>
                      <SelectItem value="sac">SAC (parcela decrescente)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Taxa anual do contrato (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={40}
                    step="0.01"
                    value={form.taxaAnualContrato}
                    onChange={numberInput("taxaAnualContrato")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>TR anual (%)</Label>
                  <Input type="number" min={0} max={20} step="0.01" value={form.trAnual} onChange={numberInput("trAnual")} />
                </div>

                <div className="space-y-2">
                  <Label>Seguros mensais (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.segurosMensais}
                    onChange={numberInput("segurosMensais")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Taxa administrativa mensal (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.taxaAdministracaoMensal}
                    onChange={numberInput("taxaAdministracaoMensal")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Renda mensal (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={form.rendaMensal} onChange={numberInput("rendaMensal")} />
                </div>

                <div className="space-y-2">
                  <Label>Parcela oficial CAIXA (R$) para conferencia</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.parcelaOficialCaixa}
                    onChange={numberInput("parcelaOficialCaixa")}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/70 p-3">
                <p className="text-sm font-medium text-foreground">Conferencia oficial obrigatoria para salvar</p>
                <p className="text-xs text-muted-foreground">
                  O CRM salva apenas quando a diferenca com a parcela oficial ficar ate {formatCurrency(maxDifferenceToConfirm)}.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" className="gap-2" onClick={handleCalculate}>
                  <Calculator className="h-4 w-4" />
                  Calcular simulacao
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleFetchOfficial}
                  disabled={isOfficialLoading}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isOfficialLoading ? "Consultando CAIXA..." : "Buscar parcela oficial CAIXA"}
                </Button>
                <Button type="button" variant="secondary" className="gap-2" onClick={handleSave}>
                  <Save className="h-4 w-4" />
                  Salvar no CRM
                </Button>
                <Button type="button" variant="outline" onClick={handleClear}>
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-primary/25">
            <CardHeader>
              <CardTitle className="text-lg">Resultado estimado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result ? (
                <>
                  <MetricRow label="Valor financiado" value={formatCurrency(result.valorFinanciado)} />
                  <MetricRow label="Taxa mensal contrato" value={`${result.taxaMensalContrato.toFixed(4)}%`} />
                  <MetricRow label="Taxa mensal TR" value={`${result.taxaMensalTr.toFixed(4)}%`} />
                  <MetricRow label="Taxa mensal efetiva" value={`${result.taxaMensalEfetiva.toFixed(4)}%`} />
                  <MetricRow label="Parcela inicial" value={formatCurrency(result.parcelaInicial)} />
                  <MetricRow label="Parcela final" value={formatCurrency(result.parcelaFinal)} />
                  <MetricRow label="Parcela media" value={formatCurrency(result.parcelaMedia)} />
                  <MetricRow label="Total pago" value={formatCurrency(result.totalPago)} />
                  <MetricRow label="Total juros contrato" value={formatCurrency(result.totalJurosContrato)} />
                  <MetricRow label="Total encargos fixos" value={formatCurrency(result.totalEncargosFixos)} />
                  <div className="pt-2 space-y-2">
                    <Badge variant="outline">
                      Comprometimento:{" "}
                      {result.comprometimentoRenda === null
                        ? "n/a"
                        : `${result.comprometimentoRenda.toFixed(1)}% da renda`}
                    </Badge>
                    <div>{validationBadge(result.validationStatus, result.diferencaParcelaOficial, formatCurrency)}</div>
                    {officialData && (
                      <div className="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
                        Oficial CAIXA: {formatCurrency(officialData.parcelaOficial)}
                        {officialData.seguradora ? ` • Seguradora: ${officialData.seguradora}` : ""}
                        {officialData.sistemaAmortizacaoNome ? ` • Sistema: ${officialData.sistemaAmortizacaoNome}` : ""}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">
                    Para proposta final, confira no simulador oficial da CAIXA e mantenha status como conferido.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Preencha os dados e clique em calcular para ver as parcelas e a conferencia oficial.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Historico de simulacoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma simulacao salva ainda.</p>
            )}

            {history.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-card/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{item.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)} • {item.sistema.toUpperCase()} • {item.prazoMeses} meses
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {validationBadge(item.validationStatus, item.diferencaParcelaOficial, formatCurrency)}
                    <Button variant="outline" size="sm" className="h-8" onClick={() => restoreFromHistory(item)}>
                      Usar dados
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                  <SmallInfo label="Imovel" value={formatCurrency(item.valorImovel)} />
                  <SmallInfo label="Entrada" value={formatCurrency(item.entrada)} />
                  <SmallInfo label="Financiado" value={formatCurrency(item.valorFinanciado)} />
                  <SmallInfo label="Parcela inicial" value={formatCurrency(item.parcelaInicial)} />
                  <SmallInfo label="Parcela oficial" value={item.parcelaOficialCaixa ? formatCurrency(item.parcelaOficialCaixa) : "Nao informado"} />
                  <SmallInfo label="Diferenca" value={item.diferencaParcelaOficial === null ? "n/a" : formatCurrency(item.diferencaParcelaOficial)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function validationBadge(
  status: ValidationStatus,
  diff: number | null,
  formatCurrency: (value: number) => string,
) {
  if (status === "conferido") {
    return (
      <Badge className="bg-primary/20 text-primary border-primary/40 gap-1">
        <ShieldCheck className="h-3.5 w-3.5" />
        Conferido com CAIXA
      </Badge>
    );
  }

  if (status === "divergente") {
    return (
      <Badge variant="destructive" className="gap-1">
        Divergente ({formatCurrency(diff ?? 0)})
      </Badge>
    );
  }

  return (
    <Badge variant="outline">Sem conferencia oficial</Badge>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 p-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/45 p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}
