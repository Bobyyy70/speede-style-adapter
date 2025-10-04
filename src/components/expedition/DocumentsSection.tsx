import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Download, ChevronDown, Loader2, Package, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface DocumentsSectionProps {
  commandeId: string;
  commande: any;
}

const COUNTRIES_UE = [
  "FR", "DE", "IT", "ES", "BE", "NL", "LU", "AT", "PT", "IE", "DK", "SE", "FI",
  "GR", "PL", "CZ", "HU", "SK", "SI", "RO", "BG", "HR", "EE", "LV", "LT", "CY", "MT"
];

export const DocumentsSection = ({ commandeId, commande }: DocumentsSectionProps) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState<string | null>(null);

  // Fetch documents existants
  const { data: documents, refetch } = useQuery({
    queryKey: ["documents_commande", commandeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_commande")
        .select("*")
        .eq("commande_id", commandeId)
        .order("date_generation", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const isHorsUE = commande?.pays_code && !COUNTRIES_UE.includes(commande.pays_code.toUpperCase());

  const documentTypes = [
    {
      categorie: "douane",
      label: "Douane",
      icon: FileText,
      docs: [
        { type: "cn23", label: "CN23 - Déclaration douane", required: isHorsUE },
        { type: "invoice", label: "Facture commerciale", required: isHorsUE },
      ],
    },
    {
      categorie: "transport",
      label: "Transport",
      icon: Package,
      docs: [
        { type: "packing_list", label: "Packing List (Bordereau de colisage)", required: true },
        { type: "delivery_note", label: "Bon de livraison", required: false },
      ],
    },
    {
      categorie: "interne",
      label: "Interne WMS",
      icon: FileText,
      docs: [
        { type: "picking_slip", label: "Bordereau de préparation", required: true },
      ],
    },
  ];

  const handleGenerateDocument = async (type: string) => {
    setGenerating(type);
    try {
      const { data, error } = await supabase.functions.invoke(`generate-${type}`, {
        body: { commandeId },
      });

      if (error) throw error;

      toast({
        title: "Document généré",
        description: `Le document ${type} a été créé avec succès`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(null);
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents-commande")
        .createSignedUrl(doc.url_fichier.replace("documents-commande/", ""), 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
        toast({ title: "Document ouvert" });
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({ title: "Erreur lors du téléchargement", variant: "destructive" });
    }
  };

  const handleDownloadAll = async () => {
    if (!documents || documents.length === 0) {
      toast({ title: "Aucun document à télécharger", variant: "destructive" });
      return;
    }

    setGenerating("download_all");
    toast({ title: "Préparation du téléchargement..." });

    try {
      const downloadPromises = documents.map(async (doc) => {
        const { data, error } = await supabase.storage
          .from("documents-commande")
          .createSignedUrl(doc.url_fichier.replace("documents-commande/", ""), 60);
        
        if (error) throw error;
        return { url: data?.signedUrl, name: doc.nom_fichier };
      });

      const urls = await Promise.all(downloadPromises);
      
      // Open each URL in a new tab (browser will handle downloads)
      urls.forEach(({ url }) => {
        if (url) window.open(url, "_blank");
      });

      toast({ title: `${documents.length} document(s) téléchargé(s)` });
    } catch (error) {
      console.error("Error downloading all documents:", error);
      toast({ title: "Erreur lors du téléchargement groupé", variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const getDocumentForType = (type: string) => {
    return documents?.find((d) => d.type_document === type);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents logistiques
          </CardTitle>
          {documents && documents.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownloadAll}
              disabled={generating === "download_all"}
            >
              {generating === "download_all" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Télécharger tout
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isHorsUE && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              ⚠️ Commande hors UE - Documents douaniers obligatoires
            </p>
          </div>
        )}

        {documentTypes.map((category) => (
          <Collapsible key={category.categorie} defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <category.icon className="h-4 w-4" />
                <span className="font-semibold">{category.label}</span>
              </div>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {category.docs.map((docType) => {
                const existingDoc = getDocumentForType(docType.type);
                return (
                  <div
                    key={docType.type}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{docType.label}</span>
                      {docType.required && (
                        <Badge variant="destructive" className="text-xs">Obligatoire</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {existingDoc ? (
                        <>
                          <Badge variant="default" className="text-xs">Disponible</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(existingDoc)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleGenerateDocument(docType.type)}
                          disabled={generating === docType.type}
                        >
                          {generating === docType.type ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <FileText className="h-3 w-3 mr-1" />
                          )}
                          Générer
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
};
