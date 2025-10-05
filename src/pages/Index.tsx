import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { ClientsTable } from "@/components/ClientsTable";
import { RecentActivity } from "@/components/RecentActivity";
import { Package, TruckIcon, PackageCheck, AlertTriangle, Boxes, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [stats, setStats] = useState({
    commandesEnAttente: 0,
    commandesPretes: 0,
    commandesEnPreparation: 0,
    commandesExpediees: 0,
    retoursEnCours: 0,
    receptionsAttendues: 0,
    stockGlobal: 0,
    alertesStock: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      // Commandes par statut
      const { data: commandes } = await supabase
        .from("commande")
        .select("statut_wms");
      
      const enAttente = commandes?.filter(c => c.statut_wms === "En attente de réappro").length || 0;
      const pretes = commandes?.filter(c => c.statut_wms === "Prêt à préparer").length || 0;
      const enPreparation = commandes?.filter(c => c.statut_wms === "En préparation").length || 0;
      const expediees = commandes?.filter(c => c.statut_wms === "Expédiée").length || 0;

      // Retours en cours
      const { count: retoursCount } = await supabase
        .from("retour_produit")
        .select("*", { count: "exact", head: true })
        .in("statut_retour", ["recu", "en_traitement"]);

      // Réceptions attendues - on utilise la table des réceptions avec un statut approprié
      const receptionsCount = 0; // Placeholder pour l'instant

      // Stock global
      const { data: produits } = await supabase
        .from("produit")
        .select("stock_actuel, stock_minimum");
      
      const stockTotal = produits?.reduce((sum, p) => sum + (p.stock_actuel || 0), 0) || 0;

      // Alertes stock (produits sous seuil minimum)
      const produitsAvecAlerte = produits?.filter(p => 
        (p.stock_actuel || 0) < (p.stock_minimum || 0)
      ).length || 0;

      setStats({
        commandesEnAttente: enAttente,
        commandesPretes: pretes,
        commandesEnPreparation: enPreparation,
        commandesExpediees: expediees,
        retoursEnCours: retoursCount || 0,
        receptionsAttendues: receptionsCount,
        stockGlobal: stockTotal,
        alertesStock: produitsAvecAlerte,
      });
    };

    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestion des Commandes</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="En Attente de Réappro"
            value={stats.commandesEnAttente}
            icon={Clock}
            variant="default"
          />
          <StatCard
            title="Prêtes à Préparer"
            value={stats.commandesPretes}
            icon={PackageCheck}
            variant="primary"
          />
          <StatCard
            title="En Préparation"
            value={stats.commandesEnPreparation}
            icon={Package}
            variant="accent"
          />
          <StatCard
            title="Expédiées"
            value={stats.commandesExpediees}
            icon={TruckIcon}
            variant="success"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Retours en Cours"
            value={stats.retoursEnCours}
            icon={Package}
            variant="default"
          />
          <StatCard
            title="Réceptions Attendues"
            value={stats.receptionsAttendues}
            icon={TruckIcon}
            variant="accent"
          />
          <StatCard
            title="Stock Global"
            value={stats.stockGlobal.toLocaleString()}
            icon={Boxes}
            variant="primary"
          />
          <StatCard
            title="Alertes Stock"
            value={stats.alertesStock}
            icon={AlertTriangle}
            variant="default"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ClientsTable />
          </div>
          <div>
            <RecentActivity />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
