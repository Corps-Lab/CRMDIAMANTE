import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckSquare,
  MessageSquare,
  ShieldCheck,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  LogIn,
  Truck,
  Building2,
  FileSignature,
  Calculator,
  Wrench,
  CalendarClock,
  ClipboardCheck,
  HelpCircle as QuestionIcon,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import logoImage from "@/assets/logo.png";
import { useAgency } from "@/contexts/AgencyContext";
import { Badge } from "../ui/badge";
import { AccessPermission, canAccessPermission } from "@/lib/accessControl";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: string;
  permission: AccessPermission;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, permission: "dashboard" },
  { title: "Clientes", url: "/clientes", icon: Users, permission: "clientes" },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, permission: "fornecedores" },
  { title: "Obras", url: "/obras", icon: Building2, permission: "obras" },
  { title: "Funil de Vendas", url: "/funil", icon: FileSignature, permission: "funil" },
  { title: "Simulador CAIXA", url: "/simulador-caixa", icon: Calculator, permission: "simulador" },
  { title: "Assistência Técnica", url: "/assistencia", icon: Wrench, permission: "assistencia" },
  { title: "Diário de Obra (RDO)", url: "/rdo", icon: CalendarClock, permission: "rdo" },
  { title: "RFIs", url: "/rfis", icon: QuestionIcon, permission: "rfis" },
  { title: "Vistorias", url: "/vistorias", icon: ClipboardCheck, permission: "vistorias" },
  { title: "Importar CSV", url: "/importar", icon: Upload, permission: "importar" },
  { title: "Contratos", url: "/contratos", icon: FileText, permission: "contratos" },
  { title: "Entradas", url: "/entradas", icon: ArrowDownCircle, permission: "financeiro" },
  { title: "Despesas", url: "/despesas", icon: ArrowUpCircle, permission: "financeiro" },
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare, permission: "tarefas" },
  { title: "Sugestões e Reclamações", url: "/sugestoes", icon: MessageSquare, permission: "sugestoes" },
  { title: "Acessos", url: "/acessos", icon: ShieldCheck, permission: "acessos" },
  { title: "Suporte", url: "/suporte", icon: HelpCircle, permission: "suporte" },
];

const bottomItems: NavItem[] = [
  { title: "Meu Perfil", url: "/perfil", icon: User, permission: "perfil" },
];

interface AppSidebarProps {
  onClose?: () => void;
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { role, user, signOut } = useAuth();
  const { currentAgency, isIsolated } = useAgency();

  const isActive = (url: string) => location.pathname === url;

  const filterByRole = (items: NavItem[]) => {
    return items.filter((item) => canAccessPermission(role, item.permission));
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <img src={logoImage} alt="CRM DIAMANTE" className="w-10 h-10 object-contain" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-foreground">CRM DIAMANTE</span>
            <span className="text-sm text-primary">Painel</span>
            <Badge variant="outline" className="mt-1 w-fit">
              {currentAgency.name} {isIsolated ? "· mock local" : "· online"}
            </Badge>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {filterByRole(navItems).map((item) => (
            <li key={item.url}>
              <Link
                to={item.url}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  isActive(item.url)
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0",
                    isActive(item.url) ? "text-primary" : "group-hover:text-primary"
                  )}
                />
                {!collapsed && (
                  <span className="flex-1 text-sm font-medium">{item.title}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom items */}
      <div className="border-t border-sidebar-border py-4">
        <ul className="space-y-1 px-2">
          {filterByRole(bottomItems).map((item) => (
            <li key={item.url}>
              <Link
                to={item.url}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  isActive(item.url)
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0",
                    isActive(item.url) ? "text-primary" : "group-hover:text-primary"
                  )}
                />
                {!collapsed && (
                  <span className="text-sm font-medium">{item.title}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Auth button */}
      <div className="border-t border-sidebar-border px-2 py-2">
        {user ? (
          <button
            onClick={() => { signOut(); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Sair</span>}
          </button>
        ) : (
          <Link
            to="/auth"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-primary hover:bg-primary/10 transition-colors"
          >
            <LogIn className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Entrar</span>}
          </Link>
        )}
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center p-3 border-t border-sidebar-border text-sidebar-foreground hover:text-primary hover:bg-sidebar-accent transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <ChevronLeft className="w-5 h-5" />
        )}
      </button>
    </aside>
  );
}
