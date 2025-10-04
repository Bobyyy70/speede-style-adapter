import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { Badge } from "@/components/ui/badge";

interface ImportCSVDialogProps {
  onSuccess: () => void;
}

export const ImportCSVDialog = ({ onSuccess }: ImportCSVDialogProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Preview first 5 rows
      Papa.parse(selectedFile, {
        header: true,
        preview: 5,
        complete: (results) => {
          setPreview(results.data);
        },
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as any[];
          const produits = rows.map((row) => ({
            reference: row.reference || row.Reference || row.SKU || row.sku,
            nom: row.nom || row.Nom || row.name || row.Name,
            code_barre_ean: row.ean || row.EAN || row.code_barre || row.barcode,
            prix_unitaire: parseFloat(row.prix || row.price || "0") || null,
            poids_unitaire: parseFloat(row.poids || row.weight || "0") || null,
            stock_minimum: parseInt(row.stock_min || row.min_stock || "0") || 0,
            stock_maximum: parseInt(row.stock_max || row.max_stock || "0") || null,
            description: row.description || row.Description || null,
            categorie_emballage: parseInt(row.categorie || row.category || "1") || 1,
            statut_actif: true,
          }));

          // Filter out invalid rows (no reference)
          const validProduits = produits.filter(p => p.reference);

          if (validProduits.length === 0) {
            toast.error("Aucun produit valide trouvé dans le CSV");
            return;
          }

          // Insert in batches of 100
          const batchSize = 100;
          let successCount = 0;
          let errorCount = 0;

          for (let i = 0; i < validProduits.length; i += batchSize) {
            const batch = validProduits.slice(i, i + batchSize);
            const { error } = await supabase
              .from("produit")
              .insert(batch);

            if (error) {
              console.error("Batch import error:", error);
              errorCount += batch.length;
            } else {
              successCount += batch.length;
            }
          }

          if (successCount > 0) {
            toast.success(`${successCount} produit(s) importé(s) avec succès`);
            onSuccess();
            setOpen(false);
            setFile(null);
            setPreview([]);
          }

          if (errorCount > 0) {
            toast.error(`${errorCount} produit(s) ont échoué (références dupliquées ?)`);
          }
        },
      });
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Erreur lors de l'import CSV");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `reference,nom,ean,prix,poids,stock_min,stock_max,description,categorie
PROD-001,Produit Exemple,1234567890123,9.99,0.5,10,100,Description du produit,1
CONSO-001,Carton Standard,9876543210987,0.50,0.2,50,500,Carton d'emballage,2`;
    
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_produits.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importer CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des produits via CSV</DialogTitle>
          <DialogDescription>
            Importez plusieurs produits en masse depuis un fichier CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span className="text-sm font-medium">Modèle CSV</span>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              Télécharger le modèle
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Format CSV attendu :</label>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>• <strong>reference</strong> (obligatoire) : SKU unique du produit</div>
              <div>• <strong>nom</strong> (obligatoire) : Nom du produit</div>
              <div>• <strong>ean</strong> : Code-barres EAN</div>
              <div>• <strong>prix</strong> : Prix unitaire</div>
              <div>• <strong>poids</strong> : Poids en kg</div>
              <div>• <strong>stock_min</strong> : Stock minimum</div>
              <div>• <strong>stock_max</strong> : Stock maximum</div>
              <div>• <strong>description</strong> : Description du produit</div>
              <div>• <strong>categorie</strong> : 1=Produit normal, 2=Consommable</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Fichier CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Aperçu (5 premières lignes)</label>
                <Badge variant="secondary">{preview.length} ligne(s)</Badge>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Référence</th>
                      <th className="p-2 text-left">Nom</th>
                      <th className="p-2 text-left">EAN</th>
                      <th className="p-2 text-right">Prix</th>
                      <th className="p-2 text-center">Validité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row: any, index) => {
                      const ref = row.reference || row.Reference || row.SKU || row.sku;
                      const nom = row.nom || row.Nom || row.name || row.Name;
                      const isValid = ref && nom;
                      
                      return (
                        <tr key={index} className="border-t">
                          <td className="p-2 font-mono text-xs">{ref || "-"}</td>
                          <td className="p-2">{nom || "-"}</td>
                          <td className="p-2 font-mono text-xs">{row.ean || row.EAN || "-"}</td>
                          <td className="p-2 text-right">{row.prix || row.price || "-"}</td>
                          <td className="p-2 text-center">
                            {isValid ? (
                              <Check className="h-4 w-4 text-green-500 inline" />
                            ) : (
                              <X className="h-4 w-4 text-red-500 inline" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!file || importing}
            >
              {importing ? "Import en cours..." : "Importer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};