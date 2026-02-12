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
  CreditCard,
  ShieldCheck,
  HelpCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import logoImage from "@/assets/logo.png";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Entradas", url: "/entradas", icon: ArrowDownCircle },
  { title: "Despesas", url: "/despesas", icon: ArrowUpCircle },
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare, badge: "NOVO" },
  { title: "Sugestões e Reclamações", url: "/sugestoes", icon: MessageSquare },
  { title: "Acessos", url: "/acessos", icon: ShieldCheck },
  { title: "Suporte", url: "/suporte", icon: HelpCircle },
];

const bottomItems: NavItem[] = [
  { title: "Meu Perfil", url: "/perfil", icon: User },
  { title: "Excluir Dados", url: "/excluir", icon: Trash2, adminOnly: true },
];

// Filter items - show all items except adminOnly ones (unless user is admin)

interface AppSidebarProps {
  onClose?: () => void;
}

export function AppSidebar({ onClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isAdmin, user, signOut } = useAuth();

  const isActive = (url: string) => location.pathname === url;

  // Show all items freely, only hide adminOnly items for non-admins
  const filterByRole = (items: NavItem[]) => {
    return items.filter((item) => !item.adminOnly || isAdmin);
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
        <img src={logoImage} alt="C.LABS" className="w-10 h-10 object-contain" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-foreground">C.LABS</span>
            <span className="text-sm text-primary">CRM</span>
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
