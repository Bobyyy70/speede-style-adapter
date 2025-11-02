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

interface AjouterStockSimpleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emplacement: {
    id: string;
    code_emplacement: string;
    produit_actuel_id: string;
    produit?: {
      id: string;
      reference: string;
      nom: string;
    };
  };
  onSuccess: () => void;
}

export function AjouterStockSimpleDialog({
  open,
  onOpenChange,
  emplacement,
  onSuccess
}: AjouterStockSimpleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [quantite, setQuantite] = useState(1);
  const [raison, setRaison] = useState("Réception");
  const [remarques, setRemarques] = useState("");

  const handleAjouter = async () => {
    if (quantite <= 0) {
      toast({
        title: "Erreur",
        description: "La quantité doit être supérieure à 0",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("ajouter_stock_manuel", {
        p_emplacement_id: emplacement.id,
        p_produit_id: emplacement.produit_actuel_id,
        p_quantite: quantite,
        p_remarques: remarques || null,
        p_raison: raison
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error || "Erreur lors de l'ajout");

      toast({
        title: "Stock ajouté",
        description: `${quantite} unités ajoutées avec succès`
      });

      onSuccess();
      onOpenChange(false);
      setQuantite(1);
      setRemarques("");
      setRaison("Réception");
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
          <DialogTitle>Ajouter du stock</DialogTitle>
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
            <Label htmlFor="quantite">Quantité *</Label>
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
                value={quantite}
                onChange={(e) => setQuantite(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={loading}
                className="text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantite(quantite + 1)}
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
                <SelectItem value="Réception">Réception</SelectItem>
                <SelectItem value="Réappro">Réapprovisionnement</SelectItem>
                <SelectItem value="Ajustement inventaire">Ajustement inventaire</SelectItem>
                <SelectItem value="Retour">Retour</SelectItem>
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
          <Button onClick={handleAjouter} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
