import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings, Users, BellDot, Database, Server, TrendingUp, Upload, Download, FileText, FileDown, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
interface ValidationResult {
  valid: any[];
  duplicates: any[];
  errors: Array<{
    _lineNumber: number;
    reference: string;
    nom: string;
    erreur: string;
  }>;
}
interface ImportReport {
  created: number;
  updated: number;
  errors: number;
  errorRows: Array<{
    ligne: number;
    reference: string;
    nom: string;
    erreur: string;
  }>;
  executionTime: number;
}
const Parametres = () => {
  const {
    toast
  } = useToast();
  const {
    userRole,
    user
  } = useAuth();
  const [activeTab, setActiveTab] = useState<"general" | "users" | "notifications" | "import-export" | "data" | "statistics" | "client-view">("general");
  const [importType, setImportType] = useState<"produits" | "commandes" | "emplacements">("produits");
  const [csvData, setCsvData] = useState<any[]>([]);
  const [validatedData, setValidatedData] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const mainTabs = [{
    id: "general" as const,
    label: "Général",
    icon: Settings
  }, ...(userRole === 'admin' ? [{
    id: "users" as const,
    label: "Utilisateurs",
    icon: Users
  }, {
    id: "notifications" as const,
    label: "Notifications",
    icon: BellDot
  }] : []), {
    id: "import-export" as const,
    label: "Import/Export",
    icon: Database
  }, ...(userRole === 'admin' ? [{
    id: "data" as const,
    label: "Données",
    icon: Server
  }] : [])];
  const statisticsTab = {
    id: "statistics" as const,
    label: "Statistiques",
    icon: TrendingUp
  };
  const clientViewTab = {
    id: "client-view" as const,
    label: "Vue Client",
    icon: Users
  };
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: results => {
        setCsvData(results.data);
        toast({
          title: "Fichier chargé",
          description: `${results.data.length} lignes détectées`
        });
      },
      error: error => {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };
  const validateCSVData = async (): Promise<ValidationResult> => {
    const errors: Array<{
      _lineNumber: number;
      reference: string;
      nom: string;
      erreur: string;
    }> = [];
    const validRows: any[] = [];

    // Helper functions for type conversion
    const parseBoolean = (value: any): boolean => {
      if (typeof value === 'boolean') return value;
      const str = String(value).toLowerCase().trim();
      return ['true', '1', 'oui', 'yes'].includes(str);
    };
    const parseArray = (value: any): string[] => {
      if (!value) return [];
      return String(value).split(';').map(s => s.trim()).filter(Boolean);
    };
    const parseNumber = (value: any, decimals = 2): number | null => {
      if (!value || value === '') return null;
      const parsed = parseFloat(String(value).replace(',', '.'));
      return isNaN(parsed) ? null : Number(parsed.toFixed(decimals));
    };

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const lineNumber = i + 2; // +2 because line 1 is headers, index starts at 0

      // Validate mandatory fields
      if (!row.reference || String(row.reference).trim() === '') {
        errors.push({
          _lineNumber: lineNumber,
          reference: 'N/A',
          nom: row.nom || 'N/A',
          erreur: "Champ 'reference' obligatoire"
        });
        continue;
      }
      if (!row.nom || String(row.nom).trim() === '') {
        errors.push({
          _lineNumber: lineNumber,
          reference: row.reference,
          nom: 'N/A',
          erreur: "Champ 'nom' obligatoire"
        });
        continue;
      }

      // Build validated row with defaults and conversions
      const validatedRow: any = {
        reference: String(row.reference).trim(),
        nom: String(row.nom).trim(),
        description: row.description || null,
        code_barre_ean: row.code_barre_ean || null,
        marque: row.marque || null,
        fournisseur: row.fournisseur || null,
        protection_individuelle: parseBoolean(row.protection_individuelle),
        prix_unitaire: parseNumber(row.prix_unitaire),
        stock_minimum: parseInt(row.stock_minimum) || 0,
        stock_maximum: parseInt(row.stock_maximum) || null,
        image_url: row.image_url || null,
        longueur_cm: parseNumber(row.longueur_cm),
        largeur_cm: parseNumber(row.largeur_cm),
        hauteur_cm: parseNumber(row.hauteur_cm),
        poids_unitaire: parseNumber(row.poids_unitaire),
        valeur_douaniere: parseNumber(row.valeur_douaniere),
        taux_tva: parseNumber(row.taux_tva) || 20.00,
        code_sh: row.code_sh || null,
        pays_origine: row.pays_origine || null,
        temperature_stockage: row.temperature_stockage || 'ambiante',
        matieres_dangereuses: parseBoolean(row.matieres_dangereuses),
        classe_danger: row.classe_danger || null,
        numero_onu: row.numero_onu || null,
        conditions_speciales: parseArray(row.conditions_speciales),
        gestion_lots: parseBoolean(row.gestion_lots),
        gestion_serie: parseBoolean(row.gestion_serie),
        duree_vie_jours: parseInt(row.duree_vie_jours) || null,
        delai_peremption_alerte_jours: parseInt(row.delai_peremption_alerte_jours) || null,
        instructions_picking: row.instructions_picking || null,
        instructions_stockage: row.instructions_stockage || null,
        statut_actif: row.statut_actif === undefined ? true : parseBoolean(row.statut_actif),
        _lineNumber: lineNumber
      };

      // Auto-calculate volume_m3
      if (validatedRow.longueur_cm && validatedRow.largeur_cm && validatedRow.hauteur_cm) {
        validatedRow.volume_m3 = parseNumber(validatedRow.longueur_cm * validatedRow.largeur_cm * validatedRow.hauteur_cm / 1000000, 6);
      }

      // Auto-calculate categorie_emballage based on protection_individuelle
      validatedRow.categorie_emballage = validatedRow.protection_individuelle ? 2 : 1;
      validRows.push(validatedRow);
    }

    // Check for duplicates in database
    const references = validRows.map(r => r.reference);
    const {
      data: existingProducts
    } = await supabase.from('produit').select('id, reference, nom, prix_unitaire, stock_actuel').in('reference', references);
    const existingMap = new Map((existingProducts || []).map(p => [p.reference, p]));
    const duplicates = validRows.filter(r => existingMap.has(r.reference)).map(r => ({
      ...r,
      _existing: existingMap.get(r.reference)
    }));
    const newProducts = validRows.filter(r => !existingMap.has(r.reference));
    return {
      valid: newProducts,
      duplicates,
      errors
    };
  };
  const handleImport = async () => {
    if (csvData.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Veuillez charger un fichier CSV d'abord",
        variant: "destructive"
      });
      return;
    }
    setImporting(true);
    try {
      const result = await validateCSVData();
      setValidatedData(result);
      if (result.errors.length > 0) {
        toast({
          title: "⚠️ Erreurs de validation",
          description: `${result.errors.length} ligne(s) avec erreurs. Consultez l'aperçu.`,
          variant: "destructive"
        });
      }
      if (result.duplicates.length > 0) {
        setShowDuplicateDialog(true);
      } else if (result.valid.length > 0) {
        await executeImport(result.valid, []);
      } else {
        toast({
          title: "Aucune donnée valide",
          description: "Corrigez les erreurs et réessayez",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de la validation",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };
  const executeImport = async (newProducts: any[], duplicatesToUpdate: any[]) => {
    const startTime = Date.now();
    let createdCount = 0;
    let updatedCount = 0;
    const errorRows: Array<{
      ligne: number;
      reference: string;
      nom: string;
      erreur: string;
    }> = [];
    setImporting(true);
    setImportProgress(0);
    try {
      const totalItems = newProducts.length + duplicatesToUpdate.length;
      let processedItems = 0;

      // Insert new products with stock_actuel = 0
      for (const product of newProducts) {
        try {
          const {
            _lineNumber,
            _existing,
            ...productData
          } = product;
          const {
            error
          } = await supabase.from('produit').insert({
            ...productData,
            stock_actuel: 0
          });
          if (error) throw error;
          createdCount++;
        } catch (err: any) {
          errorRows.push({
            ligne: product._lineNumber,
            reference: product.reference,
            nom: product.nom,
            erreur: err.message || 'Erreur insertion'
          });
        }
        processedItems++;
        setImportProgress(Math.round(processedItems / totalItems * 100));
      }

      // Update existing products (without touching stock_actuel)
      for (const product of duplicatesToUpdate) {
        try {
          const {
            _lineNumber,
            _existing,
            ...productData
          } = product;
          const {
            stock_actuel,
            ...updateData
          } = productData; // Exclude stock_actuel

          const {
            error
          } = await supabase.from('produit').update(updateData).eq('reference', product.reference);
          if (error) throw error;
          updatedCount++;
        } catch (err: any) {
          errorRows.push({
            ligne: product._lineNumber,
            reference: product.reference,
            nom: product.nom,
            erreur: err.message || 'Erreur mise à jour'
          });
        }
        processedItems++;
        setImportProgress(Math.round(processedItems / totalItems * 100));
      }
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
      setImportReport({
        created: createdCount,
        updated: updatedCount,
        errors: errorRows.length,
        errorRows,
        executionTime: parseFloat(executionTime)
      });

      // Show toast notification
      toast({
        title: "✅ Import terminé",
        description: `${createdCount} créés, ${updatedCount} mis à jour, ${errorRows.length} erreurs`
      });

      // Show detailed modal
      setShowReportModal(true);

      // Clear CSV data
      setCsvData([]);
      setValidatedData(null);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'import",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };
  const exportErrorsToCSV = () => {
    if (!importReport || importReport.errorRows.length === 0) return;
    const csv = Papa.unparse(importReport.errorRows);
    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'erreurs_import_produits.csv';
    link.click();
    toast({
      title: "📥 Export erreurs",
      description: `${importReport.errorRows.length} erreurs exportées`
    });
  };
  const handleExport = async (type: "stock" | "commandes" | "mouvements") => {
    setExporting(true);
    try {
      let data: any[] = [];
      let filename = "";

      // Get client_id if user is client
      const userClientId = userRole === 'client' && user ? (await supabase.from("profiles").select("client_id").eq("id", user.id).single()).data?.client_id : null;
      if (type === "stock") {
        let query = supabase.from("produit").select("reference, nom, stock_actuel, stock_minimum, prix_unitaire").order("reference");
        if (userClientId) {
          query = query.eq("client_id", userClientId);
        }
        const {
          data: produits,
          error
        } = await query;
        if (error) throw error;
        data = produits || [];
        filename = "export_stock.csv";
      } else if (type === "commandes") {
        let query = supabase.from("commande").select("numero_commande, nom_client, statut_wms, date_creation, valeur_totale").order("date_creation", {
          ascending: false
        }).limit(1000);
        if (userClientId) {
          query = query.eq("client_id", userClientId);
        }
        const {
          data: commandes,
          error
        } = await query;
        if (error) throw error;
        data = commandes || [];
        filename = "export_commandes.csv";
      } else if (type === "mouvements") {
        let query = supabase.from("mouvement_stock").select("numero_mouvement, type_mouvement, quantite, date_mouvement").order("date_mouvement", {
          ascending: false
        }).limit(1000);

        // Filter mouvements by client's products
        if (userClientId) {
          const {
            data: clientProducts
          } = await supabase.from("produit").select("id").eq("client_id", userClientId);
          const productIds = clientProducts?.map(p => p.id) || [];
          if (productIds.length > 0) {
            query = query.in("produit_id", productIds);
          }
        }
        const {
          data: mouvements,
          error
        } = await query;
        if (error) throw error;
        data = mouvements || [];
        filename = "export_mouvements.csv";
      }
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      toast({
        title: "Export réussi",
        description: `${data.length} lignes exportées`
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'export",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };
  const downloadTemplate = (type: "produits" | "commandes" | "emplacements") => {
    let headers: string[] = [];
    let filename = "";
    if (type === "produits") {
      headers = ["reference", "nom", "description", "code_barre_ean", "marque", "fournisseur", "protection_individuelle", "prix_unitaire", "stock_minimum", "stock_maximum", "image_url", "longueur_cm", "largeur_cm", "hauteur_cm", "poids_unitaire", "valeur_douaniere", "taux_tva", "code_sh", "pays_origine", "temperature_stockage", "matieres_dangereuses", "classe_danger", "numero_onu", "conditions_speciales", "gestion_lots", "gestion_serie", "duree_vie_jours", "delai_peremption_alerte_jours", "instructions_picking", "instructions_stockage", "statut_actif"];
      filename = "template_produits_complet.csv";
    } else if (type === "emplacements") {
      headers = ["code_emplacement", "zone", "type_emplacement", "capacite_maximale", "statut_actuel"];
      filename = "template_emplacements.csv";
    } else if (type === "commandes") {
      headers = ["numero_commande", "nom_client", "email_client", "adresse_ligne_1", "ville", "code_postal", "pays_code"];
      filename = "template_commandes.csv";
    }
    const csv = Papa.unparse([headers]);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    toast({
      title: "📥 Template téléchargé",
      description: filename
    });
  };
  const downloadExempleProduits = () => {
    const exampleData = [{
      reference: "REF-001",
      nom: "Smartphone XR Pro",
      description: "Téléphone haute performance 128GB",
      code_barre_ean: "3760123456789",
      marque: "TechCorp",
      fournisseur: "FournisseurA",
      protection_individuelle: "non",
      prix_unitaire: 299.99,
      stock_minimum: 10,
      stock_maximum: 500,
      image_url: "https://example.com/img1.jpg",
      longueur_cm: 15.5,
      largeur_cm: 7.8,
      hauteur_cm: 0.9,
      poids_unitaire: 0.175,
      valeur_douaniere: 250.00,
      taux_tva: 20.00,
      code_sh: "8517.12.00",
      pays_origine: "CN",
      temperature_stockage: "ambiante",
      matieres_dangereuses: "FALSE",
      classe_danger: "",
      numero_onu: "",
      conditions_speciales: "Fragile;Électronique",
      gestion_lots: "FALSE",
      gestion_serie: "TRUE",
      duree_vie_jours: "",
      delai_peremption_alerte_jours: "",
      instructions_picking: "Manipuler avec soin",
      instructions_stockage: "Stocker à l'abri de l'humidité",
      statut_actif: "TRUE"
    }, {
      reference: "REF-002",
      nom: "Casque Audio Bluetooth",
      description: "Casque sans fil avec réduction de bruit",
      code_barre_ean: "3760987654321",
      marque: "AudioMax",
      fournisseur: "FournisseurB",
      protection_individuelle: "oui",
      prix_unitaire: 79.99,
      stock_minimum: 20,
      stock_maximum: 300,
      image_url: "",
      longueur_cm: 12.0,
      largeur_cm: 10.0,
      hauteur_cm: 8.5,
      poids_unitaire: 0.250,
      valeur_douaniere: 60.00,
      taux_tva: 20.00,
      code_sh: "8518.30.00",
      pays_origine: "DE",
      temperature_stockage: "ambiante",
      matieres_dangereuses: "FALSE",
      classe_danger: "",
      numero_onu: "",
      conditions_speciales: "Fragile",
      gestion_lots: "FALSE",
      gestion_serie: "FALSE",
      duree_vie_jours: "",
      delai_peremption_alerte_jours: "",
      instructions_picking: "Éviter chocs",
      instructions_stockage: "Ranger dans boîte d'origine",
      statut_actif: "TRUE"
    }, {
      reference: "REF-003",
      nom: "Chargeur USB-C 65W",
      description: "Adaptateur secteur rapide compatible MacBook",
      code_barre_ean: "3760111222333",
      marque: "ChargePro",
      fournisseur: "FournisseurA",
      protection_individuelle: "non",
      prix_unitaire: 29.99,
      stock_minimum: 50,
      stock_maximum: 1000,
      image_url: "",
      longueur_cm: 8.5,
      largeur_cm: 5.2,
      hauteur_cm: 3.0,
      poids_unitaire: 0.120,
      valeur_douaniere: 18.00,
      taux_tva: 20.00,
      code_sh: "8504.40.90",
      pays_origine: "FR",
      temperature_stockage: "ambiante",
      matieres_dangereuses: "FALSE",
      classe_danger: "",
      numero_onu: "",
      conditions_speciales: "Électronique",
      gestion_lots: "FALSE",
      gestion_serie: "FALSE",
      duree_vie_jours: "",
      delai_peremption_alerte_jours: "",
      instructions_picking: "Vérifier câble fourni",
      instructions_stockage: "Stocker au sec",
      statut_actif: "TRUE"
    }];
    const csv = Papa.unparse(exampleData);
    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'exemple_produits.csv';
    link.click();
    toast({
      title: "📄 Exemple téléchargé",
      description: "3 produits pré-remplis"
    });
  };
  return <DashboardLayout>
      <div className="space-y-4 flex flex-col h-[calc(100vh-8rem)]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">
            Configuration du système WMS
          </p>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Navigation verticale */}
          <nav className="w-56 bg-card border rounded-lg p-3 flex flex-col gap-2">
            {mainTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 p-6 rounded-lg transition-all min-h-[120px]",
                  "hover:bg-accent hover:text-accent-foreground",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-transparent"
                )}
              >
                <tab.icon className="h-10 w-10" />
                <span className="text-base font-semibold text-center">{tab.label}</span>
              </button>
            ))}
            
            {/* Séparateur visuel */}
            <div className="border-t my-2" />
            
            {/* Onglet Statistiques */}
            <button onClick={() => setActiveTab("statistics")} className={cn("flex flex-col items-center justify-center gap-3 p-6 rounded-lg transition-all min-h-[120px]", "hover:bg-accent hover:text-accent-foreground", activeTab === "statistics" ? "bg-primary text-primary-foreground shadow-sm" : "bg-transparent")}>
              <statisticsTab.icon className="h-10 w-10" />
              <span className="text-base font-semibold text-center">{statisticsTab.label}</span>
            </button>

            {/* Onglet Vue Client */}
            
          </nav>

          {/* Contenu */}
          <div className="flex-1 bg-card border rounded-lg p-6 overflow-auto">
            {activeTab === "general" && <div className="space-y-4">
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
              </div>}

            {activeTab === "users" && <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des utilisateurs</CardTitle>
                <CardDescription>Administrer les comptes et rôles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[{
                    nom: "Admin Principal",
                    email: "admin@speedelog.net",
                    role: "Admin"
                  }, {
                    nom: "Opérateur 1",
                    email: "operateur@speedelog.net",
                    role: "Opérateur"
                  }].map(user => <div key={user.email} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{user.nom}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                      <div className="text-sm">{user.role}</div>
                    </div>)}
                  <Button className="w-full">Ajouter utilisateur</Button>
                </div>
              </CardContent>
            </Card>
              </div>}

            {activeTab === "notifications" && <div className="space-y-4">
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
              </div>}

            {activeTab === "import-export" && <div className="space-y-4">
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
                    <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} disabled={importing} />
                  </div>

                  {csvData.length > 0 && <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          📊 Aperçu: {csvData.length} lignes chargées
                        </p>
                        {validatedData && <div className="flex gap-2 text-xs">
                            <Badge variant="default" className="bg-green-100 text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {validatedData.valid.length} valides
                            </Badge>
                            {validatedData.duplicates.length > 0 && <Badge variant="default" className="bg-blue-100 text-blue-700">
                                <RefreshCw className="h-3 w-3 mr-1" />
                                {validatedData.duplicates.length} doublons
                              </Badge>}
                            {validatedData.errors.length > 0 && <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {validatedData.errors.length} erreurs
                              </Badge>}
                          </div>}
                      </div>
                      
                      <ScrollArea className="h-64 border rounded">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              {Object.keys(csvData[0] || {}).slice(0, 5).map(key => <TableHead key={key}>{key}</TableHead>)}
                              {validatedData && <TableHead>Statut</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvData.slice(0, 10).map((row, i) => {
                            const lineNumber = i + 2;
                            const isError = validatedData?.errors.some(e => e._lineNumber === lineNumber);
                            const isDuplicate = validatedData?.duplicates.some((d: any) => d._lineNumber === lineNumber);
                            return <TableRow key={i} className={isError ? "bg-red-50" : isDuplicate ? "bg-blue-50" : "bg-green-50"}>
                                  <TableCell className="text-xs font-mono">{lineNumber}</TableCell>
                                  {Object.values(row).slice(0, 5).map((val: any, j) => <TableCell key={j} className="text-xs">
                                      {String(val).substring(0, 30)}
                                    </TableCell>)}
                                  {validatedData && <TableCell className="text-xs">
                                      {isError && <Badge variant="destructive" className="text-xs">❌ Erreur</Badge>}
                                      {isDuplicate && <Badge variant="default" className="bg-blue-500 text-xs">🔄 Doublon</Badge>}
                                      {!isError && !isDuplicate && <Badge variant="default" className="bg-green-500 text-xs">✅ Valide</Badge>}
                                    </TableCell>}
                                </TableRow>;
                          })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      
                      {csvData.length > 10 && <p className="text-xs text-muted-foreground text-center">
                          ... et {csvData.length - 10} lignes supplémentaires
                        </p>}
                    </div>}
                  
                  {importing && importProgress > 0 && <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Import en cours...</span>
                        <span>{importProgress}%</span>
                      </div>
                      <Progress value={importProgress} />
                    </div>}

                  <Button onClick={handleImport} disabled={importing || csvData.length === 0} className="w-full">
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
                  <Button onClick={() => handleExport("stock")} disabled={exporting} variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Stock complet (référence, quantité, valeur)
                  </Button>

                  <Button onClick={() => handleExport("commandes")} disabled={exporting} variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Commandes (1000 dernières)
                  </Button>

                  <Button onClick={() => handleExport("mouvements")} disabled={exporting} variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Mouvements de stock (1000 derniers)
                  </Button>

                  {exporting && <p className="text-sm text-muted-foreground text-center">
                      Export en cours...
                    </p>}
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
                <Button onClick={() => downloadTemplate("produits")} variant="secondary" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Template Produits
                </Button>

                <Button onClick={() => downloadTemplate("commandes")} variant="secondary" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Template Commandes
                </Button>

                <Button onClick={() => downloadTemplate("emplacements")} variant="secondary" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Template Emplacements
                </Button>
              </CardContent>
            </Card>
              </div>}

            {activeTab === "data" && <div className="space-y-4">
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
              </div>}

            {activeTab === "statistics" && <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Statistiques système</CardTitle>
                    <CardDescription>Indicateurs de performance et activité</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* KPIs globaux */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="pt-6 text-center">
                          <div className="text-4xl font-bold text-blue-600">1,247</div>
                          <p className="text-sm text-muted-foreground mt-1">Produits en stock</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardContent className="pt-6 text-center">
                          <div className="text-4xl font-bold text-green-600">342</div>
                          <p className="text-sm text-muted-foreground mt-1">Commandes ce mois</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <CardContent className="pt-6 text-center">
                          <div className="text-4xl font-bold text-purple-600">78%</div>
                          <p className="text-sm text-muted-foreground mt-1">Taux remplissage entrepôt</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Utilisation stockage */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">📦 Utilisation du stockage</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Zone A (Picking)</span>
                              <span className="font-semibold">85%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary to-primary/80" style={{
                            width: '85%'
                          }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Zone B (Réserve)</span>
                              <span className="font-semibold">62%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400" style={{
                            width: '62%'
                          }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Zone C (Longue durée)</span>
                              <span className="font-semibold">41%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-green-500 to-green-400" style={{
                            width: '41%'
                          }} />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Activité utilisateurs */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">👥 Activité des utilisateurs (30 derniers jours)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="font-medium">Opérateurs</p>
                              <p className="text-sm text-muted-foreground">Réceptions, pickings</p>
                            </div>
                            <div className="text-2xl font-bold text-primary">456</div>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="font-medium">Gestionnaires</p>
                              <p className="text-sm text-muted-foreground">Approbations, réappros</p>
                            </div>
                            <div className="text-2xl font-bold text-blue-600">127</div>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="font-medium">Administrateurs</p>
                              <p className="text-sm text-muted-foreground">Configurations, imports</p>
                            </div>
                            <div className="text-2xl font-bold text-purple-600">34</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Performances import/export */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">📊 Performances Import/Export</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="text-3xl font-bold text-green-600">12</div>
                            <p className="text-sm text-muted-foreground mt-1">Imports réussis</p>
                            <p className="text-xs text-muted-foreground">Taux succès: 92%</p>
                          </div>
                          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-3xl font-bold text-blue-600">3.2s</div>
                            <p className="text-sm text-muted-foreground mt-1">Temps moyen</p>
                            <p className="text-xs text-muted-foreground">Par lot de 100 lignes</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Top 5 produits */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">🏆 Top 5 produits (rotations)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {[{
                        ref: "PROD-A123",
                        nom: "Smartphone XR Pro",
                        rotations: 234
                      }, {
                        ref: "PROD-B456",
                        nom: "Casque Bluetooth",
                        rotations: 189
                      }, {
                        ref: "PROD-C789",
                        nom: "Chargeur USB-C",
                        rotations: 156
                      }, {
                        ref: "PROD-D012",
                        nom: "Câble HDMI 2m",
                        rotations: 143
                      }, {
                        ref: "PROD-E345",
                        nom: "Écouteurs sans fil",
                        rotations: 127
                      }].map((item, index) => <div key={item.ref} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{item.nom}</p>
                                  <p className="text-xs text-muted-foreground">{item.ref}</p>
                                </div>
                              </div>
                              <div className="text-lg font-bold text-primary">{item.rotations}</div>
                            </div>)}
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </div>}

            {activeTab === "client-view" && <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Vue Client</CardTitle>
                    <CardDescription>
                      Aperçu de l'interface visible par les clients
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Cette section vous permet de voir l'interface telle qu'elle apparaît aux clients.
                      </p>
                      <Button onClick={() => window.open('/client/dashboard', '_blank')} className="w-full">
                        Ouvrir la vue client dans un nouvel onglet
                      </Button>
                      
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <h3 className="font-semibold mb-2">Pages accessibles aux clients :</h3>
                        <ul className="space-y-1 text-sm">
                          <li>• Tableau de bord (statistiques personnelles)</li>
                          <li>• Mes produits (inventaire)</li>
                          <li>• Mes commandes (suivi)</li>
                          <li>• Mes retours (gestion des retours)</li>
                          <li>• Ma facturation (historique)</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>}
          </div>
        </div>
      </div>
      
      {/* Duplicate Confirmation Dialog */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              🔄 {validatedData?.duplicates.length || 0} produits existants détectés
            </AlertDialogTitle>
            <AlertDialogDescription>
              Les produits suivants existent déjà dans la base. Les données CSV remplaceront les valeurs actuelles.
              <br />
              <strong className="text-orange-600">⚠️ Le stock actuel ne sera PAS modifié.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Nom actuel</TableHead>
                  <TableHead>Nouveau nom</TableHead>
                  <TableHead>Prix actuel</TableHead>
                  <TableHead>Nouveau prix</TableHead>
                  <TableHead>Stock actuel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validatedData?.duplicates.map((dup: any, i: number) => <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{dup.reference}</TableCell>
                    <TableCell>{dup._existing.nom}</TableCell>
                    <TableCell className="font-semibold text-blue-600">{dup.nom}</TableCell>
                    <TableCell>{dup._existing.prix_unitaire ? `${dup._existing.prix_unitaire}€` : '-'}</TableCell>
                    <TableCell className="font-semibold text-blue-600">
                      {dup.prix_unitaire ? `${dup.prix_unitaire}€` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dup._existing.stock_actuel} <span className="text-xs">(inchangé)</span>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </ScrollArea>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDuplicateDialog(false)}>
              ❌ Annuler l'import
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
            setShowDuplicateDialog(false);
            executeImport(validatedData?.valid || [], validatedData?.duplicates || []);
          }}>
              ✅ Confirmer et mettre à jour ({validatedData?.duplicates.length || 0} produits)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Import Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>📊 Rapport d'import terminé</DialogTitle>
            <DialogDescription>
              Résumé des opérations effectuées
            </DialogDescription>
          </DialogHeader>
          
          {importReport && <div className="space-y-4">
              {/* Statistics Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-green-600">{importReport.created}</div>
                    <p className="text-sm text-muted-foreground mt-1">✅ Produits créés</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-blue-600">{importReport.updated}</div>
                    <p className="text-sm text-muted-foreground mt-1">🔄 Produits mis à jour</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-6 text-center">
                    <div className="text-3xl font-bold text-red-600">{importReport.errors}</div>
                    <p className="text-sm text-muted-foreground mt-1">❌ Erreurs détectées</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Error Details */}
              {importReport.errors > 0 && <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-600 text-base">⚠️ Détail des erreurs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-32">
                      <div className="space-y-1">
                        {importReport.errorRows.map((err, i) => <div key={i} className="text-sm py-1 border-b last:border-0">
                            <span className="font-mono text-xs text-muted-foreground">Ligne {err.ligne}</span>
                            {' - '}
                            <span className="font-semibold">{err.reference}</span>
                            {': '}
                            <span className="text-red-600">{err.erreur}</span>
                          </div>)}
                      </div>
                    </ScrollArea>
                    <Button variant="outline" className="mt-3 w-full" onClick={exportErrorsToCSV}>
                      <FileDown className="h-4 w-4 mr-2" />
                      📥 Télécharger erreurs (CSV)
                    </Button>
                  </CardContent>
                </Card>}
              
              {/* Execution Time */}
              <div className="text-sm text-muted-foreground text-center pt-2 border-t">
                ⏱️ Import terminé en {importReport.executionTime}s
              </div>
            </div>}
          
          <DialogFooter>
            <Button onClick={() => setShowReportModal(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>;
};
export default Parametres;