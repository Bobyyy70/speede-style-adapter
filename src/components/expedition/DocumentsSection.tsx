import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Download, ChevronDown, Loader2, Package, Archive, Sparkles, Mail, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { CustomsValidation } from "./CustomsValidation";
import { useThermalPrinter } from "@/hooks/useThermalPrinter";

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
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [sendingCustomsDocs, setSendingCustomsDocs] = useState(false);
  const { print, isPrinting, printers, hasPickingPrinter, hasShippingPrinter } = useThermalPrinter();

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

  // Fetch session de préparation associée
  const { data: session } = useQuery({
    queryKey: ["session_commande", commandeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_commande")
        .select(`
          *,
          session_preparation:session_id (
            id,
            nom_session,
            statut
          )
        `)
        .eq("commande_id", commandeId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!commandeId,
  });

  const isHorsUE = commande?.pays_code && !COUNTRIES_UE.includes(commande.pays_code.toUpperCase());

  // Auto-génération des documents douaniers pour les expéditions internationales
  useEffect(() => {
    const autoGenerateCustomsDocs = async () => {
      if (!isHorsUE || autoGenerating) return;
      
      // Vérifier si CN23 et packing list existent déjà
      const hasCN23 = documents?.some(d => d.type_document === 'cn23');
      const hasPackingList = documents?.some(d => d.type_document === 'packing_list');
      
      if (hasCN23 && hasPackingList) return;

      // Vérifier que toutes les infos sont présentes
      const isValid = 
        commande.adresse_nom &&
        commande.adresse_ligne_1 &&
        commande.code_postal &&
        commande.ville &&
        commande.pays_code &&
        commande.valeur_totale > 0 &&
        commande.poids_total > 0 &&
        commande.lignes?.every((l: any) => l.poids_unitaire > 0 && l.prix_unitaire > 0);

      if (!isValid) return;

      setAutoGenerating(true);
      
      try {
        const docsToGenerate = [];
        if (!hasPackingList) docsToGenerate.push('packing-list');
        if (!hasCN23) docsToGenerate.push('cn23');

        // Générer avec envoi automatique des emails
        for (const docType of docsToGenerate) {
          await handleGenerateDocument(docType, true);
        }

        toast({
          title: "Documents générés automatiquement",
          description: `${docsToGenerate.length} document(s) douanier(s) créé(s) et envoyé(s) par email`,
        });
      } catch (error: any) {
        console.error('Auto-generation error:', error);
      } finally {
        setAutoGenerating(false);
      }
    };

    autoGenerateCustomsDocs();
  }, [commandeId, isHorsUE, documents, commande, autoGenerating]);

  const documentTypes = [
    {
      categorie: "interne",
      label: "Préparation",
      icon: Package,
      docs: [
        { type: "picking_slip", label: "Bon de picking (préparation)", required: true },
      ],
    },
    {
      categorie: "transport",
      label: "Transport & Expédition",
      icon: FileText,
      docs: [
        { type: "packing_list", label: "Packing List (Bordereau de colisage)", required: true },
        { type: "delivery_note", label: "Bon de livraison", required: true },
        { type: "transport_ticket", label: "Ticket de transport", required: false },
      ],
    },
    {
      categorie: "douane",
      label: "Douane & Facturation",
      icon: FileText,
      docs: [
        { type: "invoice", label: "Facture commerciale", required: true },
        { type: "cn23", label: "CN23 - Déclaration douane", required: isHorsUE },
      ],
    },
  ];

  const handleGenerateDocument = async (type: string, autoSendEmail = false) => {
    setGenerating(type);
    try {
      const { data, error } = await supabase.functions.invoke(`generate-${type}`, {
        body: { 
          commandeId,
          auto_send_email: autoSendEmail 
        },
      });

      if (error) throw error;

      // Vérifier si c'est une erreur de validation
      if (data?.status === 'validation_failed') {
        toast({
          title: "Validation échouée",
          description: data.details?.join(', ') || data.error,
          variant: "destructive",
        });
        return;
      }

      if (data?.email_scheduled) {
        toast({
          title: "Document généré",
          description: `Le document ${type} a été créé et sera envoyé par email`,
        });
      } else {
        toast({
          title: "Document généré",
          description: `Le document ${type} a été créé avec succès`,
        });
      }

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

  const handleSendCustomsDocuments = async () => {
    setSendingCustomsDocs(true);
    try {
      console.log('📧 Envoi des documents douaniers pour commande:', commandeId);

      const { data, error } = await supabase.functions.invoke('send-customs-documents', {
        body: {
          commande_id: commandeId,
          send_to_client: true,
          send_to_carrier: false,
        }
      });

      if (error) throw error;

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;

        toast({
          title: "Documents douaniers envoyés",
          description: `${successCount}/${totalCount} email(s) envoyé(s) avec succès`,
        });
      } else {
        throw new Error(data?.error || "Erreur lors de l'envoi");
      }
    } catch (error: any) {
      console.error('❌ Erreur envoi documents douaniers:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer les documents",
        variant: "destructive",
      });
    } finally {
      setSendingCustomsDocs(false);
    }
  };

  const handleThermalPrint = (docType: string) => {
    // Mapper les types de documents vers les types supportés par useThermalPrinter
    const typeMapping: Record<string, any> = {
      'picking_slip': 'picking_slip',
      'packing_list': 'packing_list',
      'shipping_label': 'shipping_label',
    };

    const thermalDocType = typeMapping[docType];
    if (!thermalDocType) {
      toast({
        title: "Type non supporté",
        description: "Ce type de document n'est pas encore supporté pour l'impression thermique",
        variant: "destructive",
      });
      return;
    }

    print({
      commandeId,
      documentType: thermalDocType,
      format: 'html_thermal',
      autoOpen: true,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents logistiques
            {autoGenerating && (
              <Badge variant="outline" className="ml-2">
                <Sparkles className="h-3 w-3 mr-1 animate-pulse" />
                Génération auto...
              </Badge>
            )}
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
        {/* Session de préparation */}
        {session?.session_preparation && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">Session: {session.session_preparation.nom_session}</div>
                  <div className="text-xs text-muted-foreground">
                    Statut: <Badge variant="outline" className="ml-1">{session.session_preparation.statut}</Badge>
                  </div>
                </div>
              </div>
              {session.session_id && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(`/preparation?session=${session.session_id}`, '_blank')}
                >
                  Voir la session
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Validation douanière */}
        <CustomsValidation commande={commande} isHorsUE={isHorsUE} />

        {/* Envoi des documents douaniers par email */}
        {isHorsUE && documents?.some(d => d.type_document === 'cn23') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-sm font-semibold text-blue-900">Documents douaniers disponibles</div>
                  <div className="text-xs text-blue-700 mt-1">
                    CN23 et Packing List prêts à être envoyés par email
                  </div>
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={handleSendCustomsDocuments}
                disabled={sendingCustomsDocs}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sendingCustomsDocs ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Envoyer au client
                  </>
                )}
              </Button>
            </div>
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
                          {/* Bouton d'impression thermique pour les types supportés */}
                          {(docType.type === 'picking_slip' || docType.type === 'packing_list') &&
                           printers && printers.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleThermalPrint(docType.type)}
                              disabled={isPrinting}
                              title="Imprimer sur imprimante thermique"
                            >
                              {isPrinting ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Printer className="h-3 w-3 mr-1" />
                              )}
                              Thermique
                            </Button>
                          )}
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
