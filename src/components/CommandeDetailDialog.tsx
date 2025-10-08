import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Truck, FileText, Clock, MapPin, User, Mail, Phone, Euro, Weight, Play, Send, Download, Printer, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DocumentsSection } from "./expedition/DocumentsSection";
import { ServicesSection } from "./expedition/ServicesSection";
import { HistoireTimeline } from "./expedition/HistoireTimeline";

interface CommandeDetailDialogProps {
  commandeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CommandeDetailDialog = ({ commandeId, open, onOpenChange, onSuccess }: CommandeDetailDialogProps) => {
  const { toast } = useToast();

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        handlePrint();
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        handleDownloadAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Fetch commande complète
  const { data: commande, refetch } = useQuery({
    queryKey: ["commande", commandeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commande")
        .select("*")
        .eq("id", commandeId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!commandeId,
  });

  // Fetch lignes de commande
  const { data: lignes } = useQuery({
    queryKey: ["lignes_commande", commandeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ligne_commande")
        .select("*")
        .eq("commande_id", commandeId)
        .order("date_creation", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!commandeId,
  });

  if (!commande) return null;

  const getStatutBadge = (statut: string) => {
    const statutMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "En attente de réappro": { label: "En attente", variant: "secondary" },
      "prete": { label: "Prêt à préparer", variant: "outline" },
      "En préparation": { label: "En préparation", variant: "default" },
      "Expédiée": { label: "Expédiée", variant: "default" },
    };
    const config = statutMap[statut] || { label: statut, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handlePrint = () => {
    window.print();
    toast({ title: "Impression lancée" });
  };

  const handleDownloadAll = () => {
    // This will be handled by DocumentsSection component
    toast({ title: "Téléchargement en cours..." });
  };

  const handleStartPreparation = async () => {
    if (!commandeId) return;
    try {
      const { error } = await supabase
        .from("commande")
        .update({ statut_wms: "En préparation" })
        .eq("id", commandeId);
      
      if (error) throw error;
      toast({ title: "Préparation lancée" });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de lancer la préparation", variant: "destructive" });
    }
  };

  const canStartPreparation = commande?.statut_wms === "Prêt à préparer";
  const canCreateShipment = commande?.statut_wms === "prete";

  const tagsArray = Array.isArray(commande?.tags) ? commande.tags : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Package className="h-6 w-6" />
                Commande {commande.numero_commande}
              </DialogTitle>
              <DialogDescription>
                Fiche logistique complète
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatutBadge(commande.statut_wms)}
              <Badge variant="outline">{commande.source}</Badge>
            </div>
          </div>
        </DialogHeader>

        {/* En-tête avec informations clés */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Client</span>
            </div>
            <div className="font-semibold">{commande.nom_client}</div>
            <div className="text-xs text-muted-foreground">{commande.email_client}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Valeur</span>
            </div>
            <div className="text-2xl font-bold text-primary">
              {commande.valeur_totale.toFixed(2)} {commande.devise}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Poids total</span>
            </div>
            <div className="text-xl font-semibold">
              {commande.poids_total ? `${commande.poids_total} kg` : "Non calculé"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Créée le</span>
            </div>
            <div className="text-sm font-medium">
              {new Date(commande.date_creation).toLocaleDateString('fr-FR')}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(commande.date_creation).toLocaleTimeString('fr-FR')}
            </div>
          </div>
        </div>

        {/* Tags */}
        {tagsArray.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Tags:</span>
            {tagsArray.map((tag, i) => (
              <Badge key={i} variant="secondary">{tag}</Badge>
            ))}
          </div>
        )}

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="produits">Produits</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="services">Services & Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Adresse de livraison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Adresse de livraison
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="font-semibold">{commande.adresse_nom}</div>
                  <div>{commande.adresse_ligne_1}</div>
                  {commande.adresse_ligne_2 && <div>{commande.adresse_ligne_2}</div>}
                  <div>{commande.code_postal} {commande.ville}</div>
                  <div className="font-medium">{commande.pays_code}</div>
                  {commande.telephone_client && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {commande.telephone_client}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Adresse de facturation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Adresse de facturation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {commande.facturation_nom ? (
                    <>
                      <div className="font-semibold">{commande.facturation_nom}</div>
                      <div>{commande.facturation_ligne_1}</div>
                      {commande.facturation_ligne_2 && <div>{commande.facturation_ligne_2}</div>}
                      <div>{commande.facturation_code_postal} {commande.facturation_ville}</div>
                      <div className="font-medium">{commande.facturation_pays_code}</div>
                    </>
                  ) : (
                    <div className="text-muted-foreground text-sm">Identique à l'adresse de livraison</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Transport */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Informations de transport
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Transporteur</div>
                    <div className="font-semibold">
                      {commande.transporteur_choisi || commande.transporteur || "Non assigné"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Méthode</div>
                    <div className="font-semibold">{commande.methode_expedition || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Poids réel</div>
                    <div className="font-semibold">
                      {commande.poids_reel_kg ? `${commande.poids_reel_kg} kg` : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Poids volumétrique</div>
                    <div className="font-semibold">
                      {commande.poids_volumetrique_kg ? `${commande.poids_volumetrique_kg} kg` : "-"}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">SendCloud</div>
                  {commande.sendcloud_id && (
                    <div className="text-sm">ID: <span className="font-mono">{commande.sendcloud_id}</span></div>
                  )}
                  {commande.tracking_number && (
                    <div className="text-sm">
                      Tracking: <a href={commande.tracking_url || "#"} target="_blank" rel="noopener" className="font-mono text-primary hover:underline">
                        {commande.tracking_number}
                      </a>
                    </div>
                  )}
                  {commande.label_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={commande.label_url} target="_blank" rel="noopener">
                        Voir l'étiquette
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="produits" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Produits commandés</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Nom produit</TableHead>
                      <TableHead className="text-center">Qté commandée</TableHead>
                      <TableHead className="text-center">Qté préparée</TableHead>
                      <TableHead className="text-right">Prix unitaire</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignes && lignes.length > 0 ? (
                      lignes.map((ligne) => (
                        <TableRow key={ligne.id}>
                          <TableCell className="font-mono text-sm">{ligne.produit_reference}</TableCell>
                          <TableCell>{ligne.produit_nom}</TableCell>
                          <TableCell className="text-center">{ligne.quantite_commandee}</TableCell>
                          <TableCell className="text-center">
                            <span className={ligne.quantite_preparee === ligne.quantite_commandee ? "text-green-600 font-semibold" : ""}>
                              {ligne.quantite_preparee}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {ligne.prix_unitaire ? `${ligne.prix_unitaire.toFixed(2)} €` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {ligne.valeur_totale ? `${ligne.valeur_totale.toFixed(2)} €` : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={ligne.statut_ligne === "preparee" ? "default" : "secondary"}>
                              {ligne.statut_ligne}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Aucune ligne de commande
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <DocumentsSection commandeId={commandeId} commande={commande} />
          </TabsContent>

          <TabsContent value="services" className="space-y-4 mt-4">
            <div className="space-y-4">
              <ServicesSection commandeId={commandeId} />
              <HistoireTimeline commande={commande} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions Bar */}
        <div className="border-t bg-muted/30 px-6 py-4 mt-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {canStartPreparation && (
                <Button onClick={handleStartPreparation} size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Lancer la préparation
                </Button>
              )}
              {!commande.label_url && !commande.sendcloud_shipment_id && (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={async () => {
                    try {
                      const { data, error } = await supabase.functions.invoke('sendcloud-create-parcel', {
                        body: { commande_id: commandeId },
                      });

                      if (error) throw error;

                      if (data.success) {
                        toast({ title: 'Étiquette SendCloud générée' });
                        refetch();
                        onSuccess?.();
                      } else {
                        toast({ title: 'Erreur', description: data.error || 'Erreur lors de la création', variant: 'destructive' });
                      }
                    } catch (error: any) {
                      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                    }
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Créer étiquette SendCloud
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer (P)
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                <Download className="h-4 w-4 mr-2" />
                Tout télécharger (D)
              </Button>
              <Button variant="ghost" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Ajouter un commentaire
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}
