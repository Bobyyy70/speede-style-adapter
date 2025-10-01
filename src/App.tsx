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
import NotFound from "./pages/NotFound";

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
              path="/reception"
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
                <ProtectedRoute allowedRoles={['admin', 'operateur']}>
                  <Commandes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock/reappro"
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
              path="/transporteurs"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Transporteurs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/facturation"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <Facturation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retours"
              element={
                <ProtectedRoute allowedRoles={['admin', 'gestionnaire']}>
                  <Retours />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
