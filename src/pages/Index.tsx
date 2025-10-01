import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { ClientsTable } from "@/components/ClientsTable";
import { RecentActivity } from "@/components/RecentActivity";
import { Users, Package, TruckIcon, Warehouse } from "lucide-react";

const Index = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de Bord</h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble de vos opérations logistiques
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Clients Actifs"
            value="47"
            icon={Users}
            trend={{ value: 12, isPositive: true }}
            variant="primary"
          />
          <StatCard
            title="Produits en Stock"
            value="2,543"
            icon={Package}
            trend={{ value: 8, isPositive: true }}
            variant="accent"
          />
          <StatCard
            title="Ordres en Cours"
            value="18"
            icon={TruckIcon}
            trend={{ value: 3, isPositive: false }}
            variant="default"
          />
          <StatCard
            title="Taux d'Occupation"
            value="87%"
            icon={Warehouse}
            trend={{ value: 5, isPositive: true }}
            variant="success"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
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
