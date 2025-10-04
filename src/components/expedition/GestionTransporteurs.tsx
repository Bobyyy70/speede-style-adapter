import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Settings, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface RegleTransport {
  id: string;
  nom_regle: string;
  transporteur: string;
  priorite: number;
  actif: boolean;
  conditions: any;
  config_poids_volumetrique: any;
}

export function GestionTransporteurs() {
  const [regles, setRegles] = useState<RegleTransport[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newRegle, setNewRegle] = useState({
    nom_regle: "",
    transporteur: "",
    priorite: "1",
    conditions: "[]",
    config_poids_volumetrique: "{}"
  });

  useEffect(() => {
    fetchRegles();
  }, []);

  const fetchRegles = async () => {
    try {
      const { data, error } = await supabase
        .from("regle_transport_automatique")
        .select("*")
        .order("priorite", { ascending: true });

      if (error) throw error;
      setRegles(data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des règles");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRegle = async () => {
    if (!newRegle.nom_regle || !newRegle.transporteur) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      let parsedConditions = [];
      let parsedConfig = {};

      try {
        parsedConditions = JSON.parse(newRegle.conditions);
        parsedConfig = JSON.parse(newRegle.config_poids_volumetrique);
      } catch {
        toast.error("Format JSON invalide");
        return;
      }

      const { error } = await supabase.from("regle_transport_automatique").insert({
        nom_regle: newRegle.nom_regle,
        transporteur: newRegle.transporteur,
        priorite: parseInt(newRegle.priorite),
        conditions: parsedConditions,
        config_poids_volumetrique: parsedConfig,
        actif: true
      });

      if (error) throw error;

      toast.success("Règle de transport ajoutée");
      setNewRegle({ nom_regle: "", transporteur: "", priorite: "1", conditions: "[]", config_poids_volumetrique: "{}" });
      setOpen(false);
      fetchRegles();
    } catch (error: any) {
      toast.error("Erreur lors de l'ajout de la règle");
      console.error(error);
    }
  };

  const handleDeleteRegle = async (id: string) => {
    try {
      const { error } = await supabase
        .from("regle_transport_automatique")
        .update({ actif: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Règle désactivée");
      fetchRegles();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Règles de transport automatiques</CardTitle>
              <CardDescription>
                Configurez des règles pour assigner automatiquement les transporteurs selon des conditions (pays, poids, valeur, etc.)
              </CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle règle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Créer une règle de transport</DialogTitle>
                  <DialogDescription>
                    Définissez les conditions et le transporteur à appliquer automatiquement
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nom de la règle</Label>
                    <Input
                      placeholder="Ex: DPD France métropolitaine"
                      value={newRegle.nom_regle}
                      onChange={(e) => setNewRegle({ ...newRegle, nom_regle: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Transporteur</Label>
                    <Input
                      placeholder="Ex: DPD, Colissimo, UPS"
                      value={newRegle.transporteur}
                      onChange={(e) => setNewRegle({ ...newRegle, transporteur: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Priorité (1 = la plus haute)</Label>
                    <Input
                      type="number"
                      value={newRegle.priorite}
                      onChange={(e) => setNewRegle({ ...newRegle, priorite: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Conditions (JSON)</Label>
                    <Textarea
                      placeholder={`[
  {"field": "pays_code", "operator": "equals", "value": "FR"},
  {"field": "poids_total", "operator": "lessThan", "value": 30}
]`}
                      value={newRegle.conditions}
                      onChange={(e) => setNewRegle({ ...newRegle, conditions: e.target.value })}
                      className="font-mono text-sm"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Opérateurs: equals, notEquals, greaterThan, lessThan, contains, in
                    </p>
                  </div>
                  <div>
                    <Label>Config poids volumétrique (JSON)</Label>
                    <Textarea
                      placeholder={`{
  "diviseur": 5000,
  "applique": true,
  "zones_exception": ["RE", "GP"]
}`}
                      value={newRegle.config_poids_volumetrique}
                      onChange={(e) => setNewRegle({ ...newRegle, config_poids_volumetrique: e.target.value })}
                      className="font-mono text-sm"
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleAddRegle} className="w-full">
                    Créer la règle
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : regles.filter((r) => r.actif).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              Aucune règle configurée
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Transporteur</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regles
                  .filter((r) => r.actif)
                  .map((regle) => (
                    <TableRow key={regle.id}>
                      <TableCell className="font-medium">{regle.nom_regle}</TableCell>
                      <TableCell>
                        <Badge>{regle.transporteur}</Badge>
                      </TableCell>
                      <TableCell>{regle.priorite}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {Array.isArray(regle.conditions) 
                            ? regle.conditions.length 
                            : (typeof regle.conditions === 'object' && regle.conditions 
                              ? Object.keys(regle.conditions).length 
                              : 0)} condition(s)
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Actif</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRegle(regle.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
