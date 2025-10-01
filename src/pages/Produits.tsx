import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, AlertTriangle, TrendingUp } from "lucide-react";

const Produits = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produits</h1>
          <p className="text-muted-foreground mt-1">
            Catalogue et gestion des stocks
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Références</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2,543</div>
              <p className="text-xs text-muted-foreground">Actives</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valeur totale</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€1.2M</div>
              <p className="text-xs text-muted-foreground">Stock en valeur</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertes stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18</div>
              <p className="text-xs text-muted-foreground">Sous seuil</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rotation</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8.5x</div>
              <p className="text-xs text-muted-foreground">Moyenne annuelle</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Catalogue produits</CardTitle>
                <CardDescription>Liste des références en stock</CardDescription>
              </div>
              <Button>Nouveau produit</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher par référence, nom ou code-barres..." className="pl-10" />
              </div>
            </div>
            <div className="space-y-4">
              {[
                { ref: "PROD-123", nom: "Produit A", stock: 450, seuil: 100, statut: "OK" },
                { ref: "PROD-456", nom: "Produit B", stock: 80, seuil: 100, statut: "Alerte" },
                { ref: "PROD-789", nom: "Produit C", stock: 1200, seuil: 200, statut: "OK" },
              ].map((produit) => (
                <div key={produit.ref} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">{produit.ref} - {produit.nom}</div>
                    <div className="text-sm text-muted-foreground">
                      Stock: {produit.stock} / Seuil: {produit.seuil}
                    </div>
                  </div>
                  <Badge variant={produit.statut === "Alerte" ? "destructive" : "default"}>
                    {produit.statut}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Produits;
