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
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Récupérer le stock actuel et le produit_id de l'emplacement
      const { data: empl, error: emplFetchError } = await supabase
        .from('emplacement')
        .select('produit_actuel_id, quantite_actuelle')
        .eq('id', emplacement.id)
        .single();
      
      if (emplFetchError) throw emplFetchError;
      if (!empl?.produit_actuel_id) throw new Error("Aucun produit dans cet emplacement");

      // 2. Récupérer stock produit
      const { data: produit, error: fetchError } = await supabase
        .from('produit')
        .select('stock_actuel')
        .eq('id', empl.produit_actuel_id)
        .single();
      
      if (fetchError) throw fetchError;
      const stockAvant = produit?.stock_actuel || 0;

      // 3. UPDATE produit - décrémenter stock
      const { error: updateError } = await supabase
        .from('produit')
        .update({ 
          stock_actuel: Math.max(0, stockAvant - quantite),
          date_modification: new Date().toISOString()
        })
        .eq('id', empl.produit_actuel_id);
      
      if (updateError) throw updateError;

      // 4. UPDATE emplacement - décrémenter quantité
      const nouvelleQuantite = Math.max(0, (empl.quantite_actuelle || 0) - quantite);
      const { error: emplError } = await supabase
        .from('emplacement')
        .update({ 
          quantite_actuelle: nouvelleQuantite,
          statut_actuel: nouvelleQuantite === 0 ? 'disponible' : 'occupé',
          produit_actuel_id: nouvelleQuantite === 0 ? null : empl.produit_actuel_id
        })
        .eq('id', emplacement.id);
        
      if (emplError) throw emplError;

      // 5. INSERT mouvement_stock pour traçabilité
      const { error: insertError } = await supabase
        .from('mouvement_stock')
        .insert({
          produit_id: empl.produit_actuel_id,
          emplacement_source_id: emplacement.id,
          quantite: -quantite,
          type_mouvement: 'retrait',
          raison: raison,
          remarques: remarques || null,
          created_by: user?.id,
          stock_apres_mouvement: Math.max(0, stockAvant - quantite),
          date_mouvement: new Date().toISOString()
        });
      
      if (insertError) throw insertError;

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
      console.error('Erreur retrait stock:', error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du retrait du stock",
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
