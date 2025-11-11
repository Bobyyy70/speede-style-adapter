import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';

interface Transition {
  id: string;
  entity_type: 'commande' | 'retour' | 'attendu';
  entity_numero: string;
  statut_precedent: string;
  statut_nouveau: string;
  date_transition: string;
  utilisateur?: {
    nom_complet: string;
  };
}

interface RollbackDialogProps {
  open: boolean;
  transition: Transition | null;
  onConfirm: (transitionId: string, raison: string) => Promise<void>;
  onClose: () => void;
}

export const RollbackDialog = ({ 
  open, 
  transition, 
  onConfirm, 
  onClose 
}: RollbackDialogProps) => {
  const [raison, setRaison] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!transition || !raison.trim() || raison.trim().length < 10) {
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(transition.id, raison);
      setRaison('');
      onClose();
    } catch (error) {
      console.error('Erreur rollback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setRaison('');
    onClose();
  };

  if (!transition) return null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'commande': return 'Commande';
      case 'retour': return 'Retour';
      case 'attendu': return 'Attendu';
      default: return type;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Annuler cette transition ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Vous êtes sur le point d'annuler la transition suivante :
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Résumé de la transition */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{transition.statut_precedent}</Badge>
              <ArrowRight className="h-4 w-4" />
              <Badge>{transition.statut_nouveau}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {getTypeLabel(transition.entity_type)} {transition.entity_numero}
            </p>
            <p className="text-xs text-muted-foreground">
              Par {transition.utilisateur?.nom_complet || 'Système'} le{' '}
              {format(new Date(transition.date_transition), 'PPpp', { locale: fr })}
            </p>
          </div>

          {/* Avertissement */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Attention</AlertTitle>
            <AlertDescription>
              Cette action va restaurer le statut <strong>{transition.statut_precedent}</strong>.
              Un enregistrement de cette annulation sera conservé dans l'historique.
            </AlertDescription>
          </Alert>

          {/* Raison obligatoire */}
          <div>
            <Label htmlFor="raison">
              Raison de l'annulation <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="raison"
              placeholder="Expliquez pourquoi vous annulez cette transition (minimum 10 caractères)..."
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              rows={3}
              required
              className="mt-2"
            />
            {raison.trim().length > 0 && raison.trim().length < 10 && (
              <p className="text-xs text-destructive mt-1">
                La raison doit contenir au moins 10 caractères ({raison.trim().length}/10)
              </p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!raison.trim() || raison.trim().length < 10 || isLoading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
