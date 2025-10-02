import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, AlertTriangle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { NouveauProduitDialog } from "@/components/NouveauProduitDialog";

const Produits = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: produits = [], isLoading, refetch } = useQuery({
    queryKey: ["produits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produit")
        .select("*")
        .eq("statut_actif", true)
        .order("reference");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["produits-stats"],
    queryFn: async () => {
      const { data: stockDispo, error } = await supabase
        .from("stock_disponible")
        .select("*");
      
      if (error) throw error;

      const totalProduits = stockDispo?.length || 0;
      const valeurTotale = produits.reduce((sum, p) => sum + (p.stock_actuel * (p.prix_unitaire || 0)), 0);
      const alertes = stockDispo?.filter(p => p.stock_disponible < (produits.find(pr => pr.id === p.produit_id)?.stock_minimum || 0)).length || 0;

      return {
        totalProduits,
        valeurTotale,
        alertes,
        rotation: 8.5 // À calculer plus tard avec historique mouvements
      };
    },
  });

  const filteredProduits = produits.filter(p => 
    searchTerm === "" || 
    p.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.code_barre_ean && p.code_barre_ean.includes(searchTerm))
  );

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
              <div className="text-2xl font-bold">{stats?.totalProduits || 0}</div>
              <p className="text-xs text-muted-foreground">Actives</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valeur totale</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                €{((stats?.valeurTotale || 0) / 1000000).toFixed(1)}M
              </div>
              <p className="text-xs text-muted-foreground">Stock en valeur</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertes stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.alertes || 0}</div>
              <p className="text-xs text-muted-foreground">Sous seuil</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rotation</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.rotation || 0}x</div>
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
              <NouveauProduitDialog onSuccess={() => refetch()} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par référence, nom ou code-barres..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : filteredProduits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Aucun produit trouvé" : "Aucun produit en stock"}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProduits.map((produit) => {
                  const isAlerte = produit.stock_actuel < produit.stock_minimum;
                  return (
                    <div key={produit.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium">{produit.reference} - {produit.nom}</div>
                        <div className="text-sm text-muted-foreground">
                          Stock: {produit.stock_actuel} / Seuil: {produit.stock_minimum}
                          {produit.code_barre_ean && ` • EAN: ${produit.code_barre_ean}`}
                          {produit.categorie_emballage && ` • Cat. ${produit.categorie_emballage}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {produit.categorie_emballage && (
                          <Badge variant="outline">
                            Cat. {produit.categorie_emballage}
                          </Badge>
                        )}
                        <Badge variant={isAlerte ? "destructive" : "default"}>
                          {isAlerte ? "Alerte" : "OK"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Produits;
