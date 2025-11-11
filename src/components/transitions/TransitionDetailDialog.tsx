import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight } from 'lucide-react';

interface Transition {
  id: string;
  entity_type: 'commande' | 'retour' | 'attendu';
  entity_numero: string;
  statut_precedent: string;
  statut_nouveau: string;
  date_transition: string;
  raison?: string;
  metadata?: any;
  utilisateur?: {
    nom_complet: string;
    email: string;
  };
  client_nom?: string;
}

interface TransitionDetailDialogProps {
  open: boolean;
  transition: Transition | null;
  onClose: () => void;
}

export const TransitionDetailDialog = ({
  open,
  transition,
  onClose
}: TransitionDetailDialogProps) => {
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Détails de la transition</DialogTitle>
          <DialogDescription>
            {getTypeLabel(transition.entity_type)} {transition.entity_numero}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transition */}
          <div>
            <p className="text-sm font-medium mb-2">Transition</p>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Badge variant="outline" className="text-sm">
                {transition.statut_precedent}
              </Badge>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <Badge className="text-sm">
                {transition.statut_nouveau}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Informations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date</p>
              <p className="text-sm mt-1">
                {format(new Date(transition.date_transition), 'PPpp', { locale: fr })}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Utilisateur</p>
              <p className="text-sm mt-1">
                {transition.utilisateur?.nom_complet || 'Système'}
              </p>
              {transition.utilisateur?.email && (
                <p className="text-xs text-muted-foreground">
                  {transition.utilisateur.email}
                </p>
              )}
            </div>

            {transition.client_nom && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Client</p>
                <p className="text-sm mt-1">{transition.client_nom}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p className="text-sm mt-1">
                <Badge variant="outline">
                  {getTypeLabel(transition.entity_type)}
                </Badge>
              </p>
            </div>
          </div>

          {/* Raison */}
          {transition.raison && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Raison</p>
                <p className="text-sm bg-muted p-3 rounded-lg">
                  {transition.raison}
                </p>
              </div>
            </>
          )}

          {/* Métadonnées */}
          {transition.metadata && Object.keys(transition.metadata).length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Métadonnées</p>
                <div className="bg-muted p-3 rounded-lg">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(transition.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
