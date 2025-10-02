import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Settings, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const Mouvements = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");

  const { data: mouvements = [], isLoading } = useQuery({
    queryKey: ["mouvements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mouvement_stock")
        .select(`
          *,
          produit:produit_id (reference, nom),
          commande:commande_id (numero_commande)
        `)
        .order("date_mouvement", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Fetch emplacement details separately if needed
      const mouvementsWithEmplacements = await Promise.all(
        (data || []).map(async (m) => {
          let emplacement_source = null;
          let emplacement_destination = null;
          
          if (m.emplacement_source_id) {
            const { data: source } = await supabase
              .from("emplacement")
              .select("code_emplacement")
              .eq("id", m.emplacement_source_id)
              .single();
            emplacement_source = source;
          }
          
          if (m.emplacement_destination_id) {
            const { data: dest } = await supabase
              .from("emplacement")
              .select("code_emplacement")
              .eq("id", m.emplacement_destination_id)
              .single();
            emplacement_destination = dest;
          }
          
          return { ...m, emplacement_source, emplacement_destination };
        })
      );
      
      return mouvementsWithEmplacements;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["mouvements-stats"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("mouvement_stock")
        .select("type_mouvement")
        .gte("date_mouvement", startOfMonth.toISOString());
      
      if (error) throw error;

      const entrees = data.filter(m => m.type_mouvement === "entrée").length;
      const sorties = data.filter(m => m.type_mouvement === "sortie").length;
      const transferts = data.filter(m => m.type_mouvement === "transfert").length;
      const ajustements = data.filter(m => m.type_mouvement === "ajustement").length;

      return { entrees, sorties, transferts, ajustements };
    },
  });

  const filteredMouvements = mouvements.filter(m => {
    const matchesSearch = searchTerm === "" || 
      m.numero_mouvement.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.produit?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.produit?.reference.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || m.type_mouvement === typeFilter;
    const matchesStatut = statutFilter === "all" || m.statut_mouvement === statutFilter;
    
    return matchesSearch && matchesType && matchesStatut;
  });

  const getTypeBadgeVariant = (type: string) => {
    switch(type) {
      case "entrée": return "default";
      case "sortie": return "destructive";
      case "transfert": return "secondary";
      case "réservation": return "outline";
      case "ajustement": return "secondary";
      default: return "default";
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case "entrée": return <ArrowDownRight className="h-4 w-4 text-green-500" />;
      case "sortie": return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "transfert": return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
      case "ajustement": return <Settings className="h-4 w-4" />;
      case "réservation": return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
      default: return null;
    }
  };

  const getStatutBadgeVariant = (statut: string): "default" | "secondary" | "destructive" | "outline" => {
    switch(statut) {
      case 'stock_physique': return 'default';
      case 'stock_réservé': return 'secondary';
      case 'en_cours_picking':
      case 'en_cours_emballage': return 'outline';
      case 'en_attente_transporteur':
      case 'en_cours_livraison': return 'secondary';
      case 'livrée': return 'default';
      default: return 'outline';
    }
  };

  const getStatutLabel = (statut: string) => {
    const labels: Record<string, string> = {
      'attente_arrivage_reappro': 'Attente réappro',
      'mise_en_stock': 'Mise en stock',
      'stock_physique': 'Stock physique',
      'stock_réservé': 'Réservé',
      'en_cours_picking': 'En picking',
      'en_cours_emballage': 'En emballage',
      'en_attente_transporteur': 'Attente transporteur',
      'en_cours_livraison': 'En livraison',
      'livrée': 'Livrée'
    };
    return labels[statut] || statut;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mouvements de Stock</h1>
          <p className="text-muted-foreground mt-1">
            Historique et traçabilité des flux
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entrées</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.entrees || 0}</div>
              <p className="text-xs text-muted-foreground">Ce mois</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sorties</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.sorties || 0}</div>
              <p className="text-xs text-muted-foreground">Ce mois</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transferts</CardTitle>
              <ArrowLeftRight className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.transferts || 0}</div>
              <p className="text-xs text-muted-foreground">Ce mois</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ajustements</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.ajustements || 0}</div>
              <p className="text-xs text-muted-foreground">Ce mois</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mouvements récents</CardTitle>
            <CardDescription>Historique des dernières opérations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par numéro, produit..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type de mouvement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="entrée">Entrées</SelectItem>
                  <SelectItem value="sortie">Sorties</SelectItem>
                  <SelectItem value="transfert">Transferts</SelectItem>
                  <SelectItem value="réservation">Réservations</SelectItem>
                  <SelectItem value="ajustement">Ajustements</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
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
            
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : filteredMouvements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun mouvement trouvé
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMouvements.map((mouvement) => (
                  <div key={mouvement.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getTypeIcon(mouvement.type_mouvement)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {mouvement.numero_mouvement} - {mouvement.produit?.nom}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">{mouvement.produit?.reference}</span>
                          {" • "}
                          Quantité: <span className={mouvement.quantite > 0 ? "text-green-600" : "text-red-600"}>
                            {mouvement.quantite > 0 ? "+" : ""}{mouvement.quantite}
                          </span>
                          {" • "}
                          {format(new Date(mouvement.date_mouvement), "dd MMM yyyy HH:mm", { locale: fr })}
                          {mouvement.type_contenant && ` • ${mouvement.type_contenant}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {mouvement.emplacement_source && `De: ${mouvement.emplacement_source.code_emplacement}`}
                          {mouvement.emplacement_source && mouvement.emplacement_destination && " → "}
                          {mouvement.emplacement_destination && `Vers: ${mouvement.emplacement_destination.code_emplacement}`}
                          {mouvement.commande && ` • Commande: ${mouvement.commande.numero_commande}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge variant={getTypeBadgeVariant(mouvement.type_mouvement)}>
                        {mouvement.type_mouvement}
                      </Badge>
                      {mouvement.statut_mouvement && (
                        <Badge variant={getStatutBadgeVariant(mouvement.statut_mouvement)}>
                          {getStatutLabel(mouvement.statut_mouvement)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Mouvements;
