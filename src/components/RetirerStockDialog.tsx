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

    const qty = parseInt(quantite);
    const stockActuel = emplacement.quantite_actuelle || 0;

    if (qty > stockActuel) {
      toast.error(`Quantité supérieure au stock disponible (${stockActuel} unités)`);
      return;
    }

    if (!emplacement.produit_actuel_id) {
      toast.error("Aucun produit dans cet emplacement");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Récupérer le stock actuel du produit
      const { data: produit, error: fetchError } = await supabase
        .from('produit')
        .select('stock_actuel')
        .eq('id', emplacement.produit_actuel_id)
        .single();
      
      if (fetchError) throw fetchError;
      const stockAvant = produit?.stock_actuel || 0;

      // 2. UPDATE produit - décrémenter stock
      const { error: updateError } = await supabase
        .from('produit')
        .update({ 
          stock_actuel: Math.max(0, stockAvant - qty),
          date_modification: new Date().toISOString()
        })
        .eq('id', emplacement.produit_actuel_id);
      
      if (updateError) throw updateError;

      // 3. UPDATE emplacement - décrémenter quantité
      const nouvelleQuantite = Math.max(0, stockActuel - qty);
      const { error: emplError } = await supabase
        .from('emplacement')
        .update({ 
          quantite_actuelle: nouvelleQuantite,
          statut_actuel: nouvelleQuantite === 0 ? 'disponible' : 'occupé',
          produit_actuel_id: nouvelleQuantite === 0 ? null : emplacement.produit_actuel_id
        })
        .eq('id', emplacement.id);
        
      if (emplError) throw emplError;

      // 4. INSERT mouvement_stock pour traçabilité
      const { error: insertError } = await supabase
        .from('mouvement_stock')
        .insert({
          produit_id: emplacement.produit_actuel_id,
          emplacement_source_id: emplacement.id,
          quantite: -qty,
          type_mouvement: 'retrait',
          raison: 'Retrait manuel',
          remarques: remarques || null,
          created_by: user?.id,
          stock_apres_mouvement: Math.max(0, stockAvant - qty),
          date_mouvement: new Date().toISOString()
        });
      
      if (insertError) throw insertError;

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
