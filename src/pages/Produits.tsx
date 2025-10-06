import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Search, AlertTriangle, TrendingUp, LayoutList, LayoutGrid, PackagePlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { NouveauProduitDialog } from "@/components/NouveauProduitDialog";
import { FicheProduitDialog } from "@/components/FicheProduitDialog";
import { ProduitsKanban } from "@/components/ProduitsKanban";
import { GestionConsommables } from "@/components/GestionConsommables";
import { ImportCSVDialog } from "@/components/ImportCSVDialog";
import { useAuth } from "@/hooks/useAuth";

const Produits = () => {
  const { user, userRole, getViewingClientId } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [selectedProduitId, setSelectedProduitId] = useState<string | null>(null);

  const { data: produits = [], isLoading, refetch } = useQuery({
    queryKey: ["produits", userRole, user?.id, getViewingClientId()],
    queryFn: async () => {
      let query = supabase
        .from("produit")
        .select("*")
        .eq("statut_actif", true);
      
      // Filter by client_id if viewing as client or if user is a client
      const viewingClientId = getViewingClientId();
      if (viewingClientId) {
        query = query.eq("client_id", viewingClientId);
      } else if (userRole === 'client' && user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single();
        
        if (profileData?.client_id) {
          query = query.eq("client_id", profileData.client_id);
        }
      }
      
      query = query.order("reference");
      
      const { data, error } = await query;
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

        <Tabs defaultValue="produits" className="space-y-4">
          <TabsList>
            <TabsTrigger value="produits">
              <Package className="h-4 w-4 mr-2" />
              Produits
            </TabsTrigger>
            <TabsTrigger value="consommables">
              <PackagePlus className="h-4 w-4 mr-2" />
              Consommables
            </TabsTrigger>
          </TabsList>

          <TabsContent value="produits">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Catalogue produits</CardTitle>
                    <CardDescription>Liste des références en stock</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <ImportCSVDialog onSuccess={() => refetch()} />
                    <Button
                      variant={viewMode === "list" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                    >
                      <LayoutList className="h-4 w-4 mr-1" />
                      Liste
                    </Button>
                    <Button
                      variant={viewMode === "kanban" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("kanban")}
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      Kanban
                    </Button>
                    <NouveauProduitDialog onSuccess={() => refetch()} />
                  </div>
                </div>
              </CardHeader>
          <CardContent>
            {viewMode === "list" && (
              <>
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
                        <div 
                          key={produit.id} 
                          onClick={() => setSelectedProduitId(produit.id)}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5 transition-colors cursor-pointer"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{produit.reference} - {produit.nom}</div>
                            <div className="text-sm text-muted-foreground">
                              Stock: {produit.stock_actuel} / Seuil: {produit.stock_minimum}
                              {produit.code_barre_ean && ` • EAN: ${produit.code_barre_ean}`}
                              {produit.categorie_emballage === 2 && ` • Protection individuelle`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {produit.categorie_emballage === 2 && (
                              <Badge variant="outline">
                                Prot.
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
              </>
            )}

            {viewMode === "kanban" && (
              <>
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
                ) : (
                  <ProduitsKanban produits={filteredProduits} onRefetch={refetch} />
                )}
              </>
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consommables">
            <GestionConsommables />
          </TabsContent>
        </Tabs>
      </div>

      {selectedProduitId && (
        <FicheProduitDialog
          produitId={selectedProduitId}
          open={!!selectedProduitId}
          onOpenChange={(open) => !open && setSelectedProduitId(null)}
          onSuccess={() => refetch()}
        />
      )}
    </DashboardLayout>
  );
};

export default Produits;
