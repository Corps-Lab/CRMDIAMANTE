import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useAgency } from "@/contexts/AgencyContext";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { AppRole, ROLE_OPTIONS } from "@/lib/accessControl";
import {
  generateBrokerCode,
  normalizeCpf,
  normalizeCreci,
  registerBroker,
} from "@/lib/brokerRegistry";
import { supabase } from "@/integrations/supabase/client";

export default function Acessos() {
  const { signUp } = useAuth();
  const { currentAgency, isIsolated } = useAgency();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [creci, setCreci] = useState("");
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [nivel, setNivel] = useState<AppRole>("suporte");
  const [loading, setLoading] = useState(false);
  const [lastBrokerCode, setLastBrokerCode] = useState<string | null>(null);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setCpf("");
    setCreci("");
    setNome("");
    setCargo("");
    setNivel("suporte");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!email || !password || !cpf || !nome || !cargo) {
      toast.error("Preencha todos os campos.");
      setLoading(false);
      return;
    }
    const generatedBrokerCode =
      nivel === "vendas" ? generateBrokerCode(currentAgency.id, cpf) : undefined;

    const { error, userId } = await signUp(
      email,
      password,
      nome,
      "",
      nivel,
      cpf,
      cargo,
      creci,
      generatedBrokerCode,
    );
    if (error) {
      toast.error(error.message || "Erro ao criar acesso.");
    } else {
      if (nivel === "vendas") {
        try {
          if (!isIsolated && userId) {
            const payload = {
              agency_id: currentAgency.id,
              user_id: userId,
              nome: nome.trim(),
              email: email.trim().toLowerCase(),
              cpf: normalizeCpf(cpf),
              creci: normalizeCreci(creci),
              broker_code: generatedBrokerCode,
            };
            const { error: brokerError } = await supabase
              .from("broker_registry")
              .upsert(payload, { onConflict: "agency_id,cpf" });
            if (brokerError) throw brokerError;
            setLastBrokerCode(generatedBrokerCode || null);
            toast.success(
              `Acesso criado. Código único do corretor: ${generatedBrokerCode}`,
            );
          } else {
            const broker = registerBroker(currentAgency.id, {
              userId: userId || null,
              nome,
              email,
              cpf,
              creci,
              brokerCode: generatedBrokerCode,
            });
            setLastBrokerCode(broker.brokerCode);
            toast.success(
              `Acesso criado. Código único do corretor: ${broker.brokerCode}`,
            );
          }
        } catch (brokerErr: any) {
          const broker = registerBroker(currentAgency.id, {
            userId: userId || null,
            nome,
            email,
            cpf,
            creci,
            brokerCode: generatedBrokerCode,
          });
          setLastBrokerCode(broker.brokerCode);
          toast.warning(
            `Acesso criado. Código salvo localmente: ${broker.brokerCode}. (${brokerErr?.message || "Erro no Supabase"})`,
          );
        }
      } else {
        setLastBrokerCode(null);
        toast.success("Acesso criado com sucesso.");
      }
      resetForm();
    }
    setLoading(false);
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acessos</h1>
          <p className="text-sm text-muted-foreground">Cadastro de usuários e perfis de acesso</p>
        </div>

        <Card className="border border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Criar novo acesso</CardTitle>
            <p className="text-sm text-muted-foreground">
              Agência atual: <span className="text-foreground font-medium">{currentAgency.name}</span>
              {isIsolated ? " (modo mock local)" : ""}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>E-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="usuario@diamante.com.br" />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} placeholder="••••••••" />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>CRECI (opcional)</Label>
                <Input value={creci} onChange={(e) => setCreci(e.target.value)} placeholder="Ex: 123456-F" />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo / Squad" />
              </div>
              <div className="space-y-2">
                <Label>Nível de acesso</Label>
                <Select value={nivel} onValueChange={(v) => setNivel(v as AppRole)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {nivel === "vendas" && (
                <div className="md:col-span-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                  O codigo unico do corretor sera gerado automaticamente ao criar este acesso e vinculado ao CPF/CRECI.
                </div>
              )}
              <div className="md:col-span-2 flex gap-3">
                <Button type="button" variant="outline" className="flex-1 h-11" disabled={loading} onClick={resetForm}>
                  Limpar
                </Button>
                <Button type="submit" className="flex-1 h-11" disabled={loading}>
                  {loading ? "Criando..." : "Criar acesso"}
                </Button>
              </div>
              {lastBrokerCode && (
                <div className="md:col-span-2 rounded-md border border-primary/40 bg-card px-3 py-3">
                  <p className="text-sm text-muted-foreground">Codigo unico gerado para este corretor</p>
                  <p className="text-lg font-semibold text-primary">{lastBrokerCode}</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
