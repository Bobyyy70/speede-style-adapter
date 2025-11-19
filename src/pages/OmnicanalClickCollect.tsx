import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Store,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  QrCode,
  ShoppingBag,
  BarChart3,
  Settings,
  Sparkles,
  Users,
  TrendingUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  openingHours: string;
  capabilities: {
    clickCollect: boolean;
    shipFromStore: boolean;
    returns: boolean;
  };
  inventory: {
    totalItems: number;
    availableForClick: number;
  };
  performance: {
    avgPickupTime: number; // minutes
    satisfactionScore: number;
    ordersToday: number;
  };
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface ClickCollectOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  storeId: string;
  storeName: string;
  status: 'preparing' | 'ready' | 'collected' | 'expired';
  items: Array<{
    name: string;
    quantity: number;
  }>;
  createdAt: string;
  readyAt?: string;
  expiresAt: string;
  pickupCode: string;
}

export default function OmnicanalClickCollect() {
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  // Données simulées
  const stores: StoreLocation[] = [
    {
      id: 'store1',
      name: 'Paris Centre',
      address: '123 Rue de Rivoli',
      city: 'Paris',
      postalCode: '75001',
      phone: '01 23 45 67 89',
      openingHours: 'Lun-Sam: 9h-19h',
      capabilities: {
        clickCollect: true,
        shipFromStore: true,
        returns: true,
      },
      inventory: {
        totalItems: 450,
        availableForClick: 380,
      },
      performance: {
        avgPickupTime: 15,
        satisfactionScore: 4.8,
        ordersToday: 23,
      },
      coordinates: { lat: 48.8566, lng: 2.3522 },
    },
    {
      id: 'store2',
      name: 'Lyon Part-Dieu',
      address: '45 Rue de la République',
      city: 'Lyon',
      postalCode: '69002',
      phone: '04 12 34 56 78',
      openingHours: 'Lun-Sam: 10h-20h',
      capabilities: {
        clickCollect: true,
        shipFromStore: false,
        returns: true,
      },
      inventory: {
        totalItems: 320,
        availableForClick: 280,
      },
      performance: {
        avgPickupTime: 12,
        satisfactionScore: 4.9,
        ordersToday: 18,
      },
      coordinates: { lat: 45.7640, lng: 4.8357 },
    },
    {
      id: 'store3',
      name: 'Marseille Vieux-Port',
      address: '78 La Canebière',
      city: 'Marseille',
      postalCode: '13001',
      phone: '04 91 23 45 67',
      openingHours: 'Lun-Sam: 9h-19h, Dim: 10h-18h',
      capabilities: {
        clickCollect: true,
        shipFromStore: true,
        returns: true,
      },
      inventory: {
        totalItems: 280,
        availableForClick: 240,
      },
      performance: {
        avgPickupTime: 18,
        satisfactionScore: 4.7,
        ordersToday: 15,
      },
      coordinates: { lat: 43.2965, lng: 5.3698 },
    },
  ];

  const clickCollectOrders: ClickCollectOrder[] = [
    {
      id: '1',
      orderNumber: 'CC-2024-001',
      customerName: 'Marie Dupont',
      customerPhone: '06 12 34 56 78',
      storeId: 'store1',
      storeName: 'Paris Centre',
      status: 'ready',
      items: [
        { name: 'T-Shirt Blanc', quantity: 2 },
        { name: 'Jeans Slim', quantity: 1 },
      ],
      createdAt: '2024-11-19T09:00:00',
      readyAt: '2024-11-19T09:15:00',
      expiresAt: '2024-11-22T19:00:00',
      pickupCode: 'ABC123',
    },
    {
      id: '2',
      orderNumber: 'CC-2024-002',
      customerName: 'Jean Martin',
      customerPhone: '06 98 76 54 32',
      storeId: 'store1',
      storeName: 'Paris Centre',
      status: 'preparing',
      items: [
        { name: 'Hoodie Gris', quantity: 1 },
      ],
      createdAt: '2024-11-19T10:30:00',
      expiresAt: '2024-11-22T19:00:00',
      pickupCode: 'DEF456',
    },
  ];

  const stats = {
    totalClickCollect: 156,
    readyForPickup: 12,
    collected: 140,
    avgPickupTime: 15,
    satisfactionScore: 4.8,
    conversionRate: 92,
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: any; icon: any }> = {
      preparing: { label: 'En préparation', variant: 'default', icon: Package },
      ready: { label: 'Prêt', variant: 'default', icon: CheckCircle2 },
      collected: { label: 'Récupéré', variant: 'secondary', icon: CheckCircle2 },
      expired: { label: 'Expiré', variant: 'destructive', icon: Clock },
    };

    const cfg = config[status];
    const Icon = cfg.icon;

    return (
      <Badge variant={cfg.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Store className="h-8 w-8 text-primary" />
            Omnicanal • Click & Collect
          </h1>
          <p className="text-muted-foreground mt-1">
            BOPIS (Buy Online Pick In Store) • Ship from Store • Gestion Unified Commerce
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Commandes C&C</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClickCollect}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.readyForPickup} prêtes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Temps Moyen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgPickupTime} min</div>
              <p className="text-xs text-muted-foreground mt-1">
                De commande → prêt
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Taux de Retrait</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate}%</div>
              <Progress value={stats.conversionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                {stats.satisfactionScore}
                <span className="text-sm text-yellow-500">★</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Score client
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="orders">Commandes C&C</TabsTrigger>
            <TabsTrigger value="stores">Points de Vente</TabsTrigger>
            <TabsTrigger value="ship-from-store">Ship from Store</TabsTrigger>
            <TabsTrigger value="settings">Configuration</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Performance Today
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stores.map((store) => (
                    <div key={store.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{store.name}</span>
                        <Badge variant="outline">{store.performance.ordersToday} commandes</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {store.performance.avgPickupTime}min
                        <span className="ml-2">★ {store.performance.satisfactionScore}</span>
                      </div>
                      <Progress
                        value={(store.performance.ordersToday / 30) * 100}
                        className="h-2"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Avantages Omnicanal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <div className="font-semibold text-green-900 mb-1">
                      +25% de Conversion
                    </div>
                    <div className="text-sm text-green-700">
                      Le Click & Collect augmente significativement les ventes
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="font-semibold text-blue-900 mb-1">
                      -40% Coûts Livraison
                    </div>
                    <div className="text-sm text-blue-700">
                      Réduction drastique des frais de transport
                    </div>
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                    <div className="font-semibold text-purple-900 mb-1">
                      +30% Ventes Additionnelles
                    </div>
                    <div className="text-sm text-purple-700">
                      Cross-sell en magasin lors du retrait
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Commandes Click & Collect */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Commandes Click & Collect en Cours</CardTitle>
                <CardDescription>
                  Gestion des retraits en magasin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {clickCollectOrders.map((order) => (
                  <div key={order.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{order.orderNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.customerName} • {order.customerPhone}
                        </div>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{order.storeName}</span>
                    </div>

                    <div className="space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-sm flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span>{item.name}</span>
                          <Badge variant="outline">x{item.quantity}</Badge>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Commandée le</div>
                        <div className="font-medium">
                          {new Date(order.createdAt).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      {order.readyAt && (
                        <div>
                          <div className="text-muted-foreground">Prête depuis</div>
                          <div className="font-medium">
                            {new Date(order.readyAt).toLocaleString('fr-FR')}
                          </div>
                        </div>
                      )}
                    </div>

                    {order.status === 'ready' && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-green-900">
                            Code de retrait
                          </span>
                          <Button size="sm" variant="outline">
                            <QrCode className="h-4 w-4 mr-2" />
                            QR Code
                          </Button>
                        </div>
                        <div className="text-3xl font-mono font-bold text-green-900 text-center py-2">
                          {order.pickupCode}
                        </div>
                        <div className="text-xs text-green-600 text-center mt-2">
                          À montrer au vendeur lors du retrait
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {order.status === 'preparing' && (
                        <Button size="sm" variant="default" className="flex-1">
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Marquer comme Prête
                        </Button>
                      )}
                      {order.status === 'ready' && (
                        <Button size="sm" variant="default" className="flex-1">
                          <ShoppingBag className="h-4 w-4 mr-2" />
                          Confirmer Retrait
                        </Button>
                      )}
                      <Button size="sm" variant="outline">
                        Contacter Client
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Points de Vente */}
          <TabsContent value="stores" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {stores.map((store) => (
                <Card key={store.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5" />
                      {store.name}
                    </CardTitle>
                    <CardDescription>
                      {store.address}, {store.postalCode} {store.city}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm flex items-center justify-between">
                        <span className="text-muted-foreground">Téléphone</span>
                        <span className="font-medium">{store.phone}</span>
                      </div>
                      <div className="text-sm flex items-center justify-between">
                        <span className="text-muted-foreground">Horaires</span>
                        <span className="font-medium">{store.openingHours}</span>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="text-sm font-medium mb-2">Fonctionnalités</div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Click & Collect</span>
                          {store.capabilities.clickCollect ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Ship from Store</span>
                          {store.capabilities.shipFromStore ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Retours en magasin</span>
                          {store.capabilities.returns ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="text-sm font-medium mb-2">Inventaire</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Articles totaux</span>
                          <span className="font-mono font-semibold">{store.inventory.totalItems}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Dispo Click & Collect</span>
                          <span className="font-mono font-semibold">{store.inventory.availableForClick}</span>
                        </div>
                        <Progress
                          value={(store.inventory.availableForClick / store.inventory.totalItems) * 100}
                          className="h-2"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-2xl font-bold">{store.performance.ordersToday}</div>
                        <div className="text-xs text-muted-foreground">Cmd/jour</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{store.performance.avgPickupTime}</div>
                        <div className="text-xs text-muted-foreground">Min prépa</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{store.performance.satisfactionScore}</div>
                        <div className="text-xs text-muted-foreground">★ Score</div>
                      </div>
                    </div>

                    <Button variant="outline" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurer le Magasin
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Ship from Store */}
          <TabsContent value="ship-from-store" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Ship from Store
                </CardTitle>
                <CardDescription>
                  Expédiez depuis vos magasins physiques pour réduire délais et coûts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="font-semibold text-blue-900 mb-2">
                    💡 Comment ça marche ?
                  </div>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>1. Client commande en ligne un produit en stock magasin</li>
                    <li>2. Système route automatiquement vers le magasin le plus proche</li>
                    <li>3. Équipe magasin prépare et expédie le colis</li>
                    <li>4. Livraison ultra-rapide + économies de transport</li>
                  </ul>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {stores
                    .filter(s => s.capabilities.shipFromStore)
                    .map((store) => (
                      <div key={store.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{store.name}</div>
                          <Badge variant="default">Actif</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground">Expéditions/jour</div>
                            <div className="text-2xl font-bold text-primary">
                              {Math.floor(store.performance.ordersToday * 0.4)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Économies</div>
                            <div className="text-2xl font-bold text-green-600">
                              -35%
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Délai moyen de livraison: 1-2 jours (vs 3-5 depuis entrepôt)
                        </div>
                      </div>
                    ))}
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-900">
                      Impact Business
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                      <div className="text-sm text-green-600">Coûts Transport</div>
                      <div className="text-2xl font-bold text-green-900">-35%</div>
                    </div>
                    <div>
                      <div className="text-sm text-green-600">Délai Livraison</div>
                      <div className="text-2xl font-bold text-green-900">-50%</div>
                    </div>
                    <div>
                      <div className="text-sm text-green-600">Satisfaction</div>
                      <div className="text-2xl font-bold text-green-900">+40%</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres Omnicanal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Activer Click & Collect</Label>
                      <p className="text-sm text-muted-foreground">
                        Permettre aux clients de récupérer en magasin
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Activer Ship from Store</Label>
                      <p className="text-sm text-muted-foreground">
                        Expédier depuis les magasins physiques
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Retours en Magasin</Label>
                      <p className="text-sm text-muted-foreground">
                        Accepter les retours de commandes web en magasin
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Délai de Conservation (Click & Collect)</Label>
                  <Input
                    type="number"
                    defaultValue={3}
                    min={1}
                    max={14}
                  />
                  <p className="text-sm text-muted-foreground">
                    Nombre de jours avant expiration de la commande
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>Rayon de Livraison Ship from Store (km)</Label>
                  <Input
                    type="number"
                    defaultValue={50}
                    min={10}
                    max={200}
                  />
                  <p className="text-sm text-muted-foreground">
                    Distance maximum pour expédition depuis magasin
                  </p>
                </div>

                <Button className="w-full">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Sauvegarder la Configuration
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
