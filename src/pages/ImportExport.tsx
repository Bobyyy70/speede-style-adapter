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
import { useAutoRules } from "@/hooks/useAutoRules";

const ImportExport = () => {
  const { toast } = useToast();
  const { userRole, user, getViewingClientId } = useAuth();
  const { applyAutoRules } = useAutoRules();
  const [importType, setImportType] = useState<"produits" | "commandes" | "emplacements">("produits");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

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

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          try {
            const rows = results.data.filter((row: any) => Object.values(row).some(v => v));

            if (importType === 'commandes') {
              const commandes = rows.map((row: any) => ({
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

              const { data: insertedCommandes, error } = await supabase
                .from("commande")
                .insert(commandes)
                .select();

              if (error) throw error;

              // Appliquer les règles automatiques
              if (insertedCommandes) {
                for (const commande of insertedCommandes) {
                  await applyAutoRules(commande.id);
                }
              }

              toast({
                title: "Import réussi",
                description: `${commandes.length} commande(s) importée(s) avec règles appliquées`,
              });
            } else if (importType === 'produits') {
              // Déterminer client_id si nécessaire
              let clientId: string | null = getViewingClientId() || null;
              if (!clientId && userRole === 'client' && user) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('client_id')
                  .eq('id', user.id)
                  .maybeSingle();
                clientId = profile?.client_id || null;
              }
              if (userRole === 'client' && !clientId) {
                throw new Error("Impossible de déterminer votre client pour l'import des produits");
              }

              const toNumberOrNull = (val: any) => {
                if (val === undefined || val === null || val === "") return null;
                const n = Number(String(val).replace(",", "."));
                return Number.isFinite(n) ? n : null;
              };
              const toIntOrNull = (val: any) => {
                if (val === undefined || val === null || val === "") return null;
                const n = parseInt(String(val), 10);
                return Number.isFinite(n) ? n : null;
              };

              const produits = rows.map((row: any) => ({
                reference: String(row.reference || row.Reference || row.SKU || row.sku || '').trim(),
                nom: row.nom || row.Nom || row.name || row.Name,
                code_barre_ean: row.ean || row.EAN || row.code_barre || row.barcode || null,
                prix_unitaire: toNumberOrNull(row.prix ?? row.price ?? row.prix_unitaire),
                poids_unitaire: toNumberOrNull(row.poids ?? row.weight ?? row.poids_unitaire),
                stock_minimum: (toIntOrNull(row.stock_min ?? row.min_stock) ?? 0),
                stock_maximum: toIntOrNull(row.stock_max ?? row.max_stock),
                description: row.description || row.Description || null,
                categorie_emballage: (toIntOrNull(row.categorie ?? row.category) ?? 1),
                statut_actif: true,
                client_id: row.client_id || clientId || null,
              })).filter((p: any) => p.reference && p.nom);

              // Déduplication: garder la dernière occurrence de chaque référence
              const deduplicatedMap = new Map<string, typeof produits[0]>();
              const duplicateRefs: string[] = [];
              
              produits.forEach(p => {
                if (deduplicatedMap.has(p.reference)) {
                  if (!duplicateRefs.includes(p.reference)) {
                    duplicateRefs.push(p.reference);
                  }
                }
                deduplicatedMap.set(p.reference, p);
              });

              const finalProduits = Array.from(deduplicatedMap.values());

              if (duplicateRefs.length > 0) {
                toast({
                  title: "Doublons détectés",
                  description: `${duplicateRefs.length} référence(s) dupliquée(s) trouvée(s) (dernière occurrence conservée)`,
                });
              }

              if (finalProduits.length === 0) throw new Error("Aucun produit valide trouvé dans le CSV");

              const { data, error } = await supabase
                .from('produit')
                .upsert(finalProduits, { onConflict: 'reference' })
                .select('id, stock_minimum');
              
              if (error) throw error;

              // Créer automatiquement les mouvements "En attente de réappro"
              if (data && data.length > 0) {
                const mouvements = data.map(product => ({
                  numero_mouvement: '', // Sera auto-généré par le trigger
                  type_mouvement: 'entrée_prévue',
                  statut_mouvement: 'attente_arrivage_reappro',
                  produit_id: product.id,
                  quantite: product.stock_minimum || 0,
                  reference_origine: 'IMPORT-CSV',
                  type_origine: 'import',
                  remarques: 'Produit importé - En attente de réception'
                }));

                await supabase.from('mouvement_stock').insert(mouvements);
              }

              toast({
                title: "Import réussi",
                description: `${data?.length || finalProduits.length} produit(s) importé(s) ou mis à jour`,
              });
            } else {
              toast({
                title: "Type non supporté",
                description: "L'import de ce type de données n'est pas encore implémenté",
                variant: "destructive",
              });
            }
          } catch (error: any) {
            toast({
              title: "Erreur d'import",
              description: error.message,
              variant: "destructive",
            });
          } finally {
            setImporting(false);
          }
        },
        error: (error) => {
          toast({
            title: "Erreur de lecture",
            description: "Le fichier CSV n'a pas pu être lu",
            variant: "destructive",
          });
          setImporting(false);
        }
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
      setImporting(false);
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
        headers = ["numero_commande", "source", "nom_client", "email_client", "telephone_client", "adresse_nom", "adresse_ligne_1", "adresse_ligne_2", "code_postal", "ville", "pays_code", "valeur_totale", "devise", "methode_expedition", "transporteur"];
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
                        onChange={handleImport}
                      />
                    </label>
                  </Button>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={downloadTemplate}>
                <FileText className="mr-2 h-4 w-4" />
                Télécharger le template
              </Button>

              <Button className="w-full" disabled={importing}>
                {importing ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importer (sélectionnez un fichier)
                  </>
                )}
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
