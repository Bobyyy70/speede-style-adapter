import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import PickingMobile from "./pages/PickingMobile";
import Connecteurs from "./pages/Connecteurs";
import ServicesLogistiques from "./pages/ServicesLogistiques";
import BacsAdresses from "./pages/BacsAdresses";
import Expedition from "./pages/Expedition";
import ImportExport from "./pages/ImportExport";
import Utilisateurs from "./pages/Utilisateurs";
import GestionClients from "./pages/GestionClients";
import Notifications from "./pages/Notifications";
import SendCloudSync from "./pages/SendCloudSync";

import NotFound from "./pages/NotFound";
import ClientCommandes from "./pages/client/MesCommandes";
import ClientProduits from "./pages/client/MesProduits";
import ClientRetours from "./pages/client/MesRetours";
import ClientFacturation from "./pages/client/MaFacturation";
import ClientAttenduReception from "./pages/client/AttenduReception";
import ClientCreerCommande from "./pages/client/CreerCommande";

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
                <ProtectedRoute allowedRoles={['admin', 'operateur', 'client']}>
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
                <ProtectedRoute allowedRoles={['admin', 'operateur', 'gestionnaire', 'client']}>
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
              path="/picking/:sessionId"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur']}>
                  <PickingMobile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/commandes/retours"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire', 'client']}>
                  <Retours />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations/transporteurs"
              element={
                <ProtectedRoute allowedRoles={['admin', 'client']}>
                  <Transporteurs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations/connecteurs"
              element={
                <ProtectedRoute allowedRoles={['admin', 'client']}>
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
                <ProtectedRoute allowedRoles={['admin', 'client']}>
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
                <ProtectedRoute allowedRoles={['admin', 'client']}>
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
              path="/integrations/sendcloud-sync"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <SendCloudSync />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parametres/chatbot-ia"
              element={<Navigate to="/parametres/utilisateurs" replace />}
            />
            {/* Client Routes */}
            <Route
              path="/client/commandes"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientCommandes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/produits"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientProduits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/retours"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientRetours />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/facturation"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientFacturation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/reception"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientAttenduReception />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/commandes/creer"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientCreerCommande />
                </ProtectedRoute>
              }
            />
            {/* Redirections anciennes routes client */}
            <Route path="/produits" element={<Navigate to="/stock/produits" replace />} />
            <Route path="/retours" element={<Navigate to="/commandes/retours" replace />} />
            <Route path="/client/attendu-reception" element={<Navigate to="/client/reception" replace />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
