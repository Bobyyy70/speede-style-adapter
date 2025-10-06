import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CommandesList } from "@/components/CommandesList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, Package, Clock, CheckCircle2, TrendingUp, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { useAutoRules } from "@/hooks/useAutoRules";
export default function Commandes() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    enAttente: 0,
    prete: 0,
    enPreparation: 0
  });
  const {
    applyAutoRules
  } = useAutoRules();
  useEffect(() => {
    fetchStats();
  }, []);
  const fetchStats = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("commande").select("statut_wms");
      if (error) throw error;
      setStats({
        total: data?.length || 0,
        enAttente: data?.filter(c => c.statut_wms === "En attente de réappro").length || 0,
        prete: data?.filter(c => c.statut_wms === "prete").length || 0,
        enPreparation: data?.filter(c => c.statut_wms === "En préparation").length || 0
      });
    } catch (error: any) {
      console.error("Erreur stats:", error);
    }
  };
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: async results => {
        try {
          const commandes = results.data.filter((row: any) => row.numero_commande).map((row: any) => ({
            numero_commande: row.numero_commande || "",
            source: row.source || "Import CSV",
            nom_client: row.nom_client || "",
            email_client: row.email_client || "",
            telephone_client: row.telephone_client || "",
            adresse_nom: row.adresse_nom || row.nom_client || "",
            adresse_ligne_1: row.adresse_ligne_1 || "",
            adresse_ligne_2: row.adresse_ligne_2 || "",
            code_postal: row.code_postal || "",
            ville: row.ville || "",
            pays_code: row.pays_code || "FR",
            valeur_totale: parseFloat(row.valeur_totale) || 0,
            devise: row.devise || "EUR",
            statut_wms: "En attente de réappro",
            methode_expedition: row.methode_expedition || "",
            transporteur: row.transporteur || ""
          }));
          const {
            data: insertedCommandes,
            error
          } = await supabase.from("commande").insert(commandes).select();
          if (error) throw error;

          // Appliquer les règles automatiques pour chaque commande importée
          if (insertedCommandes) {
            for (const commande of insertedCommandes) {
              await applyAutoRules(commande.id);
            }
          }
          toast.success(`${commandes.length} commande(s) importée(s) avec règles appliquées`);
          fetchStats();
        } catch (error: any) {
          toast.error("Erreur lors de l'import: " + error.message);
          console.error(error);
        }
      },
      error: error => {
        toast.error("Erreur de lecture du fichier CSV");
        console.error(error);
      }
    });
  };
  const handleExportCSV = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("commande").select("*").order("date_creation", {
        ascending: false
      });
      if (error) throw error;
      const csv = Papa.unparse(data || []);
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `commandes_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Export CSV réussi");
    } catch (error: any) {
      toast.error("Erreur lors de l'export");
      console.error(error);
    }
  };
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestion des commandes </h1>
            <p className="text-muted-foreground">
          </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/integrations/sendcloud-sync")}>
              <Activity className="mr-2 h-4 w-4" />
              Monitoring SendCloud
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Exporter CSV
            </Button>
            <label htmlFor="csv-upload">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer CSV
                </span>
              </Button>
            </label>
            <Input id="csv-upload" type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 py-0 my-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total commandes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Toutes les commandes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En attente</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enAttente}</div>
              <p className="text-xs text-muted-foreground">À réapprovisionner</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prêtes</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.prete}</div>
              <p className="text-xs text-muted-foreground">À préparer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En préparation</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enPreparation}</div>
              <p className="text-xs text-muted-foreground">En cours</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="toutes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="toutes">Toutes les commandes</TabsTrigger>
            <TabsTrigger value="en-attente">En attente</TabsTrigger>
            <TabsTrigger value="prete">Prêtes</TabsTrigger>
            <TabsTrigger value="en-preparation">En préparation</TabsTrigger>
          </TabsList>

          <TabsContent value="toutes">
            <CommandesList onUpdate={fetchStats} />
          </TabsContent>

          <TabsContent value="en-attente">
            <CommandesList filter="En attente de réappro" onUpdate={fetchStats} />
          </TabsContent>

          <TabsContent value="prete">
            <CommandesList filter="prete" onUpdate={fetchStats} />
          </TabsContent>

          <TabsContent value="en-preparation">
            <CommandesList filter="En préparation" onUpdate={fetchStats} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>;
}