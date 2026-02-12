import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";

export default function Sugestoes() {
  const [texto, setTexto] = useState("");

  const enviar = () => {
    if (!texto.trim()) {
      toast.error("Digite sua sugestão ou reclamação.");
      return;
    }
    const mailto = `mailto:suporte@clabs.ag?subject=Sugestao/Reclamacao&body=${encodeURIComponent(texto)}`;
    window.location.href = mailto;
    toast.success("Abrindo email para enviar sua mensagem.");
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Sugestões e Reclamações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Descreva sua sugestão ou reclamação..."
              className="min-h-[140px]"
            />
            <div className="flex gap-2">
              <Button onClick={enviar} className="gap-2">
                <Mail className="w-4 h-4" /> Enviar por email
              </Button>
              <Button variant="ghost" onClick={() => setTexto("")}>Limpar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
