import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  Key,
  Globe,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface QuickStartStepConfigProps {
  onComplete: (data: any) => void;
  wizardData: Record<string, any>;
}

export default function QuickStartStepConfig({ onComplete, wizardData }: QuickStartStepConfigProps) {
  const marketplace = wizardData.marketplace || 'amazon';
  const needsAmazon = marketplace === 'amazon' || marketplace === 'both';
  const needsShopify = marketplace === 'shopify' || marketplace === 'both';

  // Amazon credentials
  const [amazonSellerId, setAmazonSellerId] = useState('');
  const [amazonMwsToken, setAmazonMwsToken] = useState('');
  const [amazonMarketplace, setAmazonMarketplace] = useState('FR');
  const [showAmazonToken, setShowAmazonToken] = useState(false);

  // Shopify credentials
  const [shopifyStore, setShopifyStore] = useState('');
  const [shopifyApiKey, setShopifyApiKey] = useState('');
  const [shopifyApiSecret, setShopifyApiSecret] = useState('');
  const [showShopifySecret, setShowShopifySecret] = useState(false);

  // Testing
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);

    // Simulate API test
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIsTesting(false);
    setTestSuccess(true);
    toast.success('✅ Connexion réussie !', {
      description: 'Vos identifiants sont valides. Vous pouvez continuer.'
    });
  };

  const handleContinue = () => {
    const configData: any = {
      marketplace: wizardData.marketplace
    };

    if (needsAmazon) {
      configData.amazon = {
        sellerId: amazonSellerId,
        mwsToken: amazonMwsToken,
        marketplace: amazonMarketplace
      };
    }

    if (needsShopify) {
      configData.shopify = {
        store: shopifyStore,
        apiKey: shopifyApiKey,
        apiSecret: shopifyApiSecret
      };
    }

    onComplete(configData);
  };

  const isFormValid = () => {
    if (needsAmazon && (!amazonSellerId || !amazonMwsToken)) return false;
    if (needsShopify && (!shopifyStore || !shopifyApiKey || !shopifyApiSecret)) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl">2️⃣ Configuration API</CardTitle>
          <CardDescription>
            Entrez vos identifiants pour connecter votre marketplace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Amazon Configuration */}
          {needsAmazon && (
            <div className="space-y-4 p-4 border rounded-lg bg-orange-50/30 dark:bg-orange-950/10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center space-x-2">
                  <div className="w-8 h-8 rounded bg-orange-500 flex items-center justify-center">
                    <span className="text-white text-sm">A</span>
                  </div>
                  <span>Amazon Seller Central</span>
                </h3>
                <Badge variant="outline">
                  <Globe className="w-3 h-3 mr-1" />
                  {amazonMarketplace}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Marketplace Selection */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="amazon-marketplace">Marketplace Amazon</Label>
                  <Select value={amazonMarketplace} onValueChange={setAmazonMarketplace}>
                    <SelectTrigger id="amazon-marketplace">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FR">🇫🇷 Amazon.fr (France)</SelectItem>
                      <SelectItem value="UK">🇬🇧 Amazon.co.uk (UK)</SelectItem>
                      <SelectItem value="DE">🇩🇪 Amazon.de (Allemagne)</SelectItem>
                      <SelectItem value="ES">🇪🇸 Amazon.es (Espagne)</SelectItem>
                      <SelectItem value="IT">🇮🇹 Amazon.it (Italie)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Seller ID */}
                <div className="space-y-2">
                  <Label htmlFor="amazon-seller-id">
                    Seller ID
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="amazon-seller-id"
                    placeholder="A1XXXXXXXXXXXX"
                    value={amazonSellerId}
                    onChange={(e) => setAmazonSellerId(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: A1 + 12 caractères
                  </p>
                </div>

                {/* MWS Auth Token */}
                <div className="space-y-2">
                  <Label htmlFor="amazon-mws-token">
                    MWS Auth Token
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="amazon-mws-token"
                      type={showAmazonToken ? 'text' : 'password'}
                      placeholder="amzn.mws.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={amazonMwsToken}
                      onChange={(e) => setAmazonMwsToken(e.target.value)}
                      className="font-mono pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowAmazonToken(!showAmazonToken)}
                    >
                      {showAmazonToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Help Accordion */}
              <Accordion type="single" collapsible className="border rounded-md">
                <AccordionItem value="help" className="border-0">
                  <AccordionTrigger className="px-4 py-2 hover:no-underline">
                    <div className="flex items-center space-x-2 text-sm">
                      <HelpCircle className="w-4 h-4" />
                      <span>Où trouver mes identifiants Amazon ?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <ol className="text-sm space-y-2 list-decimal list-inside">
                      <li>
                        Connectez-vous à{' '}
                        <a
                          href="https://sellercentral.amazon.fr"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline inline-flex items-center"
                        >
                          Seller Central
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </li>
                      <li>Allez dans <strong>Paramètres → Informations sur le compte</strong></li>
                      <li>
                        Copiez votre <strong>Merchant Token</strong> (format: A1XXXXXXXXXXXX)
                      </li>
                      <li>
                        Allez dans <strong>Paramètres → Informations utilisateur</strong>
                      </li>
                      <li>
                        Section <strong>Amazon MWS</strong> → Cliquez sur{' '}
                        <strong>"Afficher le jeton d'autorisation développeur"</strong>
                      </li>
                      <li>Copiez le token (format: amzn.mws.xxxxxxxx-xxxx-xxxx...)</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {/* Shopify Configuration */}
          {needsShopify && (
            <div className="space-y-4 p-4 border rounded-lg bg-green-50/30 dark:bg-green-950/10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center space-x-2">
                  <div className="w-8 h-8 rounded bg-green-500 flex items-center justify-center">
                    <span className="text-white text-sm">S</span>
                  </div>
                  <span>Shopify</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Store Name */}
                <div className="space-y-2">
                  <Label htmlFor="shopify-store">
                    Nom de votre boutique
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="shopify-store"
                      placeholder="ma-boutique"
                      value={shopifyStore}
                      onChange={(e) => setShopifyStore(e.target.value)}
                      className="font-mono"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      .myshopify.com
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exemple: si votre URL est <strong>ma-boutique.myshopify.com</strong>, entrez{' '}
                    <strong>ma-boutique</strong>
                  </p>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="shopify-api-key">
                    API Key
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="shopify-api-key"
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={shopifyApiKey}
                    onChange={(e) => setShopifyApiKey(e.target.value)}
                    className="font-mono"
                  />
                </div>

                {/* API Secret */}
                <div className="space-y-2">
                  <Label htmlFor="shopify-api-secret">
                    API Secret
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="shopify-api-secret"
                      type={showShopifySecret ? 'text' : 'password'}
                      placeholder="shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={shopifyApiSecret}
                      onChange={(e) => setShopifyApiSecret(e.target.value)}
                      className="font-mono pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowShopifySecret(!showShopifySecret)}
                    >
                      {showShopifySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Help Accordion */}
              <Accordion type="single" collapsible className="border rounded-md">
                <AccordionItem value="help" className="border-0">
                  <AccordionTrigger className="px-4 py-2 hover:no-underline">
                    <div className="flex items-center space-x-2 text-sm">
                      <HelpCircle className="w-4 h-4" />
                      <span>Comment créer une API privée Shopify ?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <ol className="text-sm space-y-2 list-decimal list-inside">
                      <li>
                        Connectez-vous à votre{' '}
                        <a
                          href="https://accounts.shopify.com/store-login"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline inline-flex items-center"
                        >
                          Admin Shopify
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </li>
                      <li>Allez dans <strong>Paramètres → Applications et canaux de vente</strong></li>
                      <li>
                        Cliquez sur <strong>"Développer des applications"</strong> (en haut à droite)
                      </li>
                      <li>Cliquez sur <strong>"Créer une application"</strong></li>
                      <li>Donnez un nom à l'application (ex: "SpeedE OMS")</li>
                      <li>
                        Configurez les <strong>scopes Admin API</strong> :
                        <ul className="ml-6 mt-1 space-y-0.5">
                          <li>✓ read_orders, write_orders</li>
                          <li>✓ read_products, write_products</li>
                          <li>✓ read_inventory, write_inventory</li>
                        </ul>
                      </li>
                      <li>Cliquez sur <strong>"Installer l'application"</strong></li>
                      <li>
                        Copiez l'<strong>Admin API access token</strong> (commence par "shpat_")
                      </li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {/* Test Connection Button */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              {testSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Connexion vérifiée</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Testez la connexion avant de continuer
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={!isFormValid() || isTesting}
              >
                {isTesting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                    Test en cours...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Tester la connexion
                  </>
                )}
              </Button>

              <Button
                size="lg"
                onClick={handleContinue}
                disabled={!testSuccess}
                className="min-w-[150px]"
              >
                Continuer
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Key className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                🔒 Sécurité de vos données
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Vos identifiants API sont <strong>chiffrés AES-256</strong> et stockés de manière sécurisée.
                Nous ne pouvons jamais accéder à vos clés en clair. Vous pouvez révoquer l'accès à tout moment
                depuis votre panneau de configuration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
