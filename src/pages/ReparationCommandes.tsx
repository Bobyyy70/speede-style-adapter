import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Wrench, CheckCircle2, Package, Users } from "lucide-react";
import { RepairCommandeDialog } from "@/components/RepairCommandeDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface CommandeProbleme {
  id: string;
  numero_commande: string;
  nom_client: string;
  client_id: string | null;
  date_creation: string;
  statut_wms: string;
  nb_lignes: number;
  nb_lignes_avec_produit: number;
  problemes: string[];
}

export default function ReparationCommandes() {
  const [loading, setLoading] = useState(true);
  const [commandes, setCommandes] = useState<CommandeProbleme[]>([]);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);

  useEffect(() => {
    loadCommandesProblemes();
  }, []);

  const loadCommandesProblemes = async () => {
    setLoading(true);
    try {
      // Charger toutes les commandes
      const { data: commandesData, error } = await supabase
        .from("commande")
        .select("id, numero_commande, nom_client, client_id, date_creation, statut_wms, expediteur_entreprise")
        .order("date_creation", { ascending: false });

      if (error) throw error;

      // Pour chaque commande, compter les lignes
      const commandesAvecProblemes: CommandeProbleme[] = [];

      for (const cmd of commandesData || []) {
        const { count: nbLignes } = await supabase
          .from("ligne_commande")
          .select("*", { count: "exact", head: true })
          .eq("commande_id", cmd.id);

        const { count: nbLignesAvecProduit } = await supabase
          .from("ligne_commande")
          .select("*", { count: "exact", head: true })
          .eq("commande_id", cmd.id)
          .not("produit_id", "is", null);

        const problemes: string[] = [];
        
        if (!cmd.client_id) {
          problemes.push("Pas de client");
        }
        if (nbLignes === 0) {
          problemes.push("Aucun produit");
        }
        if (nbLignes > 0 && nbLignesAvecProduit < nbLignes) {
          problemes.push("Produits non matchés");
        }
        if (!cmd.expediteur_entreprise) {
          problemes.push("Pas d'expéditeur");
        }

        if (problemes.length > 0) {
          commandesAvecProblemes.push({
            id: cmd.id,
            numero_commande: cmd.numero_commande,
            nom_client: cmd.nom_client,
            client_id: cmd.client_id,
            date_creation: cmd.date_creation,
            statut_wms: cmd.statut_wms,
            nb_lignes: nbLignes || 0,
            nb_lignes_avec_produit: nbLignesAvecProduit || 0,
            problemes
          });
        }
      }

      setCommandes(commandesAvecProblemes);

    } catch (error: any) {
      console.error(error);
      toast.error("Erreur : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRepairClick = (commandeId: string) => {
    setSelectedCommandeId(commandeId);
    setRepairDialogOpen(true);
  };

  const handleRepairAll = async () => {
    if (!confirm(`Voulez-vous vraiment réparer automatiquement ${commandes.length} commande(s) ?\n\nCela assignera automatiquement le premier client actif et tentera de matcher les produits.`)) {
      return;
    }

    setRepairing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Appeler la fonction SQL directement
      const { data, error } = await supabase.rpc("backfill_commandes_client_id" as any);
      
      if (error) {
        console.error("Erreur backfill:", error);
        toast.error("Erreur lors de la réparation automatique");
        errorCount = commandes.length;
      } else if (data && typeof data === 'object' && 'commandes_updated' in data) {
        successCount = data.commandes_updated || 0;
        toast.success(`${successCount} commande(s) réparée(s) automatiquement !`);
      } else {
        successCount = commandes.length;
        toast.success("Réparation automatique effectuée");
      }
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la réparation");
      errorCount = commandes.length;
    }

    setRepairing(false);
    setTimeout(() => loadCommandesProblemes(), 1000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            Réparation d'Urgence des Commandes
          </h1>
          <p className="text-muted-foreground mt-2">
            Correction des commandes incomplètes (sans client, sans produits, sans expéditeur)
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Commandes à Problèmes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{commandes.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-500" />
                Sans Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">
                {commandes.filter(c => !c.client_id).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-500" />
                Sans Produits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">
                {commandes.filter(c => c.nb_lignes === 0).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions globales */}
        <Card>
          <CardHeader>
            <CardTitle>Actions Groupées</CardTitle>
            <CardDescription>
              Réparer automatiquement toutes les commandes en une fois (matching automatique)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleRepairAll} 
              disabled={repairing || commandes.length === 0}
              size="lg"
              variant="destructive"
            >
              {repairing ? (
                <>
                  <Wrench className="h-5 w-5 mr-2 animate-spin" />
                  Réparation en cours...
                </>
              ) : (
                <>
                  <Wrench className="h-5 w-5 mr-2" />
                  Réparer automatiquement ({commandes.length} commandes)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Liste des commandes à problèmes */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Commandes à Réparer</CardTitle>
            <CardDescription>
              Cliquez sur "Réparer" pour corriger manuellement une commande
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : commandes.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold mb-2">Aucun problème détecté !</h3>
                <p className="text-muted-foreground">Toutes les commandes sont correctement configurées.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {commandes.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold">{cmd.numero_commande}</span>
                        <span className="text-sm text-muted-foreground">{cmd.nom_client}</span>
                        <Badge variant="outline">{cmd.statut_wms}</Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {cmd.problemes.map((pb, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">
                            {pb}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="text-xs text-muted-foreground mt-1">
                        {cmd.nb_lignes} produit(s) • Créée le {new Date(cmd.date_creation).toLocaleDateString("fr-FR")}
                      </div>
                    </div>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleRepairClick(cmd.id)}
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Réparer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedCommandeId && (
        <RepairCommandeDialog
          open={repairDialogOpen}
          onOpenChange={setRepairDialogOpen}
          commandeId={selectedCommandeId}
          onRepaired={loadCommandesProblemes}
        />
      )}
    </DashboardLayout>
  );
}
