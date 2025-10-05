import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Package, TruckIcon, PackageCheck, AlertTriangle, Clock, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subDays } from "date-fns";
import { DashboardAIAssistant } from "@/components/DashboardAIAssistant";
const Index = () => {
  const [stats, setStats] = useState({
    commandesEnPreparation: 0,
    commandesExpediees: 0,
    retoursEnCours: 0,
    receptionsAttendues: 0,
    tauxLivraisonHeure: 0,
    tauxErreurs: 0,
    alertesStock: 0,
    delaiMoyenPreparation: 0
  });
  const [period, setPeriod] = useState<string>("7");
  const [chartData, setChartData] = useState<any[]>([]);
  useEffect(() => {
    const fetchStats = async () => {
      const {
        data: commandes
      } = await supabase.from("commande").select("statut_wms, date_creation, tracking_number");
      const enPreparation = commandes?.filter(c => c.statut_wms === "En préparation").length || 0;
      const expediees = commandes?.filter(c => c.statut_wms === "Expédiée").length || 0;
      const {
        count: retoursCount
      } = await supabase.from("retour_produit").select("*", {
        count: "exact",
        head: true
      }).in("statut_retour", ["recu", "en_traitement"]);

      // Taux de livraison à l'heure - basé sur SendCloud tracking
      const commandesAvecTracking = commandes?.filter(c => c.tracking_number) || [];
      const tauxLivraison = commandesAvecTracking.length > 0 ? Math.round(expediees / commandesAvecTracking.length * 100) : 0;

      // Erreurs de préparation - basé sur retours avec raison erreur
      const {
        data: retoursErreur
      } = await supabase.from("retour_produit").select("raison_retour").ilike("raison_retour", "%erreur%");
      const tauxErreurs = commandes && commandes.length > 0 ? Math.round((retoursErreur?.length || 0) / commandes.length * 100) : 0;
      const {
        data: produits
      } = await supabase.from("produit").select("stock_actuel, stock_minimum");
      const produitsAvecAlerte = produits?.filter(p => (p.stock_actuel || 0) < (p.stock_minimum || 0)).length || 0;
      setStats({
        commandesEnPreparation: enPreparation,
        commandesExpediees: expediees,
        retoursEnCours: retoursCount || 0,
        receptionsAttendues: 0,
        tauxLivraisonHeure: tauxLivraison,
        tauxErreurs: tauxErreurs,
        alertesStock: produitsAvecAlerte,
        delaiMoyenPreparation: 24
      });
    };
    fetchStats();
  }, []);
  useEffect(() => {
    const fetchChartData = async () => {
      const days = parseInt(period);
      const startDate = subDays(new Date(), days);
      const {
        data: commandes
      } = await supabase.from("commande").select("date_creation, statut_wms").gte("date_creation", startDate.toISOString());
      const groupedData: Record<string, {
        date: string;
        commandes: number;
        expeditions: number;
      }> = {};
      for (let i = 0; i < days; i++) {
        const date = subDays(new Date(), days - i - 1);
        const dateStr = format(date, "dd/MM");
        groupedData[dateStr] = {
          date: dateStr,
          commandes: 0,
          expeditions: 0
        };
      }
      commandes?.forEach(cmd => {
        const dateStr = format(new Date(cmd.date_creation), "dd/MM");
        if (groupedData[dateStr]) {
          groupedData[dateStr].commandes++;
          if (cmd.statut_wms === "Expédiée") {
            groupedData[dateStr].expeditions++;
          }
        }
      });
      setChartData(Object.values(groupedData));
    };
    fetchChartData();
  }, [period]);
  return <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de Bord Logistique</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="En Préparation" value={stats.commandesEnPreparation} icon={Package} variant="accent" />
          <StatCard title="Expédiées" value={stats.commandesExpediees} icon={TruckIcon} variant="success" />
          <StatCard title="Retours en Cours" value={stats.retoursEnCours} icon={Package} variant="default" />
          <StatCard title="Réceptions Attendues" value={stats.receptionsAttendues} icon={Clock} variant="primary" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Taux Livraison à l'Heure" value={`${stats.tauxLivraisonHeure}%`} icon={TrendingUp} variant="success" />
          <StatCard title="Taux Erreurs Préparation" value={`${stats.tauxErreurs}%`} icon={XCircle} variant="default" />
          <StatCard title="Alertes Stock" value={stats.alertesStock} icon={AlertTriangle} variant="default" />
          <StatCard title="Délai Moyen Prépa (h)" value={stats.delaiMoyenPreparation} icon={Clock} variant="primary" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mx-0 px-0 py-0 my-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Évolution des Commandes</CardTitle>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 jours</SelectItem>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="commandes" stroke="hsl(var(--primary))" strokeWidth={2} name="Commandes" />
                  <Line type="monotone" dataKey="expeditions" stroke="hsl(var(--success))" strokeWidth={2} name="Expéditions" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <DashboardAIAssistant context={{ stats, period, chartData }} />
    </DashboardLayout>;
};
export default Index;