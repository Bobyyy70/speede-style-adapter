import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ValidationDecisionDialogProps {
  open: boolean;
  validation: {
    id: string;
    raison_blocage: string;
    date_demande: string;
    commande: {
      numero_commande: string;
      valeur_totale: number;
      client: {
        nom_entreprise: string;
      };
    };
  };
  decision: 'approuve' | 'refuse';
  onConfirm: (commentaire: string) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

export function ValidationDecisionDialog({
  open,
  validation,
  decision,
  onConfirm,
  onClose,
  isLoading
}: ValidationDecisionDialogProps) {
  const [commentaire, setCommentaire] = useState("");

  const handleConfirm = async () => {
    if (decision === 'refuse' && !commentaire.trim()) {
      return;
    }
    await onConfirm(commentaire);
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {decision === 'approuve' ? (
              <>
                <Info className="h-5 w-5 text-blue-500" />
                Approuver la commande ?
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Refuser la commande ?
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {decision === 'approuve' 
              ? "La commande sera approuvée et pourra être traitée normalement."
              : "La commande sera refusée et automatiquement annulée."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Résumé de la commande */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">
                Commande {validation.commande.numero_commande}
              </p>
              <Badge variant="outline">{validation.commande.valeur_totale} €</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Client: {validation.commande.client.nom_entreprise}
            </p>
            <p className="text-xs text-muted-foreground">
              Demande créée le {format(new Date(validation.date_demande), 'PPpp', { locale: fr })}
            </p>
          </div>

          {/* Raison de la validation */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Raison de la validation</AlertTitle>
            <AlertDescription>{validation.raison_blocage}</AlertDescription>
          </Alert>

          {/* Avertissement pour refus */}
          {decision === 'refuse' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Attention</AlertTitle>
              <AlertDescription>
                Le refus entraînera l'annulation définitive de la commande.
                Cette action ne peut pas être annulée.
              </AlertDescription>
            </Alert>
          )}

          {/* Commentaire */}
          <div className="space-y-2">
            <Label htmlFor="commentaire">
              Commentaire {decision === 'refuse' ? '(obligatoire) *' : '(optionnel)'}
            </Label>
            <Textarea
              id="commentaire"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder={
                decision === 'approuve'
                  ? "Expliquez pourquoi vous approuvez cette commande..."
                  : "Expliquez pourquoi vous refusez cette commande..."
              }
              rows={4}
              required={decision === 'refuse'}
            />
            {decision === 'refuse' && !commentaire.trim() && (
              <p className="text-sm text-destructive">
                Un commentaire est obligatoire pour refuser une validation
              </p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || (decision === 'refuse' && !commentaire.trim())}
            className={decision === 'refuse' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {isLoading ? 'Traitement...' : decision === 'approuve' ? 'Confirmer l\'approbation' : 'Confirmer le refus'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}