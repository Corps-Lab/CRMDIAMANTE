import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Camera, Loader2, Mail, Phone, User, Shield, BellDot } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNotifications } from "@/hooks/useNotifications";
import { getRoleDescription, getRoleLabel, normalizeRole } from "@/lib/accessControl";

export default function Perfil() {
  const { user, profile, role, signOut, updateProfile, uploadAvatar } = useAuth();
  const { enabled: notificationsEnabled, setEnabled: setNotificationsEnabled, requestPermission, permission, clearNotifications } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(profile?.nome || "");
  const [telefone, setTelefone] = useState(profile?.telefone || "");

  const handleSave = async () => {
    setIsLoading(true);
    const { error } = await updateProfile({ nome, telefone });
    setIsLoading(false);

    if (error) {
      toast.error("Erro ao atualizar perfil");
    } else {
      toast.success("Perfil atualizado com sucesso!");
    }
  };

  const handleToggleNotifications = async (checked: boolean) => {
    if (!checked) {
      setNotificationsEnabled(false);
      clearNotifications();
      toast.message("Notificações desativadas");
      return;
    }
    // enabling
    const result = await requestPermission();
    if (result === "granted") {
      setNotificationsEnabled(true);
      toast.success("Notificações ativadas");
    } else {
      setNotificationsEnabled(false);
      toast.error("Ative permissões no navegador para receber notificações.");
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setIsUploading(true);
    const { url, error } = await uploadAvatar(file);
    setIsUploading(false);

    if (error) {
      toast.error("Erro ao fazer upload da foto");
    } else {
      toast.success("Foto atualizada com sucesso!");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const effectiveRole = normalizeRole(role || profile?.nivel_acesso || "colaborador");

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais</p>
        </div>

        {/* Avatar Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Foto de Perfil
            </CardTitle>
            <CardDescription>Clique na foto para alterar</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="relative">
              <Avatar
                className="w-24 h-24 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleAvatarClick}
              >
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.nome} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {profile?.nome ? getInitials(profile.nome) : "U"}
                </AvatarFallback>
              </Avatar>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{profile?.nome || "Usuário"}</h3>
              <p className="text-muted-foreground">{user?.email}</p>
              <Badge variant={effectiveRole === "admin" || effectiveRole === "ceo" ? "default" : "secondary"} className="mt-2">
                <Shield className="w-3 h-3 mr-1" />
                {getRoleLabel(effectiveRole)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>Atualize seus dados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome Completo
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O email não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Telefone
              </Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Nível de Acesso
              </Label>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{getRoleLabel(effectiveRole)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getRoleDescription(effectiveRole)}
                </p>
              </div>
            </div>

            <div className="flex gap-3 w-full mt-4">
              <Button onClick={handleSave} disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
              <Button variant="outline" className="w-36" onClick={signOut}>
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notificações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellDot className="w-5 h-5" />
              Notificações
            </CardTitle>
            <CardDescription>Controle o recebimento de alertas do app</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-foreground font-medium">Alertas e lembretes</p>
              <p className="text-sm text-muted-foreground">
                Receba avisos de prazos e pagamentos. Status: {notificationsEnabled ? "ativado" : "desativado"} {permission !== "granted" && notificationsEnabled ? "(permita no navegador)" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={notificationsEnabled} onCheckedChange={handleToggleNotifications} />
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
