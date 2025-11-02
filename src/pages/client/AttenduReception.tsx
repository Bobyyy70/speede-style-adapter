import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useStatutTransition } from "@/hooks/useStatutTransition";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AttenduDetailDialog } from "@/components/AttenduDetailDialog";
import { Package, TruckIcon, CheckCircle, AlertCircle, Plus, Eye, X, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AttenduReception {
  id: string;
  numero_attendu: string;
  fournisseur: string;
  date_reception_prevue: string;
  statut: string;
  nombre_colis: number;
  date_creation: string;
}

const AttenduReception = () => {
  const { user, getViewingClientId } = useAuth();
  const { toast } = useToast();
  const { subscribeToStatutChanges } = useStatutTransition();
  const [searchParams] = useSearchParams();
  const [attendus, setAttendus] = useState<AttenduReception[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAttendu, setSelectedAttendu] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fournisseur: "",
    date_reception_prevue: "",
    transporteur: "",
    nombre_palettes: 0,
    nombre_colis: 0,
    remarques: "",
    instructions_speciales: "",
  });

  const [lignesProduits, setLignesProduits] = useState<Array<{
    produit_id: string;
    produit_reference: string;
    produit_nom: string;
    quantite_attendue: number;
  }>>([]);

  const [produits, setProduits] = useState<any[]>([]);
  const [selectedProduitId, setSelectedProduitId] = useState<string>("");
  const [quantiteAttendue, setQuantiteAttendue] = useState<string>("");

  const ajouterLigneProduit = () => {
    if (!selectedProduitId || !quantiteAttendue || parseInt(quantiteAttendue) <= 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un produit et une quantité valide",
        variant: "destructive",
      });
      return;
    }

    const produit = produits.find(p => p.id === selectedProduitId);
    if (!produit) return;

    setLignesProduits([...lignesProduits, {
      produit_id: produit.id,
      produit_reference: produit.reference,
      produit_nom: produit.nom,
      quantite_attendue: parseInt(quantiteAttendue),
    }]);

    setSelectedProduitId("");
    setQuantiteAttendue("");
    toast({
      title: "Succès",
      description: "Produit ajouté à l'attendu",
    });
  };

  const retirerLigneProduit = (index: number) => {
    setLignesProduits(lignesProduits.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (user) {
      fetchAttendus();
    }
  }, [user, searchParams]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeToStatutChanges('attendu', () => {
      console.log('[Realtime] Attendu updated, refreshing list');
      fetchAttendus();
    });

    return () => unsubscribe();
  }, []);

  const fetchAttendus = async () => {
    try {
      setLoading(true);
      
      const asClient = searchParams.get("asClient");
      let clientId = asClient;

      if (!clientId) {
        clientId = getViewingClientId();
      }

      if (!clientId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user?.id)
          .maybeSingle();
        clientId = profile?.client_id;
      }

      if (!clientId) {
        toast({
          title: "Erreur",
          description: "Client non trouvé",
          variant: "destructive",
        });
        return;
      }

      const { data: produitsData } = await supabase
        .from('produit')
        .select('id, reference, nom, stock_actuel')
        .eq('client_id', clientId)
        .eq('statut_actif', true)
        .order('nom');
      
      if (produitsData) {
        setProduits(produitsData);
      }

      const { data, error } = await supabase
        .from("attendu_reception")
        .select("*")
        .eq("client_id", clientId)
        .order("date_creation", { ascending: false });

      if (error) throw error;
      setAttendus(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAttendu = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (lignesProduits.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez ajouter au moins un produit",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const asClient = searchParams.get("asClient");
      let clientId = asClient;

      if (!clientId) {
        clientId = getViewingClientId();
      }

      if (!clientId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user?.id)
          .maybeSingle();
        clientId = profile?.client_id;
      }

      if (!clientId) {
        toast({
          title: "Erreur",
          description: "Client non trouvé",
          variant: "destructive",
        });
        return;
      }

      const { data: newAttendu, error } = await supabase
        .from("attendu_reception")
        .insert([{
          numero_attendu: null as any,
          client_id: clientId,
          ...formData,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (error) throw error;

      if (newAttendu) {
        const { error: lignesError } = await supabase
          .from('ligne_attendu_reception')
          .insert(
            lignesProduits.map(ligne => ({
              attendu_reception_id: newAttendu.id,
              produit_id: ligne.produit_id,
              produit_reference: ligne.produit_reference,
              produit_nom: ligne.produit_nom,
              quantite_attendue: ligne.quantite_attendue,
              statut_ligne: 'attendu' as const,
            }))
          );

        if (lignesError) throw lignesError;
      }

      toast({
        title: "Succès",
        description: `Attendu de réception créé avec ${lignesProduits.length} produit(s)`,
      });

      setCreateDialogOpen(false);
      setFormData({
        fournisseur: "",
        date_reception_prevue: "",
        transporteur: "",
        nombre_palettes: 0,
        nombre_colis: 0,
        remarques: "",
        instructions_speciales: "",
      });
      setLignesProduits([]);
      setSelectedProduitId("");
      setQuantiteAttendue("");
      fetchAttendus();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      prévu: "outline",
      en_transit: "secondary",
      arrivé: "default",
      en_cours_réception: "secondary",
      réceptionné_partiellement: "default",
      réceptionné_totalement: "default",
      anomalie: "destructive",
      annulé: "destructive",
    };
    return <Badge variant={variants[statut] || "default"}>{statut}</Badge>;
  };

  const stats = {
    prevus: attendus.filter(a => a.statut === 'prévu').length,
    en_cours: attendus.filter(a => a.statut === 'en_cours_réception' || a.statut === 'arrivé').length,
    termines: attendus.filter(a => a.statut === 'réceptionné_totalement').length,
    anomalies: attendus.filter(a => a.statut === 'anomalie').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendus de Réception</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos réceptions de marchandises prévues
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prévus</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.prevus}</div>
              <p className="text-xs text-muted-foreground">Attendus non arrivés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En cours</CardTitle>
              <TruckIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.en_cours}</div>
              <p className="text-xs text-muted-foreground">En réception</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terminés</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.termines}</div>
              <p className="text-xs text-muted-foreground">Ce mois</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.anomalies}</div>
              <p className="text-xs text-muted-foreground">À traiter</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mes Attendus de Réception</CardTitle>
                <CardDescription>Liste de vos réceptions planifiées</CardDescription>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nouvel Attendu
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Créer un Attendu de Réception</DialogTitle>
                    <DialogDescription>
                      Prévenez l'arrivée de marchandises de votre fournisseur
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateAttendu} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fournisseur">Fournisseur *</Label>
                        <Input
                          id="fournisseur"
                          value={formData.fournisseur}
                          onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date_reception_prevue">Date Prévue *</Label>
                        <Input
                          id="date_reception_prevue"
                          type="date"
                          value={formData.date_reception_prevue}
                          onChange={(e) => setFormData({ ...formData, date_reception_prevue: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transporteur">Transporteur</Label>
                        <Input
                          id="transporteur"
                          value={formData.transporteur}
                          onChange={(e) => setFormData({ ...formData, transporteur: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nombre_palettes">Nombre de Palettes</Label>
                        <Input
                          id="nombre_palettes"
                          type="number"
                          min="0"
                          value={formData.nombre_palettes}
                          onChange={(e) => setFormData({ ...formData, nombre_palettes: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nombre_colis">Nombre de Colis</Label>
                        <Input
                          id="nombre_colis"
                          type="number"
                          min="0"
                          value={formData.nombre_colis}
                          onChange={(e) => setFormData({ ...formData, nombre_colis: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="remarques">Remarques</Label>
                      <Textarea
                        id="remarques"
                        value={formData.remarques}
                        onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instructions_speciales">Instructions Spéciales</Label>
                      <Textarea
                        id="instructions_speciales"
                        value={formData.instructions_speciales}
                        onChange={(e) => setFormData({ ...formData, instructions_speciales: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Produits attendus *</Label>
                        <Badge variant="secondary">{lignesProduits.length} produit(s)</Badge>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="md:col-span-2">
                          <Label htmlFor="produit">Produit</Label>
                          <Select value={selectedProduitId} onValueChange={setSelectedProduitId}>
                            <SelectTrigger id="produit">
                              <SelectValue placeholder="Sélectionner un produit" />
                            </SelectTrigger>
                            <SelectContent>
                              {produits.map(produit => (
                                <SelectItem key={produit.id} value={produit.id}>
                                  {produit.reference} - {produit.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label htmlFor="quantite">Quantité</Label>
                            <Input
                              id="quantite"
                              type="number"
                              min="1"
                              value={quantiteAttendue}
                              onChange={(e) => setQuantiteAttendue(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button type="button" onClick={ajouterLigneProduit} size="icon">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {lignesProduits.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Référence</TableHead>
                                <TableHead>Produit</TableHead>
                                <TableHead className="text-right">Quantité</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lignesProduits.map((ligne, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-mono text-sm">{ligne.produit_reference}</TableCell>
                                  <TableCell>{ligne.produit_nom}</TableCell>
                                  <TableCell className="text-right">{ligne.quantite_attendue}</TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => retirerLigneProduit(idx)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit">
                        Créer l'attendu
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : attendus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun attendu de réception
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Attendu</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Date Prévue</TableHead>
                    <TableHead>Colis</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendus.map((attendu) => (
                    <TableRow key={attendu.id}>
                      <TableCell className="font-mono">{attendu.numero_attendu}</TableCell>
                      <TableCell>{attendu.fournisseur}</TableCell>
                      <TableCell>
                        {attendu.date_reception_prevue
                          ? format(new Date(attendu.date_reception_prevue), "dd MMM yyyy", { locale: fr })
                          : "-"}
                      </TableCell>
                      <TableCell>{attendu.nombre_colis}</TableCell>
                      <TableCell>{getStatutBadge(attendu.statut)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedAttendu(attendu.id);
                            setDetailDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir
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

      <AttenduDetailDialog
        attenduId={selectedAttendu}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </DashboardLayout>
  );
};

export default AttenduReception;
