import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { useState } from "react";
import { FicheProduitDialog } from "./FicheProduitDialog";
import { DeleteButton } from "./DeleteButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Produit {
  id: string;
  reference: string;
  nom: string;
  stock_actuel: number;
  stock_minimum: number;
  prix_unitaire: number;
  code_barre_ean: string;
  categorie_emballage: number;
  image_url?: string;
}

interface ProduitsKanbanProps {
  produits: Produit[];
  onRefetch?: () => void;
  loading?: boolean;
}

export function ProduitsKanban({ produits, onRefetch, loading }: ProduitsKanbanProps) {
  const [selectedProduitId, setSelectedProduitId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDelete = async (produitId: string) => {
    const { error } = await supabase
      .from("produit")
      .update({ statut_actif: false })
      .eq("id", produitId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le produit",
        variant: "destructive",
      });
      throw error;
    }

    toast({
      title: "Produit supprimé",
      description: "Le produit a été marqué comme inactif",
    });
    
    if (onRefetch) onRefetch();
  };

  const getStockStatus = (produit: Produit) => {
    if (produit.stock_actuel === 0) {
      return { label: "Rupture", variant: "destructive" as const, color: "text-red-500" };
    }
    if (produit.stock_actuel < produit.stock_minimum) {
      return { label: "Alerte", variant: "outline" as const, color: "text-orange-500" };
    }
    return { label: "Stock OK", variant: "secondary" as const, color: "text-green-500" };
  };

  const renderProduitCard = (produit: Produit) => {
    const status = getStockStatus(produit);
    
    return (
      <div
        key={produit.id}
        className="group bg-card border rounded-lg hover:shadow-lg transition-all overflow-hidden relative"
      >
        {/* Bouton suppression */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <DeleteButton
            onDelete={() => handleDelete(produit.id)}
            entityName={`le produit ${produit.reference}`}
          />
        </div>

        {/* Carte cliquable */}
        <div onClick={() => setSelectedProduitId(produit.id)} className="cursor-pointer">
          {/* Image du produit ou icône par défaut */}
          <div className="relative h-32 bg-muted/30 flex items-center justify-center overflow-hidden">
            {produit.image_url ? (
              <img
                src={produit.image_url}
                alt={produit.nom}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <Package className="h-12 w-12 text-muted-foreground/30" />
            )}
            {/* Overlay avec infos au survol */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <div className="text-white text-xs space-y-1">
                <div className="font-medium">{produit.reference}</div>
                {produit.code_barre_ean && (
                  <div className="text-white/80">EAN: {produit.code_barre_ean}</div>
                )}
              </div>
            </div>
          </div>

          {/* Informations du produit */}
          <div className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{produit.reference}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{produit.nom}</div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                {produit.categorie_emballage === 2 && (
                  <Badge variant="outline" className="text-xs">Prot.</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t">
              <span className="text-muted-foreground">
                Stock: <span className={`font-semibold ${status.color}`}>{produit.stock_actuel}</span>
              </span>
              {produit.prix_unitaire && (
                <span className="font-medium text-primary">€{produit.prix_unitaire.toFixed(2)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {produits.length > 0 ? (
          produits.map(renderProduitCard)
        ) : (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Aucun produit trouvé
          </div>
        )}
      </div>

      {selectedProduitId && (
        <FicheProduitDialog
          produitId={selectedProduitId}
          open={!!selectedProduitId}
          onOpenChange={(open) => !open && setSelectedProduitId(null)}
          onSuccess={onRefetch}
        />
      )}
    </>
  );
};
