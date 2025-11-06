import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Package,
  Truck,
  MapPin,
  User,
  Mail,
  Phone,
  Euro,
  Weight,
  Building2,
  FileText,
  Shield,
  Clock,
  Download,
  ExternalLink,
  Globe,
  Tag,
  Barcode as BarcodeIcon,
} from "lucide-react";
import Barcode from 'react-barcode';
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ORDER_STATUS_LABELS, getStatutBadgeVariant } from "@/lib/orderStatuses";
import { HistoireTimeline } from "./expedition/HistoireTimeline";

interface FicheCommandeCompleteProps {
  commande: any; // Remplacer par le type approprié
  lignes?: any[]; // Lignes de commande
  showTimeline?: boolean;
  showProducts?: boolean;
  compact?: boolean; // Mode compact pour modal
}

export function FicheCommandeComplete({
  commande,
  lignes = [],
  showTimeline = true,
  showProducts = true,
  compact = false,
}: FicheCommandeCompleteProps) {
  if (!commande) return null;

  const tagsArray = Array.isArray(commande.tags) ? commande.tags : [];
  const isInternational = commande.pays_code !== 'FR';

  return (
    <div className={`${compact ? 'space-y-3' : 'space-y-6'}`}>
      {/* EN-TÊTE */}
      <Card>
        <CardHeader className={compact ? 'pb-3' : ''}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-muted-foreground" />
                <CardTitle className="text-3xl">
                  Commande {commande.numero_commande}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Créée le {format(new Date(commande.date_creation), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Barcode value={commande.numero_commande} height={40} width={1.2} displayValue={false} />
              <Badge variant={getStatutBadgeVariant(commande.statut_wms)} className="text-base px-3 py-1">
                {ORDER_STATUS_LABELS[commande.statut_wms] || commande.statut_wms}
              </Badge>
              {commande.source && <Badge variant="outline">{commande.source}</Badge>}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* TAGS */}
      {tagsArray.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="h-4 w-4 text-muted-foreground" />
          {tagsArray.map((tag: string, i: number) => (
            <Badge key={i} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* INFORMATIONS COMMERCIALES */}
      <div className={`grid grid-cols-2 md:grid-cols-4 ${compact ? 'gap-2' : 'gap-4'}`}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Euro className="h-4 w-4 text-primary" />
              Valeur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {commande.valeur_totale?.toFixed(2) || '0.00'} {commande.devise || 'EUR'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground" />
              Poids
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {commande.poids_total ? `${commande.poids_total} kg` : "Non calculé"}
            </div>
          </CardContent>
        </Card>

        {commande.incoterm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Incoterm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{commande.incoterm}</div>
            </CardContent>
          </Card>
        )}

        {commande.priorite_expedition && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Priorité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold capitalize">{commande.priorite_expedition}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ADRESSES */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${compact ? 'gap-2' : 'gap-4'}`}>
        {/* EXPÉDITEUR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Expéditeur (From)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {commande.expediteur_entreprise ? (
              <>
                <div>
                  <div className="text-sm text-muted-foreground">Entreprise</div>
                  <div className="font-semibold">{commande.expediteur_entreprise}</div>
                </div>
                {commande.expediteur_nom && (
                  <div>
                    <div className="text-sm text-muted-foreground">Contact</div>
                    <div className="font-medium">{commande.expediteur_nom}</div>
                  </div>
                )}
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Adresse</div>
                  <div className="space-y-1">
                    <div>{commande.expediteur_adresse_ligne_1}</div>
                    {commande.expediteur_adresse_ligne_2 && (
                      <div>{commande.expediteur_adresse_ligne_2}</div>
                    )}
                    <div className="font-medium">
                      {commande.expediteur_code_postal} {commande.expediteur_ville}
                    </div>
                    <div className="font-semibold text-primary">{commande.expediteur_pays_code}</div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  {commande.expediteur_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${commande.expediteur_email}`} className="text-primary hover:underline">
                        {commande.expediteur_email}
                      </a>
                    </div>
                  )}
                  {commande.expediteur_telephone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${commande.expediteur_telephone}`} className="text-primary hover:underline">
                        {commande.expediteur_telephone}
                      </a>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground italic">Non renseigné</div>
            )}
          </CardContent>
        </Card>

        {/* DESTINATAIRE */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              Destinataire (To)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Nom</div>
              <div className="font-semibold">{commande.adresse_nom || commande.nom_client}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm text-muted-foreground mb-1">Adresse de livraison</div>
              <div className="space-y-1">
                <div>{commande.adresse_ligne_1}</div>
                {commande.adresse_ligne_2 && <div>{commande.adresse_ligne_2}</div>}
                <div className="font-medium">
                  {commande.code_postal} {commande.ville}
                </div>
                <div className="font-semibold text-primary">{commande.pays_code}</div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              {commande.email_client && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${commande.email_client}`} className="text-primary hover:underline">
                    {commande.email_client}
                  </a>
                </div>
              )}
              {commande.telephone_client && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${commande.telephone_client}`} className="text-primary hover:underline">
                    {commande.telephone_client}
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Adresse de facturation supprimée - facturation transport toujours sous Speed E-Log */}

      {/* TRANSPORT & TRACKING - Version Compacte */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Transport
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-muted/30 p-3 rounded-lg">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expéditeur:</span>
              <span className="font-semibold">{commande.expediteur_entreprise || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transporteur:</span>
              <span className="font-semibold">{commande.transporteur || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service:</span>
              <Badge variant="outline" className="text-xs">{commande.service_transport || commande.methode_expedition || "-"}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Poids réel:</span>
              <span className="font-semibold">{commande.poids_reel_kg ? `${commande.poids_reel_kg} kg` : "-"}</span>
            </div>
            <div className="flex justify-between col-span-2">
              <span className="text-muted-foreground">Poids volumétrique:</span>
              <span className="font-semibold text-orange-600">{commande.poids_volumetrique_kg ? `${commande.poids_volumetrique_kg} kg (taxé)` : "-"}</span>
            </div>
            <div className="col-span-2 flex justify-center pt-2 border-t border-border/50">
              <Barcode value={commande.numero_commande} height={35} width={1.3} fontSize={10} />
            </div>
          </div>

          {(commande.sendcloud_id || commande.tracking_number || commande.label_url) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="text-sm font-medium text-muted-foreground">SendCloud</div>
                {commande.sendcloud_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">ID:</span>
                    <code className="font-mono bg-muted px-2 py-1 rounded">{commande.sendcloud_id}</code>
                  </div>
                )}
                {commande.tracking_number && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Tracking:</span>
                    {commande.tracking_url ? (
                      <a
                        href={commande.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary hover:underline flex items-center gap-1"
                      >
                        {commande.tracking_number}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <code className="font-mono">{commande.tracking_number}</code>
                    )}
                  </div>
                )}
                {commande.label_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={commande.label_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger l'étiquette
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* INFORMATIONS DOUANIÈRES (si international) */}
      {isInternational && (commande.nature_marchandise || commande.code_hs) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-600" />
              Informations douanières
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {commande.nature_marchandise && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Nature de la marchandise</div>
                  <div className="font-medium">{commande.nature_marchandise}</div>
                </div>
              )}
              {commande.code_hs && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Code HS</div>
                  <div className="font-mono">{commande.code_hs}</div>
                </div>
              )}
              {commande.valeur_declaree_douane && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Valeur déclarée</div>
                  <div className="font-semibold">
                    {commande.valeur_declaree_douane} {commande.devise}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SERVICES & OPTIONS */}
      {(commande.assurance_demandee || commande.signature_requise) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600" />
              Services & Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {commande.assurance_demandee && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Assurance</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Oui</Badge>
                    {commande.valeur_assuree && (
                      <span className="font-semibold">
                        {commande.valeur_assuree} {commande.devise}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {commande.signature_requise && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Signature</div>
                  <Badge variant="default">Requise</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRODUITS */}
      {showProducts && lignes && lignes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produits commandés ({lignes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Nom produit</TableHead>
                  <TableHead className="text-center">Qté cmd.</TableHead>
                  <TableHead className="text-center">Qté prép.</TableHead>
                  <TableHead className="text-right">Prix unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((ligne: any) => (
                  <TableRow key={ligne.id}>
                    <TableCell className="font-mono text-sm">{ligne.produit_reference}</TableCell>
                    <TableCell className="font-medium">{ligne.produit_nom}</TableCell>
                    <TableCell className="text-center">{ligne.quantite_commandee}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          ligne.quantite_preparee === ligne.quantite_commandee
                            ? "text-green-600 font-semibold"
                            : "text-orange-600"
                        }
                      >
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
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TIMELINE / HISTORIQUE */}
      {showTimeline && <HistoireTimeline commande={commande} />}
    </div>
  );
}
