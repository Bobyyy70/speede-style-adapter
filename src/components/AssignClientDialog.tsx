import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

interface Client {
  id: string;
  nom_entreprise: string;
}

interface AssignClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  currentClientId: string | null;
  onSuccess: () => void;
}

export function AssignClientDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  currentClientId,
  onSuccess
}: AssignClientDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(currentClientId || "");
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open]);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('client' as any)
        .select('id, nom_entreprise')
        .eq('actif', true)
        .order('nom_entreprise');

      if (error) throw error;
      setClients((data as any) || []);
    } catch (error: any) {
      console.error('Erreur lors du chargement des clients:', error);
      toast.error("Erreur lors du chargement des clients");
    } finally {
      setLoadingClients(false);
    }
  };

  const handleSave = async () => {
    if (!selectedClientId) {
      toast.error("Veuillez sélectionner un client");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ client_id: selectedClientId } as any)
        .eq('id', userId);

      if (error) throw error;

      toast.success(`Client assigné à ${userEmail}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur lors de l\'assignation du client:', error);
      toast.error(error.message || "Erreur lors de l'assignation du client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Assigner à une entreprise
          </DialogTitle>
          <DialogDescription>
            Lier l'utilisateur <strong>{userEmail}</strong> à une entreprise cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client">Entreprise cliente</Label>
            {loadingClients ? (
              <div className="text-sm text-muted-foreground">Chargement...</div>
            ) : (
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Sélectionner une entreprise" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nom_entreprise}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {clients.length === 0 && !loadingClients && (
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Aucun client trouvé. Créez d'abord une entreprise cliente dans la page "Gestion Clients".
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading || !selectedClientId}>
            {loading ? "Enregistrement..." : "Assigner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
