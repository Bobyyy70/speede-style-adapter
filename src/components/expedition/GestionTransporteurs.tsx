import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Settings, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConditionBuilder } from "./ConditionBuilder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    diviseur: "5000"
  });
  const [conditions, setConditions] = useState<any[]>([]);

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

    if (conditions.some(c => !c.field || !c.value)) {
      toast.error("Toutes les conditions doivent être complètes");
      return;
    }

    try {
      const config_poids_volumetrique = {
        diviseur: parseInt(newRegle.diviseur),
        applique: true
      };

      const { error } = await supabase.from("regle_transport_automatique").insert({
        nom_regle: newRegle.nom_regle,
        transporteur: newRegle.transporteur,
        priorite: parseInt(newRegle.priorite),
        conditions: conditions,
        config_poids_volumetrique: config_poids_volumetrique,
        actif: true
      });

      if (error) throw error;

      toast.success("Règle de transport ajoutée");
      setNewRegle({ nom_regle: "", transporteur: "", priorite: "1", diviseur: "5000" });
      setConditions([]);
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
                    <Select value={newRegle.transporteur} onValueChange={(val) => setNewRegle({ ...newRegle, transporteur: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un transporteur" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DPD">DPD</SelectItem>
                        <SelectItem value="Colissimo">Colissimo</SelectItem>
                        <SelectItem value="UPS">UPS</SelectItem>
                        <SelectItem value="GLS">GLS</SelectItem>
                        <SelectItem value="Geodis">Geodis</SelectItem>
                        <SelectItem value="Chronopost">Chronopost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Priorité (1 = la plus haute)</Label>
                      <Input
                        type="number"
                        value={newRegle.priorite}
                        onChange={(e) => setNewRegle({ ...newRegle, priorite: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Diviseur poids volumétrique</Label>
                      <Input
                        type="number"
                        value={newRegle.diviseur}
                        onChange={(e) => setNewRegle({ ...newRegle, diviseur: e.target.value })}
                        placeholder="5000"
                      />
                    </div>
                  </div>

                  <ConditionBuilder
                    conditions={conditions}
                    onChange={setConditions}
                    availableRelations={[
                      {
                        value: "commande",
                        label: "Commande",
                        fields: [
                          { value: "pays_code", label: "Pays", type: "text" },
                          { value: "zone_livraison", label: "Zone", type: "text" },
                          { value: "poids_total", label: "Poids total (kg)", type: "number" },
                          { value: "valeur_totale", label: "Valeur (€)", type: "number" },
                          { value: "source", label: "Source commande", type: "text" },
                          { value: "nom_client", label: "Client", type: "text" }
                        ]
                      }
                    ]}
                  />

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
