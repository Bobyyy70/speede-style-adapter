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
  ShoppingCart,
  CreditCard,
  Package,
  Truck,
  Database,
  Code,
  Plug,
  CheckCircle2,
  Settings,
  Search,
  Download,
  Upload,
  ExternalLink,
  Activity,
  AlertCircle,
  Clock,
  Zap,
  Globe,
  Users,
  BarChart3,
  FileText,
  Smartphone,
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

interface Integration {
  id: string;
  name: string;
  category: 'marketplace' | 'ecommerce' | 'erp' | 'payment' | 'shipping' | 'crm' | 'other';
  description: string;
  status: 'installed' | 'available' | 'coming_soon';
  icon: any;
  features: string[];
  pricing: string;
  syncFrequency?: string;
  lastSync?: string;
  ordersToday?: number;
  webhooks?: boolean;
  documentation?: string;
  popularityScore?: number;
}

export default function MarketplaceIntegrations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const integrations: Integration[] = [
    // MARKETPLACES
    {
      id: 'amazon',
      name: 'Amazon',
      category: 'marketplace',
      description: 'Synchronisez vos produits et commandes avec Amazon (FR, UK, DE, ES, IT)',
      status: 'installed',
      icon: ShoppingCart,
      features: ['Sync produits', 'Import commandes', 'Gestion stock temps réel', 'FBA support', 'Multi-pays'],
      pricing: 'Inclus',
      syncFrequency: 'Toutes les 15 min',
      lastSync: '2024-11-19T11:30:00',
      ordersToday: 45,
      webhooks: true,
      documentation: 'https://docs.amazon.com/mws',
      popularityScore: 98,
    },
    {
      id: 'ebay',
      name: 'eBay',
      category: 'marketplace',
      description: 'Intégration complète avec eBay pour gérer vos ventes aux enchères et prix fixe',
      status: 'available',
      icon: ShoppingCart,
      features: ['Sync produits', 'Import commandes', 'Gestion enchères', 'eBay Plus', 'Livraison internationale'],
      pricing: 'Inclus',
      webhooks: true,
      documentation: 'https://developer.ebay.com',
      popularityScore: 85,
    },
    {
      id: 'cdiscount',
      name: 'Cdiscount',
      category: 'marketplace',
      description: 'Vendez sur la marketplace française Cdiscount',
      status: 'installed',
      icon: ShoppingCart,
      features: ['Sync produits', 'Import commandes', 'C-Logistique', 'Promotions'],
      pricing: 'Inclus',
      syncFrequency: 'Toutes les 30 min',
      lastSync: '2024-11-19T11:15:00',
      ordersToday: 12,
      webhooks: false,
      popularityScore: 70,
    },
    {
      id: 'rakuten',
      name: 'Rakuten (ex-PriceMinister)',
      category: 'marketplace',
      description: 'Intégration avec Rakuten France',
      status: 'available',
      icon: ShoppingCart,
      features: ['Sync produits', 'Import commandes', 'Gestion avis'],
      pricing: 'Inclus',
      webhooks: false,
      popularityScore: 60,
    },
    {
      id: 'fnac',
      name: 'Fnac Marketplace',
      category: 'marketplace',
      description: 'Vendez sur la marketplace Fnac',
      status: 'coming_soon',
      icon: ShoppingCart,
      features: ['Sync produits', 'Import commandes', 'Fnac+'],
      pricing: 'À venir',
      popularityScore: 65,
    },

    // E-COMMERCE / CMS
    {
      id: 'shopify',
      name: 'Shopify',
      category: 'ecommerce',
      description: 'Synchronisation complète avec votre boutique Shopify',
      status: 'installed',
      icon: Store,
      features: ['Sync bi-directionnelle', 'Inventaire temps réel', 'Fulfillment auto', 'Multi-devises', 'Webhooks'],
      pricing: 'Inclus',
      syncFrequency: 'Temps réel (webhooks)',
      lastSync: '2024-11-19T11:35:00',
      ordersToday: 78,
      webhooks: true,
      documentation: 'https://shopify.dev',
      popularityScore: 95,
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      category: 'ecommerce',
      description: 'Plugin WordPress WooCommerce pour synchroniser votre boutique',
      status: 'installed',
      icon: Store,
      features: ['Sync produits/commandes', 'Gestion stock', 'Webhooks', 'Multi-sites'],
      pricing: 'Inclus',
      syncFrequency: 'Toutes les 10 min',
      lastSync: '2024-11-19T11:25:00',
      ordersToday: 34,
      webhooks: true,
      documentation: 'https://woocommerce.com/document/woocommerce-rest-api/',
      popularityScore: 90,
    },
    {
      id: 'prestashop',
      name: 'PrestaShop',
      category: 'ecommerce',
      description: 'Module PrestaShop pour synchronisation complète',
      status: 'available',
      icon: Store,
      features: ['Sync produits/commandes', 'Multi-boutiques', 'Stock centralisé'],
      pricing: 'Inclus',
      webhooks: true,
      popularityScore: 80,
    },
    {
      id: 'magento',
      name: 'Magento / Adobe Commerce',
      category: 'ecommerce',
      description: 'Connecteur Magento 2 & Adobe Commerce Cloud',
      status: 'available',
      icon: Store,
      features: ['API REST', 'Sync avancée', 'Multi-stores', 'B2B support'],
      pricing: 'Premium - 99€/mois',
      webhooks: true,
      popularityScore: 75,
    },
    {
      id: 'wix',
      name: 'Wix eCommerce',
      category: 'ecommerce',
      description: 'Intégration avec Wix Stores',
      status: 'coming_soon',
      icon: Store,
      features: ['Sync produits', 'Import commandes'],
      pricing: 'À venir',
      popularityScore: 55,
    },

    // ERP
    {
      id: 'sap',
      name: 'SAP Business One',
      category: 'erp',
      description: 'Connecteur SAP B1 pour synchronisation complète',
      status: 'available',
      icon: Database,
      features: ['Sync clients/produits', 'Commandes → SAP', 'Stock centralisé', 'Comptabilité'],
      pricing: 'Enterprise - sur devis',
      webhooks: false,
      popularityScore: 85,
    },
    {
      id: 'odoo',
      name: 'Odoo',
      category: 'erp',
      description: 'Module Odoo pour synchronisation ERP-OMS',
      status: 'installed',
      icon: Database,
      features: ['Sync bi-directionnelle', 'Achats/Ventes', 'Stock/Inventory', 'CRM'],
      pricing: 'Inclus',
      syncFrequency: 'Toutes les 1h',
      lastSync: '2024-11-19T11:00:00',
      webhooks: true,
      popularityScore: 80,
    },
    {
      id: 'sage',
      name: 'Sage 100',
      category: 'erp',
      description: 'Connecteur Sage pour comptabilité et gestion',
      status: 'available',
      icon: Database,
      features: ['Export compta', 'Sync clients', 'Facturation'],
      pricing: 'Premium - 149€/mois',
      popularityScore: 70,
    },

    // PAIEMENT
    {
      id: 'stripe',
      name: 'Stripe',
      category: 'payment',
      description: 'Gestion paiements CB, virements, prélèvements via Stripe',
      status: 'installed',
      icon: CreditCard,
      features: ['Paiements CB', 'Prélèvements SEPA', 'Webhooks', '3D Secure', 'Multi-devises'],
      pricing: '1.5% + 0.25€ par transaction',
      syncFrequency: 'Temps réel',
      webhooks: true,
      documentation: 'https://stripe.com/docs',
      popularityScore: 95,
    },
    {
      id: 'paypal',
      name: 'PayPal',
      category: 'payment',
      description: 'Acceptez les paiements PayPal',
      status: 'installed',
      icon: CreditCard,
      features: ['PayPal Checkout', 'Webhooks', 'Remboursements auto'],
      pricing: '2.9% + 0.30€ par transaction',
      webhooks: true,
      popularityScore: 90,
    },
    {
      id: 'adyen',
      name: 'Adyen',
      category: 'payment',
      description: 'Plateforme de paiement globale',
      status: 'available',
      icon: CreditCard,
      features: ['Multi-moyens de paiement', 'Global', 'Fraud detection', 'Webhooks'],
      pricing: 'Sur devis',
      webhooks: true,
      popularityScore: 75,
    },

    // SHIPPING (au-delà de SendCloud)
    {
      id: 'sendcloud',
      name: 'SendCloud',
      category: 'shipping',
      description: 'Hub multi-transporteurs (déjà intégré)',
      status: 'installed',
      icon: Truck,
      features: ['100+ transporteurs', 'Étiquettes auto', 'Tracking', 'Points relais'],
      pricing: 'À partir de 20€/mois',
      syncFrequency: 'Temps réel',
      lastSync: '2024-11-19T11:35:00',
      ordersToday: 156,
      webhooks: true,
      popularityScore: 92,
    },
    {
      id: 'dhl',
      name: 'DHL Express',
      category: 'shipping',
      description: 'Intégration directe DHL Express',
      status: 'available',
      icon: Truck,
      features: ['API directe', 'Tracking temps réel', 'International', 'Enlèvements auto'],
      pricing: 'Tarifs négociés',
      webhooks: true,
      popularityScore: 85,
    },
    {
      id: 'ups',
      name: 'UPS',
      category: 'shipping',
      description: 'Connecteur UPS pour expéditions',
      status: 'available',
      icon: Truck,
      features: ['Étiquettes', 'Tracking', 'Calcul frais', 'Enlèvements'],
      pricing: 'Tarifs négociés',
      webhooks: true,
      popularityScore: 80,
    },

    // CRM
    {
      id: 'salesforce',
      name: 'Salesforce',
      category: 'crm',
      description: 'Synchronisation clients et opportunités avec Salesforce',
      status: 'available',
      icon: Users,
      features: ['Sync clients', 'Historique commandes', 'Leads', 'Opportunités'],
      pricing: 'Premium - 199€/mois',
      webhooks: true,
      popularityScore: 85,
    },
    {
      id: 'hubspot',
      name: 'HubSpot CRM',
      category: 'crm',
      description: 'Intégration HubSpot pour marketing et ventes',
      status: 'available',
      icon: Users,
      features: ['Contacts', 'Deals', 'Email marketing', 'Analytics'],
      pricing: 'Inclus',
      webhooks: true,
      popularityScore: 80,
    },

    // AUTRES
    {
      id: 'zapier',
      name: 'Zapier',
      category: 'other',
      description: 'Connectez à 5000+ apps via Zapier',
      status: 'available',
      icon: Zap,
      features: ['5000+ apps', 'Workflows personnalisés', 'No-code'],
      pricing: 'Selon plan Zapier',
      webhooks: true,
      popularityScore: 88,
    },
    {
      id: 'api',
      name: 'API Publique',
      category: 'other',
      description: 'Développez vos propres intégrations avec notre API REST',
      status: 'installed',
      icon: Code,
      features: ['REST API', 'Webhooks', 'Documentation Swagger', 'Rate limiting', 'OAuth2'],
      pricing: 'Inclus',
      webhooks: true,
      documentation: 'https://api.youroms.com/docs',
      popularityScore: 90,
    },
  ];

  const categories = [
    { id: 'all', name: 'Toutes', icon: Globe },
    { id: 'marketplace', name: 'Marketplaces', icon: ShoppingCart },
    { id: 'ecommerce', name: 'E-commerce', icon: Store },
    { id: 'erp', name: 'ERP', icon: Database },
    { id: 'payment', name: 'Paiement', icon: CreditCard },
    { id: 'shipping', name: 'Transport', icon: Truck },
    { id: 'crm', name: 'CRM', icon: Users },
    { id: 'other', name: 'Autres', icon: Plug },
  ];

  const filteredIntegrations = integrations.filter(int => {
    const matchesSearch = int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         int.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || int.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    installed: integrations.filter(i => i.status === 'installed').length,
    available: integrations.filter(i => i.status === 'available').length,
    comingSoon: integrations.filter(i => i.status === 'coming_soon').length,
    totalOrders: integrations
      .filter(i => i.ordersToday)
      .reduce((sum, i) => sum + (i.ordersToday || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'installed':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Installé</Badge>;
      case 'available':
        return <Badge variant="outline">Disponible</Badge>;
      case 'coming_soon':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Bientôt</Badge>;
      default:
        return null;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.id === category);
    if (!cat) return null;
    const Icon = cat.icon;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Plug className="h-8 w-8 text-primary" />
            Marketplace d'Intégrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Connectez votre OMS à 40+ services • Marketplaces, CMS, ERP, Paiement, CRM
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Installées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.installed}</div>
              <p className="text-xs text-muted-foreground mt-1">Actives</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.available}</div>
              <p className="text-xs text-muted-foreground mt-1">Prêtes à installer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Bientôt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.comingSoon}</div>
              <p className="text-xs text-muted-foreground mt-1">En développement</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Commandes Aujourd'hui</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">Via intégrations</p>
            </CardContent>
          </Card>
        </div>

        {/* Recherche et Filtres */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une intégration..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Importer Config
          </Button>
        </div>

        {/* Catégories */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
              >
                <Icon className="h-4 w-4 mr-2" />
                {cat.name}
              </Button>
            );
          })}
        </div>

        {/* Intégrations Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredIntegrations.map((integration) => {
            const Icon = integration.icon;
            return (
              <Card key={integration.id} className={integration.status === 'installed' ? 'border-green-500' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <div className="flex items-center gap-1 mt-1">
                          {getCategoryIcon(integration.category)}
                          <span className="text-xs text-muted-foreground capitalize">
                            {categories.find(c => c.id === integration.category)?.name}
                          </span>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(integration.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{integration.description}</p>

                  {integration.status === 'installed' && (
                    <div className="space-y-2 p-3 bg-green-50 border border-green-200 rounded">
                      {integration.lastSync && (
                        <div className="text-xs flex items-center justify-between">
                          <span className="text-green-600">Dernière sync:</span>
                          <span className="font-mono">
                            {new Date(integration.lastSync).toLocaleString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {integration.ordersToday !== undefined && (
                        <div className="text-xs flex items-center justify-between">
                          <span className="text-green-600">Commandes aujourd'hui:</span>
                          <span className="font-semibold">{integration.ordersToday}</span>
                        </div>
                      )}
                      {integration.syncFrequency && (
                        <div className="text-xs flex items-center justify-between">
                          <span className="text-green-600">Fréquence:</span>
                          <span>{integration.syncFrequency}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="text-xs font-medium">Fonctionnalités:</div>
                    <div className="flex flex-wrap gap-1">
                      {integration.features.slice(0, 3).map((feature, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {integration.features.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{integration.features.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Prix:</span>
                    <span className="font-medium">{integration.pricing}</span>
                  </div>

                  {integration.webhooks && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <Zap className="h-3 w-3" />
                      <span>Webhooks temps réel</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {integration.status === 'installed' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedIntegration(integration);
                            setConfigDialogOpen(true);
                          }}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configurer
                        </Button>
                        <Button size="sm" variant="outline">
                          <Activity className="h-4 w-4 mr-2" />
                          Logs
                        </Button>
                      </>
                    ) : integration.status === 'available' ? (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          toast.success(`Installation de ${integration.name}...`);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Installer
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" className="flex-1" disabled>
                        <Clock className="h-4 w-4 mr-2" />
                        Bientôt disponible
                      </Button>
                    )}
                    {integration.documentation && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={integration.documentation} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredIntegrations.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune intégration trouvée</p>
            </CardContent>
          </Card>
        )}

        {/* Configuration Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configuration {selectedIntegration?.name}</DialogTitle>
              <DialogDescription>
                Gérez les paramètres de synchronisation et webhooks
              </DialogDescription>
            </DialogHeader>
            {selectedIntegration && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Clé API</Label>
                  <Input type="password" placeholder="••••••••••••••••" />
                </div>

                <div className="space-y-2">
                  <Label>Secret API</Label>
                  <Input type="password" placeholder="••••••••••••••••" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Synchronisation automatique</Label>
                    <p className="text-sm text-muted-foreground">
                      Sync produits et commandes automatiquement
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Webhooks</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir notifications temps réel
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>URL Webhook</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`https://api.youroms.com/webhooks/${selectedIntegration.id}`}
                      className="font-mono text-xs"
                    />
                    <Button variant="outline" size="sm">
                      Copier
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Sauvegarder
                  </Button>
                  <Button variant="destructive">
                    Désinstaller
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
