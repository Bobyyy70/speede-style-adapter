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
import { useThermalPrinter } from "@/hooks/useThermalPrinter";
import { DocumentsSection } from "./expedition/DocumentsSection";
import { HistoireTimeline } from "./expedition/HistoireTimeline";
import { FicheCommandeComplete } from "./FicheCommandeComplete";
import { CreerRetourDialog } from "./CreerRetourDialog";
import { SendCloudActions } from "./SendCloudActions";
import { SelectTransportService } from "./SelectTransportService";
import { VolumetricWeightDisplay } from "./VolumetricWeightDisplay";
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
  MapPin,
  Truck,
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

  // Hook imprimante thermique
  const { print, isPrinting, printers } = useThermalPrinter();

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

  // Appliquer automatiquement les règles si expéditeur/transporteur manquant
  useEffect(() => {
    if (!open || !commande || !lignes) return;

    const applyMissingRules = async () => {
      let rulesApplied = false;
      const updates: any = {};

      // Calculer poids total depuis lignes si manquant
      if ((!commande.poids_total || !commande.poids_reel_kg) && lignes.length > 0) {
        const poidsTotal = lignes.reduce((sum, ligne) => {
          const poids = ligne.poids_unitaire || 0;
          const qte = ligne.quantite_commandee || 0;
          return sum + (poids * qte);
        }, 0);
        
        if (poidsTotal > 0) {
          updates.poids_total = poidsTotal;
          updates.poids_reel_kg = poidsTotal;
          console.log('[Auto] Poids calculé:', poidsTotal, 'kg');
        }
      }

      // Appliquer règles expéditeur si vide (même sans client_id)
      if (!commande.expediteur_entreprise) {
        try {
          const { data, error } = await supabase.functions.invoke('apply-expediteur-rules', {
            body: {
              commandeId,
              clientId: commande.client_id || null,
              nomClient: commande.nom_client,
              tagsCommande: commande.tags || [],
              sousClient: commande.sous_client,
            }
          });

          if (!error && data?.success && data?.matched) {
            rulesApplied = true;
            console.log('[Auto] Règle expéditeur appliquée:', data.sender);
          }
        } catch (err) {
          console.error('[Auto] Erreur règles expéditeur:', err);
        }
      }

      // Appliquer règles auto (transporteur, etc.) si vide
      if (!commande.transporteur || !commande.methode_expedition) {
        try {
          const { data, error } = await supabase.functions.invoke('apply-automatic-rules', {
            body: { commandeId }
          });

          if (!error && data?.updates && Object.keys(data.updates).length > 0) {
            rulesApplied = true;
            console.log('[Auto] Règles transporteur appliquées:', data.updates);
          }
        } catch (err) {
          console.error('[Auto] Erreur règles auto:', err);
        }
      }

      // Sauvegarder les updates de poids si calculés
      if (Object.keys(updates).length > 0) {
        try {
          const { error } = await supabase
            .from('commande')
            .update(updates)
            .eq('id', commandeId);
          
          if (!error) {
            rulesApplied = true;
          }
        } catch (err) {
          console.error('[Auto] Erreur mise à jour poids:', err);
        }
      }

      if (rulesApplied) {
        refetch();
      }
    };

    applyMissingRules();
  }, [open, commande?.id, lignes?.length]);

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

  const handleThermalPrint = (docType: 'picking_slip' | 'packing_list' = 'picking_slip') => {
    if (!printers || printers.length === 0) {
      toast({
        title: "Aucune imprimante configurée",
        description: "Veuillez configurer une imprimante thermique dans les paramètres",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Fonctionnalité désactivée",
      description: "L'impression thermique n'est pas configurée",
      variant: "destructive",
    });
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
      // Si on passe à "expedie", convertir les réservations en sorties
      if (nouveauStatut === 'expedie') {
        const { data: expeditionResult, error: expeditionError } = await supabase.rpc(
          'expedier_commande_stock',
          { p_commande_id: commandeId }
        );

        if (expeditionError) {
          throw new Error(`Erreur conversion stock: ${expeditionError.message}`);
        }
      }

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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-4">
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

          {/* BARRE D'ACTIONS UNIFIÉE */}
          <div className="flex items-center justify-end gap-2 py-2 border-t border-b -mx-6 px-6">
            {/* Menu Actions principal */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm">
                  Actions
                  <ChevronDown className="h-3 w-3 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Actions disponibles</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Tracking si disponible */}
                {commande.tracking_url && (
                  <DropdownMenuItem asChild>
                    <a href={commande.tracking_url} target="_blank" rel="noopener noreferrer">
                      <MapPin className="h-4 w-4 mr-2" />
                      Suivi colis
                    </a>
                  </DropdownMenuItem>
                )}

                {/* Créer un retour */}
                <DropdownMenuItem onClick={() => setShowRetourDialog(true)}>
                  <PackageX className="h-4 w-4 mr-2" />
                  Créer un retour
                </DropdownMenuItem>

                {/* Dupliquer */}
                <DropdownMenuItem onClick={handleDuplicate} disabled={actionLoading === "duplicate"}>
                  <Copy className="h-4 w-4 mr-2" />
                  Dupliquer
                </DropdownMenuItem>

                {/* Imprimer */}
                <DropdownMenuItem onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimer
                </DropdownMenuItem>

                {/* Impression thermique */}
                {printers && printers.length > 0 && (
                  <DropdownMenuItem onClick={() => handleThermalPrint('picking_slip')} disabled={isPrinting}>
                    <Printer className="h-4 w-4 mr-2 text-blue-600" />
                    Imprimer picking (thermique)
                  </DropdownMenuItem>
                )}

                {/* Télécharger */}
                <DropdownMenuItem>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Annuler */}
                {!isExpedieOrLivre && commande.statut_wms !== "annule" && (
                  <DropdownMenuItem onClick={() => setShowCancelConfirm(true)} className="text-orange-600">
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler la commande
                  </DropdownMenuItem>
                )}

                {/* Supprimer (admin only) */}
                {canDelete && !isExpedieOrLivre && (
                  <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Actions SendCloud (seulement si existe) */}
            {commande?.sendcloud_shipment_id && (
              <SendCloudActions
                commandeId={commandeId}
                hasLabel={!!commande?.label_url}
                hasSendcloudId={!!commande?.sendcloud_shipment_id}
                showReturnButton={false}
                onSuccess={() => {
                  refetch();
                  onSuccess?.();
                }}
              />
            )}
          </div>

          {/* TABS */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="products">Produits</TabsTrigger>
              <TabsTrigger value="transport">
                <Truck className="h-4 w-4 mr-2" />
                Transport
              </TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <FicheCommandeComplete
                commande={commande}
                lignes={lignes}
                compact={true}
                showTimeline={false}
                showProducts={false}
              />
            </TabsContent>

            <TabsContent value="products" className="mt-4">
              {lignes && lignes.length > 0 ? (
                <FicheCommandeComplete
                  commande={commande}
                  lignes={lignes}
                  showTimeline={false}
                  showProducts={true}
                  compact={true}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun produit</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Cette commande ne contient aucune ligne de produit. 
                    {userRole === 'admin' && (
                      <span className="block mt-2">Utilisez les actions pour ajouter des produits à cette commande.</span>
                    )}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transport" className="mt-4">
              <div className="space-y-4">
                <SelectTransportService
                  commandeId={commandeId}
                  poidsTotal={commande?.poids_total || 0}
                  paysDestination={commande?.pays_code}
                  onServiceSelected={() => {
                    queryClient.invalidateQueries({ queryKey: ["commande", commandeId] });
                    toast({ title: "Service de transport mis à jour" });
                  }}
                />
                
                <VolumetricWeightDisplay
                  commandeId={commandeId}
                  transporteurCode={commande?.transporteur_choisi || undefined}
                />
              </div>
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
