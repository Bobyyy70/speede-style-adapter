import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RetirerStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emplacement: {
    id: string;
    code_emplacement: string;
    zone: string;
    quantite_actuelle?: number;
    produit_actuel_id?: string;
  } | null;
  produitNom?: string;
  onSuccess: () => void;
}

export function RetirerStockDialog({ open, onOpenChange, emplacement, produitNom, onSuccess }: RetirerStockDialogProps) {
  const [loading, setLoading] = useState(false);
  const [quantite, setQuantite] = useState("");
  const [remarques, setRemarques] = useState("");

  useEffect(() => {
    if (!open) {
      setQuantite("");
      setRemarques("");
    }
  }, [open]);

  const handleRetirer = async () => {
    if (!emplacement || !quantite || parseInt(quantite) <= 0) {
      toast.error("Veuillez saisir une quantité valide");
      return;
    }

    if (parseInt(quantite) > (emplacement.quantite_actuelle || 0)) {
      toast.error("Quantité supérieure au stock disponible");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('retirer_stock_manuel', {
        p_emplacement_id: emplacement.id,
        p_quantite: parseInt(quantite),
        p_remarques: remarques || null
      });

      if (error) throw error;

      if (data && !(data as any).success) {
        toast.error((data as any).error || "Erreur lors du retrait du stock");
        return;
      }

      toast.success(`${quantite} unités retirées de ${emplacement.code_emplacement}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur retrait stock:', error);
      toast.error(error.message || "Erreur lors du retrait du stock");
    } finally {
      setLoading(false);
    }
  };

  if (!emplacement) return null;

  const stockActuel = emplacement.quantite_actuelle || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Retirer du stock</DialogTitle>
          <DialogDescription>
            Emplacement: <strong>{emplacement.code_emplacement}</strong> (Zone {emplacement.zone})
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {stockActuel === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Cet emplacement est vide, aucun stock à retirer.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {produitNom && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium">Produit actuel:</p>
                  <p className="text-sm text-muted-foreground">{produitNom}</p>
                  <p className="text-sm font-medium mt-2">Stock disponible: {stockActuel} unités</p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="quantite">Quantité à retirer *</Label>
                <Input
                  id="quantite"
                  type="number"
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  min="1"
                  max={stockActuel}
                  placeholder="Nombre d'unités"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum: {stockActuel} unités
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="remarques">Remarques (optionnel)</Label>
                <Textarea
                  id="remarques"
                  value={remarques}
                  onChange={(e) => setRemarques(e.target.value)}
                  placeholder="Raison du retrait, destination, etc..."
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button 
            onClick={handleRetirer} 
            disabled={loading || !quantite || stockActuel === 0}
            variant="destructive"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Retirer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
