import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, XCircle, Eye, Clock } from "lucide-react";
import { ValidationDecisionDialog } from "@/components/ValidationDecisionDialog";
import { useNavigate } from "react-router-dom";

interface ValidationEnAttente {
  id: string;
  commande_id: string;
  regle_id: string;
  raison_blocage: string;
  date_demande: string;
  commande: {
    numero_commande: string;
    valeur_totale: number;
    pays_code: string;
    date_creation: string;
    client_id: string;
    client: {
      nom_entreprise: string;
    };
  };
  regle: {
    nom_regle: string;
  };
}

export default function ValidationsEnAttente() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedValidation, setSelectedValidation] = useState<ValidationEnAttente | null>(null);
  const [decision, setDecision] = useState<'approuve' | 'refuse' | null>(null);

  const { data: validations, isLoading } = useQuery({
    queryKey: ['commande_validation_log', 'en_attente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commande_validation_log')
        .select(`
          *,
          commande:commande_id(
            numero_commande,
            valeur_totale,
            pays_code,
            date_creation,
            client_id,
            client:client_id(nom_entreprise)
          ),
          regle:regle_id(nom_regle)
        `)
        .eq('statut_validation', 'en_attente')
        .order('date_demande', { ascending: false });

      if (error) throw error;
      return data as ValidationEnAttente[];
    },
    refetchInterval: 30000 // Rafraîchir toutes les 30 secondes
  });

  const approveMutation = useMutation({
    mutationFn: async ({ validationLogId, decision, commentaire }: {
      validationLogId: string;
      decision: 'approuve' | 'refuse';
      commentaire: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('approve-commande', {
        body: { validationLogId, decision, commentaire }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['commande_validation_log'] });
      queryClient.invalidateQueries({ queryKey: ['commande'] });
      toast.success(data.message);
      setSelectedValidation(null);
      setDecision(null);
    },
    onError: (error: any) => {
      toast.error("Erreur lors de la validation", {
        description: error.message
      });
    }
  });

  const openValidationDialog = (validation: ValidationEnAttente, dec: 'approuve' | 'refuse') => {
    setSelectedValidation(validation);
    setDecision(dec);
  };

  const handleConfirm = async (commentaire: string) => {
    if (!selectedValidation || !decision) return;

    await approveMutation.mutateAsync({
      validationLogId: selectedValidation.id,
      decision,
      commentaire
    });
  };

  const viewCommandeDetails = (commandeId: string) => {
    navigate(`/commandes?id=${commandeId}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Validations en Attente</h1>
            <p className="text-muted-foreground mt-1">
              Commandes nécessitant votre approbation
            </p>
          </div>
          {validations && validations.length > 0 && (
            <Badge variant="destructive" className="text-lg px-4 py-2">
              {validations.length} en attente
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-4">Chargement des validations...</p>
          </div>
        ) : !validations || validations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Aucune validation en attente</p>
              <p className="text-muted-foreground mt-2">
                Toutes les commandes sont validées ou en cours de traitement normal
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {validations.map((validation) => (
              <Card key={validation.id} className="border-l-4 border-l-amber-500">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        Commande {validation.commande.numero_commande}
                      </CardTitle>
                      <CardDescription>
                        Client: {validation.commande.client.nom_entreprise}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 border-amber-500/20">
                      <Clock className="h-3 w-3" />
                      En attente depuis {formatDistanceToNow(new Date(validation.date_demande), { locale: fr })}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Alert className="border-amber-500/50 bg-amber-500/5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-900">Validation requise : {validation.regle?.nom_regle}</AlertTitle>
                    <AlertDescription className="text-amber-800">{validation.raison_blocage}</AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <Label className="text-xs text-muted-foreground">Valeur totale</Label>
                      <p className="font-bold text-lg">{validation.commande.valeur_totale} €</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Pays</Label>
                      <p className="font-medium">{validation.commande.pays_code}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Date création</Label>
                      <p className="font-medium text-sm">
                        {formatDistanceToNow(new Date(validation.commande.date_creation), { 
                          locale: fr, 
                          addSuffix: true 
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={() => openValidationDialog(validation, 'approuve')}
                      className="flex-1"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approuver
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => openValidationDialog(validation, 'refuse')}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Refuser
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => viewCommandeDetails(validation.commande_id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Détails
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedValidation && decision && (
          <ValidationDecisionDialog
            open={true}
            validation={selectedValidation}
            decision={decision}
            onConfirm={handleConfirm}
            onClose={() => {
              setSelectedValidation(null);
              setDecision(null);
            }}
            isLoading={approveMutation.isPending}
          />
        )}
      </div>
    </DashboardLayout>
  );
}