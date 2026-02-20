import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { isOnlineRuntime } from "@/lib/runtime";

export type AgencyMode = "shared" | "isolated";

export interface AgencyTheme {
  primary: string;
  accent?: string;
  chartStart?: string;
  chartEnd?: string;
  glow?: string;
}

export interface AgencyConfig {
  id: string;
  name: string;
  description?: string;
  mode: AgencyMode;
  theme: AgencyTheme;
}

interface AgencyContextType {
  agencies: AgencyConfig[];
  currentAgency: AgencyConfig;
  switchAgency: (id: string) => void;
  isIsolated: boolean;
}

const agencies: AgencyConfig[] = [
  {
    id: "diamante",
    name: "CRM Diamante",
    mode: isOnlineRuntime ? "shared" : "isolated",
    description: isOnlineRuntime
      ? "Ambiente online conectado ao Supabase."
      : "Ambiente local em modo mock (sem dependencia de Supabase).",
    theme: {
      primary: "38 96% 53%",
      accent: "38 96% 53%",
      chartStart: "38 96% 53%",
      chartEnd: "30 100% 45%",
      glow: "38 96% 53% / 0.22",
    },
  },
];

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

const STORAGE_KEY = "crm_current_agency";

function applyTheme(config: AgencyConfig) {
  const root = document.documentElement;
  root.dataset.agency = config.id;
  root.style.setProperty("--primary", config.theme.primary);
  if (config.theme.accent) root.style.setProperty("--accent", config.theme.accent);
  if (config.theme.chartStart) root.style.setProperty("--chart-primary", config.theme.chartStart);
  if (config.theme.chartStart) root.style.setProperty("--chart-gradient-start", config.theme.chartStart);
  if (config.theme.chartEnd) root.style.setProperty("--chart-gradient-end", config.theme.chartEnd);
  if (config.theme.glow) root.style.setProperty("--glow-primary", config.theme.glow);
}

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [currentId, setCurrentId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const paramAgency = params.get("agency");
    if (paramAgency && agencies.some((a) => a.id === paramAgency)) return paramAgency;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && agencies.some((a) => a.id === stored) ? stored : agencies[0].id;
  });

  const currentAgency = useMemo(
    () => agencies.find((a) => a.id === currentId) || agencies[0],
    [currentId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentAgency.id);
    applyTheme(currentAgency);
  }, [currentAgency]);

  const switchAgency = (id: string) => {
    if (agencies.some((a) => a.id === id)) {
      setCurrentId(id);
    }
  };

  return (
    <AgencyContext.Provider
      value={{
        agencies,
        currentAgency,
        switchAgency,
        isIsolated: currentAgency.mode === "isolated",
      }}
    >
      {children}
    </AgencyContext.Provider>
  );
}

export function useAgency() {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error("useAgency must be used within an AgencyProvider");
  return ctx;
}
