import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface Mouvement {
  id: string;
  numero_mouvement: string;
  type_mouvement: string;
  date_mouvement: string;
  quantite: number;
  produit?: {
    reference: string;
    nom: string;
  };
  emplacement_source?: {
    code_emplacement: string;
  };
  emplacement_destination?: {
    code_emplacement: string;
  };
}

export default function MesMouvements() {
  const { user, getViewingClientId } = useAuth();
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [noClientId, setNoClientId] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("tous");

  useEffect(() => {
    fetchMouvements();
  }, [user]);

  const fetchMouvements = async () => {
    try {
      let clientId: string | null = null;
      const viewingClientId = getViewingClientId();
      if (viewingClientId) {
        clientId = viewingClientId;
      } else if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single();
        clientId = profileData?.client_id || null;
      }

      if (!clientId) {
        setNoClientId(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("mouvement_stock")
        .select(`
          *,
          produit:produit_id(reference, nom, client_id),
          emplacement_source:emplacement_source_id!inner(code_emplacement),
          emplacement_destination:emplacement_destination_id!inner(code_emplacement)
        `)
        .eq("produit.client_id", clientId)
        .order("date_mouvement", { ascending: false })
        .limit(500);

      if (error) throw error;

      setMouvements(data as any || []);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des mouvements");
    } finally {
      setLoading(false);
    }
  };

  const filteredMouvements = mouvements.filter((m) => {
    const matchesSearch =
      !searchTerm ||
      m.produit?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.produit?.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.numero_mouvement?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "tous" || m.type_mouvement === typeFilter;

    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      entrée: { variant: "default", label: "Entrée" },
      sortie: { variant: "secondary", label: "Sortie" },
      transfert: { variant: "outline", label: "Transfert" },
      ajustement: { variant: "outline", label: "Ajustement" },
      réservation: { variant: "default", label: "Réservation" }
    };
    const config = variants[type] || { variant: "outline", label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // If no client_id, show error message
  if (noClientId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mes Mouvements de Stock</h1>
            <p className="text-muted-foreground">
              Consultez l'historique des mouvements de vos produits
            </p>
          </div>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                <div className="rounded-full bg-red-100 p-3">
                  <Package className="h-8 w-8 text-red-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-red-900">Compte Non Configuré</h2>
                  <p className="text-red-700 max-w-md">
                    Votre compte n'est pas encore lié à un client. Vous ne pouvez pas accéder à vos mouvements pour le moment.
                  </p>
                  <p className="text-sm text-red-600 mt-4">
                    Veuillez contacter l'administrateur à <strong>admin@speedelog.net</strong> pour configurer votre compte.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes Mouvements de Stock</h1>
          <p className="text-muted-foreground">
            Consultez l'historique des mouvements de vos produits
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par produit, référence ou n° mouvement..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Type de mouvement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les types</SelectItem>
                  <SelectItem value="entrée">Entrée</SelectItem>
                  <SelectItem value="sortie">Sortie</SelectItem>
                  <SelectItem value="transfert">Transfert</SelectItem>
                  <SelectItem value="ajustement">Ajustement</SelectItem>
                  <SelectItem value="réservation">Réservation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Chargement...</p>
              </div>
            ) : filteredMouvements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun mouvement trouvé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>N° Mouvement</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Destination</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMouvements.map((mouvement) => (
                    <TableRow key={mouvement.id}>
                      <TableCell>
                        {format(new Date(mouvement.date_mouvement), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {mouvement.numero_mouvement}
                      </TableCell>
                      <TableCell>{getTypeBadge(mouvement.type_mouvement)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{mouvement.produit?.nom || "-"}</div>
                          <div className="text-sm text-muted-foreground">
                            {mouvement.produit?.reference || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={mouvement.quantite > 0 ? "text-green-600" : "text-red-600"}>
                          {mouvement.quantite > 0 ? "+" : ""}
                          {mouvement.quantite}
                        </span>
                      </TableCell>
                      <TableCell>
                        {mouvement.emplacement_source?.code_emplacement || "-"}
                      </TableCell>
                      <TableCell>
                        {mouvement.emplacement_destination?.code_emplacement || "-"}
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
}
