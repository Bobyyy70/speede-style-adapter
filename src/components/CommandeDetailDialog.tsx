import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useStatutTransition } from "@/hooks/useStatutTransition";
import { DocumentsSection } from "./expedition/DocumentsSection";
import { HistoireTimeline } from "./expedition/HistoireTimeline";
import { FicheCommandeComplete } from "./FicheCommandeComplete";
import { CreerRetourDialog } from "./CreerRetourDialog";
import { SendCloudActions } from "./SendCloudActions";
import { ORDER_STATUS_LABELS, getStatutBadgeVariant } from "@/lib/orderStatuses";
import {
  Package,
  Printer,
  Download,
  Copy,
  XCircle,
  Trash2,
  PackageX,
  ChevronDown,
  Loader2,
  ArrowRight,
  Archive,
  Euro,
  Clock,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CommandeDetailDialogProps {
  commandeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CommandeDetailDialog = ({
  commandeId,
  open,
  onOpenChange,
  onSuccess,
}: CommandeDetailDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const [showRetourDialog, setShowRetourDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [statusChanging, setStatusChanging] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Import du hook de transition
  const { transitionStatut, subscribeToStatutChanges } = useStatutTransition();

  // Fetch commande complète
  const { data: commande, refetch } = useQuery({
    queryKey: ["commande", commandeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commande")
        .select("*")
        .eq("id", commandeId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!commandeId,
  });

  // Realtime subscription pour les mises à jour de statut
  useEffect(() => {
    if (!commandeId || !open) return;

    const unsubscribe = subscribeToStatutChanges('commande', (payload) => {
      if (payload.new.id === commandeId) {
        console.log('[Realtime] Commande updated:', payload.new);
        refetch();
      }
    });

    return () => unsubscribe();
  }, [commandeId, open]);

  // Fetch lignes de commande
  const { data: lignes } = useQuery({
    queryKey: ["lignes_commande", commandeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ligne_commande")
        .select("*")
        .eq("commande_id", commandeId)
        .order("date_creation", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open && !!commandeId,
  });

  // Calculer les transitions possibles côté client
  const getTransitionsPossibles = (currentStatut: string): string[] => {
    const transitions: Record<string, string[]> = {
      "en_attente_reappro": ["stock_reserve", "annule", "erreur"],
      "stock_reserve": ["en_picking", "en_preparation", "annule", "erreur"],
      "en_picking": ["picking_termine", "en_attente_reappro", "erreur", "annule"],
      "picking_termine": ["en_preparation", "en_picking", "annule"],
      "en_preparation": ["pret_expedition", "picking_termine", "erreur", "annule"],
      "pret_expedition": ["etiquette_generee", "expedie", "en_preparation", "annule"],
      "etiquette_generee": ["expedie", "pret_expedition", "annule"],
      "expedie": ["livre", "erreur"],
      "livre": ["erreur"],
      "erreur": ["en_attente_reappro", "stock_reserve", "en_picking", "en_preparation", "pret_expedition", "annule"],
      "annule": [],
    };
    return transitions[currentStatut] || [];
  };

  const transitionsPossibles = commande ? getTransitionsPossibles(commande.statut_wms) : [];

  const handlePrint = () => {
    window.print();
    toast({ title: "Impression lancée" });
  };

  const handleDuplicate = async () => {
    setActionLoading("duplicate");
    try {
      // Créer une nouvelle commande avec les mêmes données
      const { data: newCommande, error: commandeError } = await supabase
        .from("commande")
        .insert({
          ...commande,
          id: undefined,
          numero_commande: `CMD-${Date.now()}`,
          statut_wms: "en_attente_reappro",
          date_creation: new Date().toISOString(),
          date_modification: new Date().toISOString(),
          sendcloud_id: null,
          sendcloud_shipment_id: null,
          tracking_number: null,
          tracking_url: null,
          label_url: null,
        })
        .select()
        .single();

      if (commandeError) throw commandeError;

      // Dupliquer les lignes
      if (lignes && lignes.length > 0) {
        const newLignes = lignes.map((l) => ({
          ...l,
          id: undefined,
          commande_id: newCommande.id,
          quantite_preparee: 0,
          statut_ligne: "en_attente",
        }));

        const { error: lignesError } = await supabase
          .from("ligne_commande")
          .insert(newLignes);

        if (lignesError) throw lignesError;
      }

      toast({
        title: "Commande dupliquée",
        description: `Nouvelle commande ${newCommande.numero_commande} créée`,
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeStatus = async (nouveauStatut: string) => {
    setStatusChanging(true);
    try {
      await transitionStatut('commande', commandeId, nouveauStatut, 'Changement manuel de statut');
      refetch();
      onSuccess?.();
    } catch (error: any) {
      // Error already handled by useStatutTransition
    } finally {
      setStatusChanging(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading("cancel");
    try {
      // Transition vers annulé
      const { data, error } = await supabase.rpc("transition_statut_commande", {
        p_commande_id: commandeId,
        p_nouveau_statut: "annule",
        p_remarques: cancelReason || "Annulation manuelle",
      });

      if (error) throw error;

      const result = data as any;
      if (result && !result.success) {
        throw new Error(result.error || "Impossible d'annuler");
      }

      // Libérer le stock réservé
      await supabase.rpc("liberer_stock_commande", {
        p_commande_id: commandeId,
      });

      toast({
        title: "Commande annulée",
        description: "Stock libéré",
      });

      setShowCancelConfirm(false);
      setCancelReason("");
      refetch();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    setActionLoading("delete");
    try {
      // Vérifier que la commande peut être supprimée
      if (commande?.statut_wms === "expedie" || commande?.statut_wms === "livre") {
        throw new Error(
          "Impossible de supprimer une commande expédiée ou livrée"
        );
      }

      // Supprimer (cascade vers lignes, mouvements, etc.)
      const { error } = await supabase
        .from("commande")
        .delete()
        .eq("id", commandeId);

      if (error) throw error;

      toast({
        title: "Commande supprimée",
        description: "La commande a été définitivement supprimée",
      });

      setShowDeleteConfirm(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (!commande) return null;

  const canDelete = userRole === "admin" || userRole === "gestionnaire";
  const isExpedieOrLivre =
    commande.statut_wms === "expedie" || commande.statut_wms === "livre";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Package className="h-6 w-6 text-muted-foreground" />
                  <DialogTitle className="text-3xl">
                    {commande.numero_commande}
                  </DialogTitle>
                  <Badge
                    variant={getStatutBadgeVariant(commande.statut_wms)}
                    className="text-base px-3 py-1"
                  >
                    {ORDER_STATUS_LABELS[commande.statut_wms] ||
                      commande.statut_wms}
                  </Badge>
                  <Badge variant="outline">{commande.source}</Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(
                        new Date(commande.date_creation),
                        "dd MMM yyyy HH:mm",
                        { locale: fr }
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{commande.nom_client}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Euro className="h-4 w-4" />
                    <span className="font-semibold">
                      {commande.valeur_totale.toFixed(2)} {commande.devise}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* BARRE D'ACTIONS */}
          <div className="flex items-center justify-between gap-2 py-3 border-t border-b bg-muted/30 -mx-6 px-6">
            <div className="flex items-center gap-2">
              {/* Changer le statut */}
              {transitionsPossibles && transitionsPossibles.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={statusChanging}
                    >
                      {statusChanging ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      Changer le statut
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Transitions possibles</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {transitionsPossibles.map((statut) => (
                      <DropdownMenuItem
                        key={statut}
                        onClick={() => handleChangeStatus(statut)}
                      >
                        <ArrowRight className="h-3 w-3 mr-2" />
                        {ORDER_STATUS_LABELS[statut] || statut}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Créer un retour */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRetourDialog(true)}
              >
                <PackageX className="h-4 w-4 mr-2" />
                Créer un retour
              </Button>

              {/* Actions SendCloud */}
              {commande?.sendcloud_shipment_id && (
                <SendCloudActions
                  commandeId={commandeId}
                  hasLabel={!!commande?.label_url}
                  hasSendcloudId={!!commande?.sendcloud_shipment_id}
                  onSuccess={() => {
                    refetch();
                    onSuccess?.();
                  }}
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Dupliquer */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                disabled={actionLoading === "duplicate"}
              >
                {actionLoading === "duplicate" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Dupliquer
              </Button>

              {/* Imprimer */}
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>

              {/* Télécharger tout */}
              <Button variant="outline" size="sm">
                <Archive className="h-4 w-4 mr-2" />
                Télécharger
              </Button>

              {/* Annuler */}
              {!isExpedieOrLivre && commande.statut_wms !== "annule" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
              )}

              {/* Supprimer (admin only) */}
              {canDelete && !isExpedieOrLivre && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              )}
            </div>
          </div>

          {/* TABS */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="products">Produits</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <FicheCommandeComplete
                commande={commande}
                lignes={lignes}
                showTimeline={false}
                showProducts={false}
                compact={true}
              />
            </TabsContent>

            <TabsContent value="products" className="mt-4">
              <FicheCommandeComplete
                commande={commande}
                lignes={lignes}
                showTimeline={false}
                showProducts={true}
                compact={true}
              />
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <DocumentsSection commandeId={commandeId} commande={commande} />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <HistoireTimeline commande={commande} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog de création de retour */}
      <CreerRetourDialog
        open={showRetourDialog}
        onOpenChange={setShowRetourDialog}
        commandeId={commandeId}
        commande={commande}
      />

      {/* Confirmation annulation */}
      <AlertDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action libérera les stocks réservés. Voulez-vous continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancel-reason">Raison de l'annulation</Label>
            <Input
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optionnel"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={actionLoading === "cancel"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading === "cancel" && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Annuler la commande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation suppression */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données (lignes,
              mouvements de stock, documents) seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading === "delete"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading === "delete" && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
