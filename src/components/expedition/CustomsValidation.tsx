import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface CustomsValidationProps {
  commande: any;
  isHorsUE: boolean;
}

interface ValidationItem {
  label: string;
  valid: boolean;
  value?: any;
}

export const CustomsValidation = ({ commande, isHorsUE }: CustomsValidationProps) => {
  if (!isHorsUE) return null;

  const validations: ValidationItem[] = [
    {
      label: "Adresse complète",
      valid: !!(commande.adresse_nom && commande.adresse_ligne_1 && commande.code_postal && commande.ville && commande.pays_code),
      value: commande.adresse_nom
    },
    {
      label: "Valeur totale déclarée",
      valid: !!(commande.valeur_totale && commande.valeur_totale > 0),
      value: commande.valeur_totale ? `${commande.valeur_totale.toFixed(2)} EUR` : null
    },
    {
      label: "Poids total",
      valid: !!(commande.poids_total && commande.poids_total > 0),
      value: commande.poids_total ? `${commande.poids_total} kg` : null
    },
    {
      label: "Lignes avec poids unitaire",
      valid: commande.lignes?.every((l: any) => l.poids_unitaire && l.poids_unitaire > 0),
      value: commande.lignes ? `${commande.lignes.filter((l: any) => l.poids_unitaire > 0).length}/${commande.lignes.length}` : "0/0"
    },
    {
      label: "Lignes avec prix unitaire",
      valid: commande.lignes?.every((l: any) => l.prix_unitaire && l.prix_unitaire > 0),
      value: commande.lignes ? `${commande.lignes.filter((l: any) => l.prix_unitaire > 0).length}/${commande.lignes.length}` : "0/0"
    },
  ];

  const allValid = validations.every(v => v.valid);
  const invalidCount = validations.filter(v => !v.valid).length;

  return (
    <Alert variant={allValid ? "default" : "destructive"} className="mb-4">
      <div className="flex items-start gap-3">
        {allValid ? (
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 mt-0.5" />
        )}
        <div className="flex-1">
          <AlertTitle className="flex items-center gap-2 mb-2">
            Validation douanière (Expédition hors UE)
            {allValid ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complète
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {invalidCount} erreur{invalidCount > 1 ? 's' : ''}
              </Badge>
            )}
          </AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              {validations.map((validation, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {validation.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={validation.valid ? "text-muted-foreground" : "font-medium"}>
                      {validation.label}
                    </span>
                  </div>
                  {validation.value && (
                    <span className="text-muted-foreground text-xs">
                      {validation.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {!allValid && (
              <p className="mt-3 text-sm font-medium">
                ⚠️ Complétez les informations manquantes avant de générer les documents douaniers (CN23).
              </p>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
};
