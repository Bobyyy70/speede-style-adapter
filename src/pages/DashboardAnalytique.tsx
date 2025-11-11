import { DashboardLayout } from "@/components/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommandesParStatutChart } from "@/components/analytics/CommandesParStatutChart";
import { TauxRetourChart } from "@/components/analytics/TauxRetourChart";
import { PerformancePickingChart } from "@/components/analytics/PerformancePickingChart";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardAnalytique() {
  const [period, setPeriod] = useState<number>(30);
  const { user } = useAuth();

  // Vérifier si l'utilisateur est admin pour filtrer par client (fonctionnalité future)
  const clientId = undefined; // Pour l'instant, pas de filtre client

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Logistique</h1>
            <p className="text-muted-foreground">
              Tableaux de bord et indicateurs de performance
            </p>
          </div>

          {/* Filtre période */}
          <Select
            value={period.toString()}
            onValueChange={(value) => setPeriod(parseInt(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">90 derniers jours</SelectItem>
              <SelectItem value="365">1 an</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Graphiques Commandes et Retours */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CommandesParStatutChart clientId={clientId} period={period} />
          <TauxRetourChart clientId={clientId} period={period} />
        </div>

        {/* Performance Picking */}
        <PerformancePickingChart period={period} />
      </div>
    </DashboardLayout>
  );
}
