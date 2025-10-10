import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, Search, AlertTriangle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { NouveauProduitDialog } from "@/components/NouveauProduitDialog";
import { FicheProduitDialog } from "@/components/FicheProduitDialog";
import { ImportCSVDialog } from "@/components/ImportCSVDialog";
import { ProduitsKanban } from "@/components/ProduitsKanban";
import { ViewSelector } from "@/components/ViewSelector";
import { useAuth } from "@/hooks/useAuth";

const Produits = () => {
  const { user, userRole, getViewingClientId, isViewingAsClient } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduitId, setSelectedProduitId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'kanban'>(() => {
    return (localStorage.getItem('produits_view') as 'list' | 'kanban') || 'list';
  });

  useEffect(() => {
    localStorage.setItem('produits_view', view);
  }, [view]);

  const { data: produits = [], isLoading, refetch } = useQuery({
    queryKey: ["produits", userRole, user?.id, getViewingClientId()],
    queryFn: async () => {
      let query = supabase
        .from("produit")
        .select("*")
        .eq("statut_actif", true);
      
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
        rotation: 8.5
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Produits</h1>
            <p className="text-muted-foreground mt-1">
              Catalogue et gestion des stocks
            </p>
          </div>
          <ViewSelector view={view} onViewChange={setView} />
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

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par référence, nom ou EAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            {userRole !== 'client' && !isViewingAsClient() && <ImportCSVDialog onSuccess={() => refetch()} />}
            <NouveauProduitDialog onSuccess={() => refetch()} />
          </div>
        </div>

        {view === 'kanban' ? (
          <ProduitsKanban 
            produits={filteredProduits} 
            onRefetch={refetch}
            loading={isLoading}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Catalogue produits</CardTitle>
              <CardDescription>Liste des références en stock</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : filteredProduits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Aucun produit trouvé" : "Aucun produit en stock"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead className="text-center">Stock Actuel</TableHead>
                      <TableHead>Stock Min.</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProduits.map((produit) => (
                      <TableRow
                        key={produit.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedProduitId(produit.id)}
                      >
                        <TableCell className="font-medium">{produit.reference}</TableCell>
                        <TableCell>{produit.nom}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-2xl font-bold">{produit.stock_actuel}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{produit.stock_minimum}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduitId(produit.id);
                            }}
                          >
                            Détails
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
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
