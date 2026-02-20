import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAgency } from "@/contexts/AgencyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logoImage from "@/assets/logo.png";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, user } = useAuth();
  const { currentAgency, switchAgency } = useAgency();
  const navigate = useNavigate();

  useEffect(() => {
    // Keep authentication fixed to the main Diamante workspace.
    if (currentAgency.id !== "diamante") {
      switchAgency("diamante");
    }
  }, [currentAgency.id, switchAgency]);

  // If already logged in, redirect
  if (user) {
    navigate("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      toast.error(error.message || "Erro ao fazer login");
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 sm:px-6 relative overflow-hidden bg-background">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, var(--auth-glow-1), transparent 32%)," +
            "radial-gradient(circle at 80% 10%, var(--auth-glow-2), transparent 30%)," +
            "linear-gradient(140deg, var(--auth-bg-1), var(--auth-bg-2))",
        }}
      />

      <Card className="w-full max-w-md border border-primary/30 bg-black/40 backdrop-blur-xl shadow-xl shadow-primary/20">
        <CardHeader className="text-center space-y-3 pb-3">
          <div className="flex justify-center">
            <img src={logoImage} alt="CRM DIAMANTE" className="w-20 h-20 object-contain" />
          </div>
          <CardTitle className="text-2xl text-white">Acesso seguro</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Faça login para acessar o CRM DIAMANTE.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
            Ambiente: CRM DIAMANTE
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-white">E-mail</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                  <Mail className="w-5 h-5" aria-hidden="true" />
                </span>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="suporte@diamante.com.br"
                  required
                  className="h-12 pl-12 pr-4 text-base bg-black/40 border-primary/40 focus-visible:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-white">Senha</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                  <Lock className="w-5 h-5" aria-hidden="true" />
                </span>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="h-12 pl-12 pr-12 text-base bg-black/40 border-primary/40 focus-visible:ring-primary"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-lg border border-primary/60 bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Mostrar ou ocultar senha"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/30"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="text-sm text-muted-foreground">
            Precisa de ajuda? <a className="font-semibold underline" href="mailto:suporte@diamante.com.br">suporte@diamante.com.br</a>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            A criação de usuários é feita somente no dashboard do ADM. Se não tiver acesso, abra um chamado interno.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
