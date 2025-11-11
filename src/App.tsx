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
import Retours from "./pages/Retours";
import Parametres from "./pages/Parametres";
import ConfigurationExpediteur from "./pages/ConfigurationExpediteur";
import Preparation from "./pages/Preparation";
import PreparationDetails from "./pages/PreparationDetails";
import PickingMobile from "./pages/PickingMobile";
import BacsAdresses from "./pages/BacsAdresses";
import Expedition from "./pages/Expedition";
import Utilisateurs from "./pages/Utilisateurs";
import GestionClients from "./pages/GestionClients";
import SendCloudSync from "./pages/SendCloudSync";
import Transporteurs from "./pages/Transporteurs";

import NotFound from "./pages/NotFound";
import ClientProduits from "./pages/client/MesProduits";
import ClientRetours from "./pages/client/MesRetours";
import ClientCommandes from "./pages/client/MesCommandes";
import ClientMouvements from "./pages/client/MesMouvements";
import ClientFacturation from "./pages/client/MaFacturation";
import ClientAttenduReception from "./pages/client/AttenduReception";
import ClientCreerCommande from "./pages/client/CreerCommande";
import AdminBootstrap from "./pages/AdminBootstrap";
import ReglesExpediteur from "./pages/ReglesExpediteur";
import ReparationCommandes from "./pages/ReparationCommandes";
import MonDashboard from "./pages/MonDashboard";
import DashboardAnalytique from "./pages/DashboardAnalytique";
import GestionTransitions from "./pages/admin/GestionTransitions";
import Workflows from "./pages/Workflows";
import ReglesFiltrage from "./pages/commandes/ReglesFiltrage";
import ReglesEmballages from "./pages/preparation/ReglesEmballages";
import ReglesValidation from "./pages/commandes/ReglesValidation";
import ValidationsEnAttente from "./pages/commandes/ValidationsEnAttente";
import SendCloudDocuments from "./pages/integrations/SendCloudDocuments";
import SendCloudProducts from "./pages/integrations/SendCloudProducts";
import SendCloudEvents from "./pages/integrations/SendCloudEvents";
import ReglesTransporteurs from "./pages/configuration/ReglesTransporteurs";

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
            <Route path="/admin-bootstrap" element={<AdminBootstrap />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            
            {/* Stock Routes */}
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
            
            {/* Commandes Routes */}
            <Route
              path="/commandes"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur', 'gestionnaire', 'client']}>
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
            <Route path="/commandes/regles-filtrage" element={
              <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                <ReglesFiltrage />
              </ProtectedRoute>
            } />
            <Route path="/commandes/regles-validation" element={
              <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                <ReglesValidation />
              </ProtectedRoute>
            } />
            <Route path="/commandes/validations-en-attente" element={
              <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                <ValidationsEnAttente />
              </ProtectedRoute>
            } />
            
            {/* Expedition */}
            <Route
              path="/expedition"
              element={
                <ProtectedRoute allowedRoles={['admin', 'operateur']}>
                  <Expedition />
                </ProtectedRoute>
              }
            />
            
            {/* Paramètres Routes */}
            <Route
              path="/parametres"
              element={
                <ProtectedRoute allowedRoles={['admin', 'client']}>
                  <Parametres />
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
              path="/parametres/expediteur"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire', 'client']}>
                  <ConfigurationExpediteur />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parametres/regles-expediteur"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <ReglesExpediteur />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parametres/regles-transporteurs"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <ReglesTransporteurs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parametres/mon-dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire', 'operateur', 'client']}>
                  <MonDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Intégrations */}
            <Route
              path="/integrations/transporteurs"
              element={
                <ProtectedRoute allowedRoles={['admin', 'client']}>
                  <Transporteurs />
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
              path="/integrations/sendcloud-products"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <SendCloudProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations/sendcloud-events"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <SendCloudEvents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integrations/sendcloud-documents"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire', 'client']}>
                  <SendCloudDocuments />
                </ProtectedRoute>
              }
            />
            
            {/* Réparation */}
            <Route
              path="/reparation-urgence"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <ReparationCommandes />
                </ProtectedRoute>
              }
            />
            
            {/* Analytics */}
            <Route
              path="/analytics"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <DashboardAnalytique />
                </ProtectedRoute>
              }
            />
            
            {/* Admin Routes */}
            <Route
              path="/admin/transitions"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <GestionTransitions />
                </ProtectedRoute>
              }
            />
            
            {/* Client Routes */}
            <Route
              path="/client/produits"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientProduits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/commandes"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientCommandes />
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
            <Route
              path="/client/retours"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientRetours />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/mouvements"
              element={
                <ProtectedRoute allowedRoles={['client', 'admin', 'gestionnaire']}>
                  <ClientMouvements />
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
            
            {/* Redirections */}
            <Route path="/produits" element={<Navigate to="/stock/produits" replace />} />
            <Route path="/retours" element={<Navigate to="/commandes/retours" replace />} />
            <Route path="/client/attendu-reception" element={<Navigate to="/client/reception" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
