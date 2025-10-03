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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicOperator: "ET" | "OU";
}

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
  const [heureExecution, setHeureExecution] = useState("");
  const [maxCommandes, setMaxCommandes] = useState<string>("");
  const [cronEnabled, setCronEnabled] = useState(false);
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([
    {
      id: crypto.randomUUID(),
      field: "statut_wms",
      operator: "equals",
      value: "",
      logicOperator: "ET"
    }
  ]);

  const fieldOptions = [
    { value: "statut_wms", label: "Statut WMS" },
    { value: "source", label: "Source" },
    { value: "nom_client", label: "Nom client" },
    { value: "methode_expedition", label: "Méthode expédition" },
    { value: "transporteur", label: "Transporteur" },
    { value: "valeur_totale", label: "Valeur totale" },
    { value: "poids_total", label: "Poids total" }
  ];

  const operatorOptions = [
    { value: "equals", label: "Égal à" },
    { value: "notEquals", label: "Différent de" },
    { value: "contains", label: "Contient" },
    { value: "notContains", label: "Ne contient pas" },
    { value: "greaterThan", label: "Supérieur à" },
    { value: "lessThan", label: "Inférieur à" },
    { value: "greaterOrEqual", label: "Supérieur ou égal" },
    { value: "lessOrEqual", label: "Inférieur ou égal" }
  ];

  const addFilterCondition = () => {
    setFilterConditions([
      ...filterConditions,
      {
        id: crypto.randomUUID(),
        field: "statut_wms",
        operator: "equals",
        value: "",
        logicOperator: "ET"
      }
    ]);
  };

  const removeFilterCondition = (id: string) => {
    setFilterConditions(filterConditions.filter(f => f.id !== id));
  };

  const updateFilterCondition = (id: string, updates: Partial<FilterCondition>) => {
    setFilterConditions(
      filterConditions.map(f => f.id === id ? { ...f, ...updates } : f)
    );
  };

  const handleCreate = async () => {
    if (!sessionName.trim()) {
      toast.error("Veuillez saisir un nom de session");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Construire l'objet filtres avec toutes les données
      const filtresData = {
        commande_ids: selectedCommandeIds,
        conditions: filterConditions.map(({ id, ...rest }) => rest),
        heureExecution: heureExecution || null
      };

      // Créer la session
      const { data: session, error: sessionError } = await supabase
        .from("session_preparation")
        .insert({
          nom_session: sessionName,
          filtres: filtresData,
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
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Créer une session de préparation</DialogTitle>
          <DialogDescription>
            {selectedCommandeIds.length} commande(s) sélectionnée(s)
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="heure-execution">Heure d'exécution</Label>
                <Input
                  id="heure-execution"
                  type="time"
                  value={heureExecution}
                  onChange={(e) => setHeureExecution(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-commandes">
                Nombre maximum de commandes
              </Label>
              <Input
                id="max-commandes"
                type="number"
                min="1"
                value={maxCommandes}
                onChange={(e) => setMaxCommandes(e.target.value)}
                placeholder="Illimité si vide"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Conditions de filtrage</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFilterCondition}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une condition
                </Button>
              </div>

              <div className="space-y-3">
                {filterConditions.map((condition, index) => (
                  <div key={condition.id} className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    {index > 0 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Opérateur logique:</Label>
                        <Select
                          value={condition.logicOperator}
                          onValueChange={(value: "ET" | "OU") =>
                            updateFilterCondition(condition.id, { logicOperator: value })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ET">ET</SelectItem>
                            <SelectItem value="OU">OU</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid grid-cols-[1fr,1fr,1fr,auto] gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm">Champ</Label>
                        <Select
                          value={condition.field}
                          onValueChange={(value) =>
                            updateFilterCondition(condition.id, { field: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Opérateur</Label>
                        <Select
                          value={condition.operator}
                          onValueChange={(value) =>
                            updateFilterCondition(condition.id, { operator: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {operatorOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Valeur</Label>
                        <Input
                          value={condition.value}
                          onChange={(e) =>
                            updateFilterCondition(condition.id, { value: e.target.value })
                          }
                          placeholder="Valeur à comparer"
                        />
                      </div>

                      <div className="flex items-end">
                        {filterConditions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFilterCondition(condition.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
        </ScrollArea>

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
