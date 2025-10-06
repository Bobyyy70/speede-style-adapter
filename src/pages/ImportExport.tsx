import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, FileText, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const ImportExport = () => {
  const { toast } = useToast();
  const { userRole, user, getViewingClientId } = useAuth();
  const [importType, setImportType] = useState<"produits" | "commandes" | "emplacements">("produits");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      let data: any[] = [];
      let filename = "";

      // Get client_id if user is client or viewing as client
      let clientIdToFilter: string | null = null;
      const viewingClientId = getViewingClientId();
      
      if (viewingClientId) {
        clientIdToFilter = viewingClientId;
      } else if (userRole === 'client' && user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single();
        clientIdToFilter = profileData?.client_id || null;
      }

      switch (importType) {
        case "produits":
          let queryProduits = supabase.from('produit').select('*');
          if (clientIdToFilter) {
            queryProduits = queryProduits.eq("client_id", clientIdToFilter);
          }
          const { data: produits, error: produitsError } = await queryProduits;
          if (produitsError) throw produitsError;
          data = produits || [];
          filename = "export_produits.csv";
          break;

        case "commandes":
          let queryCommandes = supabase.from('commande').select('*');
          if (clientIdToFilter) {
            queryCommandes = queryCommandes.eq("client_id", clientIdToFilter);
          }
          const { data: commandes, error: commandesError } = await queryCommandes;
          if (commandesError) throw commandesError;
          data = commandes || [];
          filename = "export_commandes.csv";
          break;

        case "emplacements":
          const { data: emplacements, error: emplacementsError } = await supabase
            .from('emplacement')
            .select('*');
          if (emplacementsError) throw emplacementsError;
          data = emplacements || [];
          filename = "export_emplacements.csv";
          break;
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
    } catch (error: any) {
      toast({
        title: "Erreur d'export",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = () => {
    let headers: string[] = [];
    let filename = "";

    switch (importType) {
      case "produits":
        headers = ["reference", "nom", "description", "ean", "poids", "prix_unitaire", "actif"];
        filename = "template_produits.csv";
        break;
      case "commandes":
        headers = ["numero_commande", "client_nom", "statut_wms", "date_creation"];
        filename = "template_commandes.csv";
        break;
      case "emplacements":
        headers = ["code", "type", "zone", "allee", "niveau", "capacite_max"];
        filename = "template_emplacements.csv";
        break;
    }

    const csv = Papa.unparse([headers]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    toast({
      title: "Template téléchargé",
      description: "Utilisez ce fichier comme modèle pour vos imports",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import / Export</h1>
          <p className="text-muted-foreground">
            Importez et exportez vos données en masse
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importer des données
              </CardTitle>
              <CardDescription>
                Importez des produits, commandes ou emplacements via CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-type">Type de données</Label>
                <Select value={importType} onValueChange={(value: any) => setImportType(value)}>
                  <SelectTrigger id="import-type">
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
                <Label htmlFor="file-upload">Fichier CSV</Label>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" asChild>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Choisir un fichier
                      <input
                        id="file-upload"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={() => {}}
                      />
                    </label>
                  </Button>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={downloadTemplate}>
                <FileText className="mr-2 h-4 w-4" />
                Télécharger le template
              </Button>

              <Button className="w-full" disabled>
                <Upload className="mr-2 h-4 w-4" />
                Importer
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Exporter des données
              </CardTitle>
              <CardDescription>
                Exportez vos données en format CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="export-type">Type de données</Label>
                <Select value={importType} onValueChange={(value: any) => setImportType(value)}>
                  <SelectTrigger id="export-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produits">Produits</SelectItem>
                    <SelectItem value="commandes">Commandes</SelectItem>
                    <SelectItem value="emplacements">Emplacements</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium">CSV (UTF-8)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Séparateur</span>
                  <span className="font-medium">Virgule (,)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Encodage</span>
                  <span className="font-medium">UTF-8</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Export en cours...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Exporter
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ImportExport;
