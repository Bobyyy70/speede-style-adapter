import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCommandeIds: string[];
  onSuccess?: () => void;
}

export function CreateSessionDialog({
  open,
  onOpenChange,
  selectedCommandeIds,
  onSuccess,
}: CreateSessionDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sessionName, setSessionName] = useState(
    `Session du ${new Date().toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })}`
  );
  const [maxCommandes, setMaxCommandes] = useState<string>("");
  const [cronEnabled, setCronEnabled] = useState(false);
  const [cronExpression, setCronExpression] = useState("0 9 * * *");

  const handleCreate = async () => {
    if (!sessionName.trim()) {
      toast.error("Veuillez saisir un nom de session");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Créer la session
      const { data: session, error: sessionError } = await supabase
        .from("session_preparation")
        .insert({
          nom_session: sessionName,
          filtres: { commande_ids: selectedCommandeIds },
          statut: "active",
          ordre_priorite: 0,
          max_commandes: maxCommandes ? parseInt(maxCommandes) : null,
          cron_enabled: cronEnabled,
          cron_expression: cronEnabled ? cronExpression : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Créer les liens session_commande
      const sessionCommandes = selectedCommandeIds.map((commandeId) => ({
        session_id: session.id,
        commande_id: commandeId,
        statut_session: "a_preparer",
      }));

      const { error: commandesError } = await supabase
        .from("session_commande")
        .insert(sessionCommandes);

      if (commandesError) throw commandesError;

      toast.success(`Session "${sessionName}" créée avec succès`);
      onOpenChange(false);
      onSuccess?.();
      navigate("/preparation");
    } catch (error) {
      console.error("Erreur lors de la création de la session:", error);
      toast.error("Erreur lors de la création de la session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Créer une session de préparation</DialogTitle>
          <DialogDescription>
            {selectedCommandeIds.length} commande(s) sélectionnée(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="session-name">Nom de la session</Label>
            <Input
              id="session-name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Session du..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-commandes">
              Nombre max de commandes (optionnel)
            </Label>
            <Input
              id="max-commandes"
              type="number"
              min="1"
              value={maxCommandes}
              onChange={(e) => setMaxCommandes(e.target.value)}
              placeholder="Illimité"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="cron-enabled">Création automatique (Cronjob)</Label>
              <p className="text-sm text-muted-foreground">
                Créer automatiquement cette session de manière récurrente
              </p>
            </div>
            <Switch
              id="cron-enabled"
              checked={cronEnabled}
              onCheckedChange={setCronEnabled}
            />
          </div>

          {cronEnabled && (
            <div className="space-y-2">
              <Label htmlFor="cron-expression">Expression Cron</Label>
              <Input
                id="cron-expression"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 9 * * *"
              />
              <p className="text-xs text-muted-foreground">
                Exemple: "0 9 * * *" = tous les jours à 9h00
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer la session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
