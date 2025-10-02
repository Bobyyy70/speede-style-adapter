import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings, Users, Bell, Database, FileSpreadsheet, Upload, Download, FileText } from "lucide-react";
import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Parametres = () => {
  const { toast } = useToast();
  const [importType, setImportType] = useState<"produits" | "commandes" | "emplacements">("produits");
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        setCsvData(results.data);
        toast({
          title: "Fichier chargé",
          description: `${results.data.length} lignes détectées`,
        });
      },
      error: (error) => {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleImport = async () => {
    if (csvData.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Veuillez charger un fichier CSV d'abord",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const row of csvData) {
        try {
          if (importType === "produits") {
            const { error } = await supabase.from("produit").insert({
              reference: row.reference,
              nom: row.nom,
              code_barre_ean: row.code_barre_ean,
              description: row.description,
              poids_unitaire: parseFloat(row.poids_unitaire) || null,
              prix_unitaire: parseFloat(row.prix_unitaire) || null,
              stock_minimum: parseInt(row.stock_minimum) || 0,
              stock_actuel: parseInt(row.stock_actuel) || 0,
              statut_actif: row.statut_actif !== "false",
            });
            if (error) throw error;
          } else if (importType === "emplacements") {
            const { error } = await supabase.from("emplacement").insert({
              code_emplacement: row.code_emplacement,
              zone: row.zone,
              type_emplacement: row.type_emplacement,
              capacite_maximale: parseFloat(row.capacite_maximale) || null,
              statut_actuel: row.statut_actuel || "disponible",
            });
            if (error) throw error;
          }
          successCount++;
        } catch (err) {
          errorCount++;
          console.error("Erreur import ligne:", err);
        }
      }

      toast({
        title: "Import terminé",
        description: `${successCount} lignes importées, ${errorCount} erreurs`,
      });
      setCsvData([]);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'import",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (type: "stock" | "commandes" | "mouvements") => {
    setExporting(true);
    try {
      let data: any[] = [];
      let filename = "";

      if (type === "stock") {
        const { data: produits, error } = await supabase
          .from("produit")
          .select("reference, nom, stock_actuel, stock_minimum, prix_unitaire")
          .order("reference");
        
        if (error) throw error;
        data = produits || [];
        filename = "export_stock.csv";
      } else if (type === "commandes") {
        const { data: commandes, error } = await supabase
          .from("commande")
          .select("numero_commande, nom_client, statut_wms, date_creation, valeur_totale")
          .order("date_creation", { ascending: false })
          .limit(1000);
        
        if (error) throw error;
        data = commandes || [];
        filename = "export_commandes.csv";
      } else if (type === "mouvements") {
        const { data: mouvements, error } = await supabase
          .from("mouvement_stock")
          .select("numero_mouvement, type_mouvement, quantite, date_mouvement")
          .order("date_mouvement", { ascending: false })
          .limit(1000);
        
        if (error) throw error;
        data = mouvements || [];
        filename = "export_mouvements.csv";
      }

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      toast({
        title: "Export réussi",
        description: `${data.length} lignes exportées`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = (type: "produits" | "commandes" | "emplacements") => {
    let headers: string[] = [];
    let filename = "";

    if (type === "produits") {
      headers = ["reference", "nom", "code_barre_ean", "description", "poids_unitaire", "prix_unitaire", "stock_minimum", "stock_actuel", "statut_actif"];
      filename = "template_produits.csv";
    } else if (type === "emplacements") {
      headers = ["code_emplacement", "zone", "type_emplacement", "capacite_maximale", "statut_actuel"];
      filename = "template_emplacements.csv";
    } else if (type === "commandes") {
      headers = ["numero_commande", "nom_client", "email_client", "adresse_ligne_1", "ville", "code_postal", "pays_code"];
      filename = "template_commandes.csv";
    }

    const csv = Papa.unparse([headers]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    toast({
      title: "Template téléchargé",
      description: filename,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">
            Configuration du système WMS
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              Général
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="import-export">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Import/Export
            </TabsTrigger>
            <TabsTrigger value="data">
              <Database className="h-4 w-4 mr-2" />
              Données
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres généraux</CardTitle>
                <CardDescription>Configuration de base du système</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Nom de l'entreprise</Label>
                  <Input id="company" defaultValue="Speed E-Log" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuseau horaire</Label>
                  <Input id="timezone" defaultValue="Europe/Paris" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mode maintenance</Label>
                    <p className="text-sm text-muted-foreground">Désactiver l'accès au système</p>
                  </div>
                  <Switch />
                </div>
                <Button>Enregistrer</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des utilisateurs</CardTitle>
                <CardDescription>Administrer les comptes et rôles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { nom: "Admin Principal", email: "admin@speedelog.net", role: "Admin" },
                    { nom: "Opérateur 1", email: "operateur@speedelog.net", role: "Opérateur" },
                  ].map((user) => (
                    <div key={user.email} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{user.nom}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                      <div className="text-sm">{user.role}</div>
                    </div>
                  ))}
                  <Button className="w-full">Ajouter utilisateur</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configurer les alertes système</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Alertes stock bas</Label>
                    <p className="text-sm text-muted-foreground">Notification si stock sous seuil</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Anomalies réception</Label>
                    <p className="text-sm text-muted-foreground">Alerte en cas de problème</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Picking urgent</Label>
                    <p className="text-sm text-muted-foreground">Notification picking prioritaire</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Button>Enregistrer</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import-export" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Section Import */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import de données
                  </CardTitle>
                  <CardDescription>Importer en masse via fichiers CSV</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type de données</Label>
                    <Select value={importType} onValueChange={(v: any) => setImportType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="produits">Produits</SelectItem>
                        <SelectItem value="commandes">Commandes</SelectItem>
                        <SelectItem value="emplacements">Emplacements</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="csv-upload">Fichier CSV</Label>
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={importing}
                    />
                  </div>

                  {csvData.length > 0 && (
                    <div className="border rounded-lg p-4 max-h-64 overflow-auto">
                      <p className="text-sm font-medium mb-2">
                        Aperçu: {csvData.length} lignes
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(csvData[0] || {}).map((key) => (
                              <TableHead key={key}>{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvData.slice(0, 3).map((row, i) => (
                            <TableRow key={i}>
                              {Object.values(row).map((val: any, j) => (
                                <TableCell key={j} className="text-xs">
                                  {String(val).substring(0, 20)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <Button
                    onClick={handleImport}
                    disabled={importing || csvData.length === 0}
                    className="w-full"
                  >
                    {importing ? "Import en cours..." : "Importer les données"}
                  </Button>
                </CardContent>
              </Card>

              {/* Section Export */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Export de rapports
                  </CardTitle>
                  <CardDescription>Générer des rapports CSV</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => handleExport("stock")}
                    disabled={exporting}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Stock complet (référence, quantité, valeur)
                  </Button>

                  <Button
                    onClick={() => handleExport("commandes")}
                    disabled={exporting}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Commandes (1000 dernières)
                  </Button>

                  <Button
                    onClick={() => handleExport("mouvements")}
                    disabled={exporting}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Mouvements de stock (1000 derniers)
                  </Button>

                  {exporting && (
                    <p className="text-sm text-muted-foreground text-center">
                      Export en cours...
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Section Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Templates d'import
                </CardTitle>
                <CardDescription>
                  Téléchargez des modèles CSV vierges avec les colonnes requises
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Button
                  onClick={() => downloadTemplate("produits")}
                  variant="secondary"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template Produits
                </Button>

                <Button
                  onClick={() => downloadTemplate("commandes")}
                  variant="secondary"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template Commandes
                </Button>

                <Button
                  onClick={() => downloadTemplate("emplacements")}
                  variant="secondary"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template Emplacements
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des données</CardTitle>
                <CardDescription>Sauvegarde et maintenance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Dernière sauvegarde</Label>
                  <p className="text-sm text-muted-foreground">15 janvier 2025 à 03:00</p>
                </div>
                <Button variant="outline" className="w-full">Sauvegarder maintenant</Button>
                <Button variant="outline" className="w-full">Exporter les données</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Parametres;
