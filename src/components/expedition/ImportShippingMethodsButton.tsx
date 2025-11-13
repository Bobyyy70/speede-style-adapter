import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TransporteurRule } from '@/pages/expedition/types';

export function ImportShippingMethodsButton({ 
  onImportSuccess 
}: { 
  onImportSuccess: (rules: TransporteurRule[]) => void 
}) {
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    
    try {
      // 1. Appeler la fonction edge d'import
      const { data: importResult, error: importError } = await supabase.functions.invoke(
        'sendcloud-import-shipping-methods'
      );

      if (importError) throw importError;

      toast.success(
        `Import réussi : ${importResult.imported} nouveaux, ${importResult.updated} mis à jour`
      );

      // 2. Récupérer les services importés depuis Supabase
      const { data: services, error: fetchError } = await (supabase as any)
        .from('transporteur_service')
        .select(`
          id,
          code_service,
          nom_affichage,
          sendcloud_shipping_method_id,
          transporteur_id,
          transporteur_configuration!inner(
            code_transporteur,
            nom_complet
          )
        `)
        .eq('actif', true)
        .not('sendcloud_shipping_method_id', 'is', null);

      if (fetchError) throw fetchError;

      // 3. Mapper automatiquement vers les règles
      const autoRules: TransporteurRule[] = services.map((service: any) => {
        // Mapping intelligent des noms de transporteurs
        let carrier: TransporteurRule['carrier'] = 'Autre';
        const carrierCode = service.transporteur_configuration.code_transporteur.toUpperCase();
        
        if (carrierCode.includes('FEDEX')) carrier = 'FedEx';
        else if (carrierCode.includes('COLISSIMO')) carrier = 'Colissimo';
        else if (carrierCode.includes('MONDIAL') || carrierCode.includes('RELAY')) {
          carrier = 'Mondial Relay';
        }

        return {
          id: crypto.randomUUID(),
          carrier,
          service: service.nom_affichage,
          shipping_method_id: service.sendcloud_shipping_method_id,
          conditions: '', // À remplir manuellement si besoin
        };
      });

      // 4. Retourner les règles au parent
      onImportSuccess(autoRules);
      
      toast.success(
        `${autoRules.length} règles générées automatiquement`,
        { duration: 5000 }
      );

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Erreur d'import : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleImport} 
      disabled={loading}
      variant="outline"
      className="gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Import en cours...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Importer depuis SendCloud
        </>
      )}
    </Button>
  );
}
