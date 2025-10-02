import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Mouvements = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");

  // Fetch mouvements groupés par produit avec quantités par statut
  const { data: pipelineData = [], isLoading } = useQuery({
    queryKey: ["pipeline-mouvements", statutFilter],
    queryFn: async () => {
      // Get all products with their movements
      const { data: produits, error: produitsError } = await supabase
        .from("produit")
        .select("id, reference, nom, stock_actuel");
      
      if (produitsError) throw produitsError;

      // Get movements grouped by product and status
      const pipelineByProduct = await Promise.all(
        produits.map(async (produit) => {
          const { data: mouvements } = await supabase
            .from("mouvement_stock")
            .select("*")
            .eq("produit_id", produit.id)
            .order("date_mouvement", { ascending: false });

          // Calculate quantities by status
          const quantitesByStatut: Record<string, number> = {
            attente_arrivage_reappro: 0,
            mise_en_stock: 0,
            stock_physique: 0,
            stock_réservé: 0,
            en_cours_picking: 0,
            en_cours_emballage: 0,
            en_attente_transporteur: 0,
            en_cours_livraison: 0,
            livrée: 0,
          };

          mouvements?.forEach(m => {
            if (m.statut_mouvement && quantitesByStatut.hasOwnProperty(m.statut_mouvement)) {
              quantitesByStatut[m.statut_mouvement] += Math.abs(m.quantite);
            }
          });

          return {
            produit,
            quantites: quantitesByStatut,
            dernierMouvement: mouvements?.[0],
          };
        })
      );

      return pipelineByProduct.filter(p => 
        Object.values(p.quantites).some(q => q > 0) || p.produit.stock_actuel > 0
      );
    },
  });

  const filteredPipeline = pipelineData.filter(p => {
    const matchesSearch = searchTerm === "" || 
      p.produit.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.produit.reference.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatut = statutFilter === "all" || 
      p.quantites[statutFilter as keyof typeof p.quantites] > 0;
    
    return matchesSearch && matchesStatut;
  });

  const getQuantiteCellClass = (quantite: number) => {
    if (quantite === 0) return "text-muted-foreground";
    if (quantite > 100) return "text-green-600 font-semibold";
    if (quantite > 50) return "text-blue-600 font-medium";
    return "text-foreground font-medium";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline de Stock</h1>
          <p className="text-muted-foreground mt-1">
            Vue en colonnes des quantités par statut
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Flux de Stock par Produit</CardTitle>
                <CardDescription>Quantités à chaque étape du pipeline</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="relative w-[300px]">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher un produit..." 
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statutFilter} onValueChange={setStatutFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="attente_arrivage_reappro">Attente réappro</SelectItem>
                    <SelectItem value="mise_en_stock">Mise en stock</SelectItem>
                    <SelectItem value="stock_physique">Stock physique</SelectItem>
                    <SelectItem value="stock_réservé">Réservé</SelectItem>
                    <SelectItem value="en_cours_picking">En picking</SelectItem>
                    <SelectItem value="en_cours_emballage">En emballage</SelectItem>
                    <SelectItem value="en_attente_transporteur">Attente transporteur</SelectItem>
                    <SelectItem value="en_cours_livraison">En livraison</SelectItem>
                    <SelectItem value="livrée">Livrée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : filteredPipeline.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun produit trouvé
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Produit</TableHead>
                      <TableHead className="text-center">Attente Réappro</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                      <TableHead className="text-center">Mise en Stock</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                      <TableHead className="text-center bg-primary/5">Stock Physique</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                      <TableHead className="text-center">Réservé</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                      <TableHead className="text-center">En Picking</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                      <TableHead className="text-center">En Emballage</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                      <TableHead className="text-center">Attente Transp.</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                      <TableHead className="text-center">En Livraison</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                      <TableHead className="text-center">Livrée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPipeline.map((item) => (
                      <TableRow key={item.produit.id}>
                        <TableCell className="font-medium">
                          <div className="text-sm">{item.produit.nom}</div>
                          <div className="text-xs text-muted-foreground">{item.produit.reference}</div>
                        </TableCell>
                        <TableCell className={`text-center ${getQuantiteCellClass(item.quantites.attente_arrivage_reappro)}`}>
                          {item.quantites.attente_arrivage_reappro || "-"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className={`text-center ${getQuantiteCellClass(item.quantites.mise_en_stock)}`}>
                          {item.quantites.mise_en_stock || "-"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className={`text-center bg-primary/5 font-semibold ${getQuantiteCellClass(item.quantites.stock_physique)}`}>
                          {item.quantites.stock_physique || item.produit.stock_actuel || "-"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className={`text-center ${getQuantiteCellClass(item.quantites.stock_réservé)}`}>
                          {item.quantites.stock_réservé || "-"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className={`text-center ${getQuantiteCellClass(item.quantites.en_cours_picking)}`}>
                          {item.quantites.en_cours_picking || "-"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className={`text-center ${getQuantiteCellClass(item.quantites.en_cours_emballage)}`}>
                          {item.quantites.en_cours_emballage || "-"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className={`text-center ${getQuantiteCellClass(item.quantites.en_attente_transporteur)}`}>
                          {item.quantites.en_attente_transporteur || "-"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className={`text-center ${getQuantiteCellClass(item.quantites.en_cours_livraison)}`}>
                          {item.quantites.en_cours_livraison || "-"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell className={`text-center ${getQuantiteCellClass(item.quantites.livrée)}`}>
                          {item.quantites.livrée || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Mouvements;
