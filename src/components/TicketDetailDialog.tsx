import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertCircle, Check, Clock, User, Package, Calendar } from "lucide-react";

interface TicketDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
}

export function TicketDetailDialog({ open, onOpenChange, ticketId }: TicketDetailDialogProps) {
  const [remarques, setRemarques] = useState("");
  const queryClient = useQueryClient();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      const { data, error } = await supabase
        .from('ticket_service_client' as any)
        .select(`
          *,
          commande:commande_id(numero_commande),
          retour:retour_id(numero_retour),
          client:client_id(nom_client),
          assigne:assigne_a(nom_complet),
          createur:created_by(nom_complet)
        `)
        .eq('id', ticketId)
        .single();
      
      if (error) throw error;
      return data as any;
    },
    enabled: !!ticketId && open,
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ statut, priorite }: { statut?: string; priorite?: string }) => {
      if (!ticketId) return;
      const updates: any = { date_modification: new Date().toISOString() };
      if (statut) updates.statut = statut;
      if (priorite) updates.priorite = priorite;
      if (remarques) updates.remarques = ticket?.remarques ? `${ticket.remarques}\n---\n${remarques}` : remarques;
      
      const { error } = await supabase
        .from('ticket_service_client' as any)
        .update(updates)
        .eq('id', ticketId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success("Ticket mis à jour");
      setRemarques("");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, any> = {
      ouvert: { variant: "destructive", icon: AlertCircle },
      en_cours: { variant: "default", icon: Clock },
      resolu: { variant: "secondary", icon: Check },
      ferme: { variant: "outline", icon: Check },
      escalade: { variant: "destructive", icon: AlertCircle },
    };
    const config = variants[statut] || variants.ouvert;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {statut.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPrioriteBadge = (priorite: string) => {
    const variants: Record<string, any> = {
      basse: "outline",
      normale: "secondary",
      haute: "default",
      critique: "destructive",
    };
    return <Badge variant={variants[priorite] || "secondary"}>{priorite.toUpperCase()}</Badge>;
  };

  if (!ticket || isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{ticket.numero_ticket}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{ticket.type_probleme}</p>
            </div>
            <div className="flex gap-2">
              {getStatutBadge(ticket.statut)}
              {getPrioriteBadge(ticket.priorite)}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations générales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Client</span>
              </div>
              <p className="font-medium">{ticket.client?.nom_client}</p>
            </div>
            
            {ticket.commande && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>Commande liée</span>
                </div>
                <p className="font-medium">{ticket.commande.numero_commande}</p>
              </div>
            )}
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Créé le</span>
              </div>
              <p className="font-medium">
                {format(new Date(ticket.date_creation), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
            </div>

            {ticket.assigne && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Assigné à</span>
                </div>
                <p className="font-medium">{ticket.assigne.nom_complet}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-2">
            <h3 className="font-semibold">Description du problème</h3>
            <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">{ticket.description}</p>
          </div>

          {/* Historique remarques */}
          {ticket.remarques && (
            <div className="space-y-2">
              <h3 className="font-semibold">Historique</h3>
              <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded max-h-40 overflow-y-auto">
                {ticket.remarques}
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="space-y-4">
            <h3 className="font-semibold">Actions</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Changer le statut</label>
                <Select
                  defaultValue={ticket.statut}
                  onValueChange={(statut) => updateTicketMutation.mutate({ statut })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ouvert">Ouvert</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="resolu">Résolu</SelectItem>
                    <SelectItem value="ferme">Fermé</SelectItem>
                    <SelectItem value="escalade">Escaladé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Changer la priorité</label>
                <Select
                  defaultValue={ticket.priorite}
                  onValueChange={(priorite) => updateTicketMutation.mutate({ priorite })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basse">Basse</SelectItem>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="haute">Haute</SelectItem>
                    <SelectItem value="critique">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ajouter une remarque</label>
              <Textarea
                value={remarques}
                onChange={(e) => setRemarques(e.target.value)}
                placeholder="Commentaire ou action effectuée..."
                rows={4}
              />
              <Button
                onClick={() => updateTicketMutation.mutate({})}
                disabled={!remarques || updateTicketMutation.isPending}
                className="w-full"
              >
                Enregistrer la remarque
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
