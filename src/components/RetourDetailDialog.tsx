import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Package, MapPin, Truck, FileText, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface RetourDetailDialogProps {
  retourId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RetourDetailDialog({ retourId, open, onOpenChange }: RetourDetailDialogProps) {
  const [retour, setRetour] = useState<any>(null);
  const [lignes, setLignes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (retourId && open) {
      fetchRetourDetails();
    }
  }, [retourId, open]);

  const fetchRetourDetails = async () => {
    if (!retourId) return;
    
    setLoading(true);
    try {
      const { data: retourData, error: retourError } = await supabase
        .from('retour_produit')
        .select('*')
        .eq('id', retourId)
        .single();

      if (retourError) throw retourError;
      setRetour(retourData);

      const { data: lignesData, error: lignesError } = await supabase
        .from('ligne_retour_produit')
        .select('*')
        .eq('retour_id', retourId);

      if (lignesError) throw lignesError;
      setLignes(lignesData || []);
    } catch (error: any) {
      console.error('Erreur fetch retour:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails du retour",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadgeVariant = (statut: string) => {
    const variants: Record<string, any> = {
      'annonce': 'secondary',
      'etiquette_generee': 'outline',
      'en_transit': 'default',
      'recu': 'default',
      'en_inspection': 'secondary',
      'traite': 'default',
      'rembourse': 'default',
      'echange_envoye': 'default',
      'annule': 'destructive',
    };
    return variants[statut] || 'secondary';
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'remboursement': 'Remboursement',
      'echange': 'Échange',
      'avoir': 'Avoir',
      'reintegration_stock': 'Réintégration stock',
    };
    return labels[action] || action;
  };

  const getEtatLabel = (etat: string) => {
    const labels: Record<string, string> = {
      'neuf': 'Neuf',
      'bon_etat': 'Bon état',
      'endommage': 'Endommagé',
      'inutilisable': 'Inutilisable',
    };
    return labels[etat] || etat;
  };

  if (!retour) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            {loading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            ) : (
              <p className="text-muted-foreground">Aucun retour sélectionné</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Retour {retour.numero_retour}</DialogTitle>
            <Badge variant={getStatutBadgeVariant(retour.statut_retour)}>
              {retour.statut_retour}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="produits">Produits</TabsTrigger>
            <TabsTrigger value="traitement">Traitement</TabsTrigger>
            <TabsTrigger value="historique">Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Informations Générales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{retour.client_nom}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date de création</p>
                    <p className="font-medium">
                      {new Date(retour.date_creation).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  {retour.date_retour && (
                    <div>
                      <p className="text-sm text-muted-foreground">Date de retour</p>
                      <p className="font-medium">
                        {new Date(retour.date_retour).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                  {retour.date_retour_prevue && (
                    <div>
                      <p className="text-sm text-muted-foreground">Date prévue</p>
                      <p className="font-medium">
                        {new Date(retour.date_retour_prevue).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Valeur totale</p>
                    <p className="font-medium">{retour.valeur_totale?.toFixed(2) || '0.00'} €</p>
                  </div>
                  {retour.raison_retour && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Raison</p>
                      <p className="font-medium">{retour.raison_retour}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {retour.adresse_retour_ligne_1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Adresse de Retour
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p>{retour.adresse_retour_ligne_1}</p>
                    {retour.adresse_retour_ligne_2 && <p>{retour.adresse_retour_ligne_2}</p>}
                    <p>
                      {retour.adresse_retour_code_postal} {retour.adresse_retour_ville}
                    </p>
                    {retour.adresse_retour_pays_code && <p>{retour.adresse_retour_pays_code}</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            {(retour.transporteur_retour || retour.numero_tracking_retour) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Informations Transport
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {retour.transporteur_retour && (
                    <div>
                      <p className="text-sm text-muted-foreground">Transporteur</p>
                      <p className="font-medium">{retour.transporteur_retour}</p>
                    </div>
                  )}
                  {retour.numero_tracking_retour && (
                    <div>
                      <p className="text-sm text-muted-foreground">Numéro de tracking</p>
                      <p className="font-mono text-sm">{retour.numero_tracking_retour}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {retour.instructions_retour && (
              <Card>
                <CardHeader>
                  <CardTitle>Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{retour.instructions_retour}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="produits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Produits Retournés</CardTitle>
                <CardDescription>{lignes.length} produit(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Raison</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignes.map((ligne) => (
                      <TableRow key={ligne.id}>
                        <TableCell className="font-mono text-sm">{ligne.produit_reference}</TableCell>
                        <TableCell>{ligne.produit_nom}</TableCell>
                        <TableCell>{ligne.quantite_retournee}</TableCell>
                        <TableCell>{ligne.raison_retour || '-'}</TableCell>
                        <TableCell>
                          {ligne.etat_produit ? (
                            <Badge variant="outline">{getEtatLabel(ligne.etat_produit)}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {ligne.action_souhaitee ? (
                            <Badge>{getActionLabel(ligne.action_souhaitee)}</Badge>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="traitement" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Traitement du Retour</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center text-muted-foreground py-8">
                  Fonctionnalité en cours de développement
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historique" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Historique
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                    <div>
                      <p className="font-medium">Retour créé</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(retour.date_creation).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  {retour.date_retour && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                      <div>
                        <p className="font-medium">Retour effectué</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(retour.date_retour).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}