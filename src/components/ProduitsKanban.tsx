import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, XCircle } from "lucide-react";
import { useState } from "react";
import { FicheProduitDialog } from "./FicheProduitDialog";

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
}

export const ProduitsKanban = ({ produits, onRefetch }: ProduitsKanbanProps) => {
  const [selectedProduitId, setSelectedProduitId] = useState<string | null>(null);

  // Catégoriser les produits par statut
  const stockOk = produits.filter(p => p.stock_actuel >= p.stock_minimum && p.stock_actuel > 0);
  const alerteStock = produits.filter(p => p.stock_actuel < p.stock_minimum && p.stock_actuel > 0);
  const rupture = produits.filter(p => p.stock_actuel === 0);

  const renderProduitCard = (produit: Produit) => (
    <div
      key={produit.id}
      onClick={() => setSelectedProduitId(produit.id)}
      className="group bg-card border rounded-lg hover:shadow-lg transition-all cursor-pointer overflow-hidden"
    >
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
          {produit.categorie_emballage === 2 && (
            <Badge variant="outline" className="text-xs shrink-0">Prot.</Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t">
          <span className="text-muted-foreground">Stock: <span className="font-semibold text-foreground">{produit.stock_actuel}</span></span>
          {produit.prix_unitaire && (
            <span className="font-medium text-primary">€{produit.prix_unitaire.toFixed(2)}</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Colonne Stock OK */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-green-500" />
              Stock OK
              <Badge variant="secondary" className="ml-auto">
                {stockOk.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {stockOk.length > 0 ? (
              stockOk.map(renderProduitCard)
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucun produit
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colonne Alerte Stock */}
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Alerte Stock
              <Badge variant="secondary" className="ml-auto">
                {alerteStock.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {alerteStock.length > 0 ? (
              alerteStock.map(renderProduitCard)
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucun produit
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colonne Rupture */}
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4 text-red-500" />
              Rupture
              <Badge variant="secondary" className="ml-auto">
                {rupture.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {rupture.length > 0 ? (
              rupture.map(renderProduitCard)
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Aucun produit
              </div>
            )}
          </CardContent>
        </Card>
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
