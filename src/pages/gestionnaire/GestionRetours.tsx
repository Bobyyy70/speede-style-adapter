import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Truck,
  Eye,
  AlertCircle,
  Filter,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Retour {
  id: string;
  numero_retour: string;
  commande_id: string;
  numero_commande: string;
  client_nom: string;
  client_final_nom: string;
  client_final_email: string;
  statut: string;
  motif_retour: string;
  date_demande: string;
  date_reception?: string;
  montant_rembourse?: number;
  decision_retour?: string;
}

interface RetourDetail extends Retour {
  details_motif: string;
  photos_urls: string[];
  transporteur_retour: string;
  numero_tracking_retour: string;
  frais_retour: number;
  etat_produits_recu: string;
  notes_internes: string;
  lignes: Array<{
    id: string;
    produit_sku: string;
    produit_nom: string;
    quantite_demandee: number;
    quantite_recue: number;
    quantite_conforme: number;
    etat_produit: string;
  }>;
  historique: Array<{
    date: string;
    statut: string;
    commentaire: string;
  }>;
}

const STATUT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  demande_recue: { label: 'Demande reçue', icon: AlertCircle, color: 'text-orange-600' },
  validee: { label: 'Validée', icon: CheckCircle2, color: 'text-blue-600' },
  etiquette_generee: { label: 'Étiquette générée', icon: Package, color: 'text-cyan-600' },
  en_transit: { label: 'En transit', icon: Truck, color: 'text-purple-600' },
  recue: { label: 'Reçue', icon: Package, color: 'text-indigo-600' },
  en_controle: { label: 'En contrôle', icon: Clock, color: 'text-amber-600' },
  traitee: { label: 'Traitée', icon: CheckCircle2, color: 'text-green-600' },
  remboursee: { label: 'Remboursée', icon: CheckCircle2, color: 'text-emerald-600' },
  refusee: { label: 'Refusée', icon: XCircle, color: 'text-red-600' },
};

const MOTIFS_LABELS: Record<string, string> = {
  produit_defectueux: 'Produit défectueux',
  erreur_commande: 'Erreur de commande',
  taille_inadaptee: 'Taille inadaptée',
  produit_endommage: 'Produit endommagé',
  delai_livraison: 'Délai de livraison',
  changement_avis: 'Changement d\'avis',
  autre: 'Autre',
};

export default function GestionRetours() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filtreStatut, setFiltreStatut] = useState<string>('all');
  const [selectedRetour, setSelectedRetour] = useState<string | null>(null);
  const [updateStatut, setUpdateStatut] = useState('');
  const [updateCommentaire, setUpdateCommentaire] = useState('');

  // Fetch retours
  const { data: retours, isLoading } = useQuery({
    queryKey: ['retours', filtreStatut],
    queryFn: async () => {
      let query = supabase
        .from('retour')
        .select(`
          *,
          commande:commande_id(numero_commande),
          client:client_id(nom_entreprise)
        `)
        .order('date_demande', { ascending: false });

      if (filtreStatut !== 'all') {
        query = query.eq('statut', filtreStatut);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        numero_retour: r.numero_retour,
        commande_id: r.commande_id,
        numero_commande: r.commande?.numero_commande || 'N/A',
        client_nom: r.client?.nom_entreprise || 'N/A',
        client_final_nom: r.client_final_nom,
        client_final_email: r.client_final_email,
        statut: r.statut,
        motif_retour: r.motif_retour,
        date_demande: r.date_demande,
        date_reception: r.date_reception,
        montant_rembourse: r.montant_rembourse,
        decision_retour: r.decision_retour,
      })) as Retour[];
    },
  });

  // Fetch retour detail
  const { data: retourDetail } = useQuery({
    queryKey: ['retour-detail', selectedRetour],
    queryFn: async () => {
      if (!selectedRetour) return null;

      const { data: retour, error: retourError } = await supabase
        .from('retour')
        .select(`
          *,
          commande:commande_id(numero_commande),
          client:client_id(nom_entreprise)
        `)
        .eq('id', selectedRetour)
        .single();

      if (retourError) throw retourError;

      const { data: lignes, error: lignesError } = await supabase
        .from('retour_ligne')
        .select(`
          *,
          produit:produit_id(sku, nom)
        `)
        .eq('retour_id', selectedRetour);

      if (lignesError) throw lignesError;

      const { data: historique, error: histError } = await supabase
        .from('historique_statut_retour')
        .select('*')
        .eq('retour_id', selectedRetour)
        .order('created_at', { ascending: false });

      if (histError) throw histError;

      return {
        ...retour,
        numero_commande: retour.commande?.numero_commande || 'N/A',
        client_nom: retour.client?.nom_entreprise || 'N/A',
        lignes: (lignes || []).map((l: any) => ({
          id: l.id,
          produit_sku: l.produit?.sku || 'N/A',
          produit_nom: l.produit?.nom || 'N/A',
          quantite_demandee: l.quantite_demandee,
          quantite_recue: l.quantite_recue,
          quantite_conforme: l.quantite_conforme,
          etat_produit: l.etat_produit,
        })),
        historique: historique || [],
      } as RetourDetail;
    },
    enabled: !!selectedRetour,
  });

  // Update statut mutation
  const updateStatutMutation = useMutation({
    mutationFn: async ({ retourId, nouveauStatut, commentaire }: { retourId: string; nouveauStatut: string; commentaire?: string }) => {
      const updates: any = { statut: nouveauStatut };

      // Auto-set dates
      if (nouveauStatut === 'validee') updates.date_validation = new Date().toISOString();
      if (nouveauStatut === 'etiquette_generee') updates.date_etiquette_generee = new Date().toISOString();
      if (nouveauStatut === 'recue') updates.date_reception = new Date().toISOString();
      if (nouveauStatut === 'en_controle') updates.date_controle = new Date().toISOString();
      if (nouveauStatut === 'traitee') updates.date_traitement = new Date().toISOString();
      if (nouveauStatut === 'remboursee') updates.date_remboursement = new Date().toISOString();

      const { error } = await supabase
        .from('retour')
        .update(updates)
        .eq('id', retourId);

      if (error) throw error;

      // Add comment to historique if provided
      if (commentaire) {
        await supabase
          .from('historique_statut_retour')
          .insert({
            retour_id: retourId,
            nouveau_statut: nouveauStatut,
            commentaire,
          });
      }
    },
    onSuccess: () => {
      toast({ title: "Statut mis à jour" });
      queryClient.invalidateQueries({ queryKey: ['retours'] });
      queryClient.invalidateQueries({ queryKey: ['retour-detail'] });
      setUpdateStatut('');
      setUpdateCommentaire('');
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const getStatutBadge = (statut: string) => {
    const config = STATUT_LABELS[statut] || STATUT_LABELS.demande_recue;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className="gap-1">
        <Icon className={`w-3 h-3 ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  // Stats
  const stats = retours ? {
    total: retours.length,
    demandes_recues: retours.filter(r => r.statut === 'demande_recue').length,
    en_cours: retours.filter(r => !['traitee', 'remboursee', 'refusee'].includes(r.statut)).length,
    traitees: retours.filter(r => r.statut === 'traitee' || r.statut === 'remboursee').length,
  } : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Retours</h1>
          <p className="text-muted-foreground mt-1">
            Traitement et suivi des demandes de retours clients
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Retours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Nouvelles Demandes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.demandes_recues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                En Cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.en_cours}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Traitées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.traitees}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-64">
              <Label>Statut</Label>
              <Select value={filtreStatut} onValueChange={setFiltreStatut}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(STATUT_LABELS).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste retours */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Retours</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Retour</TableHead>
                <TableHead>N° Commande</TableHead>
                <TableHead>Client 3PL</TableHead>
                <TableHead>Client Final</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Date Demande</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Chargement...</TableCell>
                </TableRow>
              ) : retours && retours.length > 0 ? (
                retours.map((retour) => (
                  <TableRow key={retour.id}>
                    <TableCell className="font-mono font-medium">{retour.numero_retour}</TableCell>
                    <TableCell>{retour.numero_commande}</TableCell>
                    <TableCell>{retour.client_nom}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{retour.client_final_nom}</div>
                        <div className="text-muted-foreground">{retour.client_final_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{MOTIFS_LABELS[retour.motif_retour] || retour.motif_retour}</TableCell>
                    <TableCell>{format(new Date(retour.date_demande), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                    <TableCell>{getStatutBadge(retour.statut)}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRetour(retour.id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Détails
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Retour {retour.numero_retour}</DialogTitle>
                            <DialogDescription>
                              Détails complets et actions disponibles
                            </DialogDescription>
                          </DialogHeader>

                          {retourDetail && retourDetail.id === retour.id && (
                            <div className="space-y-6">
                              {/* Info générale */}
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Statut:</span>
                                  <div className="mt-1">{getStatutBadge(retourDetail.statut)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Commande origine:</span>
                                  <div className="font-mono mt-1">{retourDetail.numero_commande}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Client 3PL:</span>
                                  <div className="mt-1">{retourDetail.client_nom}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Motif:</span>
                                  <div className="mt-1">{MOTIFS_LABELS[retourDetail.motif_retour]}</div>
                                </div>
                                {retourDetail.details_motif && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Détails:</span>
                                    <div className="mt-1">{retourDetail.details_motif}</div>
                                  </div>
                                )}
                              </div>

                              {/* Produits */}
                              <div>
                                <h4 className="font-semibold mb-2">Produits retournés</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>SKU</TableHead>
                                      <TableHead>Produit</TableHead>
                                      <TableHead>Qté demandée</TableHead>
                                      <TableHead>Qté reçue</TableHead>
                                      <TableHead>État</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {retourDetail.lignes.map((ligne) => (
                                      <TableRow key={ligne.id}>
                                        <TableCell className="font-mono">{ligne.produit_sku}</TableCell>
                                        <TableCell>{ligne.produit_nom}</TableCell>
                                        <TableCell>{ligne.quantite_demandee}</TableCell>
                                        <TableCell>{ligne.quantite_recue || 0}</TableCell>
                                        <TableCell>
                                          {ligne.etat_produit ? (
                                            <Badge variant="outline">{ligne.etat_produit}</Badge>
                                          ) : (
                                            <span className="text-muted-foreground">-</span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>

                              {/* Changer statut */}
                              <div className="border rounded-lg p-4 space-y-4">
                                <h4 className="font-semibold">Changer le statut</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Nouveau statut</Label>
                                    <Select value={updateStatut} onValueChange={setUpdateStatut}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(STATUT_LABELS).map(([value, config]) => (
                                          <SelectItem key={value} value={value}>
                                            {config.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Commentaire (optionnel)</Label>
                                    <Input
                                      value={updateCommentaire}
                                      onChange={(e) => setUpdateCommentaire(e.target.value)}
                                      placeholder="Notes internes..."
                                    />
                                  </div>
                                </div>
                                <Button
                                  onClick={() => updateStatutMutation.mutate({
                                    retourId: retourDetail.id,
                                    nouveauStatut: updateStatut,
                                    commentaire: updateCommentaire || undefined,
                                  })}
                                  disabled={!updateStatut || updateStatutMutation.isPending}
                                >
                                  Mettre à jour le statut
                                </Button>
                              </div>

                              {/* Historique */}
                              {retourDetail.historique.length > 0 && (
                                <div>
                                  <h4 className="font-semibold mb-2">Historique</h4>
                                  <div className="space-y-2">
                                    {retourDetail.historique.map((event, idx) => (
                                      <div key={idx} className="flex items-start gap-2 text-sm border-l-2 pl-4">
                                        <div className="flex-1">
                                          <div className="font-medium">
                                            {STATUT_LABELS[event.statut]?.label || event.statut}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {format(new Date(event.date), 'PPP à HH:mm', { locale: fr })}
                                          </div>
                                          {event.commentaire && (
                                            <div className="text-xs mt-1">{event.commentaire}</div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Aucun retour trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
