import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { ValidationDecisionDialog } from "./ValidationDecisionDialog";
import { useAuth } from "@/hooks/useAuth";

interface ValidationEnAttente {
  id: string;
  numero_commande: string;
  nom_client: string;
  valeur_totale: number;
  validation_message: string;
  date_creation: string;
  validation_logs?: Array<{
    id: string;
    regle: {
      nom_regle: string;
      message_utilisateur: string;
    };
  }>;
}

interface ValidationsEnAttenteTableProps {
  onApprove?: () => void;
  onReject?: () => void;
  onViewDetails?: (commandeId: string) => void;
}

export function ValidationsEnAttenteTable({ 
  onApprove, 
  onReject,
  onViewDetails 
}: ValidationsEnAttenteTableProps) {
  const { user } = useAuth();
  const [selectedValidation, setSelectedValidation] = useState<any>(null);
  const [decision, setDecision] = useState<'approuve' | 'refuse'>('approuve');
  const [isSaving, setIsSaving] = useState(false);

  const { data: validations, isLoading, refetch } = useQuery({
    queryKey: ['validations-en-attente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commande')
        .select(`
          id,
          numero_commande,
          nom_client,
          valeur_totale,
          validation_message,
          date_creation
        `)
        .eq('statut_wms', 'en_attente_validation' as any)
        .eq('validation_requise', true)
        .order('date_creation', { ascending: false });

      if (error) throw error;
      return data as ValidationEnAttente[];
    },
    refetchInterval: 30000,
  });

  const handleValidationClick = async (validation: ValidationEnAttente, dec: 'approuve' | 'refuse') => {
    // Récupérer le log de validation associé
    const { data: logs } = await supabase
      .from('commande_validation_log')
      .select('id, regle:regle_validation_commande(nom_regle, message_utilisateur)')
      .eq('commande_id', validation.id)
      .eq('statut_validation', 'en_attente')
      .order('date_demande', { ascending: false })
      .limit(1);

    if (logs && logs.length > 0) {
      setSelectedValidation({
        ...validation,
        validation_log_id: logs[0].id,
        regle: logs[0].regle
      });
      setDecision(dec);
    } else {
      toast.error("Aucun log de validation trouvé pour cette commande");
    }
  };

  const handleConfirm = async (commentaire: string) => {
    if (!selectedValidation?.validation_log_id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke('approve-commande', {
        body: {
          validationLogId: selectedValidation.validation_log_id,
          decision,
          commentaire
        }
      });

      if (error) throw error;

      toast.success(decision === 'approuve' ? 'Commande approuvée' : 'Commande refusée');
      setSelectedValidation(null);
      refetch();
      if (decision === 'approuve' && onApprove) onApprove();
      if (decision === 'refuse' && onReject) onReject();
    } catch (error: any) {
      console.error('Erreur lors de la validation:', error);
      toast.error("Erreur: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;
  }

  if (!validations || validations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucune commande en attente de validation
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° Commande</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Valeur</TableHead>
            <TableHead>Raison du blocage</TableHead>
            <TableHead>Date demande</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {validations.map((validation) => (
            <TableRow key={validation.id}>
              <TableCell className="font-medium">{validation.numero_commande}</TableCell>
              <TableCell>{validation.nom_client}</TableCell>
              <TableCell>{validation.valeur_totale.toFixed(2)} €</TableCell>
              <TableCell>
                <Badge variant="outline" className="border-amber-500 text-amber-700">
                  {validation.validation_message || 'Validation requise'}
                </Badge>
              </TableCell>
              <TableCell>{new Date(validation.date_creation).toLocaleDateString('fr-FR')}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    size="sm" 
                    variant="default" 
                    onClick={() => handleValidationClick(validation, 'approuve')}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Approuver
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => handleValidationClick(validation, 'refuse')}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Refuser
                  </Button>
                  {onViewDetails && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onViewDetails(validation.id)}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      Détails
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedValidation && (
        <ValidationDecisionDialog
          open={!!selectedValidation}
          onClose={() => setSelectedValidation(null)}
          validation={selectedValidation}
          decision={decision}
          onConfirm={handleConfirm}
          isLoading={isSaving}
        />
      )}
    </>
  );
}
