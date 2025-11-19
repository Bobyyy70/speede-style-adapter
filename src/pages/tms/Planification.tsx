import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus,
  Package,
  Search,
  Filter,
  Truck,
  Ship,
  Plane,
  Train,
  MapPin,
  Calendar,
  DollarSign,
  Leaf,
  Sparkles,
} from 'lucide-react';
import {
  formatPlanStatut,
  formatModeTransport,
  formatMontant,
  formatDistance,
  formatCO2,
  formatPoids,
} from '@/lib/tmsHelpers';
import type { PlanTransportComplet, ModeTransport, CommandePreteTransport } from '@/types/tms';

export default function Planification() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCommande, setSelectedCommande] = useState<string>('');

  // Query: Plans de transport
  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans-transport', profile?.client_id, filterStatut],
    queryFn: async () => {
      let query = supabase
        .from('v_plan_transport_complet')
        .select('*')
        .order('date_creation', { ascending: false });

      if (filterStatut !== 'all') {
        query = query.eq('statut', filterStatut);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PlanTransportComplet[];
    },
    enabled: !!profile,
  });

  // Query: Modes de transport
  const { data: modes } = useQuery({
    queryKey: ['modes-transport'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mode_transport')
        .select('*')
        .eq('actif', true)
        .order('code');
      if (error) throw error;
      return data as ModeTransport[];
    },
  });

  // Query: Commandes prêtes pour transport
  const { data: commandesPrete } = useQuery({
    queryKey: ['commandes-prete-transport'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_commandes_prete_transport')
        .select('*')
        .is('plan_transport_id', null)
        .limit(50);
      if (error) throw error;
      return data as CommandePreteTransport[];
    },
  });

  // Mutation: Créer plan depuis commande
  const createPlanMutation = useMutation({
    mutationFn: async (commandeId: string) => {
      const { data, error } = await supabase.rpc('create_plan_for_commande', {
        p_commande_id: commandeId,
        p_mode_transport_code: 'ROAD',
        p_auto_select_carrier: true,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans-transport'] });
      queryClient.invalidateQueries({ queryKey: ['commandes-prete-transport'] });
      toast({
        title: 'Plan créé',
        description: 'Le plan de transport a été créé avec succès',
      });
      setCreateDialogOpen(false);
      setSelectedCommande('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filtrer les plans
  const filteredPlans = plans?.filter((plan) => {
    if (!searchTerm) return true;
    return (
      plan.numero_plan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.destination_adresse?.ville?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getModeIcon = (code?: string) => {
    switch (code) {
      case 'ROAD':
        return <Truck className="h-4 w-4" />;
      case 'SEA':
        return <Ship className="h-4 w-4" />;
      case 'AIR':
        return <Plane className="h-4 w-4" />;
      case 'RAIL':
        return <Train className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Planification Transport</h1>
            <p className="text-gray-600">Gestion des plans de transport</p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Créer un plan de transport</DialogTitle>
                <DialogDescription>
                  Sélectionnez une commande prête pour l'expédition
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Commande</Label>
                  <Select value={selectedCommande} onValueChange={setSelectedCommande}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une commande" />
                    </SelectTrigger>
                    <SelectContent>
                      {commandesPrete?.map((cmd) => (
                        <SelectItem key={cmd.commande_id} value={cmd.commande_id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cmd.numero_commande}</span>
                            <span className="text-sm text-gray-500">
                              → {cmd.ville_livraison}, {cmd.pays_livraison}
                            </span>
                            {cmd.poids_total_kg && (
                              <Badge variant="outline">{formatPoids(cmd.poids_total_kg)}</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {commandesPrete && commandesPrete.length === 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      Aucune commande prête pour l'expédition
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={() => {
                    if (selectedCommande) {
                      createPlanMutation.mutate(selectedCommande);
                    }
                  }}
                  disabled={!selectedCommande || createPlanMutation.isPending}
                >
                  {createPlanMutation.isPending ? 'Création...' : 'Créer le plan'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtres */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="planifie">Planifié</SelectItem>
                  <SelectItem value="confirme">Confirmé</SelectItem>
                  <SelectItem value="en_transit">En transit</SelectItem>
                  <SelectItem value="livre">Livré</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-gray-600 flex items-center">
                {filteredPlans?.length || 0} plan{(filteredPlans?.length || 0) > 1 ? 's' : ''}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des plans */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">Chargement...</div>
            </CardContent>
          </Card>
        ) : filteredPlans && filteredPlans.length > 0 ? (
          <div className="grid gap-4">
            {filteredPlans.map((plan) => (
              <Card key={plan.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      {/* En-tête */}
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          {getModeIcon(plan.mode_code)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{plan.numero_plan}</h3>
                            <Badge variant={formatPlanStatut(plan.statut).variant}>
                              {plan.statut_label}
                            </Badge>
                            {plan.optimise_par_ia && (
                              <Badge variant="secondary" className="gap-1">
                                <Sparkles className="h-3 w-3" />
                                Optimisé IA
                              </Badge>
                            )}
                          </div>
                          {plan.numero_commande && (
                            <p className="text-sm text-gray-600">
                              Commande: {plan.numero_commande}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Détails */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-gray-600">Destination</p>
                            <p className="font-medium">
                              {plan.destination_adresse?.ville || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-gray-600">Départ prévu</p>
                            <p className="font-medium">
                              {plan.date_depart_prevue
                                ? new Date(plan.date_depart_prevue).toLocaleDateString('fr-FR')
                                : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {plan.poids_total_kg && (
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="text-gray-600">Poids</p>
                              <p className="font-medium">{formatPoids(plan.poids_total_kg)}</p>
                            </div>
                          </div>
                        )}

                        {plan.distance_km && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="text-gray-600">Distance</p>
                              <p className="font-medium">{formatDistance(plan.distance_km)}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* KPIs */}
                      <div className="flex items-center gap-4 text-sm pt-2 border-t">
                        {plan.cout_estime && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="font-medium">
                              {formatMontant(plan.cout_estime)}
                            </span>
                          </div>
                        )}

                        {plan.emission_co2_kg && (
                          <div className="flex items-center gap-1">
                            <Leaf className="h-4 w-4 text-green-600" />
                            <span>{formatCO2(plan.emission_co2_kg)}</span>
                          </div>
                        )}

                        {plan.nom_transporteur && (
                          <div className="flex items-center gap-1">
                            <Truck className="h-4 w-4 text-gray-400" />
                            <span>{plan.nom_transporteur}</span>
                          </div>
                        )}

                        {plan.nb_alertes_actives > 0 && (
                          <Badge variant="destructive">
                            {plan.nb_alertes_actives} alerte{plan.nb_alertes_actives > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button variant="outline" size="sm">
                      Détails →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun plan de transport</h3>
                <p className="text-gray-600 mb-4">
                  Créez votre premier plan de transport pour commencer
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un plan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
