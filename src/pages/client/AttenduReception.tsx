import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, TruckIcon, CheckCircle, AlertCircle, Plus, Eye, Home } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getClientId } from "@/lib/clientHelpers";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [attendus, setAttendus] = useState<AttenduReception[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAttendu, setSelectedAttendu] = useState<string | null>(null);

  // Formulaire nouveau attendu
  const [formData, setFormData] = useState({
    fournisseur: "",
    date_reception_prevue: "",
    transporteur: "",
    nombre_palettes: 0,
    nombre_colis: 0,
    remarques: "",
    instructions_speciales: "",
  });

  useEffect(() => {
    if (user) {
      fetchAttendus();
    }
  }, [user, searchParams]);

  const fetchAttendus = async () => {
    try {
      setLoading(true);
      setClientError(false);
      
      const { clientId } = await getClientId(user, searchParams, null);

      const { data, error } = await supabase
        .from("attendu_reception")
        .select("*")
        .eq("client_id", clientId)
        .order("date_creation", { ascending: false });

      if (error) throw error;
      setAttendus(data || []);
    } catch (error: any) {
      if (error.message.includes("Aucun client")) {
        setClientError(true);
      } else {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAttendu = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { clientId } = await getClientId(user, searchParams, null);

      const { error } = await supabase.from("attendu_reception").insert([{
        numero_attendu: null as any,
        client_id: clientId,
        ...formData,
        created_by: user?.id,
      }]);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Attendu de réception créé",
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

  if (clientError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">
            Aucun client sélectionné. Veuillez utiliser le menu "Vue Client" pour en choisir un.
          </p>
          <Button onClick={() => navigate("/")}>
            <Home className="mr-2 h-4 w-4" />
            Retour au tableau de bord
          </Button>
        </div>
      </DashboardLayout>
    );
  }

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
                <DialogContent className="max-w-2xl">
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
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit">Créer l'Attendu</Button>
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
                Aucun attendu de réception pour le moment
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendus.map((attendu) => (
                    <TableRow key={attendu.id}>
                      <TableCell className="font-medium">{attendu.numero_attendu}</TableCell>
                      <TableCell>{attendu.fournisseur}</TableCell>
                      <TableCell>
                        {attendu.date_reception_prevue
                          ? format(new Date(attendu.date_reception_prevue), "dd/MM/yyyy", { locale: fr })
                          : "-"}
                      </TableCell>
                      <TableCell>{attendu.nombre_colis}</TableCell>
                      <TableCell>{getStatutBadge(attendu.statut)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAttendu(attendu.id);
                            setDetailDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
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
    </DashboardLayout>
  );
};

export default AttenduReception;
