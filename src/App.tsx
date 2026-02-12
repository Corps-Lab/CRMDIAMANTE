import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ClientProvider } from "./contexts/ClientContext";
import { ContractProvider } from "./contexts/ContractContext";
import { TransactionProvider } from "./contexts/TransactionContext";
import { DemandProvider } from "./contexts/DemandContext";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import Index from "./pages/Index";
import Clientes from "./pages/Clientes";
import Contratos from "./pages/Contratos";
import Financeiro from "./pages/Financeiro";
import Demandas from "./pages/Demandas";
import Acessos from "./pages/Acessos";
import Sugestoes from "./pages/Sugestoes";
import Suporte from "./pages/Suporte";

import Auth from "./pages/Auth";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter basename="/C.LABS-CRM">
        <AuthProvider>
          <ClientProvider>
            <ContractProvider>
              <TransactionProvider>
                <DemandProvider>
                  <Toaster />
                  <Sonner />
                  <Routes>
                    <Route element={<ProtectedRoute />}>
                      <Route path="/" element={<Index />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/contratos" element={<Contratos />} />
                      <Route path="/entradas" element={<Financeiro />} />
                      <Route path="/despesas" element={<Financeiro />} />
                      <Route path="/tarefas" element={<Demandas />} />
                      <Route path="/acessos" element={<Acessos />} />
                      <Route path="/sugestoes" element={<Sugestoes />} />
                      <Route path="/suporte" element={<Suporte />} />
                      <Route path="/perfil" element={<Perfil />} />
                    </Route>
                    <Route path="/auth" element={<Auth />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </DemandProvider>
              </TransactionProvider>
            </ContractProvider>
          </ClientProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
