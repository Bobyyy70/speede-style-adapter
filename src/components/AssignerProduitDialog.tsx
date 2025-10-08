import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignerProduitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emplacement: {
    id: string;
    code_emplacement: string;
  };
  onSuccess: () => void;
}

export function AssignerProduitDialog({
  open,
  onOpenChange,
  emplacement,
  onSuccess
}: AssignerProduitDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingProduits, setLoadingProduits] = useState(false);
  const [produits, setProduits] = useState<any[]>([]);
  const [produitSelectionne, setProduitSelectionne] = useState<string>("");
  const [openCombobox, setOpenCombobox] = useState(false);

  useEffect(() => {
    if (open) {
      loadProduits();
    } else {
      setProduitSelectionne("");
    }
  }, [open]);

  const loadProduits = async () => {
    setLoadingProduits(true);
    try {
      const { data, error } = await supabase
        .from("produit")
        .select("id, reference, nom, stock_actuel")
        .eq("statut_actif", true)
        .order("reference");

      if (error) throw error;
      setProduits(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive"
      });
    } finally {
      setLoadingProduits(false);
    }
  };

  const handleAssigner = async () => {
    if (!produitSelectionne) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un produit",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("emplacement")
        .update({
          produit_actuel_id: produitSelectionne,
          statut_actuel: "occupé"
        })
        .eq("id", emplacement.id);

      if (error) throw error;

      toast({
        title: "Produit assigné",
        description: "Le produit a été assigné à l'emplacement avec succès"
      });

      onSuccess();
      onOpenChange(false);
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

  const produitSelectionneData = produits.find(p => p.id === produitSelectionne);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assigner un produit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Emplacement</Label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium">
              {emplacement.code_emplacement}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Produit *</Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between"
                  disabled={loadingProduits || loading}
                >
                  {produitSelectionneData ? (
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{produitSelectionneData.reference}</span>
                      <span className="text-muted-foreground">- {produitSelectionneData.nom}</span>
                    </span>
                  ) : (
                    "Sélectionner un produit..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Rechercher un produit..." />
                  <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {produits.map((produit) => (
                      <CommandItem
                        key={produit.id}
                        value={`${produit.reference} ${produit.nom}`}
                        onSelect={() => {
                          setProduitSelectionne(produit.id);
                          setOpenCombobox(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            produitSelectionne === produit.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{produit.reference}</span>
                          <span className="text-sm text-muted-foreground">{produit.nom}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {produitSelectionneData && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="font-medium">Stock actuel: {produitSelectionneData.stock_actuel || 0} unités</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleAssigner} disabled={loading || !produitSelectionne}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assigner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
