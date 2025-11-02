import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Package, MapPin, Truck, Clock, ArrowRight, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStatutTransition } from '@/hooks/useStatutTransition';
import { TransitionTimeline } from './TransitionTimeline';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AttenduDetailDialogProps {
  attenduId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttenduDetailDialog({ attenduId, open, onOpenChange }: AttenduDetailDialogProps) {
  const [attendu, setAttendu] = useState<any>(null);
  const [lignes, setLignes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [historique, setHistorique] = useState<any[]>([]);
  const [historiqueLoading, setHistoriqueLoading] = useState(false);

  const { transitionStatut, subscribeToStatutChanges, fetchTransitionHistory } = useStatutTransition();

  useEffect(() => {
    if (attenduId && open) {
      fetchAttenduDetails();
      fetchHistorique();
    }
  }, [attenduId, open]);

  // Realtime subscription
  useEffect(() => {
    if (!attenduId || !open) return;

    const unsubscribe = subscribeToStatutChanges('attendu', (payload) => {
      if (payload.new.id === attenduId) {
        console.log('[Realtime] Attendu updated:', payload.new);
        toast.info(`Statut mis à jour: ${payload.new.statut}`);
        fetchAttenduDetails();
        fetchHistorique();
      }
    });

    return () => unsubscribe();
  }, [attenduId, open]);

  const fetchAttenduDetails = async () => {
    if (!attenduId) return;

    setLoading(true);
    try {
      const { data: attenduData, error: attenduError } = await supabase
        .from('attendu_reception')
        .select('*')
        .eq('id', attenduId)
        .single();

      if (attenduError) throw attenduError;
      setAttendu(attenduData);

      const { data: lignesData, error: lignesError } = await supabase
        .from('ligne_attendu_reception')
        .select('*')
        .eq('attendu_reception_id', attenduId);

      if (lignesError) throw lignesError;
      setLignes(lignesData || []);
    } catch (error: any) {
      console.error('Erreur fetch attendu:', error);
      toast.error('Impossible de charger les détails de l\'attendu');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorique = async () => {
    if (!attenduId) return;

    setHistoriqueLoading(true);
    try {
      const data = await fetchTransitionHistory('attendu', attenduId);
      setHistorique(data);
    } catch (error: any) {
      console.error('Erreur fetch historique:', error);
    } finally {
      setHistoriqueLoading(false);
    }
  };

  const handleStatusChange = async (nouveauStatut: string) => {
    if (!attendu) return;

    setStatusChanging(true);
    try {
      await transitionStatut('attendu', attendu.id, nouveauStatut);
      fetchAttenduDetails();
      fetchHistorique();
    } catch (error: any) {
      // Error already handled by useStatutTransition
    } finally {
      setStatusChanging(false);
    }
  };

  const getTransitionsPossibles = (currentStatut: string): string[] => {
    const transitions: Record<string, string[]> = {
      prévu: ['en_transit', 'annulé'],
      en_transit: ['arrivé', 'prévu', 'annulé'],
      arrivé: ['en_cours_réception'],
      en_cours_réception: ['réceptionné_partiellement', 'réceptionné_totalement', 'anomalie'],
      réceptionné_partiellement: ['réceptionné_totalement', 'anomalie'],
      anomalie: ['en_cours_réception', 'réceptionné_totalement'],
      réceptionné_totalement: ['clôturé'],
    };
    return transitions[currentStatut] || [];
  };

  const getStatutBadgeVariant = (statut: string) => {
    const variants: Record<string, any> = {
      prévu: 'outline',
      en_transit: 'secondary',
      arrivé: 'default',
      en_cours_réception: 'secondary',
      réceptionné_partiellement: 'default',
      réceptionné_totalement: 'default',
      anomalie: 'destructive',
      annulé: 'destructive',
      clôturé: 'outline',
    };
    return variants[statut] || 'secondary';
  };

  const transitionsPossibles = attendu ? getTransitionsPossibles(attendu.statut) : [];

  if (!attendu) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            {loading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            ) : (
              <p className="text-muted-foreground">Aucun attendu sélectionné</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-muted-foreground" />
              <DialogTitle className="text-2xl">
                Attendu {attendu.numero_attendu}
              </DialogTitle>
              <Badge variant={getStatutBadgeVariant(attendu.statut)} className="text-base px-3 py-1">
                {attendu.statut}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* BARRE D'ACTIONS */}
        {transitionsPossibles && transitionsPossibles.length > 0 && (
          <div className="flex items-center gap-2 py-3 border-t border-b bg-muted/30 -mx-6 px-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" disabled={statusChanging}>
                  {statusChanging ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Changer le statut
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Transitions possibles</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {transitionsPossibles.map((statut) => (
                  <DropdownMenuItem key={statut} onClick={() => handleStatusChange(statut)}>
                    <ArrowRight className="h-3 w-3 mr-2" />
                    {statut}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="produits">Produits</TabsTrigger>
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
                    <p className="text-sm text-muted-foreground">Fournisseur</p>
                    <p className="font-medium">{attendu.fournisseur}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date de création</p>
                    <p className="font-medium">
                      {format(new Date(attendu.date_creation), "dd MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  {attendu.date_reception_prevue && (
                    <div>
                      <p className="text-sm text-muted-foreground">Date prévue</p>
                      <p className="font-medium">
                        {format(new Date(attendu.date_reception_prevue), "dd MMMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  )}
                  {attendu.date_arrivee_reelle && (
                    <div>
                      <p className="text-sm text-muted-foreground">Date d'arrivée réelle</p>
                      <p className="font-medium">
                        {format(new Date(attendu.date_arrivee_reelle), "dd MMMM yyyy HH:mm", { locale: fr })}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre de palettes</p>
                    <p className="font-medium">{attendu.nombre_palettes || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre de colis</p>
                    <p className="font-medium">{attendu.nombre_colis || 0}</p>
                  </div>
                </div>
                {attendu.remarques && (
                  <div>
                    <p className="text-sm text-muted-foreground">Remarques</p>
                    <p className="text-sm whitespace-pre-wrap">{attendu.remarques}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {attendu.transporteur && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Transport
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Transporteur</p>
                      <p className="font-medium">{attendu.transporteur}</p>
                    </div>
                    {attendu.numero_tracking && (
                      <div>
                        <p className="text-sm text-muted-foreground">Numéro de tracking</p>
                        <p className="font-mono text-sm">{attendu.numero_tracking}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="produits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Produits Attendus</CardTitle>
                <CardDescription>{lignes.length} produit(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Qté Attendue</TableHead>
                      <TableHead>Qté Reçue</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignes.map((ligne) => (
                      <TableRow key={ligne.id}>
                        <TableCell className="font-mono text-sm">{ligne.produit_reference}</TableCell>
                        <TableCell>{ligne.produit_nom}</TableCell>
                        <TableCell>{ligne.quantite_attendue}</TableCell>
                        <TableCell>{ligne.quantite_recue || 0}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ligne.statut_ligne}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historique" className="space-y-4">
            <TransitionTimeline transitions={historique} loading={historiqueLoading} />
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
