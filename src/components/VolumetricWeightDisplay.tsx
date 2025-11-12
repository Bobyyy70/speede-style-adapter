import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Scale, Calculator, Package, RefreshCw, AlertTriangle } from "lucide-react";

interface VolumetricWeightProps {
  commandeId: string;
  transporteurCode?: string;
}

interface WeightCalculation {
  poids_reel_total: number;
  poids_volumetrique_total: number;
  poids_facturable: number;
  facteur_utilise: number;
  details: Array<{
    reference: string;
    nom: string;
    quantite: number;
    poids_unitaire_kg: number;
    dimensions_cm: {
      longueur: number;
      largeur: number;
      hauteur: number;
    };
    poids_volumetrique_unitaire_kg: number;
  }>;
}

export function VolumetricWeightDisplay({ commandeId, transporteurCode }: VolumetricWeightProps) {
  const [calculation, setCalculation] = useState<WeightCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    loadCalculation();
  }, [commandeId, transporteurCode]);

  const loadCalculation = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('calculer_poids_volumetrique_commande', {
        p_commande_id: commandeId,
        p_transporteur_code: transporteurCode || 'DEFAULT'
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setCalculation(data[0] as WeightCalculation);
      }
    } catch (error: any) {
      console.error('Error loading weight calculation:', error);
      toast.error('Erreur lors du chargement du calcul');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-volumetric-weight', {
        body: {
          commande_id: commandeId,
          transporteur_code: transporteurCode
        }
      });

      if (error) throw error;

      toast.success('Poids recalculé avec succès');
      await loadCalculation();
    } catch (error: any) {
      console.error('Error recalculating weight:', error);
      toast.error('Erreur lors du recalcul');
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement du calcul...
        </CardContent>
      </Card>
    );
  }

  if (!calculation) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Aucune donnée de calcul disponible. Les produits doivent avoir des dimensions et poids renseignés.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isVolumetricHigher = calculation.poids_volumetrique_total > calculation.poids_reel_total;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Calcul du Poids Volumétrique
              </CardTitle>
              <CardDescription>
                Facteur de division: {calculation.facteur_utilise} cm³/kg
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={calculating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
              Recalculer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Résumé des poids */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                Poids Réel
              </div>
              <div className="text-2xl font-bold">
                {calculation.poids_reel_total.toFixed(2)} kg
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calculator className="h-4 w-4" />
                Poids Volumétrique
              </div>
              <div className="text-2xl font-bold">
                {calculation.poids_volumetrique_total.toFixed(2)} kg
              </div>
            </div>

            <div className="bg-primary/10 rounded-lg p-4 border-2 border-primary/20">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Scale className="h-4 w-4" />
                Poids Facturable
              </div>
              <div className="text-2xl font-bold text-primary">
                {calculation.poids_facturable.toFixed(2)} kg
              </div>
              {isVolumetricHigher && (
                <Badge variant="secondary" className="mt-2">
                  Basé sur poids volumétrique
                </Badge>
              )}
            </div>
          </div>

          {/* Alerte si poids volumétrique > poids réel */}
          {isVolumetricHigher && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Le poids volumétrique ({calculation.poids_volumetrique_total.toFixed(2)} kg) est supérieur au poids réel ({calculation.poids_reel_total.toFixed(2)} kg).
                Le transporteur facturera sur la base du poids volumétrique.
              </AlertDescription>
            </Alert>
          )}

          {/* Détails par produit */}
          {calculation.details && calculation.details.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Détail par produit</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Dimensions (L×l×H)</TableHead>
                    <TableHead className="text-right">Poids réel</TableHead>
                    <TableHead className="text-right">Poids vol. unitaire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculation.details.map((detail, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="font-medium">{detail.nom}</div>
                        <div className="text-xs text-muted-foreground">{detail.reference}</div>
                      </TableCell>
                      <TableCell className="text-right">{detail.quantite}</TableCell>
                      <TableCell className="text-right text-xs">
                        {detail.dimensions_cm ? (
                          `${detail.dimensions_cm.longueur}×${detail.dimensions_cm.largeur}×${detail.dimensions_cm.hauteur} cm`
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {detail.poids_unitaire_kg ? (
                          `${(detail.quantite * detail.poids_unitaire_kg).toFixed(2)} kg`
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {detail.poids_volumetrique_unitaire_kg ? (
                          `${(detail.quantite * detail.poids_volumetrique_unitaire_kg).toFixed(2)} kg`
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Formule de calcul */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Formule de calcul du poids volumétrique:</p>
            <code className="text-xs">
              Poids volumétrique (kg) = (Longueur × Largeur × Hauteur en cm) ÷ {calculation.facteur_utilise}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
