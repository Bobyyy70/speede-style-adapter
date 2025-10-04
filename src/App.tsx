import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Reception from "./pages/Reception";
import Mouvements from "./pages/Mouvements";
import Commandes from "./pages/Commandes";
import Reappro from "./pages/Reappro";
import Produits from "./pages/Produits";
import Emplacements from "./pages/Emplacements";
import Transporteurs from "./pages/Transporteurs";
import Facturation from "./pages/Facturation";
import Retours from "./pages/Retours";
import Parametres from "./pages/Parametres";
import Preparation from "./pages/Preparation";
import PreparationDetails from "./pages/PreparationDetails";
import Connecteurs from "./pages/Connecteurs";
import ServicesLogistiques from "./pages/ServicesLogistiques";
import BacsAdresses from "./pages/BacsAdresses";
import Expedition from "./pages/Expedition";
import ImportExport from "./pages/ImportExport";
import Utilisateurs from "./pages/Utilisateurs";
import GestionClients from "./pages/GestionClients";
import Notifications from "./pages/Notifications";
import ChatbotIA from "./pages/ChatbotIA";
import NotFound from "./pages/NotFound";
import ClientDashboard from "./pages/client/Dashboard";
import ClientCommandes from "./pages/client/MesCommandes";
import ClientProduits from "./pages/client/MesProduits";
import ClientRetours from "./pages/client/MesRetours";
import ClientFacturation from "./pages/client/MaFacturation";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock/reception"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur']}>
                  <Reception />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock/mouvements"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur']}>
                  <Mouvements />
                </ProtectedRoute>
              }
            />
            <Route
              path="/commandes"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur', 'gestionnaire']}>
                  <Commandes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/commandes/reappro"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <Reappro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock/produits"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur', 'gestionnaire']}>
                  <Produits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock/emplacements"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur', 'gestionnaire']}>
                  <Emplacements />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock/bacs"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur', 'gestionnaire']}>
                  <BacsAdresses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/commandes/preparation"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur']}>
                  <Preparation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/preparation/:sessionId"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur']}>
                  <PreparationDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/commandes/retours"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <Retours />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations/transporteurs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Transporteurs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations/connecteurs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Connecteurs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/administratif/facturation"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <Facturation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/administratif/services"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <ServicesLogistiques />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parametres"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Parametres />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expedition"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur']}>
                  <Expedition />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestion-donnees/import-export"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ImportExport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parametres/utilisateurs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Utilisateurs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parametres/clients"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <GestionClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parametres/notifications"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parametres/chatbot-ia"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ChatbotIA />
                </ProtectedRoute>
              }
            />
            {/* Client Routes */}
            <Route
              path="/client/dashboard"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/commandes"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientCommandes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/produits"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientProduits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/retours"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientRetours />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/facturation"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientFacturation />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
