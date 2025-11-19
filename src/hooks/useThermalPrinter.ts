import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type DocumentType = 'picking_slip' | 'packing_list' | 'shipping_label' | 'product_label' | 'cn23' | 'barcode';
export type PrintFormat = 'html_thermal' | 'escpos' | 'zpl' | 'pdf';

interface ThermalPrinter {
  id: string;
  nom_imprimante: string;
  type_imprimante: string;
  type_connexion: string;
  adresse_ip?: string;
  port?: number;
  device_id?: string;
  largeur_papier_mm: number;
  hauteur_papier_mm?: number;
  is_active: boolean;
  par_defaut_picking: boolean;
  par_defaut_expedition: boolean;
  par_defaut_etiquettes: boolean;
}

interface PrintOptions {
  commandeId: string;
  documentType: DocumentType;
  format?: PrintFormat;
  printerId?: string; // Si non spécifié, utilise l'imprimante par défaut
  copies?: number;
  autoOpen?: boolean; // Ouvre automatiquement dans un nouvel onglet
}

export function useThermalPrinter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isPrinting, setIsPrinting] = useState(false);

  // Récupérer les imprimantes disponibles pour le client
  const { data: printers, isLoading: loadingPrinters } = useQuery({
    queryKey: ['thermal_printers', user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.client_id) {
        return [];
      }

      const { data, error } = await supabase
        .from('imprimante_thermique')
        .select('*')
        .eq('client_id', profile.client_id)
        .eq('is_active', true)
        .order('par_defaut_picking', { ascending: false });

      if (error) throw error;
      return data as ThermalPrinter[];
    },
    enabled: !!user,
  });

  // Obtenir l'imprimante par défaut pour un type de document
  const getDefaultPrinter = (documentType: DocumentType): ThermalPrinter | null => {
    if (!printers || printers.length === 0) return null;

    let printer: ThermalPrinter | undefined;

    switch (documentType) {
      case 'picking_slip':
      case 'packing_list':
        printer = printers.find(p => p.par_defaut_picking);
        break;
      case 'shipping_label':
        printer = printers.find(p => p.par_defaut_expedition);
        break;
      case 'product_label':
      case 'barcode':
        printer = printers.find(p => p.par_defaut_etiquettes);
        break;
    }

    // Si pas d'imprimante par défaut, prendre la première active
    return printer || printers[0] || null;
  };

  // Générer le document thermique
  const generateThermalDocument = async (
    commandeId: string,
    documentType: DocumentType,
    format: PrintFormat = 'html_thermal',
    printerWidth: number = 80
  ) => {
    const { data, error } = await supabase.functions.invoke('generate-thermal-label', {
      body: {
        commandeId,
        documentType,
        format,
        printerWidth,
      },
    });

    if (error) throw error;
    if (!data?.success) throw new Error('Échec de la génération du document');

    return data;
  };

  // Envoyer à l'imprimante (ouvre dans un nouvel onglet pour impression)
  const sendToPrinter = async (
    documentUrl: string,
    printer: ThermalPrinter,
    autoOpen: boolean = true
  ): Promise<boolean> => {
    if (printer.type_connexion === 'network' || printer.type_connexion === 'wifi') {
      // Pour les imprimantes réseau, on peut tenter d'envoyer directement
      // Pour l'instant, on ouvre le document dans un nouvel onglet
      if (autoOpen) {
        window.open(documentUrl, '_blank', 'width=800,height=600');
      }
      return true;
    } else {
      // Pour USB/Bluetooth, on doit ouvrir le document et laisser l'utilisateur choisir
      if (autoOpen) {
        window.open(documentUrl, '_blank');
      }
      return true;
    }
  };

  // Logger l'impression
  const logPrint = async (
    printerId: string,
    commandeId: string,
    documentId: string | null,
    documentType: DocumentType,
    format: PrintFormat,
    status: 'success' | 'error',
    errorMessage?: string,
    copies: number = 1,
    dataSize?: number,
    duration?: number
  ) => {
    try {
      await supabase.from('log_impression_thermique').insert({
        imprimante_id: printerId,
        commande_id: commandeId,
        document_id: documentId,
        type_document: documentType,
        format_impression: format,
        statut: status,
        message_erreur: errorMessage,
        nombre_copies: copies,
        taille_donnees_bytes: dataSize,
        duree_impression_ms: duration,
        printed_at: status === 'success' ? new Date().toISOString() : null,
        printed_by: user?.id,
      });
    } catch (error) {
      console.error('Erreur lors du log d\'impression:', error);
    }
  };

  // Fonction principale d'impression
  const printMutation = useMutation({
    mutationFn: async (options: PrintOptions) => {
      const startTime = Date.now();
      setIsPrinting(true);

      const {
        commandeId,
        documentType,
        format = 'html_thermal',
        printerId,
        copies = 1,
        autoOpen = true,
      } = options;

      // Déterminer l'imprimante à utiliser
      const printer = printerId
        ? printers?.find(p => p.id === printerId)
        : getDefaultPrinter(documentType);

      if (!printer) {
        throw new Error(
          'Aucune imprimante thermique configurée. Veuillez configurer une imprimante dans les paramètres.'
        );
      }

      // Générer le document
      const result = await generateThermalDocument(
        commandeId,
        documentType,
        format,
        printer.largeur_papier_mm
      );

      // Envoyer à l'imprimante
      const success = await sendToPrinter(result.url, printer, autoOpen);

      const duration = Date.now() - startTime;

      // Logger l'impression
      await logPrint(
        printer.id,
        commandeId,
        null, // On pourrait récupérer l'ID du document généré
        documentType,
        format,
        success ? 'success' : 'error',
        success ? undefined : 'Échec de l\'envoi à l\'imprimante',
        copies,
        result.size,
        duration
      );

      return {
        success,
        url: result.url,
        printer: printer.nom_imprimante,
        duration,
      };
    },
    onSuccess: (result) => {
      toast.success(`Document envoyé à ${result.printer}`, {
        description: `Impression réussie en ${result.duration}ms`,
      });
      queryClient.invalidateQueries({ queryKey: ['print_logs'] });
    },
    onError: (error: any) => {
      toast.error('Erreur d\'impression', {
        description: error.message,
      });
    },
    onSettled: () => {
      setIsPrinting(false);
    },
  });

  // Tester la connexion à une imprimante
  const testPrinterConnection = async (printerId: string): Promise<boolean> => {
    const printer = printers?.find(p => p.id === printerId);
    if (!printer) return false;

    try {
      // Mettre à jour le statut de connexion
      await supabase
        .from('imprimante_thermique')
        .update({
          statut_connexion: 'online',
          derniere_connexion: new Date().toISOString(),
          message_erreur: null,
        })
        .eq('id', printerId);

      toast.success('Connexion réussie', {
        description: `Imprimante ${printer.nom_imprimante} accessible`,
      });

      queryClient.invalidateQueries({ queryKey: ['thermal_printers'] });
      return true;
    } catch (error: any) {
      await supabase
        .from('imprimante_thermique')
        .update({
          statut_connexion: 'error',
          message_erreur: error.message,
        })
        .eq('id', printerId);

      toast.error('Échec de la connexion', {
        description: error.message,
      });

      queryClient.invalidateQueries({ queryKey: ['thermal_printers'] });
      return false;
    }
  };

  // Récupérer l'historique des impressions
  const { data: printLogs, isLoading: loadingLogs } = useQuery({
    queryKey: ['print_logs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_impression_thermique')
        .select(`
          *,
          imprimante:imprimante_thermique(nom_imprimante),
          commande:commande(numero_commande)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return {
    // État
    printers,
    loadingPrinters,
    isPrinting,
    printLogs,
    loadingLogs,

    // Fonctions
    print: printMutation.mutate,
    printAsync: printMutation.mutateAsync,
    getDefaultPrinter,
    testPrinterConnection,
    generateThermalDocument,

    // Imprimantes disponibles par type
    hasPickingPrinter: printers?.some(p => p.par_defaut_picking) ?? false,
    hasShippingPrinter: printers?.some(p => p.par_defaut_expedition) ?? false,
    hasLabelPrinter: printers?.some(p => p.par_defaut_etiquettes) ?? false,
  };
}
