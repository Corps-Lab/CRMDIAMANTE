import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ClientProvider } from "./contexts/ClientContext";
import { SupplierProvider } from "./contexts/SupplierContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { SalesProvider } from "./contexts/SalesContext";
import { AssistProvider } from "./contexts/AssistContext";
import { RdoProvider } from "./contexts/RdoContext";
import { RfiProvider } from "./contexts/RfiContext";
import { ContractProvider } from "./contexts/ContractContext";
import { TransactionProvider } from "./contexts/TransactionContext";
import { DemandProvider } from "./contexts/DemandContext";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import Index from "./pages/Index";
import Clientes from "./pages/Clientes";
import Fornecedores from "./pages/Fornecedores";
import Obras from "./pages/Obras";
import FunilVendas from "./pages/FunilVendas";
import SimuladorCaixa from "./pages/SimuladorCaixa";
import Assistencia from "./pages/Assistencia";
import RdoPage from "./pages/Rdo";
import Rfis from "./pages/Rfis";
import Vistorias from "./pages/Vistorias";
import Importador from "./pages/Importador";
import Contratos from "./pages/Contratos";
import Financeiro from "./pages/Financeiro";
import Demandas from "./pages/Demandas";
import Acessos from "./pages/Acessos";
import Sugestoes from "./pages/Sugestoes";
import Suporte from "./pages/Suporte";
import Progress from "./pages/Progress";
import PortalCliente from "./pages/PortalCliente";

import Auth from "./pages/Auth";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const rawBase = import.meta.env.BASE_URL || "/";
const routerBase = rawBase.startsWith(".") ? "/" : rawBase.replace(/\/$/, "");
const isFileProtocol =
  typeof window !== "undefined" && window.location.protocol === "file:";
const useHashRouter = import.meta.env.MODE === "html" || isFileProtocol;
const Router = useHashRouter ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Router basename={routerBase}>
        <AuthProvider>
          <ClientProvider>
            <SupplierProvider>
              <ProjectProvider>
                <SalesProvider>
                  <AssistProvider>
                    <RdoProvider>
                      <RfiProvider>
                    <ContractProvider>
                      <TransactionProvider>
                        <DemandProvider>
                          <Toaster />
                          <Sonner />
                          <Routes>
                            <Route element={<ProtectedRoute />}>
                              <Route path="/" element={<Index />} />
                              <Route path="/clientes" element={<Clientes />} />
                              <Route path="/fornecedores" element={<Fornecedores />} />
                              <Route path="/obras" element={<Obras />} />
                              <Route path="/funil" element={<FunilVendas />} />
                              <Route path="/simulador-caixa" element={<SimuladorCaixa />} />
                              <Route path="/assistencia" element={<Assistencia />} />
                              <Route path="/rdo" element={<RdoPage />} />
                              <Route path="/rfis" element={<Rfis />} />
                              <Route path="/vistorias" element={<Vistorias />} />
                              <Route path="/importar" element={<Importador />} />
                              <Route path="/contratos" element={<Contratos />} />
                              <Route path="/entradas" element={<Financeiro />} />
                              <Route path="/despesas" element={<Financeiro />} />
                              <Route path="/tarefas" element={<Demandas />} />
                              <Route path="/acessos" element={<Acessos />} />
                              <Route path="/sugestoes" element={<Sugestoes />} />
                              <Route path="/suporte" element={<Suporte />} />
                              <Route path="/perfil" element={<Perfil />} />
                              <Route path="/progresso" element={<Progress />} />
                            </Route>
                            <Route path="/auth" element={<Auth />} />
                            <Route path="/portal-cliente" element={<PortalCliente />} />
                            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </DemandProvider>
                      </TransactionProvider>
                    </ContractProvider>
                      </RfiProvider>
                    </RdoProvider>
                  </AssistProvider>
                </SalesProvider>
              </ProjectProvider>
            </SupplierProvider>
          </ClientProvider>
        </AuthProvider>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
