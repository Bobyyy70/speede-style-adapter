import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Calendar, CreditCard, Euro, TrendingUp, Loader2, Eye, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Facture {
  facture_id: string;
  numero_facture: string;
  periode_mois: number;
  periode_annee: number;
  date_emission: string;
  date_echeance: string;
  montant_ht: number;
  montant_ttc: number;
  statut_paiement: string;
  nb_lignes: number;
}

interface LigneFacture {
  id: string;
  type_prestation: string;
  description: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  total: number;
  periode_debut: string;
  periode_fin: string;
}

const getMoisLabel = (mois: number): string => {
  const moisLabels = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  return moisLabels[mois - 1] || "";
};

const getStatutBadge = (statut: string) => {
  const variants: Record<string, { label: string; className: string; icon: any }> = {
    'en_attente': { label: 'En attente', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
    'payee': { label: 'Payée', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
    'en_retard': { label: 'En retard', className: 'bg-red-100 text-red-800', icon: XCircle },
    'annulee': { label: 'Annulée', className: 'bg-gray-100 text-gray-800', icon: XCircle },
  };
  return variants[statut] || variants['en_attente'];
};

export default function MaFacturation() {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Récupérer le client_id de l'utilisateur connecté
  const { data: profile } = useQuery({
    queryKey: ['current-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Récupérer les factures
  const { data: factures, isLoading, refetch } = useQuery({
    queryKey: ['factures-client', profile?.client_id, selectedYear],
    enabled: !!profile?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_factures_client', {
        p_client_id: profile!.client_id,
        p_annee: selectedYear,
      });

      if (error) throw error;
      return data as Facture[];
    },
  });

  // Récupérer les lignes d'une facture
  const { data: lignesFacture, isLoading: loadingLignes } = useQuery({
    queryKey: ['lignes-facture', selectedFacture?.facture_id],
    enabled: !!selectedFacture?.facture_id && detailsDialogOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturation_ligne')
        .select('*')
        .eq('facture_id', selectedFacture!.facture_id)
        .order('ordre');

      if (error) throw error;
      return data as LigneFacture[];
    },
  });

  // Statistiques
  const stats = factures ? {
    total_ttc: factures.reduce((sum, f) => sum + f.montant_ttc, 0),
    total_payee: factures.filter(f => f.statut_paiement === 'payee').reduce((sum, f) => sum + f.montant_ttc, 0),
    total_en_attente: factures.filter(f => f.statut_paiement === 'en_attente').reduce((sum, f) => sum + f.montant_ttc, 0),
    total_en_retard: factures.filter(f => f.statut_paiement === 'en_retard').reduce((sum, f) => sum + f.montant_ttc, 0),
    nb_factures: factures.length,
  } : null;

  const handleViewDetails = (facture: Facture) => {
    setSelectedFacture(facture);
    setDetailsDialogOpen(true);
  };

  const handleDownloadPDF = (facture: Facture) => {
    toast({
      title: "Téléchargement PDF",
      description: "Fonctionnalité en cours de développement",
    });
  };

  const availableYears = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i
  );

  if (!profile?.client_id) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Aucun client associé à votre compte
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ma Facturation</h1>
            <p className="text-muted-foreground">
              Historique de facturation et prestations logistiques
            </p>
          </div>

          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Facturé</CardTitle>
                <Euro className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_ttc.toFixed(2)} €</div>
                <p className="text-xs text-muted-foreground">
                  {stats.nb_factures} facture(s)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Payé</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.total_payee.toFixed(2)} €
                </div>
                <p className="text-xs text-muted-foreground">
                  {((stats.total_payee / (stats.total_ttc || 1)) * 100).toFixed(0)}% du total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En attente</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.total_en_attente.toFixed(2)} €
                </div>
                <p className="text-xs text-muted-foreground">À régler</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En retard</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {stats.total_en_retard.toFixed(2)} €
                </div>
                <p className="text-xs text-muted-foreground">Échéance dépassée</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Liste des factures */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factures {selectedYear}
            </CardTitle>
            <CardDescription>
              Consultez et téléchargez vos factures
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : factures && factures.length > 0 ? (
              <div className="space-y-4">
                {factures.map((facture) => {
                  const statutInfo = getStatutBadge(facture.statut_paiement);
                  const StatutIcon = statutInfo.icon;

                  return (
                    <div
                      key={facture.facture_id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{facture.numero_facture}</h3>
                          <Badge className={`gap-1 ${statutInfo.className}`}>
                            <StatutIcon className="h-3 w-3" />
                            {statutInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {getMoisLabel(facture.periode_mois)} {facture.periode_annee}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {facture.nb_lignes} ligne(s)
                          </span>
                          <span>•</span>
                          <span>
                            Émise le {format(new Date(facture.date_emission), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                          <span>•</span>
                          <span>
                            Échéance: {format(new Date(facture.date_echeance), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">
                            {facture.montant_ht.toFixed(2)} € HT
                          </div>
                          <div className="text-lg font-bold">
                            {facture.montant_ttc.toFixed(2)} € TTC
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(facture)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Détails
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPDF(facture)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Aucune facture pour {selectedYear}</p>
                <p className="text-sm">
                  Les factures sont générées automatiquement le 1er de chaque mois
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Détails Facture */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedFacture?.numero_facture}
            </DialogTitle>
            <DialogDescription>
              Détails de la facture - {getMoisLabel(selectedFacture?.periode_mois || 1)} {selectedFacture?.periode_annee}
            </DialogDescription>
          </DialogHeader>

          {selectedFacture && (
            <div className="space-y-6">
              {/* Informations facture */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Date d'émission</div>
                  <div className="font-medium">
                    {format(new Date(selectedFacture.date_emission), 'dd MMMM yyyy', { locale: fr })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Date d'échéance</div>
                  <div className="font-medium">
                    {format(new Date(selectedFacture.date_echeance), 'dd MMMM yyyy', { locale: fr })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Statut</div>
                  <Badge className={`${getStatutBadge(selectedFacture.statut_paiement).className} mt-1`}>
                    {getStatutBadge(selectedFacture.statut_paiement).label}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Lignes de facturation */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Détail des prestations</h3>

                {loadingLignes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : lignesFacture && lignesFacture.length > 0 ? (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted/50 rounded-md text-sm font-medium">
                      <div className="col-span-5">Prestation</div>
                      <div className="col-span-2 text-right">Quantité</div>
                      <div className="col-span-2 text-right">Prix unitaire</div>
                      <div className="col-span-3 text-right">Total</div>
                    </div>

                    {/* Lignes */}
                    {lignesFacture.map((ligne) => (
                      <div
                        key={ligne.id}
                        className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-md hover:bg-muted/20"
                      >
                        <div className="col-span-5">
                          <div className="font-medium">{ligne.description}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {ligne.type_prestation}
                          </div>
                        </div>
                        <div className="col-span-2 text-right">
                          {ligne.quantite.toFixed(2)} {ligne.unite}
                        </div>
                        <div className="col-span-2 text-right">
                          {ligne.prix_unitaire.toFixed(2)} €
                        </div>
                        <div className="col-span-3 text-right font-semibold">
                          {ligne.total.toFixed(2)} €
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune ligne de facturation
                  </p>
                )}
              </div>

              <Separator />

              {/* Totaux */}
              <div className="space-y-2">
                <div className="flex justify-between text-lg">
                  <span className="text-muted-foreground">Total HT</span>
                  <span className="font-semibold">{selectedFacture.montant_ht.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>TVA (20%)</span>
                  <span>{(selectedFacture.montant_ttc - selectedFacture.montant_ht).toFixed(2)} €</span>
                </div>
                <Separator />
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total TTC</span>
                  <span className="text-primary">{selectedFacture.montant_ttc.toFixed(2)} €</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => handleDownloadPDF(selectedFacture)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
