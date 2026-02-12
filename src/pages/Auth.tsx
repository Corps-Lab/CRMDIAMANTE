import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import logoImage from "@/assets/logo.png";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect
  if (user) {
    navigate("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message || "Erro ao fazer login");
      } else {
        toast.success("Login realizado com sucesso!");
        navigate("/");
      }
    } else {
      if (!nome.trim()) {
        toast.error("Informe seu nome");
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, nome, telefone, "admin", undefined, undefined);
      if (error) {
        toast.error(error.message || "Erro ao criar conta");
      } else {
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 sm:px-6 relative overflow-hidden bg-[#050505]">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.16), transparent 32%)," +
            "radial-gradient(circle at 80% 10%, rgba(124, 58, 237, 0.22), transparent 30%)," +
            "linear-gradient(140deg, #050505, #0d0d12)",
        }}
      />

      <Card className="w-full max-w-md border border-primary/30 bg-black/40 backdrop-blur-xl shadow-xl shadow-primary/20">
        <CardHeader className="text-center space-y-3 pb-3">
          <div className="flex justify-center">
            <img src={logoImage} alt="C.LABS" className="w-20 h-20 object-contain" />
          </div>
          <CardTitle className="text-2xl text-white">Acesso seguro</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Acesso liberado pelo ADM do CRM. Use seu e-mail corporativo.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
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
                  placeholder="squad@clabs.ag"
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

            <div className="flex items-center gap-3 pl-1">
              <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(!!v)} className="border-primary/60 data-[state=checked]:bg-primary data-[state=checked]:text-black" />
              <Label htmlFor="remember" className="text-sm text-white">Manter conectado</Label>
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
            Precisa de ajuda? <a className="font-semibold underline" href="mailto:suporte@clabs.ag">suporte@clabs.ag</a>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            A criação de usuários é feita somente no dashboard do ADM. Se não tiver acesso, abra um chamado interno.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
