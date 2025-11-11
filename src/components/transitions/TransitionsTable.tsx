import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { AlertCircle, ArrowRight, Eye, Undo } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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

interface TransitionsTableProps {
  transitions: Transition[];
  loading: boolean;
  onRowClick: (transition: Transition) => void;
  onRollback: (transition: Transition) => void;
}

export const TransitionsTable = ({ 
  transitions, 
  loading, 
  onRowClick, 
  onRollback 
}: TransitionsTableProps) => {
  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'commande': return 'default';
      case 'retour': return 'secondary';
      case 'attendu': return 'outline';
      default: return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'commande': return 'Commande';
      case 'retour': return 'Retour';
      case 'attendu': return 'Attendu';
      default: return type;
    }
  };

  const detectAnomaly = (transition: Transition) => {
    if (transition.metadata?.is_rolled_back) return true;
    if (transition.metadata?.is_rollback) return true;
    return false;
  };

  const getAnomalyMessage = (transition: Transition) => {
    if (transition.metadata?.is_rolled_back) {
      return 'Cette transition a été annulée';
    }
    if (transition.metadata?.is_rollback) {
      return 'Ceci est une annulation de transition';
    }
    return 'Anomalie détectée';
  };

  const canRollback = (transition: Transition) => {
    if (!isAdmin) return false;
    if (transition.metadata?.is_rolled_back) return false;
    if (transition.metadata?.is_rollback) return false;
    if (['livre', 'annule', 'cloture', 'archive'].includes(transition.statut_nouveau)) {
      return false;
    }
    return true;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (transitions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucune transition trouvée
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Numéro</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Transition</TableHead>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Anomalie</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transitions.map((transition) => (
            <TableRow 
              key={transition.id}
              onClick={() => onRowClick(transition)}
              className="cursor-pointer hover:bg-muted/50"
            >
              <TableCell>
                <Badge variant={getTypeVariant(transition.entity_type)}>
                  {getTypeLabel(transition.entity_type)}
                </Badge>
              </TableCell>
              
              <TableCell className="font-mono text-sm">
                {transition.entity_numero}
              </TableCell>

              <TableCell>{transition.client_nom || '-'}</TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {transition.statut_precedent}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge className="text-xs">
                    {transition.statut_nouveau}
                  </Badge>
                </div>
              </TableCell>

              <TableCell className="text-sm">
                {transition.utilisateur?.nom_complet || 'Système'}
              </TableCell>

              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(transition.date_transition), { 
                        addSuffix: true,
                        locale: fr 
                      })}
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(transition.date_transition), 'PPpp', { locale: fr })}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>

              <TableCell>
                {detectAnomaly(transition) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        {getAnomalyMessage(transition)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </TableCell>

              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRowClick(transition);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canRollback(transition) && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRollback(transition);
                      }}
                    >
                      <Undo className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
