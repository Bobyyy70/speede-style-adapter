import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AuditTracking() {
  const [selectedCommande, setSelectedCommande] = useState<string | null>(null);

  // Requête pour les commandes avec tracking mais sans sendcloud_reference
  const { data: commandesProblemes, isLoading, refetch } = useQuery({
    queryKey: ["audit-tracking-problems"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commande")
        .select("id, numero_commande, tracking_number, tracking_url, sendcloud_id, sendcloud_reference, nom_client, statut_wms")
        .not("tracking_number", "is", null)
        .order("date_creation", { ascending: false });

      if (error) throw error;

      // Filtrer les commandes avec incohérences
      return data?.filter(
        (cmd) =>
          !cmd.sendcloud_reference || // Pas de référence
          (cmd.sendcloud_id && cmd.sendcloud_reference !== cmd.id) // Référence ne correspond pas à l'ID
      );
    },
  });

  // Requête stats globales
  const { data: stats } = useQuery({
    queryKey: ["audit-tracking-stats"],
    queryFn: async () => {
      // Total commandes avec tracking
      const { count: totalAvecTracking } = await supabase
        .from("commande")
        .select("*", { count: "exact", head: true })
        .not("tracking_number", "is", null);

      // Commandes avec sendcloud_reference OK
      const { count: avecReferenceOK } = await supabase
        .from("commande")
        .select("*", { count: "exact", head: true })
        .not("tracking_number", "is", null)
        .not("sendcloud_reference", "is", null);

      // Commandes avec tracking mais sans sendcloud_id
      const { count: sansSendcloudId } = await supabase
        .from("commande")
        .select("*", { count: "exact", head: true })
        .not("tracking_number", "is", null)
        .is("sendcloud_id", null);

      return {
        totalAvecTracking: totalAvecTracking || 0,
        avecReferenceOK: avecReferenceOK || 0,
        sansSendcloudId: sansSendcloudId || 0,
        problemes: (commandesProblemes?.length || 0),
      };
    },
  });

  const handleSupprimerTracking = async (commandeId: string) => {
    const { error } = await supabase
      .from("commande")
      .update({
        tracking_number: null,
        tracking_url: null,
        sendcloud_id: null,
        sendcloud_reference: null,
      })
      .eq("id", commandeId);

    if (error) {
      toast.error("Erreur lors de la suppression du tracking");
      console.error(error);
    } else {
      toast.success("Tracking supprimé avec succès");
      refetch();
    }
    setSelectedCommande(null);
  };

  const handleNettoyageGlobal = async () => {
    const { error } = await supabase
      .from("commande")
      .update({
        tracking_number: null,
        tracking_url: null,
        sendcloud_id: null,
      })
      .not("tracking_number", "is", null)
      .is("sendcloud_reference", null);

    if (error) {
      toast.error("Erreur lors du nettoyage global");
      console.error(error);
    } else {
      toast.success("Nettoyage global effectué - Les trackings corrompus ont été supprimés");
      refetch();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">🔍 Audit des Trackings SendCloud</h1>
          <p className="text-muted-foreground">
            Détection et correction des incohérences dans les numéros de suivi
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total avec Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalAvecTracking || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">Référence OK</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {stats?.avecReferenceOK || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Problèmes Détectés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                {stats?.problemes || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-600">Sans SendCloud ID</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {stats?.sansSendcloudId || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action de nettoyage global */}
        {commandesProblemes && commandesProblemes.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Action de Nettoyage Global
              </CardTitle>
              <CardDescription>
                Supprimer tous les trackings corrompus (sans sendcloud_reference) pour permettre une re-synchronisation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleNettoyageGlobal}>
                <Trash2 className="mr-2 h-4 w-4" />
                Nettoyer tous les trackings corrompus
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Table des commandes problématiques */}
        <Card>
          <CardHeader>
            <CardTitle>Commandes avec Incohérences</CardTitle>
            <CardDescription>
              Commandes ayant un tracking mais dont le mapping SendCloud est incorrect ou manquant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : commandesProblemes && commandesProblemes.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Commande</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>SendCloud ID</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Problème</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commandesProblemes.map((cmd) => {
                      const probleme = !cmd.sendcloud_reference
                        ? "Pas de référence"
                        : cmd.sendcloud_reference !== cmd.id
                        ? "Référence incorrecte"
                        : "Autre";

                      return (
                        <TableRow key={cmd.id}>
                          <TableCell className="font-mono">{cmd.numero_commande}</TableCell>
                          <TableCell>{cmd.nom_client}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{cmd.statut_wms}</Badge>
                          </TableCell>
                          <TableCell>
                            {cmd.tracking_url ? (
                              <a
                                href={cmd.tracking_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                {cmd.tracking_number?.substring(0, 12)}...
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">{cmd.tracking_number}</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{cmd.sendcloud_id || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {cmd.sendcloud_reference?.substring(0, 8) || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">{probleme}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCommande(cmd.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-green-600 flex flex-col items-center gap-2">
                <CheckCircle className="h-8 w-8" />
                <p className="font-medium">Aucune incohérence détectée</p>
                <p className="text-sm text-muted-foreground">
                  Tous les trackings sont correctement mappés avec leurs commandes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!selectedCommande} onOpenChange={() => setSelectedCommande(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le tracking corrompu ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va supprimer le tracking_number, tracking_url, sendcloud_id et sendcloud_reference de cette commande.
              Vous pourrez ensuite re-générer le tracking depuis SendCloud avec le bon mapping.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedCommande && handleSupprimerTracking(selectedCommande)}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer le tracking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
