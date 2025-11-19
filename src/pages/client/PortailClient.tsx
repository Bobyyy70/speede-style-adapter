import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Package,
  TrendingUp,
  Clock,
  MapPin,
  Search,
  Download,
  Eye,
  AlertCircle,
  CheckCircle2,
  Truck,
  Box,
  Undo2,
  FileText,
  Bell,
  Star,
  BarChart3,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface OrderTracking {
  orderId: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  estimatedDelivery: string;
  currentLocation: string;
  progress: number;
  timeline: TimelineEvent[];
  items: OrderItem[];
  shipping: ShippingInfo;
}

interface TimelineEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
  completed: boolean;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface ShippingInfo {
  carrier: string;
  trackingNumber: string;
  method: string;
  address: string;
}

export default function PortailClient() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderTracking | null>(null);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);

  // Données simulées pour démo
  const mockOrders: OrderTracking[] = [
    {
      orderId: "1",
      orderNumber: "CMD-2024-1234",
      status: "en_transit",
      createdAt: "2024-11-15T10:30:00",
      estimatedDelivery: "2024-11-20T18:00:00",
      currentLocation: "Centre de tri Paris",
      progress: 65,
      timeline: [
        {
          timestamp: "2024-11-15T10:30:00",
          status: "created",
          location: "Système",
          description: "Commande créée",
          completed: true,
        },
        {
          timestamp: "2024-11-15T14:00:00",
          status: "validated",
          location: "Entrepôt Paris Nord",
          description: "Commande validée et en préparation",
          completed: true,
        },
        {
          timestamp: "2024-11-16T09:00:00",
          status: "shipped",
          location: "Entrepôt Paris Nord",
          description: "Colis expédié",
          completed: true,
        },
        {
          timestamp: "2024-11-17T15:30:00",
          status: "in_transit",
          location: "Centre de tri Paris",
          description: "En transit vers la destination",
          completed: true,
        },
        {
          timestamp: "2024-11-20T18:00:00",
          status: "delivered",
          location: "Votre adresse",
          description: "Livraison prévue",
          completed: false,
        },
      ],
      items: [
        { id: "1", name: "T-Shirt Premium Blanc", quantity: 2, price: 29.99 },
        { id: "2", name: "Jeans Slim Noir", quantity: 1, price: 79.99 },
      ],
      shipping: {
        carrier: "Colissimo",
        trackingNumber: "6A12345678901",
        method: "Standard",
        address: "123 Rue de la Paix, 75001 Paris",
      },
    },
    {
      orderId: "2",
      orderNumber: "CMD-2024-1235",
      status: "delivered",
      createdAt: "2024-11-10T08:00:00",
      estimatedDelivery: "2024-11-15T18:00:00",
      currentLocation: "Livrée",
      progress: 100,
      timeline: [
        {
          timestamp: "2024-11-10T08:00:00",
          status: "created",
          location: "Système",
          description: "Commande créée",
          completed: true,
        },
        {
          timestamp: "2024-11-10T10:00:00",
          status: "validated",
          location: "Entrepôt Lyon",
          description: "Commande validée",
          completed: true,
        },
        {
          timestamp: "2024-11-11T09:00:00",
          status: "shipped",
          location: "Entrepôt Lyon",
          description: "Colis expédié",
          completed: true,
        },
        {
          timestamp: "2024-11-14T16:30:00",
          status: "delivered",
          location: "Votre adresse",
          description: "Livrée et signée",
          completed: true,
        },
      ],
      items: [
        { id: "3", name: "Hoodie Gris Premium", quantity: 1, price: 59.99 },
      ],
      shipping: {
        carrier: "Chronopost",
        trackingNumber: "CH98765432109",
        method: "Express",
        address: "123 Rue de la Paix, 75001 Paris",
      },
    },
  ];

  const stats = {
    totalOrders: 24,
    ordersInProgress: 3,
    ordersDelivered: 20,
    ordersReturned: 1,
    totalSpent: 2456.78,
    avgOrderValue: 102.37,
    satisfactionScore: 4.8,
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
      created: { label: "Créée", variant: "secondary", icon: FileText },
      validated: { label: "Validée", variant: "default", icon: CheckCircle2 },
      shipped: { label: "Expédiée", variant: "default", icon: Truck },
      in_transit: { label: "En transit", variant: "default", icon: Package },
      delivered: { label: "Livrée", variant: "default", icon: CheckCircle2 },
      returned: { label: "Retournée", variant: "destructive", icon: Undo2 },
    };

    const config = statusConfig[status] || statusConfig.created;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const openTrackingDialog = (order: OrderTracking) => {
    setSelectedOrder(order);
    setTrackingDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Star className="h-8 w-8 text-primary" />
            Mon Espace Client
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos commandes, suivez vos livraisons et bien plus • Service self-service 24/7
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Commandes Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.ordersInProgress} en cours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSpent.toFixed(2)}€</div>
              <p className="text-xs text-muted-foreground mt-1">
                Panier moyen: {stats.avgOrderValue.toFixed(2)}€
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Taux de Livraison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {((stats.ordersDelivered / stats.totalOrders) * 100).toFixed(0)}%
              </div>
              <Progress
                value={(stats.ordersDelivered / stats.totalOrders) * 100}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                {stats.satisfactionScore}
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Basé sur {stats.ordersDelivered} commandes
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="orders">Mes Commandes</TabsTrigger>
            <TabsTrigger value="tracking">Suivi en Temps Réel</TabsTrigger>
            <TabsTrigger value="returns">Retours</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
          </TabsList>

          {/* Mes Commandes */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Toutes mes commandes</CardTitle>
                <CardDescription>
                  Accès complet à l'historique et au suivi de vos commandes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par numéro de commande..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter
                  </Button>
                </div>

                <div className="space-y-3">
                  {mockOrders.map((order) => (
                    <div key={order.orderId} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold">{order.orderNumber}</div>
                          <div className="text-sm text-muted-foreground">
                            Créée le {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Progression</span>
                          <span className="font-medium">{order.progress}%</span>
                        </div>
                        <Progress value={order.progress} className="h-2" />
                      </div>

                      {/* Items */}
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Box className="h-4 w-4 text-muted-foreground" />
                              <span>{item.name}</span>
                              <Badge variant="outline">x{item.quantity}</Badge>
                            </div>
                            <span className="font-medium">{item.price.toFixed(2)}€</span>
                          </div>
                        ))}
                      </div>

                      {/* Current Status */}
                      <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span className="text-blue-900">
                          <span className="font-medium">Position actuelle:</span> {order.currentLocation}
                        </span>
                      </div>

                      {order.status !== 'delivered' && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            Livraison estimée le {new Date(order.estimatedDelivery).toLocaleDateString('fr-FR')} à{' '}
                            {new Date(order.estimatedDelivery).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openTrackingDialog(order)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir le Détail
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Facture
                        </Button>
                        {order.status === 'delivered' && (
                          <Button variant="outline" size="sm">
                            <Undo2 className="h-4 w-4 mr-2" />
                            Retourner
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suivi Temps Réel */}
          <TabsContent value="tracking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Suivi en Temps Réel
                </CardTitle>
                <CardDescription>
                  Localisation GPS et mises à jour en direct de vos colis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockOrders
                    .filter(o => o.status !== 'delivered')
                    .map((order) => (
                      <div key={order.orderId} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="font-semibold">{order.orderNumber}</div>
                            <div className="text-sm text-muted-foreground">
                              {order.shipping.carrier} • {order.shipping.trackingNumber}
                            </div>
                          </div>
                          <Badge>{order.progress}%</Badge>
                        </div>

                        <div className="space-y-3">
                          {order.timeline.map((event, idx) => (
                            <div key={idx} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-3 h-3 rounded-full ${
                                    event.completed ? 'bg-green-500' : 'bg-gray-300'
                                  }`}
                                />
                                {idx < order.timeline.length - 1 && (
                                  <div
                                    className={`w-0.5 h-12 ${
                                      event.completed ? 'bg-green-500' : 'bg-gray-300'
                                    }`}
                                  />
                                )}
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`font-medium ${
                                      event.completed ? 'text-foreground' : 'text-muted-foreground'
                                    }`}
                                  >
                                    {event.description}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {new Date(event.timestamp).toLocaleDateString('fr-FR')}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3" />
                                  {event.location}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Button variant="outline" className="w-full mt-4">
                          <Bell className="h-4 w-4 mr-2" />
                          Recevoir des notifications SMS
                        </Button>
                      </div>
                    ))}

                  {mockOrders.filter(o => o.status !== 'delivered').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Aucune commande en cours de livraison</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Retours */}
          <TabsContent value="returns" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Undo2 className="h-5 w-5" />
                  Gestion des Retours Self-Service
                </CardTitle>
                <CardDescription>
                  Retournez vos articles en 3 clics, sans contact support
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-blue-900 mb-1">
                        Retours gratuits sous 30 jours
                      </div>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>✓ Étiquette de retour générée automatiquement</li>
                        <li>✓ Remboursement sous 5 jours après réception</li>
                        <li>✓ Pas de frais de retour pour les articles défectueux</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {mockOrders
                    .filter(o => o.status === 'delivered')
                    .map((order) => (
                      <div key={order.orderId} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-semibold">{order.orderNumber}</div>
                            <div className="text-sm text-muted-foreground">
                              Livrée le {new Date(order.estimatedDelivery).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                          <Badge variant="secondary">Éligible au retour</Badge>
                        </div>

                        <div className="space-y-2 mb-4">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                              <span>{item.name} x{item.quantity}</span>
                              <Button variant="ghost" size="sm">
                                Retourner cet article
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Button variant="outline" className="w-full">
                          <Undo2 className="h-4 w-4 mr-2" />
                          Créer une Demande de Retour
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Mes Documents
                </CardTitle>
                <CardDescription>
                  Accédez à toutes vos factures et documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mockOrders.map((order) => (
                    <div key={order.orderId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">Facture {order.orderNumber}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger PDF
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Support */}
          <TabsContent value="support" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Centre d'Aide</CardTitle>
                <CardDescription>
                  Support automatisé 24/7 • Réponses instantanées
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Button variant="outline" className="h-auto flex-col items-start gap-2 p-4">
                    <Package className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Où est ma commande ?</div>
                      <div className="text-xs text-muted-foreground">
                        Suivi en temps réel
                      </div>
                    </div>
                  </Button>

                  <Button variant="outline" className="h-auto flex-col items-start gap-2 p-4">
                    <Undo2 className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Faire un retour</div>
                      <div className="text-xs text-muted-foreground">
                        Processus guidé
                      </div>
                    </div>
                  </Button>

                  <Button variant="outline" className="h-auto flex-col items-start gap-2 p-4">
                    <FileText className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Facture manquante</div>
                      <div className="text-xs text-muted-foreground">
                        Téléchargement direct
                      </div>
                    </div>
                  </Button>

                  <Button variant="outline" className="h-auto flex-col items-start gap-2 p-4">
                    <AlertCircle className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Autre question</div>
                      <div className="text-xs text-muted-foreground">
                        Contactez le support
                      </div>
                    </div>
                  </Button>
                </div>

                <Separator />

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div className="font-semibold text-green-900">
                      Questions Fréquentes Résolues
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-green-700">
                    <li>• Délais de livraison: 2-5 jours ouvrés</li>
                    <li>• Frais de port: Gratuits dès 50€</li>
                    <li>• Retours: Gratuits sous 30 jours</li>
                    <li>• Paiement: CB, PayPal, Virement</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Tracking Detail Dialog */}
        <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Détail de la Commande</DialogTitle>
              <DialogDescription>
                {selectedOrder?.orderNumber}
              </DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Statut</div>
                    <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Progression</div>
                    <div className="mt-1">
                      <Progress value={selectedOrder.progress} className="h-2" />
                      <span className="text-xs">{selectedOrder.progress}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Transporteur</div>
                    <div className="font-medium mt-1">{selectedOrder.shipping.carrier}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Numéro de suivi</div>
                    <div className="font-mono text-xs mt-1">{selectedOrder.shipping.trackingNumber}</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="font-semibold mb-3">Articles</div>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span>{item.name} x{item.quantity}</span>
                        <span className="font-medium">{(item.price * item.quantity).toFixed(2)}€</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t font-semibold">
                    <span>Total</span>
                    <span>
                      {selectedOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}€
                    </span>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="font-semibold mb-3">Adresse de livraison</div>
                  <div className="text-sm p-3 bg-gray-50 rounded">
                    {selectedOrder.shipping.address}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger Facture
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Bell className="h-4 w-4 mr-2" />
                    Activer Notifications
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
