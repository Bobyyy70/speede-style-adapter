import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Code,
  Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface APIToken {
  id: string;
  token: string;
  nom_token: string;
  type_acces: string;
  domaines_autorises: string[];
  rate_limit_par_heure: number;
  actif: boolean;
  derniere_utilisation?: string;
  nb_requetes_total: number;
  created_at: string;
  expires_at?: string;
}

export default function MesTokensAPI() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showToken, setShowToken] = useState<string | null>(null);

  // Nouveau token
  const [nomToken, setNomToken] = useState("");
  const [typeAcces, setTypeAcces] = useState<string>("tracking");
  const [domaines, setDomaines] = useState("");

  // Get profile
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('profiles')
        .select('*, client:client_id(nom_entreprise)')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch tokens
  const { data: tokens, isLoading } = useQuery({
    queryKey: ['api-tokens', profile?.client_id],
    queryFn: async () => {
      if (!profile?.client_id) return [];

      const { data, error } = await supabase
        .from('client_api_token')
        .select('*')
        .eq('client_id', profile.client_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as APIToken[];
    },
    enabled: !!profile?.client_id,
  });

  // Create token mutation
  const createTokenMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.client_id) throw new Error('Client ID introuvable');

      const domainesArray = domaines
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      const { data, error } = await supabase.rpc('creer_api_token', {
        p_client_id: profile.client_id,
        p_nom_token: nomToken,
        p_type_acces: typeAcces,
        p_domaines_autorises: domainesArray.length > 0 ? domainesArray : null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Token créé",
        description: "Copiez-le maintenant, il ne sera plus visible !",
      });
      setShowToken(data.token);
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      setNomToken("");
      setDomaines("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Revoke token mutation
  const revokeTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      if (!profile?.client_id) throw new Error('Client ID introuvable');

      const { data, error } = await supabase.rpc('revoquer_api_token', {
        p_token_id: tokenId,
        p_client_id: profile.client_id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Token révoqué" });
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié !", description: "Token copié dans le presse-papier" });
  };

  const maskToken = (token: string) => {
    return token.substring(0, 12) + '•••••••••••••••••';
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mes Tokens API</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos tokens pour les portails tracking et retours
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Créer un token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un nouveau token API</DialogTitle>
              <DialogDescription>
                Ce token permettra d'intégrer les portails sur votre site
              </DialogDescription>
            </DialogHeader>

            {showToken ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="w-4 h-4" />
                  <AlertDescription>
                    Token créé ! Copiez-le maintenant, il ne sera plus visible.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Votre token API</Label>
                  <div className="flex gap-2">
                    <Input
                      value={showToken}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(showToken)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => {
                    setShowToken(null);
                    setDialogOpen(false);
                  }}
                >
                  Fermer
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom du token *</Label>
                  <Input
                    id="nom"
                    placeholder="Widget tracking site e-commerce"
                    value={nomToken}
                    onChange={(e) => setNomToken(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type d'accès *</Label>
                  <Select value={typeAcces} onValueChange={setTypeAcces}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tracking">Tracking uniquement</SelectItem>
                      <SelectItem value="retours">Retours uniquement</SelectItem>
                      <SelectItem value="both">Tracking + Retours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="domaines">Domaines autorisés (optionnel)</Label>
                  <Input
                    id="domaines"
                    placeholder="monsite.com, www.monsite.com"
                    value={domaines}
                    onChange={(e) => setDomaines(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Séparez par des virgules. Laissez vide pour autoriser tous les domaines.
                  </p>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={() => createTokenMutation.mutate()}
                    disabled={!nomToken || createTokenMutation.isPending}
                  >
                    Créer le token
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Info */}
      <Alert>
        <Globe className="w-4 h-4" />
        <AlertDescription>
          Les tokens API vous permettent d'intégrer les portails tracking et retours sur votre site e-commerce.
          Vos clients pourront suivre leurs commandes et demander des retours directement depuis votre site.
        </AlertDescription>
      </Alert>

      {/* Liste tokens */}
      <Card>
        <CardHeader>
          <CardTitle>Tokens actifs</CardTitle>
          <CardDescription>
            Gérez vos tokens d'accès aux portails publics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Domaines</TableHead>
                <TableHead>Utilisations</TableHead>
                <TableHead>Dernière utilisation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Chargement...</TableCell>
                </TableRow>
              ) : tokens && tokens.length > 0 ? (
                tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.nom_token}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {token.type_acces === 'both' ? 'Tracking + Retours' :
                         token.type_acces === 'tracking' ? 'Tracking' : 'Retours'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono">{maskToken(token.token)}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(token.token)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {token.domaines_autorises && token.domaines_autorises.length > 0 ? (
                        <div className="text-xs">
                          {token.domaines_autorises.slice(0, 2).join(', ')}
                          {token.domaines_autorises.length > 2 && ` +${token.domaines_autorises.length - 2}`}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tous</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {token.nb_requetes_total.toLocaleString()} req.
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Limite: {token.rate_limit_par_heure}/h
                      </div>
                    </TableCell>
                    <TableCell>
                      {token.derniere_utilisation ? (
                        <div className="text-xs">
                          {format(new Date(token.derniere_utilisation), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Jamais</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={token.actif ? 'default' : 'destructive'}>
                        {token.actif ? 'Actif' : 'Révoqué'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {token.actif && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Êtes-vous sûr de vouloir révoquer ce token ?')) {
                              revokeTokenMutation.mutate(token.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Aucun token créé. Créez-en un pour intégrer les portails sur votre site.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Documentation intégration */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code className="w-5 h-5" />
            Intégrer les portails sur votre site
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="font-semibold mb-2">Option 1 - Iframe (le plus simple)</div>
            <pre className="bg-white border rounded p-3 overflow-x-auto text-xs">
{`<iframe
  src="https://votre-wms.com/public/tracking?token=VOTRE_TOKEN"
  width="100%"
  height="600px"
  frameborder="0"
></iframe>`}
            </pre>
          </div>

          <div>
            <div className="font-semibold mb-2">Option 2 - Lien direct</div>
            <pre className="bg-white border rounded p-3 overflow-x-auto text-xs">
{`<a href="https://votre-wms.com/public/tracking?token=VOTRE_TOKEN" target="_blank">
  Suivre ma commande
</a>`}
            </pre>
          </div>

          <div>
            <div className="font-semibold mb-2">Option 3 - API JavaScript</div>
            <pre className="bg-white border rounded p-3 overflow-x-auto text-xs">
{`fetch('https://api.votre-wms.com/rpc/api_public_track_commande', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    p_api_token: 'VOTRE_TOKEN',
    p_numero_commande: 'CMD-20251118-00001'
  })
})
.then(r => r.json())
.then(data => console.log(data));`}
            </pre>
          </div>

          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Remplacez <code>VOTRE_TOKEN</code> par le token que vous venez de créer.
              Pour le portail retours, utilisez <code>/public/retours</code> au lieu de <code>/public/tracking</code>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
