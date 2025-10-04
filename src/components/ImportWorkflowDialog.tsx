import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ImportWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportWorkflowDialog({ open, onOpenChange }: ImportWorkflowDialogProps) {
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [configJson, setConfigJson] = useState("");
  const [categorie, setCategorie] = useState("");
  const [declencheurAuto, setDeclencheurAuto] = useState("");
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async () => {
      let parsedConfig, parsedDeclencheur;
      
      try {
        parsedConfig = JSON.parse(configJson);
      } catch (e) {
        throw new Error("Config JSON invalide");
      }

      if (declencheurAuto) {
        try {
          parsedDeclencheur = JSON.parse(declencheurAuto);
        } catch (e) {
          throw new Error("Déclencheur JSON invalide");
        }
      }

      const { data, error } = await supabase
        .from('n8n_workflows')
        .insert({
          nom,
          description,
          webhook_url: webhookUrl,
          config_json: parsedConfig,
          categorie,
          declencheur_auto: parsedDeclencheur,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] });
      toast.success('Workflow importé avec succès');
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Erreur d'import: ${error.message}`);
    },
  });

  const resetForm = () => {
    setNom("");
    setDescription("");
    setWebhookUrl("");
    setConfigJson("");
    setCategorie("");
    setDeclencheurAuto("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !webhookUrl || !configJson) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    importMutation.mutate();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          setConfigJson(JSON.stringify(json, null, 2));
          
          // Auto-remplir le nom si présent dans le workflow
          if (json.name && !nom) {
            setNom(json.name);
          }
        } catch (e) {
          toast.error("Fichier JSON invalide");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer un workflow n8n</DialogTitle>
          <DialogDescription>
            Importez un workflow depuis un export JSON n8n ou saisissez les informations manuellement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Import fichier JSON (optionnel)</Label>
            <Input
              id="file"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nom">Nom du workflow *</Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Alerte Stock Bas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Envoie un email quand le stock passe sous le minimum"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook">URL Webhook n8n *</Label>
            <Input
              id="webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://votre-n8n.com/webhook/stock-bas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categorie">Catégorie</Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alertes">Alertes</SelectItem>
                <SelectItem value="expedition">Expédition</SelectItem>
                <SelectItem value="crm">CRM</SelectItem>
                <SelectItem value="integration">Intégration</SelectItem>
                <SelectItem value="automatisation">Automatisation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="config">Configuration JSON *</Label>
            <Textarea
              id="config"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              placeholder='{"nodes": [...], "connections": {...}}'
              rows={8}
              className="font-mono text-xs"
              required
            />
            <p className="text-xs text-muted-foreground">
              Collez l'export JSON complet de votre workflow n8n
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="declencheur">Déclencheur automatique (JSON optionnel)</Label>
            <Textarea
              id="declencheur"
              value={declencheurAuto}
              onChange={(e) => setDeclencheurAuto(e.target.value)}
              placeholder='{"conditions": [{"table": "produit", "field": "stock_actuel", "operator": "<", "value": "stock_minimum"}]}'
              rows={4}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Définissez les conditions de déclenchement automatique (optionnel)
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={importMutation.isPending}>
              {importMutation.isPending ? "Import en cours..." : "Importer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}