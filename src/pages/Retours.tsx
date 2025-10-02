import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Retours() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");

  const { data: retours, isLoading } = useQuery({
    queryKey: ["retours-produit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retour_produit")
        .select(`
          *,
          lignes:ligne_retour_produit(*)
        `)
        .order("date_creation", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredRetours = retours?.filter(retour => {
    const matchesSearch = retour.numero_retour.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         retour.client_nom.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatut = statutFilter === "all" || retour.statut_retour === statutFilter;
    return matchesSearch && matchesStatut;
  });

  const stats = {
    enAttente: retours?.filter(r => r.statut_retour === "recu").length || 0,
    enCours: retours?.filter(r => r.statut_retour === "en_traitement").length || 0,
    traites: retours?.filter(r => r.statut_retour === "traite").length || 0,
    nonConformes: retours?.filter(r => r.statut_retour === "non_conforme").length || 0,
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
      recu: { variant: "outline", label: "Reçu" },
      en_traitement: { variant: "secondary", label: "En traitement" },
      traite: { variant: "default", label: "Traité" },
      non_conforme: { variant: "destructive", label: "Non conforme" },
    };
    return variants[statut] || { variant: "outline", label: statut };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Retours & SAV</h1>
          <p className="text-muted-foreground">Gestion des retours produits et service après-vente</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En attente</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enAttente}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En cours</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enCours}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Traités</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.traites}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Non conformes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.nonConformes}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Dossiers de retours</CardTitle>
                <CardDescription>Liste complète des retours produits avec facturation automatique</CardDescription>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau retour
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher un retour..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="recu">Reçu</SelectItem>
                  <SelectItem value="en_traitement">En traitement</SelectItem>
                  <SelectItem value="traite">Traité</SelectItem>
                  <SelectItem value="non_conforme">Non conforme</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : filteredRetours?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Aucun retour trouvé</div>
              ) : (
                filteredRetours?.map((retour) => {
                  const statutBadge = getStatutBadge(retour.statut_retour);
                  return (
                    <div
                      key={retour.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium font-mono">{retour.numero_retour}</h3>
                          <Badge variant={statutBadge.variant}>{statutBadge.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{retour.client_nom}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{new Date(retour.date_creation).toLocaleDateString("fr-FR")}</span>
                          {retour.lignes && (
                            <>
                              <span>•</span>
                              <span>{retour.lignes.length} produit(s)</span>
                            </>
                          )}
                          {retour.raison_retour && (
                            <>
                              <span>•</span>
                              <span>{retour.raison_retour}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-medium">{Number(retour.valeur_totale).toFixed(2)}€</div>
                        <div className="text-xs text-muted-foreground">Coût traitement</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
