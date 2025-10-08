import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus } from "lucide-react";

interface RetirerStockSimpleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emplacement: {
    id: string;
    code_emplacement: string;
    quantite_actuelle: number;
    produit?: {
      reference: string;
      nom: string;
    };
  };
  onSuccess: () => void;
}

export function RetirerStockSimpleDialog({
  open,
  onOpenChange,
  emplacement,
  onSuccess
}: RetirerStockSimpleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [quantite, setQuantite] = useState(1);
  const [raison, setRaison] = useState("Expédition");
  const [remarques, setRemarques] = useState("");

  const maxQuantite = emplacement.quantite_actuelle || 0;

  const handleRetirer = async () => {
    if (quantite <= 0) {
      toast({
        title: "Erreur",
        description: "La quantité doit être supérieure à 0",
        variant: "destructive"
      });
      return;
    }

    if (quantite > maxQuantite) {
      toast({
        title: "Erreur",
        description: `Stock disponible: ${maxQuantite} unités`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("retirer_stock_manuel", {
        p_emplacement_id: emplacement.id,
        p_quantite: quantite,
        p_remarques: remarques || null,
        p_raison: raison
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error || "Erreur lors du retrait");

      toast({
        title: "Stock retiré",
        description: `${quantite} unités retirées avec succès`
      });

      onSuccess();
      onOpenChange(false);
      setQuantite(1);
      setRemarques("");
      setRaison("Expédition");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retirer du stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Emplacement</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm">
              {emplacement.code_emplacement}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produit</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm">
              <div className="font-medium">{emplacement.produit?.reference}</div>
              <div className="text-muted-foreground">{emplacement.produit?.nom}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Stock disponible</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium">
              {maxQuantite} unités
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantite">Quantité à retirer *</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantite(Math.max(1, quantite - 1))}
                disabled={loading}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="quantite"
                type="number"
                min="1"
                max={maxQuantite}
                value={quantite}
                onChange={(e) => setQuantite(Math.max(1, Math.min(maxQuantite, parseInt(e.target.value) || 1)))}
                disabled={loading}
                className="text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantite(Math.min(maxQuantite, quantite + 1))}
                disabled={loading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="raison">Raison *</Label>
            <Select value={raison} onValueChange={setRaison} disabled={loading}>
              <SelectTrigger id="raison">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Expédition">Expédition</SelectItem>
                <SelectItem value="Casse">Casse</SelectItem>
                <SelectItem value="Retour fournisseur">Retour fournisseur</SelectItem>
                <SelectItem value="Ajustement inventaire">Ajustement inventaire</SelectItem>
                <SelectItem value="Autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarques">Remarques (optionnel)</Label>
            <Textarea
              id="remarques"
              value={remarques}
              onChange={(e) => setRemarques(e.target.value)}
              disabled={loading}
              placeholder="Notes additionnelles..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleRetirer} disabled={loading} variant="destructive">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Retirer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
