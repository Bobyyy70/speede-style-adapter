import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface AjouterStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emplacement: {
    id: string;
    code_emplacement: string;
    zone: string;
    capacite_max_unites?: number;
    quantite_actuelle?: number;
  } | null;
  onSuccess: () => void;
}

export function AjouterStockDialog({ open, onOpenChange, emplacement, onSuccess }: AjouterStockDialogProps) {
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [produits, setProduits] = useState<any[]>([]);
  const [selectedProduit, setSelectedProduit] = useState<any>(null);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [quantite, setQuantite] = useState("");
  const [remarques, setRemarques] = useState("");

  useEffect(() => {
    if (open) {
      loadProduits();
    } else {
      // Reset form
      setSelectedProduit(null);
      setQuantite("");
      setRemarques("");
    }
  }, [open]);

  const loadProduits = async () => {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('produit')
        .select('id, reference, nom, stock_actuel, poids_unitaire')
        .eq('statut_actif', true)
        .order('reference');

      if (error) throw error;
      setProduits(data || []);
    } catch (error: any) {
      console.error('Erreur chargement produits:', error);
      toast.error("Erreur lors du chargement des produits");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAjouter = async () => {
    if (!emplacement || !selectedProduit || !quantite || parseInt(quantite) <= 0) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }

    // Vérification capacité poids si disponible
    if (selectedProduit?.poids_unitaire && (emplacement as any).capacite_max_kg) {
      const poidsTotal = selectedProduit.poids_unitaire * parseInt(quantite);
      if (poidsTotal > (emplacement as any).capacite_max_kg) {
        toast.error(`Capacité dépassée: ${poidsTotal.toFixed(1)} kg > ${(emplacement as any).capacite_max_kg} kg`);
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('ajouter_stock_manuel', {
        p_emplacement_id: emplacement.id,
        p_produit_id: selectedProduit.id,
        p_quantite: parseInt(quantite),
        p_remarques: remarques || null
      });

      if (error) throw error;

      if (data && !(data as any).success) {
        toast.error((data as any).error || "Erreur lors de l'ajout du stock");
        return;
      }

      toast.success(`${quantite} unités ajoutées à ${emplacement.code_emplacement}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur ajout stock:', error);
      toast.error(error.message || "Erreur lors de l'ajout du stock");
    } finally {
      setLoading(false);
    }
  };

  if (!emplacement) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter du stock</DialogTitle>
          <DialogDescription>
            Emplacement: <strong>{emplacement.code_emplacement}</strong> (Zone {emplacement.zone})
            {(emplacement as any).capacite_max_kg && (
              <span className="block mt-1 text-xs">
                Capacité max: {(emplacement as any).capacite_max_kg} kg
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Produit *</Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="justify-between"
                  disabled={searchLoading}
                >
                  {selectedProduit ? (
                    <span className="truncate">
                      {selectedProduit.reference} - {selectedProduit.nom}
                    </span>
                  ) : (
                    "Sélectionner un produit..."
                  )}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Rechercher un produit..." />
                  <CommandList>
                    <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
                    <CommandGroup>
                      {produits.map((produit) => (
                        <CommandItem
                          key={produit.id}
                          value={`${produit.reference} ${produit.nom}`}
                          onSelect={() => {
                            setSelectedProduit(produit);
                            setOpenCombobox(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{produit.reference}</span>
                            <span className="text-sm text-muted-foreground">{produit.nom}</span>
                            <span className="text-xs text-muted-foreground">
                              Stock: {produit.stock_actuel || 0} unités
                              {produit.poids_unitaire && ` • ${produit.poids_unitaire} kg/unité`}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quantite">Quantité à ajouter *</Label>
            <Input
              id="quantite"
              type="number"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              min="1"
              placeholder="Nombre d'unités"
            />
            {selectedProduit && quantite && (emplacement as any).capacite_max_kg && selectedProduit.poids_unitaire && (() => {
              const poidsTotal = selectedProduit.poids_unitaire * parseInt(quantite || "0");
              const capaciteMax = (emplacement as any).capacite_max_kg;
              const depassement = poidsTotal > capaciteMax;
              return (
                <p className={`text-xs ${depassement ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  Poids total: {poidsTotal.toFixed(1)} kg / {capaciteMax} kg
                  {depassement && " ⚠️ Capacité dépassée !"}
                </p>
              );
            })()}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="remarques">Remarques (optionnel)</Label>
            <Textarea
              id="remarques"
              value={remarques}
              onChange={(e) => setRemarques(e.target.value)}
              placeholder="Notes sur cet ajout de stock..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleAjouter} disabled={loading || !selectedProduit || !quantite}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
