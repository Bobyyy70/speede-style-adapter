import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useStatutTransition } from "@/hooks/useStatutTransition";
import { RetourDetailDialog } from "@/components/RetourDetailDialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PackageX, Clock, CheckCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ViewSelector } from "@/components/ViewSelector";
import { RetoursKanban } from "@/components/RetoursKanban";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

export default function Retours() {
  const { user, userRole, getViewingClientId } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRetourId, setSelectedRetourId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [view, setView] = useState<'list' | 'kanban'>(() => {
    return (localStorage.getItem('retours_view') as 'list' | 'kanban') || 'list';
  });

  const { subscribeToStatutChanges } = useStatutTransition();

  useEffect(() => {
    localStorage.setItem('retours_view', view);
  }, [view]);

  const { data: retours, isLoading, refetch } = useQuery({
    queryKey: ["retours-produit", userRole, user?.id, getViewingClientId()],
    queryFn: async () => {
      let query = supabase
        .from("retour_produit")
        .select(`
          *,
          lignes:ligne_retour_produit(*),
          client:client_id(nom_entreprise)
        `);
      
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
      
      query = query.order("date_creation", { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeToStatutChanges('retour', () => {
      console.log('[Realtime] Retour updated, refreshing list');
      refetch();
    });

    return () => unsubscribe();
  }, []);

  const handleCreateReturn = async (commandeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('sendcloud-create-return', {
        body: { 
          commande_id: commandeId,
          raison: 'Retour client - Mondial Relay',
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Étiquette retour Mondial Relay générée');
        refetch();
      } else {
        toast.error(data.error || 'Erreur création retour');
      }
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    }
  };

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
      en_inspection: { variant: "secondary", label: "En inspection" },
      traite: { variant: "default", label: "Traité" },
      etiquette_generee: { variant: "default", label: "Étiquette générée" },
      non_conforme: { variant: "destructive", label: "Non conforme" },
    };
    return variants[statut] || { variant: "outline", label: statut };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Retours & SAV</h1>
            <p className="text-muted-foreground">Gestion des retours produits et service après-vente</p>
          </div>
          <ViewSelector view={view} onViewChange={setView} />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En attente</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enAttente}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En cours</CardTitle>
              <PackageX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enCours}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Traités</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.traites}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Non conformes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.nonConformes}</div>
            </CardContent>
          </Card>
        </div>

        {/* Affichage conditionnel Liste ou Kanban */}
        {view === 'kanban' ? (
          <RetoursKanban retours={filteredRetours || []} loading={isLoading} />
        ) : (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Dossiers de retours</CardTitle>
                <CardDescription>Liste complète des retours produits avec facturation automatique</CardDescription>
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
                    <SelectItem value="en_inspection">En inspection</SelectItem>
                    <SelectItem value="traite">Traité</SelectItem>
                    <SelectItem value="etiquette_generee">Étiquette générée</SelectItem>
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
                            <span>{format(new Date(retour.date_creation), "d MMMM yyyy", { locale: fr })}</span>
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
                           <div className="flex items-center gap-4">
                             <div className="text-right">
                               <div className="font-medium">{Number(retour.valeur_totale).toFixed(2)}€</div>
                               <div className="text-xs text-muted-foreground">Coût traitement</div>
                             </div>
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => {
                                 setSelectedRetourId(retour.id);
                                 setDetailDialogOpen(true);
                               }}
                             >
                               Voir détails
                             </Button>
                           </div>
                         </div>
                       );
                     })
                   )}
                 </div>
            </CardContent>
          </Card>
        )}
      </div>

      <RetourDetailDialog 
        retourId={selectedRetourId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </DashboardLayout>
  );
}
