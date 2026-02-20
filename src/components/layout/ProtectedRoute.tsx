import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { canAccessPath, getHomePathForRole } from "@/lib/accessControl";

export function ProtectedRoute() {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role && !canAccessPath(role, location.pathname)) {
    return <Navigate to={getHomePathForRole(role)} replace />;
  }

  return <Outlet />;
}
