import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare } from "lucide-react";

export default function Suporte() {
  const abrirMailto = () => {
    window.location.href = "mailto:suporte@diamante.com.br?subject=Suporte%20CRM%20DIAMANTE";
  };

  const abrirSlack = () => {
    window.open("https://slack.com/app_redirect?channel=support", "_blank");
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Suporte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Abra um chamado pelo e-mail ou Slack interno.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={abrirMailto} className="gap-2">
                <Mail className="w-4 h-4" /> Email suporte@diamante.com.br
              </Button>
              <Button variant="outline" onClick={abrirSlack} className="gap-2">
                <MessageSquare className="w-4 h-4" /> Slack suporte
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
