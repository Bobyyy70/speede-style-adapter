import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { FileText, Download, RefreshCw, Package, Search, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function SendCloudDocuments() {
  const { userRole, user, getViewingClientId } = useAuth();
  const isClient = userRole === 'client';
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [fetchingDocs, setFetchingDocs] = useState<string | null>(null);

  // Fetch documents with commande data
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents_commande_all', searchTerm],
    queryFn: async () => {
      let clientId: string | null = null;
      const viewingClientId = getViewingClientId();
      
      if (viewingClientId) {
        clientId = viewingClientId;
      } else if (isClient && user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single();
        clientId = profileData?.client_id || null;
      }

      let query = supabase
        .from('document_commande')
        .select(`
          *,
          commande:commande_id (
            id,
            numero_commande,
            adresse_nom,
            sendcloud_shipment_id,
            statut_wms
          )
        `)
        .order('date_generation', { ascending: false });

      if (clientId) {
        query = query.eq('commande.client_id', clientId);
      }

      if (searchTerm) {
        query = query.or(`nom_fichier.ilike.%${searchTerm}%,commande.numero_commande.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Fetch all commandes for document fetching
  const { data: commandes } = useQuery({
    queryKey: ['commandes_with_sendcloud'],
    queryFn: async () => {
      let clientId: string | null = null;
      const viewingClientId = getViewingClientId();
      
      if (viewingClientId) {
        clientId = viewingClientId;
      } else if (isClient && user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single();
        clientId = profileData?.client_id || null;
      }

      let query = supabase
        .from('commande')
        .select('id, numero_commande, sendcloud_shipment_id, statut_wms')
        .not('sendcloud_shipment_id', 'is', null)
        .order('date_creation', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const fetchDocuments = async (commandeId: string) => {
    setFetchingDocs(commandeId);
    try {
      toast.info('Récupération des documents en cours...');
      const { data, error } = await supabase.functions.invoke('sendcloud-fetch-documents', {
        body: { commandeId }
      });

      if (error) throw error;

      toast.success(data.message || 'Documents récupérés avec succès');
      queryClient.invalidateQueries({ queryKey: ['documents_commande_all'] });
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error(error.message || 'Erreur lors de la récupération des documents');
    } finally {
      setFetchingDocs(null);
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents-commande')
        .createSignedUrl(doc.url_fichier, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
        toast.success('Document ouvert');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'label': 'Étiquette transport',
      'cn23': 'Déclaration CN23',
      'packing_list': 'Packing List',
      'invoice': 'Facture commerciale',
      'delivery_note': 'Bon de livraison',
      'picking_slip': 'Bon de picking',
    };
    return labels[type] || type;
  };

  const getCategorieLabel = (categorie: string) => {
    const labels: Record<string, string> = {
      'transport': 'Transport',
      'douane': 'Douane',
      'commercial': 'Commercial',
      'interne': 'Interne',
    };
    return labels[categorie] || categorie;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents SendCloud</h1>
          <p className="text-muted-foreground">
            Gestion centralisée des documents générés et récupérés depuis SendCloud
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documents?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Étiquettes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {documents?.filter(d => d.type_document === 'label').length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documents douane</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {documents?.filter(d => d.categorie === 'douane').length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commandes SendCloud</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{commandes?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Documents disponibles</CardTitle>
                <CardDescription>
                  Labels, CN23, factures commerciales et autres documents
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
                <Button 
                  variant="outline"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['documents_commande_all'] })}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Chargement...
              </div>
            ) : !documents || documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun document trouvé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commande</TableHead>
                    <TableHead>Type document</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Nom fichier</TableHead>
                    <TableHead>Date génération</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc: any) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        {doc.commande?.numero_commande || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getDocumentTypeLabel(doc.type_document)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getCategorieLabel(doc.categorie)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {doc.nom_fichier}
                      </TableCell>
                      <TableCell>
                        {new Date(doc.date_generation).toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(doc)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                          {doc.commande?.sendcloud_shipment_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(`/expedition?commande=${doc.commande.id}`, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {!isClient && commandes && commandes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Récupération automatique</CardTitle>
              <CardDescription>
                Récupérer les documents depuis SendCloud pour les commandes existantes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sélectionnez une commande pour récupérer automatiquement ses documents (label, CN23, etc.)
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Commande</TableHead>
                      <TableHead>SendCloud ID</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commandes.slice(0, 10).map((commande) => (
                      <TableRow key={commande.id}>
                        <TableCell className="font-medium">
                          {commande.numero_commande}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {commande.sendcloud_shipment_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{commande.statut_wms}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchDocuments(commande.id)}
                            disabled={fetchingDocs === commande.id}
                          >
                            {fetchingDocs === commande.id ? (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                Récupération...
                              </>
                            ) : (
                              <>
                                <Download className="h-3 w-3 mr-1" />
                                Récupérer docs
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
