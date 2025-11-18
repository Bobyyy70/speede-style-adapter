import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Euro,
  TrendingUp,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Download,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface DashboardStats {
  periode_annee: number;
  periode_mois: number;
  nb_factures: number;
  nb_clients_factures: number;
  ca_ht: number;
  ca_ttc: number;
  encaisse: number;
  en_attente: number;
  en_retard: number;
  taux_paiement_pct: number;
}

interface FactureClient {
  facture_id: string;
  numero_facture: string;
  client_id: string;
  client_nom: string;
  periode_mois: number;
  periode_annee: number;
  date_emission: string;
  date_echeance: string;
  montant_ht: number;
  montant_ttc: number;
  statut_paiement: string;
  date_paiement?: string;
}

interface ClientStats {
  client_id: string;
  client_nom: string;
  nb_factures: number;
  total_ht: number;
  total_ttc: number;
  total_paye: number;
  total_en_attente: number;
  taux_paiement_pct: number;
}

const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const getStatutBadge = (statut: string) => {
  switch (statut) {
    case 'payee':
      return { label: 'Payée', icon: CheckCircle2, variant: 'default' as const, color: 'text-green-600' };
    case 'en_attente':
      return { label: 'En attente', icon: Clock, variant: 'secondary' as const, color: 'text-blue-600' };
    case 'en_retard':
      return { label: 'En retard', icon: AlertCircle, variant: 'destructive' as const, color: 'text-orange-600' };
    case 'annulee':
      return { label: 'Annulée', icon: XCircle, variant: 'outline' as const, color: 'text-gray-600' };
    default:
      return { label: statut, icon: Clock, variant: 'secondary' as const, color: 'text-gray-600' };
  }
};

export default function DashboardFacturation() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');

  // Fetch global stats
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard-facturation', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_dashboard_facturation')
        .select('*')
        .eq('periode_annee', selectedYear)
        .order('periode_mois', { ascending: false });

      if (error) throw error;
      return data as DashboardStats[];
    },
  });

  // Fetch all invoices for the year
  const { data: factures } = useQuery({
    queryKey: ['factures-all', selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from('facturation_mensuelle')
        .select(`
          id,
          numero_facture,
          client_id,
          client:client_id (nom),
          periode_mois,
          periode_annee,
          date_emission,
          date_echeance,
          montant_ht,
          montant_ttc,
          statut_paiement,
          date_paiement
        `)
        .eq('periode_annee', selectedYear)
        .order('date_emission', { ascending: false });

      if (selectedMonth !== 'all') {
        query = query.eq('periode_mois', selectedMonth);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((f: any) => ({
        facture_id: f.id,
        numero_facture: f.numero_facture,
        client_id: f.client_id,
        client_nom: f.client?.nom || 'Client inconnu',
        periode_mois: f.periode_mois,
        periode_annee: f.periode_annee,
        date_emission: f.date_emission,
        date_echeance: f.date_echeance,
        montant_ht: f.montant_ht,
        montant_ttc: f.montant_ttc,
        statut_paiement: f.statut_paiement,
        date_paiement: f.date_paiement,
      })) as FactureClient[];
    },
  });

  // Fetch client stats
  const { data: clientStats } = useQuery({
    queryKey: ['client-stats', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_stats_facturation_par_client', {
        p_annee: selectedYear,
      });

      if (error) throw error;
      return data as ClientStats[];
    },
  });

  // Calculate aggregated stats
  const yearStats = dashboardStats?.reduce(
    (acc, stat) => ({
      nb_factures: acc.nb_factures + stat.nb_factures,
      ca_ht: acc.ca_ht + stat.ca_ht,
      ca_ttc: acc.ca_ttc + stat.ca_ttc,
      encaisse: acc.encaisse + stat.encaisse,
      en_attente: acc.en_attente + stat.en_attente,
      en_retard: acc.en_retard + stat.en_retard,
    }),
    { nb_factures: 0, ca_ht: 0, ca_ttc: 0, encaisse: 0, en_attente: 0, en_retard: 0 }
  );

  const taux_paiement_global = yearStats
    ? yearStats.ca_ttc > 0
      ? ((yearStats.encaisse / yearStats.ca_ttc) * 100).toFixed(1)
      : '0.0'
    : '0.0';

  const handleExportData = () => {
    if (!factures) return;

    // Prepare CSV data
    const headers = ['N° Facture', 'Client', 'Période', 'Date Émission', 'Date Échéance', 'Montant HT', 'Montant TTC', 'Statut', 'Date Paiement'];
    const rows = factures.map(f => [
      f.numero_facture,
      f.client_nom,
      `${MOIS_LABELS[f.periode_mois - 1]} ${f.periode_annee}`,
      format(new Date(f.date_emission), 'dd/MM/yyyy'),
      format(new Date(f.date_echeance), 'dd/MM/yyyy'),
      `${f.montant_ht.toFixed(2)} €`,
      `${f.montant_ttc.toFixed(2)} €`,
      getStatutBadge(f.statut_paiement).label,
      f.date_paiement ? format(new Date(f.date_paiement), 'dd/MM/yyyy') : '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `factures_${selectedYear}${selectedMonth !== 'all' ? `_${selectedMonth}` : ''}.csv`;
    link.click();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Facturation</h1>
          <p className="text-muted-foreground mt-1">
            Analyse complète du chiffre d'affaires et suivi des paiements
          </p>
        </div>
        <div className="flex gap-3">
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4].map((offset) => {
                const year = currentYear - offset;
                return (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => setSelectedMonth(value === 'all' ? 'all' : parseInt(value))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les mois</SelectItem>
              {MOIS_LABELS.map((label, index) => (
                <SelectItem key={index + 1} value={(index + 1).toString()}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExportData}>
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Euro className="w-4 h-4" />
              CA Total TTC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {yearStats?.ca_ttc.toFixed(2) || '0.00'} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              HT: {yearStats?.ca_ht.toFixed(2) || '0.00'} €
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Encaissé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {yearStats?.encaisse.toFixed(2) || '0.00'} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Taux: {taux_paiement_global}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              En Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {yearStats?.en_attente.toFixed(2) || '0.00'} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              À encaisser
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              En Retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {yearStats?.en_retard.toFixed(2) || '0.00'} €
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Nécessite relance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Évolution Mensuelle {selectedYear}
          </CardTitle>
          <CardDescription>
            Chiffre d'affaires et taux de paiement par mois
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dashboardStats && dashboardStats.length > 0 ? (
              dashboardStats.map((stat) => {
                const maxCA = Math.max(...dashboardStats.map(s => s.ca_ttc));
                const barWidth = maxCA > 0 ? (stat.ca_ttc / maxCA) * 100 : 0;

                return (
                  <div key={`${stat.periode_annee}-${stat.periode_mois}`} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium w-24">
                        {MOIS_LABELS[stat.periode_mois - 1]}
                      </span>
                      <span className="text-muted-foreground">
                        {stat.nb_factures} facture{stat.nb_factures > 1 ? 's' : ''}
                      </span>
                      <span className="font-semibold w-32 text-right">
                        {stat.ca_ttc.toFixed(2)} €
                      </span>
                      <span className="text-muted-foreground w-20 text-right">
                        {stat.taux_paiement_pct.toFixed(0)}% payé
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Aucune donnée pour {selectedYear}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Client Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Statistiques par Client
          </CardTitle>
          <CardDescription>
            Analyse du CA et taux de paiement par client
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-center">Nb Factures</TableHead>
                <TableHead className="text-right">CA HT</TableHead>
                <TableHead className="text-right">CA TTC</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">En Attente</TableHead>
                <TableHead className="text-right">Taux Paiement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientStats && clientStats.length > 0 ? (
                clientStats.map((client) => (
                  <TableRow key={client.client_id}>
                    <TableCell className="font-medium">{client.client_nom}</TableCell>
                    <TableCell className="text-center">{client.nb_factures}</TableCell>
                    <TableCell className="text-right">{client.total_ht.toFixed(2)} €</TableCell>
                    <TableCell className="text-right font-medium">{client.total_ttc.toFixed(2)} €</TableCell>
                    <TableCell className="text-right text-green-600">{client.total_paye.toFixed(2)} €</TableCell>
                    <TableCell className="text-right text-blue-600">{client.total_en_attente.toFixed(2)} €</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={client.taux_paiement_pct >= 80 ? 'default' : 'destructive'}>
                        {client.taux_paiement_pct.toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucune donnée disponible
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* All Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Liste des Factures
          </CardTitle>
          <CardDescription>
            {selectedMonth === 'all'
              ? `Toutes les factures de ${selectedYear}`
              : `Factures de ${MOIS_LABELS[(selectedMonth as number) - 1]} ${selectedYear}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Date Émission</TableHead>
                <TableHead>Date Échéance</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date Paiement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factures && factures.length > 0 ? (
                factures.map((facture) => {
                  const statutInfo = getStatutBadge(facture.statut_paiement);
                  const StatutIcon = statutInfo.icon;

                  return (
                    <TableRow key={facture.facture_id}>
                      <TableCell className="font-mono font-medium">
                        {facture.numero_facture}
                      </TableCell>
                      <TableCell>{facture.client_nom}</TableCell>
                      <TableCell>
                        {MOIS_LABELS[facture.periode_mois - 1]} {facture.periode_annee}
                      </TableCell>
                      <TableCell>
                        {format(new Date(facture.date_emission), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(facture.date_echeance), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {facture.montant_ttc.toFixed(2)} €
                      </TableCell>
                      <TableCell>
                        <Badge variant={statutInfo.variant} className="gap-1">
                          <StatutIcon className="w-3 h-3" />
                          {statutInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {facture.date_paiement ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(facture.date_paiement), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Aucune facture trouvée
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
