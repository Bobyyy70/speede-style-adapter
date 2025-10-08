import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SupprimerEmplacementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zones: string[];
  onSuccess: () => void;
}

export function SupprimerEmplacementsDialog({ open, onOpenChange, zones, onSuccess }: SupprimerEmplacementsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [confirmStep, setConfirmStep] = useState(false);

  const handleSupprimer = async () => {
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('supprimer_emplacements_zone', {
        p_zone: selectedZone === "all" ? null : selectedZone
      });

      if (error) throw error;

      if (data && !(data as any).success) {
        toast.error((data as any).error || "Impossible de supprimer les emplacements");
        setConfirmStep(false);
        return;
      }

      const count = (data as any).emplacements_supprimes || 0;
      toast.success(`${count} emplacement${count > 1 ? 's supprimés' : ' supprimé'}`);
      onSuccess();
      onOpenChange(false);
      setConfirmStep(false);
      setSelectedZone("all");
    } catch (error: any) {
      console.error('Erreur suppression emplacements:', error);
      toast.error(error.message || "Erreur lors de la suppression des emplacements");
      setConfirmStep(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setConfirmStep(false);
    onOpenChange(false);
    setSelectedZone("all");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        setConfirmStep(false);
        setSelectedZone("all");
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Supprimer des emplacements
          </DialogTitle>
          <DialogDescription>
            {confirmStep 
              ? "Êtes-vous vraiment sûr ? Cette action est irréversible."
              : "Supprimer tous les emplacements vides d'une zone"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Seuls les emplacements <strong>vides</strong> (sans stock) seront supprimés.
              Les emplacements contenant du stock ne seront pas affectés.
            </AlertDescription>
          </Alert>

          {!confirmStep && (
            <div className="grid gap-2">
              <Label htmlFor="zone">Zone à supprimer</Label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger id="zone">
                  <SelectValue placeholder="Choisir une zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">⚠️ Toutes les zones (tout supprimer)</SelectItem>
                  {zones.map(zone => (
                    <SelectItem key={zone} value={zone}>Zone {zone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedZone === "all" 
                  ? "⚠️ Tous les emplacements vides de toutes les zones seront supprimés"
                  : `Seuls les emplacements vides de la zone ${selectedZone} seront supprimés`
                }
              </p>
            </div>
          )}

          {confirmStep && (
            <Alert>
              <AlertDescription className="font-medium">
                Zone: <strong>{selectedZone === "all" ? "Toutes les zones" : selectedZone}</strong>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Annuler
          </Button>
          <Button 
            onClick={handleSupprimer} 
            disabled={loading}
            variant="destructive"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmStep ? "Oui, supprimer définitivement" : "Continuer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
