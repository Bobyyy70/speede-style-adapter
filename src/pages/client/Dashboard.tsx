import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";

export default function ClientDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState({
    totalProduits: 0,
    commandesEnCours: 0,
    stockTotal: 0,
    alertesStock: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [user, searchParams]);

  const fetchStats = async () => {
    try {
      if (!user) return;

      const asClient = searchParams.get('asClient');
      let clientId: string | null = asClient;

      if (!clientId) {
        // Get client_id from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single();
        clientId = profile?.client_id || null;
      }

      if (!clientId) {
        toast({
          title: "Erreur",
          description: "Profil client non configuré",
          variant: "destructive",
        });
        return;
      }

      // Fetch products count
      const { count: produitsCount } = await supabase
        .from("produit")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("statut_actif", true);

      // Fetch orders in progress
      const { count: commandesCount } = await supabase
        .from("commande")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .in("statut_wms", ["En attente de réappro", "Prêt à préparer", "En préparation"]);

      // Fetch total stock - get product IDs first then query stock
      const { data: produitsData } = await supabase
        .from("produit")
        .select("id")
        .eq("client_id", clientId);

      const produitIds = produitsData?.map(p => p.id) || [];

      let stockTotal = 0;
      if (produitIds.length > 0) {
        const { data: stockData } = await supabase
          .from("stock_disponible")
          .select("stock_actuel")
          .in("produit_id", produitIds);

        stockTotal = stockData?.reduce((sum, item) => sum + (item.stock_actuel || 0), 0) || 0;
      }

      // Fetch stock alerts
      const { count: alertesCount } = await supabase
        .from("produit")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .lt("stock_actuel", "stock_minimum");

      setStats({
        totalProduits: produitsCount || 0,
        commandesEnCours: commandesCount || 0,
        stockTotal,
        alertesStock: alertesCount || 0,
      });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les statistiques",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mon Tableau de Bord</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de vos stocks et commandes
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mes Produits</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProduits}</div>
              <p className="text-xs text-muted-foreground">
                Références actives
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commandes en cours</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.commandesEnCours}</div>
              <p className="text-xs text-muted-foreground">
                En préparation/attente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.stockTotal}</div>
              <p className="text-xs text-muted-foreground">
                Unités en stock
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertes Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.alertesStock}</div>
              <p className="text-xs text-muted-foreground">
                Produits sous seuil
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
