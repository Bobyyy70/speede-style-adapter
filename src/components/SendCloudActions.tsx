import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Printer, RotateCcw, Ban, MapPin } from "lucide-react";
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
import { useState } from "react";

interface SendCloudActionsProps {
  commandeId: string;
  hasLabel: boolean;
  hasSendcloudId: boolean;
  onSuccess?: () => void;
}

export function SendCloudActions({
  commandeId,
  hasLabel,
  hasSendcloudId,
  onSuccess,
}: SendCloudActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);

  const handleCreateParcel = async () => {
    setLoading('create');
    try {
      const { data, error } = await supabase.functions.invoke('sendcloud-create-parcel', {
        body: { commande_id: commandeId },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Étiquette SendCloud générée');
        onSuccess?.();
      } else {
        toast.error(data.error || 'Erreur lors de la création');
      }
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    } finally {
      setLoading(null);
    }
  };

  const handleGetTracking = async () => {
    setLoading('tracking');
    try {
      const { data, error } = await supabase.functions.invoke('sendcloud-get-tracking', {
        body: { commande_id: commandeId },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Tracking mis à jour');
        onSuccess?.();
      } else {
        toast.error(data.error || 'Erreur tracking');
      }
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    } finally {
      setLoading(null);
    }
  };

  const handleCancelParcel = async () => {
    setLoading('cancel');
    try {
      const { data, error } = await supabase.functions.invoke('sendcloud-cancel-parcel', {
        body: { commande_id: commandeId },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Commande annulée et stock libéré');
        onSuccess?.();
      } else {
        toast.error(data.error || 'Erreur annulation');
      }
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    } finally {
      setLoading(null);
      setCancelDialogOpen(false);
    }
  };

  const handleCreateReturn = async () => {
    setLoading('return');
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
        onSuccess?.();
      } else {
        toast.error(data.error || 'Erreur création retour');
      }
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    } finally {
      setLoading(null);
      setReturnDialogOpen(false);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {hasSendcloudId && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGetTracking}
            disabled={loading === 'tracking'}
          >
            <MapPin className="h-4 w-4" />
            Tracking
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setReturnDialogOpen(true)}
            disabled={loading === 'return'}
          >
            <RotateCcw className="h-4 w-4" />
            Créer retour
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => setCancelDialogOpen(true)}
            disabled={loading === 'cancel'}
          >
            <Ban className="h-4 w-4" />
            Annuler
          </Button>
        </>
      )}

      {/* Dialog de confirmation d'annulation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la commande SendCloud ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action annulera le parcel dans SendCloud et libérera le stock réservé.
              Cette opération est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelParcel}>
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation de retour */}
      <AlertDialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Créer une étiquette de retour ?</AlertDialogTitle>
            <AlertDialogDescription>
              Une étiquette de retour Mondial Relay sera générée pour cette commande.
              Le client pourra l'utiliser pour retourner sa commande.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateReturn}>
              Générer l'étiquette
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
