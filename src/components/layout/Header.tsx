import { Calendar, ChevronDown, Menu, LogOut, User, Settings } from "lucide-react";
import { BellDot, AlarmClock, AlertTriangle } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/lib/accessControl";

interface HeaderProps {
  totalCaixa: number;
  onMenuClick?: () => void;
}

const severityToClasses = (sev: "info" | "warn" | "danger") => ({
  info: "text-info",
  warn: "text-primary",
  danger: "text-info"
}[sev]);

export function Header({ totalCaixa, onMenuClick }: HeaderProps) {
  const { profile, role, signOut, user } = useAuth();
  const { notifications, clearNotifications } = useNotifications();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="flex items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4 bg-card border-b border-border">
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>
        
        <div className="min-w-0">
          <p className="text-[11px] sm:text-sm text-muted-foreground">Caixa Total</p>
          <p className="text-base sm:text-2xl font-bold text-primary truncate">{formatCurrency(totalCaixa)}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        {/* Period Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="hidden sm:inline-flex gap-2 px-3 py-2 h-10 text-sm lg:px-4 lg:h-10"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Selecionar Período</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Hoje</DropdownMenuItem>
            <DropdownMenuItem>Esta Semana</DropdownMenuItem>
            <DropdownMenuItem>Este Mês</DropdownMenuItem>
            <DropdownMenuItem>Este Ano</DropdownMenuItem>
            <DropdownMenuItem>Período Personalizado</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
              <BellDot className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 min-w-[20px] px-1 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {notifications.length}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-1.5rem)] max-w-72 max-h-96 overflow-y-auto">
            {notifications.length > 0 && (
              <DropdownMenuItem
                className="text-xs justify-between text-muted-foreground"
                onClick={clearNotifications}
              >
                Limpar notificações
              </DropdownMenuItem>
            )}
            {notifications.length > 0 && <DropdownMenuSeparator />}
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex items-start gap-3 py-3">
                {n.type === "prazo" ? (
                  <AlarmClock className={`w-4 h-4 mt-0.5 ${severityToClasses(n.severity)}`} />
                ) : (
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${severityToClasses(n.severity)}`} />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{n.description}</p>
                </div>
              </DropdownMenuItem>
            ))}
            {notifications.length === 0 && (
              <DropdownMenuItem className="text-sm text-muted-foreground">Sem notificações</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile Dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
                <Avatar className="w-9 h-9 sm:w-10 sm:h-10">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.nome} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                    {profile?.nome ? getInitials(profile.nome) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-foreground">{profile?.nome || "Usuário"}</p>
                  <Badge variant="default" className="text-xs">
                    {getRoleLabel(role)}
                  </Badge>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground hidden lg:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/perfil" className="flex items-center gap-2 cursor-pointer">
                  <User className="w-4 h-4" />
                  Meu Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 text-destructive">
                <LogOut className="w-4 h-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
