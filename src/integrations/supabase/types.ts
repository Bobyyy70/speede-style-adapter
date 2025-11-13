export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alerte_performance_transporteur: {
        Row: {
          actions_recommandees: Json | null
          date_creation: string | null
          date_traitement: string | null
          degradation_pourcentage: number | null
          id: string
          message: string
          score_actuel: number | null
          score_precedent: number | null
          severite: string
          statut: string | null
          traitee_par: string | null
          transporteur_code: string
          type_alerte: string
        }
        Insert: {
          actions_recommandees?: Json | null
          date_creation?: string | null
          date_traitement?: string | null
          degradation_pourcentage?: number | null
          id?: string
          message: string
          score_actuel?: number | null
          score_precedent?: number | null
          severite: string
          statut?: string | null
          traitee_par?: string | null
          transporteur_code: string
          type_alerte: string
        }
        Update: {
          actions_recommandees?: Json | null
          date_creation?: string | null
          date_traitement?: string | null
          degradation_pourcentage?: number | null
          id?: string
          message?: string
          score_actuel?: number | null
          score_precedent?: number | null
          severite?: string
          statut?: string | null
          traitee_par?: string | null
          transporteur_code?: string
          type_alerte?: string
        }
        Relationships: []
      }
      alerte_poids_volumetrique: {
        Row: {
          client_id: string | null
          commande_id: string
          date_creation: string | null
          date_traitement: string | null
          ecart_kg: number
          ecart_pourcentage: number
          facteur_division_utilise: number | null
          id: string
          notes_traitement: string | null
          numero_commande: string
          poids_reel_kg: number
          poids_volumetrique_kg: number
          recommandations: Json | null
          statut: string | null
          traite_par: string | null
          transporteur_code: string | null
        }
        Insert: {
          client_id?: string | null
          commande_id: string
          date_creation?: string | null
          date_traitement?: string | null
          ecart_kg: number
          ecart_pourcentage: number
          facteur_division_utilise?: number | null
          id?: string
          notes_traitement?: string | null
          numero_commande: string
          poids_reel_kg: number
          poids_volumetrique_kg: number
          recommandations?: Json | null
          statut?: string | null
          traite_par?: string | null
          transporteur_code?: string | null
        }
        Update: {
          client_id?: string | null
          commande_id?: string
          date_creation?: string | null
          date_traitement?: string | null
          ecart_kg?: number
          ecart_pourcentage?: number
          facteur_division_utilise?: number | null
          id?: string
          notes_traitement?: string | null
          numero_commande?: string
          poids_reel_kg?: number
          poids_volumetrique_kg?: number
          recommandations?: Json | null
          statut?: string | null
          traite_par?: string | null
          transporteur_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerte_poids_volumetrique_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerte_poids_volumetrique_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "alerte_poids_volumetrique_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerte_poids_volumetrique_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerte_poids_volumetrique_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      alerte_poids_volumetrique_config: {
        Row: {
          actif: boolean | null
          date_creation: string | null
          date_modification: string | null
          description: string | null
          emails_notification: string[] | null
          frequence_verification: string | null
          id: string
          notification_email: boolean | null
          seuil_ecart_pourcentage: number
          seuil_poids_minimum_kg: number | null
        }
        Insert: {
          actif?: boolean | null
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          emails_notification?: string[] | null
          frequence_verification?: string | null
          id?: string
          notification_email?: boolean | null
          seuil_ecart_pourcentage?: number
          seuil_poids_minimum_kg?: number | null
        }
        Update: {
          actif?: boolean | null
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          emails_notification?: string[] | null
          frequence_verification?: string | null
          id?: string
          notification_email?: boolean | null
          seuil_ecart_pourcentage?: number
          seuil_poids_minimum_kg?: number | null
        }
        Relationships: []
      }
      analyse_optimisation_couts: {
        Row: {
          cout_total_actuel: number | null
          cout_total_optimal: number | null
          date_analyse: string | null
          economies_potentielles: number | null
          generee_par: string | null
          id: string
          metadata: Json | null
          nombre_commandes_analysees: number | null
          nombre_suggestions: number | null
          periode_debut: string
          periode_fin: string
          pourcentage_economie: number | null
        }
        Insert: {
          cout_total_actuel?: number | null
          cout_total_optimal?: number | null
          date_analyse?: string | null
          economies_potentielles?: number | null
          generee_par?: string | null
          id?: string
          metadata?: Json | null
          nombre_commandes_analysees?: number | null
          nombre_suggestions?: number | null
          periode_debut: string
          periode_fin: string
          pourcentage_economie?: number | null
        }
        Update: {
          cout_total_actuel?: number | null
          cout_total_optimal?: number | null
          date_analyse?: string | null
          economies_potentielles?: number | null
          generee_par?: string | null
          id?: string
          metadata?: Json | null
          nombre_commandes_analysees?: number | null
          nombre_suggestions?: number | null
          periode_debut?: string
          periode_fin?: string
          pourcentage_economie?: number | null
        }
        Relationships: []
      }
      attendu_reception: {
        Row: {
          client_id: string | null
          created_by: string | null
          date_arrivee_reelle: string | null
          date_creation: string
          date_modification: string
          date_reception_prevue: string | null
          fournisseur: string | null
          id: string
          instructions_speciales: string | null
          nombre_colis: number | null
          nombre_palettes: number | null
          numero_attendu: string
          numero_tracking: string | null
          poids_total_kg: number | null
          remarques: string | null
          statut: Database["public"]["Enums"]["statut_attendu_reception"]
          transporteur: string | null
          volume_total_m3: number | null
        }
        Insert: {
          client_id?: string | null
          created_by?: string | null
          date_arrivee_reelle?: string | null
          date_creation?: string
          date_modification?: string
          date_reception_prevue?: string | null
          fournisseur?: string | null
          id?: string
          instructions_speciales?: string | null
          nombre_colis?: number | null
          nombre_palettes?: number | null
          numero_attendu: string
          numero_tracking?: string | null
          poids_total_kg?: number | null
          remarques?: string | null
          statut?: Database["public"]["Enums"]["statut_attendu_reception"]
          transporteur?: string | null
          volume_total_m3?: number | null
        }
        Update: {
          client_id?: string | null
          created_by?: string | null
          date_arrivee_reelle?: string | null
          date_creation?: string
          date_modification?: string
          date_reception_prevue?: string | null
          fournisseur?: string | null
          id?: string
          instructions_speciales?: string | null
          nombre_colis?: number | null
          nombre_palettes?: number | null
          numero_attendu?: string
          numero_tracking?: string | null
          poids_total_kg?: number | null
          remarques?: string | null
          statut?: Database["public"]["Enums"]["statut_attendu_reception"]
          transporteur?: string | null
          volume_total_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendu_reception_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendu_reception_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      attendu_transition_log: {
        Row: {
          attendu_id: string
          date_transition: string
          id: string
          metadata: Json | null
          raison: string | null
          statut_nouveau: string
          statut_precedent: string
          utilisateur_id: string | null
        }
        Insert: {
          attendu_id: string
          date_transition?: string
          id?: string
          metadata?: Json | null
          raison?: string | null
          statut_nouveau: string
          statut_precedent: string
          utilisateur_id?: string | null
        }
        Update: {
          attendu_id?: string
          date_transition?: string
          id?: string
          metadata?: Json | null
          raison?: string | null
          statut_nouveau?: string
          statut_precedent?: string
          utilisateur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendu_transition_log_attendu_id_fkey"
            columns: ["attendu_id"]
            isOneToOne: false
            referencedRelation: "attendu_reception"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bac_adresse: {
        Row: {
          allee: string | null
          capacite_max_kg: number | null
          capacite_max_volume: number | null
          code_bac: string
          date_creation: string | null
          date_derniere_activite: string | null
          id: string
          niveau: number | null
          position: string | null
          produit_actuel_id: string | null
          quantite_actuelle: number | null
          statut: string | null
          type_bac: string
          zone: string
        }
        Insert: {
          allee?: string | null
          capacite_max_kg?: number | null
          capacite_max_volume?: number | null
          code_bac: string
          date_creation?: string | null
          date_derniere_activite?: string | null
          id?: string
          niveau?: number | null
          position?: string | null
          produit_actuel_id?: string | null
          quantite_actuelle?: number | null
          statut?: string | null
          type_bac: string
          zone: string
        }
        Update: {
          allee?: string | null
          capacite_max_kg?: number | null
          capacite_max_volume?: number | null
          code_bac?: string
          date_creation?: string | null
          date_derniere_activite?: string | null
          id?: string
          niveau?: number | null
          position?: string | null
          produit_actuel_id?: string | null
          quantite_actuelle?: number | null
          statut?: string | null
          type_bac?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "bac_adresse_produit_actuel_id_fkey"
            columns: ["produit_actuel_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bac_adresse_produit_actuel_id_fkey"
            columns: ["produit_actuel_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      calculateur_volumetrique: {
        Row: {
          commande_id: string | null
          date_calcul: string | null
          est_multi_colis: boolean | null
          id: string
          nombre_bacs_grand: number | null
          nombre_bacs_moyen: number | null
          nombre_bacs_petit: number | null
          nombre_cartons_pcb: number | null
          nombre_colis_total: number | null
          nombre_palettes: number | null
          poids_total_kg: number | null
          services_auto_generes: Json | null
          volume_total_m3: number | null
        }
        Insert: {
          commande_id?: string | null
          date_calcul?: string | null
          est_multi_colis?: boolean | null
          id?: string
          nombre_bacs_grand?: number | null
          nombre_bacs_moyen?: number | null
          nombre_bacs_petit?: number | null
          nombre_cartons_pcb?: number | null
          nombre_colis_total?: number | null
          nombre_palettes?: number | null
          poids_total_kg?: number | null
          services_auto_generes?: Json | null
          volume_total_m3?: number | null
        }
        Update: {
          commande_id?: string | null
          date_calcul?: string | null
          est_multi_colis?: boolean | null
          id?: string
          nombre_bacs_grand?: number | null
          nombre_bacs_moyen?: number | null
          nombre_bacs_petit?: number | null
          nombre_cartons_pcb?: number | null
          nombre_colis_total?: number | null
          nombre_palettes?: number | null
          poids_total_kg?: number | null
          services_auto_generes?: Json | null
          volume_total_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calculateur_volumetrique_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculateur_volumetrique_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculateur_volumetrique_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      client: {
        Row: {
          actif: boolean | null
          adresse: string | null
          date_creation: string | null
          date_modification: string | null
          email_contact: string | null
          id: string
          nom_entreprise: string
          remarques: string | null
          siret: string | null
          telephone: string | null
        }
        Insert: {
          actif?: boolean | null
          adresse?: string | null
          date_creation?: string | null
          date_modification?: string | null
          email_contact?: string | null
          id?: string
          nom_entreprise: string
          remarques?: string | null
          siret?: string | null
          telephone?: string | null
        }
        Update: {
          actif?: boolean | null
          adresse?: string | null
          date_creation?: string | null
          date_modification?: string | null
          email_contact?: string | null
          id?: string
          nom_entreprise?: string
          remarques?: string | null
          siret?: string | null
          telephone?: string | null
        }
        Relationships: []
      }
      client_user_limits: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          max_users: number
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          max_users?: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          max_users?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_user_limits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_user_limits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      commande: {
        Row: {
          adresse_ligne_1: string
          adresse_ligne_2: string | null
          adresse_nom: string
          assurance_demandee: boolean | null
          client_id: string | null
          code_hs: string | null
          code_postal: string
          conditions_paiement: string | null
          date_creation: string
          date_expedition: string | null
          date_expedition_demandee: string | null
          date_expiration_commande: string | null
          date_livraison_estimee: string | null
          date_livraison_reelle: string | null
          date_modification: string
          date_packing: string | null
          date_picking: string | null
          devise: string | null
          documents_douane_requis: string[] | null
          email_client: string | null
          expediteur_adresse_ligne_1: string | null
          expediteur_adresse_ligne_2: string | null
          expediteur_code_postal: string | null
          expediteur_email: string | null
          expediteur_entreprise: string | null
          expediteur_nom: string | null
          expediteur_pays_code: string | null
          expediteur_telephone: string | null
          expediteur_ville: string | null
          facturation_code_postal: string | null
          facturation_ligne_1: string | null
          facturation_ligne_2: string | null
          facturation_nom: string | null
          facturation_pays_code: string | null
          facturation_siret: string | null
          facturation_tva_numero: string | null
          facturation_ville: string | null
          id: string
          incoterm: string | null
          instructions_livraison: string | null
          label_pregenere: boolean | null
          label_source: string | null
          label_url: string | null
          methode_expedition: string | null
          montant_expedition: number | null
          nature_marchandise: string | null
          nom_client: string
          notes_expedition: string | null
          numero_commande: string
          numero_facture_commerciale: string | null
          pays_code: string
          pays_origine_marchandise: string | null
          poids_reel_kg: number | null
          poids_total: number | null
          poids_volumetrique_kg: number | null
          point_relais_id: string | null
          priorite_expedition: string | null
          reference_client: string | null
          reference_interne: string | null
          remarques: string | null
          sendcloud_id: string | null
          sendcloud_reference: string | null
          sendcloud_shipment_id: string | null
          source: string
          sous_client: string | null
          statut_wms: Database["public"]["Enums"]["statut_commande_enum"]
          statut_wms_old: string
          tags: string[] | null
          telephone_client: string | null
          tracking_number: string | null
          tracking_url: string | null
          transporteur: string | null
          transporteur_choisi: string | null
          type_carton_id: string | null
          valeur_assuree: number | null
          valeur_declaree_douane: number | null
          valeur_totale: number
          validation_message: string | null
          validation_requise: boolean | null
          validation_statut: string | null
          ville: string
          zone_livraison: string | null
        }
        Insert: {
          adresse_ligne_1: string
          adresse_ligne_2?: string | null
          adresse_nom: string
          assurance_demandee?: boolean | null
          client_id?: string | null
          code_hs?: string | null
          code_postal: string
          conditions_paiement?: string | null
          date_creation?: string
          date_expedition?: string | null
          date_expedition_demandee?: string | null
          date_expiration_commande?: string | null
          date_livraison_estimee?: string | null
          date_livraison_reelle?: string | null
          date_modification?: string
          date_packing?: string | null
          date_picking?: string | null
          devise?: string | null
          documents_douane_requis?: string[] | null
          email_client?: string | null
          expediteur_adresse_ligne_1?: string | null
          expediteur_adresse_ligne_2?: string | null
          expediteur_code_postal?: string | null
          expediteur_email?: string | null
          expediteur_entreprise?: string | null
          expediteur_nom?: string | null
          expediteur_pays_code?: string | null
          expediteur_telephone?: string | null
          expediteur_ville?: string | null
          facturation_code_postal?: string | null
          facturation_ligne_1?: string | null
          facturation_ligne_2?: string | null
          facturation_nom?: string | null
          facturation_pays_code?: string | null
          facturation_siret?: string | null
          facturation_tva_numero?: string | null
          facturation_ville?: string | null
          id?: string
          incoterm?: string | null
          instructions_livraison?: string | null
          label_pregenere?: boolean | null
          label_source?: string | null
          label_url?: string | null
          methode_expedition?: string | null
          montant_expedition?: number | null
          nature_marchandise?: string | null
          nom_client: string
          notes_expedition?: string | null
          numero_commande: string
          numero_facture_commerciale?: string | null
          pays_code: string
          pays_origine_marchandise?: string | null
          poids_reel_kg?: number | null
          poids_total?: number | null
          poids_volumetrique_kg?: number | null
          point_relais_id?: string | null
          priorite_expedition?: string | null
          reference_client?: string | null
          reference_interne?: string | null
          remarques?: string | null
          sendcloud_id?: string | null
          sendcloud_reference?: string | null
          sendcloud_shipment_id?: string | null
          source: string
          sous_client?: string | null
          statut_wms?: Database["public"]["Enums"]["statut_commande_enum"]
          statut_wms_old?: string
          tags?: string[] | null
          telephone_client?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          transporteur?: string | null
          transporteur_choisi?: string | null
          type_carton_id?: string | null
          valeur_assuree?: number | null
          valeur_declaree_douane?: number | null
          valeur_totale?: number
          validation_message?: string | null
          validation_requise?: boolean | null
          validation_statut?: string | null
          ville: string
          zone_livraison?: string | null
        }
        Update: {
          adresse_ligne_1?: string
          adresse_ligne_2?: string | null
          adresse_nom?: string
          assurance_demandee?: boolean | null
          client_id?: string | null
          code_hs?: string | null
          code_postal?: string
          conditions_paiement?: string | null
          date_creation?: string
          date_expedition?: string | null
          date_expedition_demandee?: string | null
          date_expiration_commande?: string | null
          date_livraison_estimee?: string | null
          date_livraison_reelle?: string | null
          date_modification?: string
          date_packing?: string | null
          date_picking?: string | null
          devise?: string | null
          documents_douane_requis?: string[] | null
          email_client?: string | null
          expediteur_adresse_ligne_1?: string | null
          expediteur_adresse_ligne_2?: string | null
          expediteur_code_postal?: string | null
          expediteur_email?: string | null
          expediteur_entreprise?: string | null
          expediteur_nom?: string | null
          expediteur_pays_code?: string | null
          expediteur_telephone?: string | null
          expediteur_ville?: string | null
          facturation_code_postal?: string | null
          facturation_ligne_1?: string | null
          facturation_ligne_2?: string | null
          facturation_nom?: string | null
          facturation_pays_code?: string | null
          facturation_siret?: string | null
          facturation_tva_numero?: string | null
          facturation_ville?: string | null
          id?: string
          incoterm?: string | null
          instructions_livraison?: string | null
          label_pregenere?: boolean | null
          label_source?: string | null
          label_url?: string | null
          methode_expedition?: string | null
          montant_expedition?: number | null
          nature_marchandise?: string | null
          nom_client?: string
          notes_expedition?: string | null
          numero_commande?: string
          numero_facture_commerciale?: string | null
          pays_code?: string
          pays_origine_marchandise?: string | null
          poids_reel_kg?: number | null
          poids_total?: number | null
          poids_volumetrique_kg?: number | null
          point_relais_id?: string | null
          priorite_expedition?: string | null
          reference_client?: string | null
          reference_interne?: string | null
          remarques?: string | null
          sendcloud_id?: string | null
          sendcloud_reference?: string | null
          sendcloud_shipment_id?: string | null
          source?: string
          sous_client?: string | null
          statut_wms?: Database["public"]["Enums"]["statut_commande_enum"]
          statut_wms_old?: string
          tags?: string[] | null
          telephone_client?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          transporteur?: string | null
          transporteur_choisi?: string | null
          type_carton_id?: string | null
          valeur_assuree?: number | null
          valeur_declaree_douane?: number | null
          valeur_totale?: number
          validation_message?: string | null
          validation_requise?: boolean | null
          validation_statut?: string | null
          ville?: string
          zone_livraison?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "commande_type_carton_id_fkey"
            columns: ["type_carton_id"]
            isOneToOne: false
            referencedRelation: "type_carton"
            referencedColumns: ["id"]
          },
        ]
      }
      commande_transition_log: {
        Row: {
          commande_id: string
          date_transition: string | null
          id: string
          metadata: Json | null
          raison: string | null
          statut_nouveau: Database["public"]["Enums"]["statut_commande_enum"]
          statut_precedent:
            | Database["public"]["Enums"]["statut_commande_enum"]
            | null
          utilisateur_id: string | null
        }
        Insert: {
          commande_id: string
          date_transition?: string | null
          id?: string
          metadata?: Json | null
          raison?: string | null
          statut_nouveau: Database["public"]["Enums"]["statut_commande_enum"]
          statut_precedent?:
            | Database["public"]["Enums"]["statut_commande_enum"]
            | null
          utilisateur_id?: string | null
        }
        Update: {
          commande_id?: string
          date_transition?: string | null
          id?: string
          metadata?: Json | null
          raison?: string | null
          statut_nouveau?: Database["public"]["Enums"]["statut_commande_enum"]
          statut_precedent?:
            | Database["public"]["Enums"]["statut_commande_enum"]
            | null
          utilisateur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commande_transition_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_transition_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_transition_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      commande_validation_log: {
        Row: {
          commande_id: string
          commentaire_validateur: string | null
          date_demande: string | null
          date_reponse: string | null
          destinataires_notification: string[] | null
          id: string
          metadata: Json | null
          notification_envoyee: boolean | null
          raison_blocage: string | null
          regle_id: string | null
          statut_validation: string
          validateur_id: string | null
        }
        Insert: {
          commande_id: string
          commentaire_validateur?: string | null
          date_demande?: string | null
          date_reponse?: string | null
          destinataires_notification?: string[] | null
          id?: string
          metadata?: Json | null
          notification_envoyee?: boolean | null
          raison_blocage?: string | null
          regle_id?: string | null
          statut_validation: string
          validateur_id?: string | null
        }
        Update: {
          commande_id?: string
          commentaire_validateur?: string | null
          date_demande?: string | null
          date_reponse?: string | null
          destinataires_notification?: string[] | null
          id?: string
          metadata?: Json | null
          notification_envoyee?: boolean | null
          raison_blocage?: string | null
          regle_id?: string | null
          statut_validation?: string
          validateur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commande_validation_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_validation_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_validation_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_validation_log_regle_id_fkey"
            columns: ["regle_id"]
            isOneToOne: false
            referencedRelation: "regle_validation_commande"
            referencedColumns: ["id"]
          },
        ]
      }
      config_auto_selection_transporteur: {
        Row: {
          actif: boolean | null
          client_id: string | null
          date_activation: string | null
          date_modification: string | null
          fallback_manuel: boolean | null
          id: string
          metadata: Json | null
          mode_selection: string | null
          regles_prioritaires: Json | null
          seuil_confiance_minimum: number | null
          utiliser_ia: boolean | null
        }
        Insert: {
          actif?: boolean | null
          client_id?: string | null
          date_activation?: string | null
          date_modification?: string | null
          fallback_manuel?: boolean | null
          id?: string
          metadata?: Json | null
          mode_selection?: string | null
          regles_prioritaires?: Json | null
          seuil_confiance_minimum?: number | null
          utiliser_ia?: boolean | null
        }
        Update: {
          actif?: boolean | null
          client_id?: string | null
          date_activation?: string | null
          date_modification?: string | null
          fallback_manuel?: boolean | null
          id?: string
          metadata?: Json | null
          mode_selection?: string | null
          regles_prioritaires?: Json | null
          seuil_confiance_minimum?: number | null
          utiliser_ia?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "config_auto_selection_transporteur_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_auto_selection_transporteur_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      configuration_expediteur: {
        Row: {
          actif: boolean | null
          adresse_ligne_1: string
          adresse_ligne_2: string | null
          client_id: string | null
          code_postal: string
          date_creation: string | null
          date_modification: string | null
          email: string
          entreprise: string
          eori_number: string | null
          est_defaut: boolean | null
          id: string
          nom: string
          pays_code: string
          telephone: string
          vat_number: string | null
          ville: string
        }
        Insert: {
          actif?: boolean | null
          adresse_ligne_1: string
          adresse_ligne_2?: string | null
          client_id?: string | null
          code_postal: string
          date_creation?: string | null
          date_modification?: string | null
          email: string
          entreprise: string
          eori_number?: string | null
          est_defaut?: boolean | null
          id?: string
          nom: string
          pays_code?: string
          telephone: string
          vat_number?: string | null
          ville: string
        }
        Update: {
          actif?: boolean | null
          adresse_ligne_1?: string
          adresse_ligne_2?: string | null
          client_id?: string | null
          code_postal?: string
          date_creation?: string | null
          date_modification?: string | null
          email?: string
          entreprise?: string
          eori_number?: string | null
          est_defaut?: boolean | null
          id?: string
          nom?: string
          pays_code?: string
          telephone?: string
          vat_number?: string | null
          ville?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuration_expediteur_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuration_expediteur_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      contact_destinataire: {
        Row: {
          adresse_ligne_1: string
          adresse_ligne_2: string | null
          adresse_ligne_3: string | null
          client_id: string
          code_postal: string
          date_creation: string
          date_modification: string
          derniere_utilisation: string | null
          digicode: string | null
          email: string | null
          entreprise: string | null
          est_archive: boolean | null
          est_favori: boolean | null
          id: string
          instructions_acces: string | null
          instructions_livraison: string | null
          interphone: string | null
          label_contact: string | null
          nom: string
          pays_code: string
          prenom: string | null
          telephone: string | null
          telephone_mobile: string | null
          utilisation_count: number | null
          ville: string
        }
        Insert: {
          adresse_ligne_1: string
          adresse_ligne_2?: string | null
          adresse_ligne_3?: string | null
          client_id: string
          code_postal: string
          date_creation?: string
          date_modification?: string
          derniere_utilisation?: string | null
          digicode?: string | null
          email?: string | null
          entreprise?: string | null
          est_archive?: boolean | null
          est_favori?: boolean | null
          id?: string
          instructions_acces?: string | null
          instructions_livraison?: string | null
          interphone?: string | null
          label_contact?: string | null
          nom: string
          pays_code: string
          prenom?: string | null
          telephone?: string | null
          telephone_mobile?: string | null
          utilisation_count?: number | null
          ville: string
        }
        Update: {
          adresse_ligne_1?: string
          adresse_ligne_2?: string | null
          adresse_ligne_3?: string | null
          client_id?: string
          code_postal?: string
          date_creation?: string
          date_modification?: string
          derniere_utilisation?: string | null
          digicode?: string | null
          email?: string | null
          entreprise?: string | null
          est_archive?: boolean | null
          est_favori?: boolean | null
          id?: string
          instructions_acces?: string | null
          instructions_livraison?: string | null
          interphone?: string | null
          label_contact?: string | null
          nom?: string
          pays_code?: string
          prenom?: string | null
          telephone?: string | null
          telephone_mobile?: string | null
          utilisation_count?: number | null
          ville?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_destinataire_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_destinataire_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      dashboard_widget_config: {
        Row: {
          date_creation: string | null
          height: number | null
          id: string
          position_x: number
          position_y: number
          user_id: string
          visible: boolean | null
          widget_config: Json
          widget_library_id: string | null
          widget_type: string
          width: number | null
        }
        Insert: {
          date_creation?: string | null
          height?: number | null
          id?: string
          position_x?: number
          position_y?: number
          user_id: string
          visible?: boolean | null
          widget_config: Json
          widget_library_id?: string | null
          widget_type: string
          width?: number | null
        }
        Update: {
          date_creation?: string | null
          height?: number | null
          id?: string
          position_x?: number
          position_y?: number
          user_id?: string
          visible?: boolean | null
          widget_config?: Json
          widget_library_id?: string | null
          widget_type?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widget_config_widget_library_id_fkey"
            columns: ["widget_library_id"]
            isOneToOne: false
            referencedRelation: "dashboard_widget_library"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widget_library: {
        Row: {
          actif: boolean | null
          categorie: string | null
          date_ajout: string | null
          default_config: Json
          description: string | null
          id: string
          nom: string
          preview_image: string | null
          version: number | null
          widget_type: string
        }
        Insert: {
          actif?: boolean | null
          categorie?: string | null
          date_ajout?: string | null
          default_config: Json
          description?: string | null
          id?: string
          nom: string
          preview_image?: string | null
          version?: number | null
          widget_type: string
        }
        Update: {
          actif?: boolean | null
          categorie?: string | null
          date_ajout?: string | null
          default_config?: Json
          description?: string | null
          id?: string
          nom?: string
          preview_image?: string | null
          version?: number | null
          widget_type?: string
        }
        Relationships: []
      }
      decision_transporteur: {
        Row: {
          analyse_ia: string | null
          commande_id: string
          confiance_decision: number | null
          cout_estime: number | null
          date_decision: string | null
          delai_souhaite: string | null
          duree_calcul_ms: number | null
          facteurs_decision: Json | null
          force_manuellement: boolean | null
          id: string
          mode_decision: string | null
          nombre_regles_matchees: number | null
          pays_destination: string | null
          poids_colis: number | null
          raison_forcage: string | null
          recommandation_ia: string | null
          regles_appliquees: Json | null
          score_transporteur: number | null
          transporteur_choisi_code: string
          transporteur_choisi_nom: string
          transporteurs_alternatives: Json | null
        }
        Insert: {
          analyse_ia?: string | null
          commande_id: string
          confiance_decision?: number | null
          cout_estime?: number | null
          date_decision?: string | null
          delai_souhaite?: string | null
          duree_calcul_ms?: number | null
          facteurs_decision?: Json | null
          force_manuellement?: boolean | null
          id?: string
          mode_decision?: string | null
          nombre_regles_matchees?: number | null
          pays_destination?: string | null
          poids_colis?: number | null
          raison_forcage?: string | null
          recommandation_ia?: string | null
          regles_appliquees?: Json | null
          score_transporteur?: number | null
          transporteur_choisi_code: string
          transporteur_choisi_nom: string
          transporteurs_alternatives?: Json | null
        }
        Update: {
          analyse_ia?: string | null
          commande_id?: string
          confiance_decision?: number | null
          cout_estime?: number | null
          date_decision?: string | null
          delai_souhaite?: string | null
          duree_calcul_ms?: number | null
          facteurs_decision?: Json | null
          force_manuellement?: boolean | null
          id?: string
          mode_decision?: string | null
          nombre_regles_matchees?: number | null
          pays_destination?: string | null
          poids_colis?: number | null
          raison_forcage?: string | null
          recommandation_ia?: string | null
          regles_appliquees?: Json | null
          score_transporteur?: number | null
          transporteur_choisi_code?: string
          transporteur_choisi_nom?: string
          transporteurs_alternatives?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      demande_service_personnalise: {
        Row: {
          client_id: string
          created_by: string | null
          date_creation: string | null
          date_modification: string | null
          date_rdv: string | null
          formulaire_data: Json
          hubspot_ticket_id: string | null
          id: string
          prix_estime: number | null
          prix_final: number | null
          remarques_admin: string | null
          service_id: string
          statut: string | null
        }
        Insert: {
          client_id: string
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          date_rdv?: string | null
          formulaire_data: Json
          hubspot_ticket_id?: string | null
          id?: string
          prix_estime?: number | null
          prix_final?: number | null
          remarques_admin?: string | null
          service_id: string
          statut?: string | null
        }
        Update: {
          client_id?: string
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          date_rdv?: string | null
          formulaire_data?: Json
          hubspot_ticket_id?: string | null
          id?: string
          prix_estime?: number | null
          prix_final?: number | null
          remarques_admin?: string | null
          service_id?: string
          statut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demande_service_personnalise_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demande_service_personnalise_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "demande_service_personnalise_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_logistique"
            referencedColumns: ["id"]
          },
        ]
      }
      document_commande: {
        Row: {
          categorie: string
          commande_id: string
          date_generation: string | null
          format: string | null
          genere_par: string | null
          id: string
          nom_fichier: string
          taille_fichier: number | null
          type_document: string
          url_fichier: string
        }
        Insert: {
          categorie: string
          commande_id: string
          date_generation?: string | null
          format?: string | null
          genere_par?: string | null
          id?: string
          nom_fichier: string
          taille_fichier?: number | null
          type_document: string
          url_fichier: string
        }
        Update: {
          categorie?: string
          commande_id?: string
          date_generation?: string | null
          format?: string | null
          genere_par?: string | null
          id?: string
          nom_fichier?: string
          taille_fichier?: number | null
          type_document?: string
          url_fichier?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      emplacement: {
        Row: {
          capacite_max_kg: number | null
          capacite_maximale: number | null
          code_emplacement: string
          date_creation: string | null
          id: string
          produit_actuel_id: string | null
          quantite_actuelle: number | null
          statut_actuel: string | null
          type_emplacement: string
          zone: string
        }
        Insert: {
          capacite_max_kg?: number | null
          capacite_maximale?: number | null
          code_emplacement: string
          date_creation?: string | null
          id?: string
          produit_actuel_id?: string | null
          quantite_actuelle?: number | null
          statut_actuel?: string | null
          type_emplacement: string
          zone: string
        }
        Update: {
          capacite_max_kg?: number | null
          capacite_maximale?: number | null
          code_emplacement?: string
          date_creation?: string | null
          id?: string
          produit_actuel_id?: string | null
          quantite_actuelle?: number | null
          statut_actuel?: string | null
          type_emplacement?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "emplacement_produit_actuel_id_fkey"
            columns: ["produit_actuel_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emplacement_produit_actuel_id_fkey"
            columns: ["produit_actuel_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      error_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string
          route: string
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          route: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          route?: string
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_decision_transporteur: {
        Row: {
          commande_id: string
          commentaire: string | null
          date_feedback: string | null
          decision_id: string | null
          id: string
          metadata: Json | null
          raison_changement: string | null
          regles_ignorees: Json | null
          transporteur_initial: string
          transporteur_modifie: string
          utilisateur_id: string | null
        }
        Insert: {
          commande_id: string
          commentaire?: string | null
          date_feedback?: string | null
          decision_id?: string | null
          id?: string
          metadata?: Json | null
          raison_changement?: string | null
          regles_ignorees?: Json | null
          transporteur_initial: string
          transporteur_modifie: string
          utilisateur_id?: string | null
        }
        Update: {
          commande_id?: string
          commentaire?: string | null
          date_feedback?: string | null
          decision_id?: string | null
          id?: string
          metadata?: Json | null
          raison_changement?: string | null
          regles_ignorees?: Json | null
          transporteur_initial?: string
          transporteur_modifie?: string
          utilisateur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_decision_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_decision_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_decision_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_decision_transporteur_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_transporteur"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_conversation: {
        Row: {
          contexte_wms: Json | null
          cout_estimation: number | null
          date_creation: string | null
          id: string
          message: string
          role: string
          session_id: string
          tokens_utilises: number | null
          user_id: string
          workflow_genere_id: string | null
        }
        Insert: {
          contexte_wms?: Json | null
          cout_estimation?: number | null
          date_creation?: string | null
          id?: string
          message: string
          role: string
          session_id: string
          tokens_utilises?: number | null
          user_id: string
          workflow_genere_id?: string | null
        }
        Update: {
          contexte_wms?: Json | null
          cout_estimation?: number | null
          date_creation?: string | null
          id?: string
          message?: string
          role?: string
          session_id?: string
          tokens_utilises?: number | null
          user_id?: string
          workflow_genere_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_conversation_workflow_genere_id_fkey"
            columns: ["workflow_genere_id"]
            isOneToOne: false
            referencedRelation: "n8n_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_usage_quotas: {
        Row: {
          derniere_utilisation: string | null
          id: string
          messages_gratuits_restants: number | null
          messages_payes_restants: number | null
          reset_date: string | null
          user_id: string
        }
        Insert: {
          derniere_utilisation?: string | null
          id?: string
          messages_gratuits_restants?: number | null
          messages_payes_restants?: number | null
          reset_date?: string | null
          user_id: string
        }
        Update: {
          derniere_utilisation?: string | null
          id?: string
          messages_gratuits_restants?: number | null
          messages_payes_restants?: number | null
          reset_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ia_user_blocked: {
        Row: {
          actif: boolean | null
          bloque_par: string | null
          date_blocage: string | null
          id: string
          raison: string
          user_id: string
        }
        Insert: {
          actif?: boolean | null
          bloque_par?: string | null
          date_blocage?: string | null
          id?: string
          raison: string
          user_id: string
        }
        Update: {
          actif?: boolean | null
          bloque_par?: string | null
          date_blocage?: string | null
          id?: string
          raison?: string
          user_id?: string
        }
        Relationships: []
      }
      ligne_attendu_reception: {
        Row: {
          attendu_reception_id: string
          date_creation: string
          date_fabrication: string | null
          date_peremption: string | null
          emplacement_stockage_prevu: string | null
          id: string
          numero_lot: string | null
          produit_id: string | null
          produit_nom: string
          produit_reference: string
          quantite_attendue: number
          quantite_recue: number | null
          remarques: string | null
          statut_ligne: Database["public"]["Enums"]["statut_ligne_attendu"]
        }
        Insert: {
          attendu_reception_id: string
          date_creation?: string
          date_fabrication?: string | null
          date_peremption?: string | null
          emplacement_stockage_prevu?: string | null
          id?: string
          numero_lot?: string | null
          produit_id?: string | null
          produit_nom: string
          produit_reference: string
          quantite_attendue: number
          quantite_recue?: number | null
          remarques?: string | null
          statut_ligne?: Database["public"]["Enums"]["statut_ligne_attendu"]
        }
        Update: {
          attendu_reception_id?: string
          date_creation?: string
          date_fabrication?: string | null
          date_peremption?: string | null
          emplacement_stockage_prevu?: string | null
          id?: string
          numero_lot?: string | null
          produit_id?: string | null
          produit_nom?: string
          produit_reference?: string
          quantite_attendue?: number
          quantite_recue?: number | null
          remarques?: string | null
          statut_ligne?: Database["public"]["Enums"]["statut_ligne_attendu"]
        }
        Relationships: [
          {
            foreignKeyName: "ligne_attendu_reception_attendu_reception_id_fkey"
            columns: ["attendu_reception_id"]
            isOneToOne: false
            referencedRelation: "attendu_reception"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_attendu_reception_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_attendu_reception_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      ligne_commande: {
        Row: {
          commande_id: string
          date_creation: string
          date_peremption: string | null
          emplacement_picking_id: string | null
          id: string
          numero_lot: string | null
          poids_unitaire: number | null
          prix_unitaire: number | null
          produit_id: string | null
          produit_nom: string
          produit_reference: string
          quantite_commandee: number
          quantite_preparee: number | null
          statut_ligne: string | null
          valeur_totale: number | null
        }
        Insert: {
          commande_id: string
          date_creation?: string
          date_peremption?: string | null
          emplacement_picking_id?: string | null
          id?: string
          numero_lot?: string | null
          poids_unitaire?: number | null
          prix_unitaire?: number | null
          produit_id?: string | null
          produit_nom: string
          produit_reference: string
          quantite_commandee: number
          quantite_preparee?: number | null
          statut_ligne?: string | null
          valeur_totale?: number | null
        }
        Update: {
          commande_id?: string
          date_creation?: string
          date_peremption?: string | null
          emplacement_picking_id?: string | null
          id?: string
          numero_lot?: string | null
          poids_unitaire?: number | null
          prix_unitaire?: number | null
          produit_id?: string | null
          produit_nom?: string
          produit_reference?: string
          quantite_commandee?: number
          quantite_preparee?: number | null
          statut_ligne?: string | null
          valeur_totale?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ligne_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_commande_emplacement_picking_id_fkey"
            columns: ["emplacement_picking_id"]
            isOneToOne: false
            referencedRelation: "emplacement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_commande_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_commande_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      ligne_retour_produit: {
        Row: {
          action_a_faire: string | null
          categorie_emballage: number | null
          cout_traitement: number | null
          date_creation: string | null
          id: string
          produit_id: string | null
          produit_nom: string
          produit_reference: string
          quantite_retournee: number
          retour_id: string | null
          statut_produit: string | null
        }
        Insert: {
          action_a_faire?: string | null
          categorie_emballage?: number | null
          cout_traitement?: number | null
          date_creation?: string | null
          id?: string
          produit_id?: string | null
          produit_nom: string
          produit_reference: string
          quantite_retournee: number
          retour_id?: string | null
          statut_produit?: string | null
        }
        Update: {
          action_a_faire?: string | null
          categorie_emballage?: number | null
          cout_traitement?: number | null
          date_creation?: string | null
          id?: string
          produit_id?: string | null
          produit_nom?: string
          produit_reference?: string
          quantite_retournee?: number
          retour_id?: string | null
          statut_produit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ligne_retour_produit_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_retour_produit_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
          {
            foreignKeyName: "ligne_retour_produit_retour_id_fkey"
            columns: ["retour_id"]
            isOneToOne: false
            referencedRelation: "retour_produit"
            referencedColumns: ["id"]
          },
        ]
      }
      log_auto_selection_transporteur: {
        Row: {
          client_id: string | null
          commande_id: string
          date_log: string | null
          decision_id: string | null
          duree_ms: number | null
          erreur: string | null
          id: string
          metadata: Json | null
          methode_selection: string | null
          succes: boolean | null
          transporteur_selectionne: string | null
        }
        Insert: {
          client_id?: string | null
          commande_id: string
          date_log?: string | null
          decision_id?: string | null
          duree_ms?: number | null
          erreur?: string | null
          id?: string
          metadata?: Json | null
          methode_selection?: string | null
          succes?: boolean | null
          transporteur_selectionne?: string | null
        }
        Update: {
          client_id?: string | null
          commande_id?: string
          date_log?: string | null
          decision_id?: string | null
          duree_ms?: number | null
          erreur?: string | null
          id?: string
          metadata?: Json | null
          methode_selection?: string | null
          succes?: boolean | null
          transporteur_selectionne?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_auto_selection_transporteur_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_auto_selection_transporteur_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "log_auto_selection_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_auto_selection_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_auto_selection_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_auto_selection_transporteur_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_transporteur"
            referencedColumns: ["id"]
          },
        ]
      }
      metrique_apprentissage: {
        Row: {
          date_metrique: string
          economies_potentielles: number | null
          economies_realisees: number | null
          id: string
          metadata: Json | null
          nombre_changements_manuels: number | null
          nombre_decisions: number | null
          nombre_suggestions_appliquees: number | null
          nombre_suggestions_generees: number | null
          precision_predictions: number | null
          taux_changement_manuel: number | null
        }
        Insert: {
          date_metrique: string
          economies_potentielles?: number | null
          economies_realisees?: number | null
          id?: string
          metadata?: Json | null
          nombre_changements_manuels?: number | null
          nombre_decisions?: number | null
          nombre_suggestions_appliquees?: number | null
          nombre_suggestions_generees?: number | null
          precision_predictions?: number | null
          taux_changement_manuel?: number | null
        }
        Update: {
          date_metrique?: string
          economies_potentielles?: number | null
          economies_realisees?: number | null
          id?: string
          metadata?: Json | null
          nombre_changements_manuels?: number | null
          nombre_decisions?: number | null
          nombre_suggestions_appliquees?: number | null
          nombre_suggestions_generees?: number | null
          precision_predictions?: number | null
          taux_changement_manuel?: number | null
        }
        Relationships: []
      }
      mouvement_stock: {
        Row: {
          commande_id: string | null
          created_by: string | null
          date_mouvement: string | null
          emplacement_destination_id: string | null
          emplacement_source_id: string | null
          id: string
          numero_mouvement: string | null
          produit_id: string
          quantite: number
          raison: string | null
          reference_origine: string | null
          remarques: string | null
          statut_mouvement: string | null
          stock_apres_mouvement: number | null
          type_contenant: string | null
          type_mouvement: string
          type_origine: string | null
        }
        Insert: {
          commande_id?: string | null
          created_by?: string | null
          date_mouvement?: string | null
          emplacement_destination_id?: string | null
          emplacement_source_id?: string | null
          id?: string
          numero_mouvement?: string | null
          produit_id: string
          quantite: number
          raison?: string | null
          reference_origine?: string | null
          remarques?: string | null
          statut_mouvement?: string | null
          stock_apres_mouvement?: number | null
          type_contenant?: string | null
          type_mouvement: string
          type_origine?: string | null
        }
        Update: {
          commande_id?: string | null
          created_by?: string | null
          date_mouvement?: string | null
          emplacement_destination_id?: string | null
          emplacement_source_id?: string | null
          id?: string
          numero_mouvement?: string | null
          produit_id?: string
          quantite?: number
          raison?: string | null
          reference_origine?: string | null
          remarques?: string | null
          statut_mouvement?: string | null
          stock_apres_mouvement?: number | null
          type_contenant?: string | null
          type_mouvement?: string
          type_origine?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mouvement_stock_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvement_stock_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvement_stock_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvement_stock_emplacement_destination_id_fkey"
            columns: ["emplacement_destination_id"]
            isOneToOne: false
            referencedRelation: "emplacement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvement_stock_emplacement_source_id_fkey"
            columns: ["emplacement_source_id"]
            isOneToOne: false
            referencedRelation: "emplacement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvement_stock_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvement_stock_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      n8n_client_keys: {
        Row: {
          actif: boolean
          api_key_hash: string
          client_id: string
          date_creation: string
          derniere_utilisation: string | null
          description: string | null
          id: string
        }
        Insert: {
          actif?: boolean
          api_key_hash: string
          client_id: string
          date_creation?: string
          derniere_utilisation?: string | null
          description?: string | null
          id?: string
        }
        Update: {
          actif?: boolean
          api_key_hash?: string
          client_id?: string
          date_creation?: string
          derniere_utilisation?: string | null
          description?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "n8n_client_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "n8n_client_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      n8n_execution_log: {
        Row: {
          date_execution: string | null
          declencheur: string | null
          duree_ms: number | null
          error_message: string | null
          id: string
          payload_envoye: Json
          reponse_n8n: Json | null
          statut: string | null
          user_id: string | null
          workflow_id: string | null
        }
        Insert: {
          date_execution?: string | null
          declencheur?: string | null
          duree_ms?: number | null
          error_message?: string | null
          id?: string
          payload_envoye: Json
          reponse_n8n?: Json | null
          statut?: string | null
          user_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          date_execution?: string | null
          declencheur?: string | null
          duree_ms?: number | null
          error_message?: string | null
          id?: string
          payload_envoye?: Json
          reponse_n8n?: Json | null
          statut?: string | null
          user_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "n8n_execution_log_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "n8n_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_gateway_audit: {
        Row: {
          api_key_hash: string | null
          client_id: string | null
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          success: boolean
          timestamp: string
        }
        Insert: {
          api_key_hash?: string | null
          client_id?: string | null
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          success: boolean
          timestamp?: string
        }
        Update: {
          api_key_hash?: string | null
          client_id?: string | null
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          success?: boolean
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "n8n_gateway_audit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "n8n_gateway_audit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      n8n_workflows: {
        Row: {
          actif: boolean | null
          categorie: string | null
          config_json: Json
          created_by: string | null
          date_creation: string | null
          date_modification: string | null
          declencheur_auto: Json | null
          derniere_execution: string | null
          description: string | null
          id: string
          metadonnees: Json | null
          nom: string
          nombre_executions: number | null
          webhook_url: string
        }
        Insert: {
          actif?: boolean | null
          categorie?: string | null
          config_json: Json
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          declencheur_auto?: Json | null
          derniere_execution?: string | null
          description?: string | null
          id?: string
          metadonnees?: Json | null
          nom: string
          nombre_executions?: number | null
          webhook_url: string
        }
        Update: {
          actif?: boolean | null
          categorie?: string | null
          config_json?: Json
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          declencheur_auto?: Json | null
          derniere_execution?: string | null
          description?: string | null
          id?: string
          metadonnees?: Json | null
          nom?: string
          nombre_executions?: number | null
          webhook_url?: string
        }
        Relationships: []
      }
      notification_transporteur: {
        Row: {
          date_creation: string | null
          date_lecture: string | null
          id: string
          lien_action: string | null
          lue: boolean | null
          message: string
          metadata: Json | null
          severite: string
          titre: string
          type_notification: string
          user_id: string | null
        }
        Insert: {
          date_creation?: string | null
          date_lecture?: string | null
          id?: string
          lien_action?: string | null
          lue?: boolean | null
          message: string
          metadata?: Json | null
          severite: string
          titre: string
          type_notification: string
          user_id?: string | null
        }
        Update: {
          date_creation?: string | null
          date_lecture?: string | null
          id?: string
          lien_action?: string | null
          lue?: boolean | null
          message?: string
          metadata?: Json | null
          severite?: string
          titre?: string
          type_notification?: string
          user_id?: string | null
        }
        Relationships: []
      }
      performance_reelle_transporteur: {
        Row: {
          commande_id: string | null
          commentaire_client: string | null
          cout_prevu: number | null
          cout_reel: number | null
          date_enregistrement: string | null
          date_expedition: string | null
          date_livraison: string | null
          delai_prevu_jours: number | null
          delai_reel_jours: number | null
          id: string
          incidents: Json | null
          note_client: number | null
          statut_livraison: string | null
          transporteur_code: string
        }
        Insert: {
          commande_id?: string | null
          commentaire_client?: string | null
          cout_prevu?: number | null
          cout_reel?: number | null
          date_enregistrement?: string | null
          date_expedition?: string | null
          date_livraison?: string | null
          delai_prevu_jours?: number | null
          delai_reel_jours?: number | null
          id?: string
          incidents?: Json | null
          note_client?: number | null
          statut_livraison?: string | null
          transporteur_code: string
        }
        Update: {
          commande_id?: string | null
          commentaire_client?: string | null
          cout_prevu?: number | null
          cout_reel?: number | null
          date_enregistrement?: string | null
          date_expedition?: string | null
          date_livraison?: string | null
          delai_prevu_jours?: number | null
          delai_reel_jours?: number | null
          id?: string
          incidents?: Json | null
          note_client?: number | null
          statut_livraison?: string | null
          transporteur_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reelle_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reelle_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reelle_transporteur_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_performance_transporteur: {
        Row: {
          confiance_prediction: number | null
          date_prediction: string | null
          facteurs_cles: Json | null
          id: string
          metadata: Json | null
          nombre_commandes_analysees: number | null
          periode_analyse_jours: number | null
          score_cout: number | null
          score_delai: number | null
          score_fiabilite: number | null
          score_predictif: number
          score_qualite: number | null
          tendance: string | null
          transporteur_code: string
          transporteur_nom: string
          valide_jusqu_a: string | null
        }
        Insert: {
          confiance_prediction?: number | null
          date_prediction?: string | null
          facteurs_cles?: Json | null
          id?: string
          metadata?: Json | null
          nombre_commandes_analysees?: number | null
          periode_analyse_jours?: number | null
          score_cout?: number | null
          score_delai?: number | null
          score_fiabilite?: number | null
          score_predictif: number
          score_qualite?: number | null
          tendance?: string | null
          transporteur_code: string
          transporteur_nom: string
          valide_jusqu_a?: string | null
        }
        Update: {
          confiance_prediction?: number | null
          date_prediction?: string | null
          facteurs_cles?: Json | null
          id?: string
          metadata?: Json | null
          nombre_commandes_analysees?: number | null
          periode_analyse_jours?: number | null
          score_cout?: number | null
          score_delai?: number | null
          score_fiabilite?: number | null
          score_predictif?: number
          score_qualite?: number | null
          tendance?: string | null
          transporteur_code?: string
          transporteur_nom?: string
          valide_jusqu_a?: string | null
        }
        Relationships: []
      }
      produit: {
        Row: {
          categorie_emballage: number | null
          classe_danger: string | null
          client_id: string | null
          code_barre_ean: string | null
          code_sh: string | null
          conditions_speciales: string[] | null
          date_creation: string | null
          date_modification: string | null
          delai_peremption_alerte_jours: number | null
          description: string | null
          duree_vie_jours: number | null
          fournisseur: string | null
          gestion_lots: boolean | null
          gestion_serie: boolean | null
          hauteur_cm: number | null
          id: string
          image_url: string | null
          instructions_picking: string | null
          instructions_stockage: string | null
          largeur_cm: number | null
          longueur_cm: number | null
          marque: string | null
          matieres_dangereuses: boolean | null
          nom: string
          numero_onu: string | null
          pays_origine: string | null
          poids_unitaire: number | null
          prix_unitaire: number | null
          protection_individuelle: boolean | null
          reference: string
          rotation_stock: string | null
          statut_actif: boolean | null
          stock_actuel: number | null
          stock_maximum: number | null
          stock_minimum: number | null
          taux_tva: number | null
          temperature_stockage: string | null
          valeur_douaniere: number | null
          volume_cm3: number | null
          volume_m3: number | null
        }
        Insert: {
          categorie_emballage?: number | null
          classe_danger?: string | null
          client_id?: string | null
          code_barre_ean?: string | null
          code_sh?: string | null
          conditions_speciales?: string[] | null
          date_creation?: string | null
          date_modification?: string | null
          delai_peremption_alerte_jours?: number | null
          description?: string | null
          duree_vie_jours?: number | null
          fournisseur?: string | null
          gestion_lots?: boolean | null
          gestion_serie?: boolean | null
          hauteur_cm?: number | null
          id?: string
          image_url?: string | null
          instructions_picking?: string | null
          instructions_stockage?: string | null
          largeur_cm?: number | null
          longueur_cm?: number | null
          marque?: string | null
          matieres_dangereuses?: boolean | null
          nom: string
          numero_onu?: string | null
          pays_origine?: string | null
          poids_unitaire?: number | null
          prix_unitaire?: number | null
          protection_individuelle?: boolean | null
          reference: string
          rotation_stock?: string | null
          statut_actif?: boolean | null
          stock_actuel?: number | null
          stock_maximum?: number | null
          stock_minimum?: number | null
          taux_tva?: number | null
          temperature_stockage?: string | null
          valeur_douaniere?: number | null
          volume_cm3?: number | null
          volume_m3?: number | null
        }
        Update: {
          categorie_emballage?: number | null
          classe_danger?: string | null
          client_id?: string | null
          code_barre_ean?: string | null
          code_sh?: string | null
          conditions_speciales?: string[] | null
          date_creation?: string | null
          date_modification?: string | null
          delai_peremption_alerte_jours?: number | null
          description?: string | null
          duree_vie_jours?: number | null
          fournisseur?: string | null
          gestion_lots?: boolean | null
          gestion_serie?: boolean | null
          hauteur_cm?: number | null
          id?: string
          image_url?: string | null
          instructions_picking?: string | null
          instructions_stockage?: string | null
          largeur_cm?: number | null
          longueur_cm?: number | null
          marque?: string | null
          matieres_dangereuses?: boolean | null
          nom?: string
          numero_onu?: string | null
          pays_origine?: string | null
          poids_unitaire?: number | null
          prix_unitaire?: number | null
          protection_individuelle?: boolean | null
          reference?: string
          rotation_stock?: string | null
          statut_actif?: boolean | null
          stock_actuel?: number | null
          stock_maximum?: number | null
          stock_minimum?: number | null
          taux_tva?: number | null
          temperature_stockage?: string | null
          valeur_douaniere?: number | null
          volume_cm3?: number | null
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      produit_alertes_stock: {
        Row: {
          actif: boolean | null
          couleur: string
          date_creation: string | null
          id: string
          message_alerte: string | null
          produit_id: string
          seuil: number
          type_alerte: string
        }
        Insert: {
          actif?: boolean | null
          couleur: string
          date_creation?: string | null
          id?: string
          message_alerte?: string | null
          produit_id: string
          seuil: number
          type_alerte: string
        }
        Update: {
          actif?: boolean | null
          couleur?: string
          date_creation?: string | null
          id?: string
          message_alerte?: string | null
          produit_id?: string
          seuil?: number
          type_alerte?: string
        }
        Relationships: [
          {
            foreignKeyName: "produit_alertes_stock_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produit_alertes_stock_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          id: string
          nom_complet: string | null
          tabs_access: string[] | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          nom_complet?: string | null
          tabs_access?: string[] | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom_complet?: string | null
          tabs_access?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          blocked_until: string | null
          identifier: string
          last_request: string
          request_count: number
          window_start: string
        }
        Insert: {
          blocked_until?: string | null
          identifier: string
          last_request?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          blocked_until?: string | null
          identifier?: string
          last_request?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      regle_attribution_emballage: {
        Row: {
          actif: boolean | null
          code_emballage: string | null
          conditions: Json
          date_creation: string | null
          description: string | null
          id: string
          nom_regle: string
          priorite: number | null
          type_carton_id: string | null
        }
        Insert: {
          actif?: boolean | null
          code_emballage?: string | null
          conditions: Json
          date_creation?: string | null
          description?: string | null
          id?: string
          nom_regle: string
          priorite?: number | null
          type_carton_id?: string | null
        }
        Update: {
          actif?: boolean | null
          code_emballage?: string | null
          conditions?: Json
          date_creation?: string | null
          description?: string | null
          id?: string
          nom_regle?: string
          priorite?: number | null
          type_carton_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regle_attribution_emballage_type_carton_id_fkey"
            columns: ["type_carton_id"]
            isOneToOne: false
            referencedRelation: "type_carton"
            referencedColumns: ["id"]
          },
        ]
      }
      regle_attribution_emplacement: {
        Row: {
          actif: boolean | null
          conditions: Json
          date_creation: string | null
          description: string | null
          id: string
          nom_regle: string
          priorite: number | null
          type_emplacement_cible: string | null
          zone_cible: string | null
        }
        Insert: {
          actif?: boolean | null
          conditions: Json
          date_creation?: string | null
          description?: string | null
          id?: string
          nom_regle: string
          priorite?: number | null
          type_emplacement_cible?: string | null
          zone_cible?: string | null
        }
        Update: {
          actif?: boolean | null
          conditions?: Json
          date_creation?: string | null
          description?: string | null
          id?: string
          nom_regle?: string
          priorite?: number | null
          type_emplacement_cible?: string | null
          zone_cible?: string | null
        }
        Relationships: []
      }
      regle_expediteur_automatique: {
        Row: {
          actif: boolean | null
          client_id: string
          condition_type: string
          condition_value: string
          configuration_expediteur_id: string
          date_creation: string | null
          date_modification: string | null
          id: string
          nom_regle: string
          priorite: number | null
        }
        Insert: {
          actif?: boolean | null
          client_id: string
          condition_type: string
          condition_value: string
          configuration_expediteur_id: string
          date_creation?: string | null
          date_modification?: string | null
          id?: string
          nom_regle: string
          priorite?: number | null
        }
        Update: {
          actif?: boolean | null
          client_id?: string
          condition_type?: string
          condition_value?: string
          configuration_expediteur_id?: string
          date_creation?: string | null
          date_modification?: string | null
          id?: string
          nom_regle?: string
          priorite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "regle_expediteur_automatique_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regle_expediteur_automatique_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "regle_expediteur_automatique_configuration_expediteur_id_fkey"
            columns: ["configuration_expediteur_id"]
            isOneToOne: false
            referencedRelation: "configuration_expediteur"
            referencedColumns: ["id"]
          },
        ]
      }
      regle_picking_optimal: {
        Row: {
          actif: boolean | null
          conditions: Json | null
          date_creation: string | null
          description: string | null
          id: string
          nom_regle: string
          parametres: Json | null
          priorite: number | null
          strategie: string
        }
        Insert: {
          actif?: boolean | null
          conditions?: Json | null
          date_creation?: string | null
          description?: string | null
          id?: string
          nom_regle: string
          parametres?: Json | null
          priorite?: number | null
          strategie: string
        }
        Update: {
          actif?: boolean | null
          conditions?: Json | null
          date_creation?: string | null
          description?: string | null
          id?: string
          nom_regle?: string
          parametres?: Json | null
          priorite?: number | null
          strategie?: string
        }
        Relationships: []
      }
      regle_selection_transporteur: {
        Row: {
          actif: boolean | null
          client_id: string | null
          conditions: Json
          critere_principal: string | null
          date_creation: string | null
          date_modification: string | null
          description: string | null
          force_transporteur: boolean | null
          id: string
          nom_regle: string
          nombre_utilisations: number | null
          priorite: number | null
          score_performance: number | null
          transporteur_force_id: string | null
        }
        Insert: {
          actif?: boolean | null
          client_id?: string | null
          conditions?: Json
          critere_principal?: string | null
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          force_transporteur?: boolean | null
          id?: string
          nom_regle: string
          nombre_utilisations?: number | null
          priorite?: number | null
          score_performance?: number | null
          transporteur_force_id?: string | null
        }
        Update: {
          actif?: boolean | null
          client_id?: string | null
          conditions?: Json
          critere_principal?: string | null
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          force_transporteur?: boolean | null
          id?: string
          nom_regle?: string
          nombre_utilisations?: number | null
          priorite?: number | null
          score_performance?: number | null
          transporteur_force_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regle_selection_transporteur_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regle_selection_transporteur_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "regle_selection_transporteur_transporteur_force_id_fkey"
            columns: ["transporteur_force_id"]
            isOneToOne: false
            referencedRelation: "transporteur_service"
            referencedColumns: ["id"]
          },
        ]
      }
      regle_session_preparation: {
        Row: {
          actif: boolean | null
          auto_assignation_operateur: string | null
          conditions: Json
          date_creation: string | null
          date_modification: string | null
          description: string | null
          id: string
          nom_regle: string
          priorite: number | null
          type_session: string | null
        }
        Insert: {
          actif?: boolean | null
          auto_assignation_operateur?: string | null
          conditions: Json
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          id?: string
          nom_regle: string
          priorite?: number | null
          type_session?: string | null
        }
        Update: {
          actif?: boolean | null
          auto_assignation_operateur?: string | null
          conditions?: Json
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          id?: string
          nom_regle?: string
          priorite?: number | null
          type_session?: string | null
        }
        Relationships: []
      }
      regle_tag_automatique: {
        Row: {
          actif: boolean | null
          conditions: Json
          couleur_tag: string
          created_by: string | null
          date_creation: string | null
          date_modification: string | null
          id: string
          nom_regle: string
          priorite: number
          tag: string
        }
        Insert: {
          actif?: boolean | null
          conditions?: Json
          couleur_tag: string
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          id?: string
          nom_regle: string
          priorite?: number
          tag: string
        }
        Update: {
          actif?: boolean | null
          conditions?: Json
          couleur_tag?: string
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          id?: string
          nom_regle?: string
          priorite?: number
          tag?: string
        }
        Relationships: []
      }
      regle_traitement_retour: {
        Row: {
          actif: boolean | null
          actions_automatiques: Json
          conditions: Json
          date_creation: string | null
          description: string | null
          id: string
          nom_regle: string
          priorite: number | null
          validation_manuelle_requise: boolean | null
        }
        Insert: {
          actif?: boolean | null
          actions_automatiques: Json
          conditions: Json
          date_creation?: string | null
          description?: string | null
          id?: string
          nom_regle: string
          priorite?: number | null
          validation_manuelle_requise?: boolean | null
        }
        Update: {
          actif?: boolean | null
          actions_automatiques?: Json
          conditions?: Json
          date_creation?: string | null
          description?: string | null
          id?: string
          nom_regle?: string
          priorite?: number | null
          validation_manuelle_requise?: boolean | null
        }
        Relationships: []
      }
      regle_transport_automatique: {
        Row: {
          actif: boolean | null
          conditions: Json
          config_poids_volumetrique: Json | null
          created_by: string | null
          date_creation: string | null
          date_modification: string | null
          id: string
          nom_regle: string
          priorite: number
          transporteur: string
        }
        Insert: {
          actif?: boolean | null
          conditions?: Json
          config_poids_volumetrique?: Json | null
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          id?: string
          nom_regle: string
          priorite?: number
          transporteur: string
        }
        Update: {
          actif?: boolean | null
          conditions?: Json
          config_poids_volumetrique?: Json | null
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          id?: string
          nom_regle?: string
          priorite?: number
          transporteur?: string
        }
        Relationships: []
      }
      regle_validation_commande: {
        Row: {
          actif: boolean | null
          action_a_effectuer: string
          approbateurs_autorises: string[] | null
          client_id: string | null
          conditions: Json
          created_by: string | null
          date_creation: string | null
          date_modification: string | null
          delai_max_jours: number | null
          description: string | null
          id: string
          message_utilisateur: string | null
          niveau_validation: string | null
          nom_regle: string
          priorite: number | null
          statut_bloque: string | null
        }
        Insert: {
          actif?: boolean | null
          action_a_effectuer: string
          approbateurs_autorises?: string[] | null
          client_id?: string | null
          conditions: Json
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          delai_max_jours?: number | null
          description?: string | null
          id?: string
          message_utilisateur?: string | null
          niveau_validation?: string | null
          nom_regle: string
          priorite?: number | null
          statut_bloque?: string | null
        }
        Update: {
          actif?: boolean | null
          action_a_effectuer?: string
          approbateurs_autorises?: string[] | null
          client_id?: string | null
          conditions?: Json
          created_by?: string | null
          date_creation?: string | null
          date_modification?: string | null
          delai_max_jours?: number | null
          description?: string | null
          id?: string
          message_utilisateur?: string | null
          niveau_validation?: string | null
          nom_regle?: string
          priorite?: number | null
          statut_bloque?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regle_validation_commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regle_validation_commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      retour_produit: {
        Row: {
          client_id: string | null
          client_nom: string
          commande_origine_id: string | null
          date_creation: string | null
          date_modification: string | null
          date_retour: string | null
          id: string
          numero_retour: string
          raison_retour: string | null
          remarques: string | null
          statut_retour: string | null
          valeur_totale: number | null
        }
        Insert: {
          client_id?: string | null
          client_nom: string
          commande_origine_id?: string | null
          date_creation?: string | null
          date_modification?: string | null
          date_retour?: string | null
          id?: string
          numero_retour: string
          raison_retour?: string | null
          remarques?: string | null
          statut_retour?: string | null
          valeur_totale?: number | null
        }
        Update: {
          client_id?: string | null
          client_nom?: string
          commande_origine_id?: string | null
          date_creation?: string | null
          date_modification?: string | null
          date_retour?: string | null
          id?: string
          numero_retour?: string
          raison_retour?: string | null
          remarques?: string | null
          statut_retour?: string | null
          valeur_totale?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "retour_produit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retour_produit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "retour_produit_commande_origine_id_fkey"
            columns: ["commande_origine_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retour_produit_commande_origine_id_fkey"
            columns: ["commande_origine_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retour_produit_commande_origine_id_fkey"
            columns: ["commande_origine_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      retour_transition_log: {
        Row: {
          date_transition: string
          id: string
          metadata: Json | null
          raison: string | null
          retour_id: string
          statut_nouveau: string
          statut_precedent: string
          utilisateur_id: string | null
        }
        Insert: {
          date_transition?: string
          id?: string
          metadata?: Json | null
          raison?: string | null
          retour_id: string
          statut_nouveau: string
          statut_precedent: string
          utilisateur_id?: string | null
        }
        Update: {
          date_transition?: string
          id?: string
          metadata?: Json | null
          raison?: string | null
          retour_id?: string
          statut_nouveau?: string
          statut_precedent?: string
          utilisateur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retour_transition_log_retour_id_fkey"
            columns: ["retour_id"]
            isOneToOne: false
            referencedRelation: "retour_produit"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_picking: {
        Row: {
          code_barre: string
          commande_id: string
          date_scan: string | null
          id: string
          ligne_commande_id: string | null
          operateur_id: string | null
          produit_id: string
          quantite_scannee: number
          remarques: string | null
          session_id: string
          statut_scan: string | null
        }
        Insert: {
          code_barre: string
          commande_id: string
          date_scan?: string | null
          id?: string
          ligne_commande_id?: string | null
          operateur_id?: string | null
          produit_id: string
          quantite_scannee?: number
          remarques?: string | null
          session_id: string
          statut_scan?: string | null
        }
        Update: {
          code_barre?: string
          commande_id?: string
          date_scan?: string | null
          id?: string
          ligne_commande_id?: string | null
          operateur_id?: string | null
          produit_id?: string
          quantite_scannee?: number
          remarques?: string | null
          session_id?: string
          statut_scan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_picking_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_picking_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_picking_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_picking_ligne_commande_id_fkey"
            columns: ["ligne_commande_id"]
            isOneToOne: false
            referencedRelation: "ligne_commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_picking_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_picking_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
          {
            foreignKeyName: "scan_picking_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_preparation"
            referencedColumns: ["id"]
          },
        ]
      }
      sendcloud_api_log: {
        Row: {
          commande_id: string | null
          created_by: string | null
          date_appel: string | null
          duree_ms: number | null
          endpoint: string
          error_message: string | null
          id: string
          methode: string
          payload: Json | null
          reponse: Json | null
          statut_http: number | null
        }
        Insert: {
          commande_id?: string | null
          created_by?: string | null
          date_appel?: string | null
          duree_ms?: number | null
          endpoint: string
          error_message?: string | null
          id?: string
          methode: string
          payload?: Json | null
          reponse?: Json | null
          statut_http?: number | null
        }
        Update: {
          commande_id?: string | null
          created_by?: string | null
          date_appel?: string | null
          duree_ms?: number | null
          endpoint?: string
          error_message?: string | null
          id?: string
          methode?: string
          payload?: Json | null
          reponse?: Json | null
          statut_http?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sendcloud_api_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sendcloud_api_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sendcloud_api_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      sendcloud_client_mapping: {
        Row: {
          actif: boolean | null
          client_id: string
          config_expediteur_defaut_id: string | null
          date_creation: string | null
          date_modification: string | null
          email_domain: string | null
          id: string
          integration_id: number | null
          shop_name: string | null
        }
        Insert: {
          actif?: boolean | null
          client_id: string
          config_expediteur_defaut_id?: string | null
          date_creation?: string | null
          date_modification?: string | null
          email_domain?: string | null
          id?: string
          integration_id?: number | null
          shop_name?: string | null
        }
        Update: {
          actif?: boolean | null
          client_id?: string
          config_expediteur_defaut_id?: string | null
          date_creation?: string | null
          date_modification?: string | null
          email_domain?: string | null
          id?: string
          integration_id?: number | null
          shop_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sendcloud_client_mapping_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sendcloud_client_mapping_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sendcloud_client_mapping_config_expediteur_defaut_id_fkey"
            columns: ["config_expediteur_defaut_id"]
            isOneToOne: false
            referencedRelation: "configuration_expediteur"
            referencedColumns: ["id"]
          },
        ]
      }
      sendcloud_event_history: {
        Row: {
          created_at: string | null
          direction: string
          entity_id: string | null
          entity_type: string | null
          error_details: string | null
          event_type: string
          id: string
          metadata: Json | null
          processing_time_ms: number | null
          success: boolean
        }
        Insert: {
          created_at?: string | null
          direction: string
          entity_id?: string | null
          entity_type?: string | null
          error_details?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          processing_time_ms?: number | null
          success: boolean
        }
        Update: {
          created_at?: string | null
          direction?: string
          entity_id?: string | null
          entity_type?: string | null
          error_details?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          processing_time_ms?: number | null
          success?: boolean
        }
        Relationships: []
      }
      sendcloud_outgoing_webhooks: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          error_message: string | null
          event_type: string
          id: string
          max_retries: number | null
          next_retry_at: string | null
          payload: Json
          retry_count: number | null
          sendcloud_response: Json | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          error_message?: string | null
          event_type: string
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          payload: Json
          retry_count?: number | null
          sendcloud_response?: Json | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          event_type?: string
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          payload?: Json
          retry_count?: number | null
          sendcloud_response?: Json | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      sendcloud_sender_address: {
        Row: {
          bank_account_number: string | null
          city: string
          company_name: string | null
          contact_name: string
          country: string
          date_creation: string | null
          date_modification: string | null
          email: string
          eori_number: string | null
          house_number: string
          id: string
          is_default: boolean | null
          postal_code: string
          raw_data: Json | null
          sendcloud_id: number
          street: string
          telephone: string | null
          vat_number: string | null
        }
        Insert: {
          bank_account_number?: string | null
          city: string
          company_name?: string | null
          contact_name: string
          country: string
          date_creation?: string | null
          date_modification?: string | null
          email: string
          eori_number?: string | null
          house_number: string
          id?: string
          is_default?: boolean | null
          postal_code: string
          raw_data?: Json | null
          sendcloud_id: number
          street: string
          telephone?: string | null
          vat_number?: string | null
        }
        Update: {
          bank_account_number?: string | null
          city?: string
          company_name?: string | null
          contact_name?: string
          country?: string
          date_creation?: string | null
          date_modification?: string | null
          email?: string
          eori_number?: string | null
          house_number?: string
          id?: string
          is_default?: boolean | null
          postal_code?: string
          raw_data?: Json | null
          sendcloud_id?: number
          street?: string
          telephone?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      sendcloud_status_tracking: {
        Row: {
          carrier: string | null
          commande_id: string | null
          created_at: string | null
          current_status: string | null
          estimated_delivery_date: string | null
          external_tracking_url: string | null
          id: string
          last_status_change: string | null
          sendcloud_parcel_id: string
          shipment_uuid: string | null
          status_message: string | null
          tracking_events: Json | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          carrier?: string | null
          commande_id?: string | null
          created_at?: string | null
          current_status?: string | null
          estimated_delivery_date?: string | null
          external_tracking_url?: string | null
          id?: string
          last_status_change?: string | null
          sendcloud_parcel_id: string
          shipment_uuid?: string | null
          status_message?: string | null
          tracking_events?: Json | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string | null
          commande_id?: string | null
          created_at?: string | null
          current_status?: string | null
          estimated_delivery_date?: string | null
          external_tracking_url?: string | null
          id?: string
          last_status_change?: string | null
          sendcloud_parcel_id?: string
          shipment_uuid?: string | null
          status_message?: string | null
          tracking_events?: Json | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sendcloud_status_tracking_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sendcloud_status_tracking_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sendcloud_status_tracking_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      sendcloud_sync_log: {
        Row: {
          date_sync: string
          details: Json | null
          duree_ms: number | null
          erreur_message: string | null
          id: string
          mode_sync: string | null
          nb_commandes_creees: number | null
          nb_commandes_existantes: number | null
          nb_commandes_trouvees: number | null
          nb_erreurs: number | null
          nb_produits_crees: number | null
          nb_statuts_mis_a_jour: number | null
          statut: string
        }
        Insert: {
          date_sync?: string
          details?: Json | null
          duree_ms?: number | null
          erreur_message?: string | null
          id?: string
          mode_sync?: string | null
          nb_commandes_creees?: number | null
          nb_commandes_existantes?: number | null
          nb_commandes_trouvees?: number | null
          nb_erreurs?: number | null
          nb_produits_crees?: number | null
          nb_statuts_mis_a_jour?: number | null
          statut: string
        }
        Update: {
          date_sync?: string
          details?: Json | null
          duree_ms?: number | null
          erreur_message?: string | null
          id?: string
          mode_sync?: string | null
          nb_commandes_creees?: number | null
          nb_commandes_existantes?: number | null
          nb_commandes_trouvees?: number | null
          nb_erreurs?: number | null
          nb_produits_crees?: number | null
          nb_statuts_mis_a_jour?: number | null
          statut?: string
        }
        Relationships: []
      }
      sendcloud_webhook_events: {
        Row: {
          commande_id: string | null
          created_at: string | null
          event_data: Json
          event_type: string
          id: string
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          retry_count: number | null
          sendcloud_id: string | null
        }
        Insert: {
          commande_id?: string | null
          created_at?: string | null
          event_data: Json
          event_type: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          retry_count?: number | null
          sendcloud_id?: string | null
        }
        Update: {
          commande_id?: string | null
          created_at?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          retry_count?: number | null
          sendcloud_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sendcloud_webhook_events_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sendcloud_webhook_events_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sendcloud_webhook_events_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
      service_logistique: {
        Row: {
          actif: boolean | null
          categorie: string
          code_service: string
          date_creation: string | null
          date_modification: string | null
          description: string | null
          formulaire_hubspot_url: string | null
          id: string
          nom_service: string
          prix_unitaire: number | null
          type_facturation: string
        }
        Insert: {
          actif?: boolean | null
          categorie: string
          code_service: string
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          formulaire_hubspot_url?: string | null
          id?: string
          nom_service: string
          prix_unitaire?: number | null
          type_facturation: string
        }
        Update: {
          actif?: boolean | null
          categorie?: string
          code_service?: string
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          formulaire_hubspot_url?: string | null
          id?: string
          nom_service?: string
          prix_unitaire?: number | null
          type_facturation?: string
        }
        Relationships: []
      }
      session_commande: {
        Row: {
          commande_id: string
          date_creation: string | null
          date_prise: string | null
          id: string
          pris_par: string | null
          session_id: string
          statut_session: string | null
        }
        Insert: {
          commande_id: string
          date_creation?: string | null
          date_prise?: string | null
          id?: string
          pris_par?: string | null
          session_id: string
          statut_session?: string | null
        }
        Update: {
          commande_id?: string
          date_creation?: string | null
          date_prise?: string | null
          id?: string
          pris_par?: string | null
          session_id?: string
          statut_session?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_commande_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_preparation"
            referencedColumns: ["id"]
          },
        ]
      }
      session_picking_consolidee: {
        Row: {
          date_creation: string | null
          date_modification: string | null
          emplacements: Json | null
          id: string
          nombre_commandes: number
          produit_id: string
          quantite_totale: number
          session_id: string
          statut_picking: string | null
        }
        Insert: {
          date_creation?: string | null
          date_modification?: string | null
          emplacements?: Json | null
          id?: string
          nombre_commandes?: number
          produit_id: string
          quantite_totale?: number
          session_id: string
          statut_picking?: string | null
        }
        Update: {
          date_creation?: string | null
          date_modification?: string | null
          emplacements?: Json | null
          id?: string
          nombre_commandes?: number
          produit_id?: string
          quantite_totale?: number
          session_id?: string
          statut_picking?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_picking_consolidee_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_picking_consolidee_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
          {
            foreignKeyName: "session_picking_consolidee_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_preparation"
            referencedColumns: ["id"]
          },
        ]
      }
      session_preparation: {
        Row: {
          created_by: string | null
          cron_enabled: boolean | null
          cron_expression: string | null
          date_creation: string | null
          date_modification: string | null
          derniere_execution: string | null
          description: string | null
          filtres: Json
          id: string
          max_commandes: number | null
          nom_session: string
          ordre_priorite: number
          statut: string | null
          strategie_picking: string | null
        }
        Insert: {
          created_by?: string | null
          cron_enabled?: boolean | null
          cron_expression?: string | null
          date_creation?: string | null
          date_modification?: string | null
          derniere_execution?: string | null
          description?: string | null
          filtres?: Json
          id?: string
          max_commandes?: number | null
          nom_session: string
          ordre_priorite?: number
          statut?: string | null
          strategie_picking?: string | null
        }
        Update: {
          created_by?: string | null
          cron_enabled?: boolean | null
          cron_expression?: string | null
          date_creation?: string | null
          date_modification?: string | null
          derniere_execution?: string | null
          description?: string | null
          filtres?: Json
          id?: string
          max_commandes?: number | null
          nom_session?: string
          ordre_priorite?: number
          statut?: string | null
          strategie_picking?: string | null
        }
        Relationships: []
      }
      sku_variante: {
        Row: {
          actif: boolean | null
          code_barre_variante: string | null
          date_creation: string | null
          id: string
          produit_id: string | null
          quantite_par_unite: number
          sku_principal: string
          type_variante: string
        }
        Insert: {
          actif?: boolean | null
          code_barre_variante?: string | null
          date_creation?: string | null
          id?: string
          produit_id?: string | null
          quantite_par_unite?: number
          sku_principal: string
          type_variante?: string
        }
        Update: {
          actif?: boolean | null
          code_barre_variante?: string | null
          date_creation?: string | null
          id?: string
          produit_id?: string | null
          quantite_par_unite?: number
          sku_principal?: string
          type_variante?: string
        }
        Relationships: [
          {
            foreignKeyName: "sku_variante_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_variante_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "stock_disponible"
            referencedColumns: ["produit_id"]
          },
        ]
      }
      statut_migration_map: {
        Row: {
          ancien_statut: string
          date_migration: string | null
          nouveau_statut: Database["public"]["Enums"]["statut_commande_enum"]
        }
        Insert: {
          ancien_statut: string
          date_migration?: string | null
          nouveau_statut: Database["public"]["Enums"]["statut_commande_enum"]
        }
        Update: {
          ancien_statut?: string
          date_migration?: string | null
          nouveau_statut?: Database["public"]["Enums"]["statut_commande_enum"]
        }
        Relationships: []
      }
      suggestion_ajustement_regle: {
        Row: {
          applique_le: string | null
          approuve_par: string | null
          confiance: number | null
          date_approbation: string | null
          date_creation: string | null
          id: string
          impact_estime: Json | null
          justification: string
          modification_proposee: Json
          regle_cible_id: string | null
          resultat_application: Json | null
          statut: string | null
          type_ajustement: string
        }
        Insert: {
          applique_le?: string | null
          approuve_par?: string | null
          confiance?: number | null
          date_approbation?: string | null
          date_creation?: string | null
          id?: string
          impact_estime?: Json | null
          justification: string
          modification_proposee: Json
          regle_cible_id?: string | null
          resultat_application?: Json | null
          statut?: string | null
          type_ajustement: string
        }
        Update: {
          applique_le?: string | null
          approuve_par?: string | null
          confiance?: number | null
          date_approbation?: string | null
          date_creation?: string | null
          id?: string
          impact_estime?: Json | null
          justification?: string
          modification_proposee?: Json
          regle_cible_id?: string | null
          resultat_application?: Json | null
          statut?: string | null
          type_ajustement?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_ajustement_regle_regle_cible_id_fkey"
            columns: ["regle_cible_id"]
            isOneToOne: false
            referencedRelation: "regle_selection_transporteur"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_optimisation: {
        Row: {
          actions_requises: Json | null
          analyse_id: string | null
          appliquee_le: string | null
          confiance: number | null
          date_creation: string | null
          description: string
          id: string
          impact_financier: number | null
          pourcentage_economie: number | null
          priorite: number | null
          statut: string | null
          type_suggestion: string
        }
        Insert: {
          actions_requises?: Json | null
          analyse_id?: string | null
          appliquee_le?: string | null
          confiance?: number | null
          date_creation?: string | null
          description: string
          id?: string
          impact_financier?: number | null
          pourcentage_economie?: number | null
          priorite?: number | null
          statut?: string | null
          type_suggestion: string
        }
        Update: {
          actions_requises?: Json | null
          analyse_id?: string | null
          appliquee_le?: string | null
          confiance?: number | null
          date_creation?: string | null
          description?: string
          id?: string
          impact_financier?: number | null
          pourcentage_economie?: number | null
          priorite?: number | null
          statut?: string | null
          type_suggestion?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_optimisation_analyse_id_fkey"
            columns: ["analyse_id"]
            isOneToOne: false
            referencedRelation: "analyse_optimisation_couts"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_vote: {
        Row: {
          commentaire: string | null
          date_vote: string | null
          id: string
          suggestion_id: string
          user_id: string
          vote: string
        }
        Insert: {
          commentaire?: string | null
          date_vote?: string | null
          id?: string
          suggestion_id: string
          user_id: string
          vote: string
        }
        Update: {
          commentaire?: string | null
          date_vote?: string | null
          id?: string
          suggestion_id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_vote_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestion_ajustement_regle"
            referencedColumns: ["id"]
          },
        ]
      }
      transporteur_configuration: {
        Row: {
          actif: boolean | null
          api_credentials_encrypted: string | null
          api_endpoint: string | null
          code_transporteur: string
          date_creation: string | null
          date_modification: string | null
          delais_moyens: Json | null
          id: string
          logo_url: string | null
          nom_complet: string
          services_disponibles: Json | null
          zones_couverture: Json | null
        }
        Insert: {
          actif?: boolean | null
          api_credentials_encrypted?: string | null
          api_endpoint?: string | null
          code_transporteur: string
          date_creation?: string | null
          date_modification?: string | null
          delais_moyens?: Json | null
          id?: string
          logo_url?: string | null
          nom_complet: string
          services_disponibles?: Json | null
          zones_couverture?: Json | null
        }
        Update: {
          actif?: boolean | null
          api_credentials_encrypted?: string | null
          api_endpoint?: string | null
          code_transporteur?: string
          date_creation?: string | null
          date_modification?: string | null
          delais_moyens?: Json | null
          id?: string
          logo_url?: string | null
          nom_complet?: string
          services_disponibles?: Json | null
          zones_couverture?: Json | null
        }
        Relationships: []
      }
      transporteur_facteur_division: {
        Row: {
          actif: boolean | null
          date_creation: string | null
          date_modification: string | null
          description: string | null
          facteur_division: number
          id: string
          transporteur_code: string
          transporteur_nom: string
          unite: string
        }
        Insert: {
          actif?: boolean | null
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          facteur_division?: number
          id?: string
          transporteur_code: string
          transporteur_nom: string
          unite?: string
        }
        Update: {
          actif?: boolean | null
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          facteur_division?: number
          id?: string
          transporteur_code?: string
          transporteur_nom?: string
          unite?: string
        }
        Relationships: []
      }
      transporteur_service: {
        Row: {
          actif: boolean | null
          assurance_incluse: boolean | null
          code_service: string
          date_creation: string | null
          delai_max_jours: number | null
          delai_min_jours: number | null
          description: string | null
          dimensions_max_cm: Json | null
          id: string
          nom_affichage: string
          poids_max_kg: number | null
          poids_min_kg: number | null
          suivi_disponible: boolean | null
          transporteur_id: string | null
        }
        Insert: {
          actif?: boolean | null
          assurance_incluse?: boolean | null
          code_service: string
          date_creation?: string | null
          delai_max_jours?: number | null
          delai_min_jours?: number | null
          description?: string | null
          dimensions_max_cm?: Json | null
          id?: string
          nom_affichage: string
          poids_max_kg?: number | null
          poids_min_kg?: number | null
          suivi_disponible?: boolean | null
          transporteur_id?: string | null
        }
        Update: {
          actif?: boolean | null
          assurance_incluse?: boolean | null
          code_service?: string
          date_creation?: string | null
          delai_max_jours?: number | null
          delai_min_jours?: number | null
          description?: string | null
          dimensions_max_cm?: Json | null
          id?: string
          nom_affichage?: string
          poids_max_kg?: number | null
          poids_min_kg?: number | null
          suivi_disponible?: boolean | null
          transporteur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transporteur_service_transporteur_id_fkey"
            columns: ["transporteur_id"]
            isOneToOne: false
            referencedRelation: "transporteur_configuration"
            referencedColumns: ["id"]
          },
        ]
      }
      type_carton: {
        Row: {
          actif: boolean | null
          date_creation: string | null
          hauteur_cm: number
          id: string
          largeur_cm: number
          longueur_cm: number
          nom: string
          poids_carton_kg: number
          volume_m3: number | null
        }
        Insert: {
          actif?: boolean | null
          date_creation?: string | null
          hauteur_cm: number
          id?: string
          largeur_cm: number
          longueur_cm: number
          nom: string
          poids_carton_kg?: number
          volume_m3?: number | null
        }
        Update: {
          actif?: boolean | null
          date_creation?: string | null
          hauteur_cm?: number
          id?: string
          largeur_cm?: number
          longueur_cm?: number
          nom?: string
          poids_carton_kg?: number
          volume_m3?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_rate_limit: {
        Row: {
          blocked_until: string | null
          created_at: string | null
          endpoint: string
          first_request_at: string | null
          id: string
          ip_address: unknown
          last_request_at: string | null
          request_count: number | null
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string | null
          endpoint: string
          first_request_at?: string | null
          id?: string
          ip_address: unknown
          last_request_at?: string | null
          request_count?: number | null
        }
        Update: {
          blocked_until?: string | null
          created_at?: string | null
          endpoint?: string
          first_request_at?: string | null
          id?: string
          ip_address?: unknown
          last_request_at?: string | null
          request_count?: number | null
        }
        Relationships: []
      }
      webhook_security_log: {
        Row: {
          created_at: string | null
          details: Json | null
          endpoint: string
          event_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          endpoint: string
          event_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          endpoint?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      webhook_sendcloud_log: {
        Row: {
          commande_id: string | null
          date_reception: string | null
          erreur: string | null
          id: string
          payload: Json
          statut: string | null
          traite_a: string | null
        }
        Insert: {
          commande_id?: string | null
          date_reception?: string | null
          erreur?: string | null
          id?: string
          payload: Json
          statut?: string | null
          traite_a?: string | null
        }
        Update: {
          commande_id?: string | null
          date_reception?: string | null
          erreur?: string | null
          id?: string
          payload?: Json
          statut?: string | null
          traite_a?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_sendcloud_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_sendcloud_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande_gestionnaire_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_sendcloud_log_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "v_commandes_avec_statut"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_user_stats: {
        Row: {
          client_id: string | null
          current_users: number | null
          max_users: number | null
          nom_entreprise: string | null
          remaining_slots: number | null
        }
        Relationships: []
      }
      commande_gestionnaire_secure: {
        Row: {
          adresse_ligne_1: string | null
          adresse_ligne_2: string | null
          adresse_nom: string | null
          client_id: string | null
          code_postal: string | null
          date_creation: string | null
          date_modification: string | null
          devise: string | null
          email_client: string | null
          facturation_code_postal: string | null
          facturation_ligne_1: string | null
          facturation_ligne_2: string | null
          facturation_nom: string | null
          facturation_pays_code: string | null
          facturation_ville: string | null
          id: string | null
          methode_expedition: string | null
          nom_client: string | null
          numero_commande: string | null
          numero_facture_commerciale: string | null
          pays_code: string | null
          poids_total: number | null
          remarques: string | null
          sendcloud_id: string | null
          source: string | null
          statut_wms: string | null
          telephone_client: string | null
          transporteur: string | null
          valeur_totale: number | null
          ville: string | null
        }
        Insert: {
          adresse_ligne_1?: string | null
          adresse_ligne_2?: string | null
          adresse_nom?: string | null
          client_id?: string | null
          code_postal?: string | null
          date_creation?: string | null
          date_modification?: string | null
          devise?: string | null
          email_client?: never
          facturation_code_postal?: string | null
          facturation_ligne_1?: string | null
          facturation_ligne_2?: string | null
          facturation_nom?: never
          facturation_pays_code?: string | null
          facturation_ville?: string | null
          id?: string | null
          methode_expedition?: string | null
          nom_client?: never
          numero_commande?: string | null
          numero_facture_commerciale?: string | null
          pays_code?: string | null
          poids_total?: number | null
          remarques?: string | null
          sendcloud_id?: string | null
          source?: string | null
          statut_wms?: string | null
          telephone_client?: never
          transporteur?: string | null
          valeur_totale?: number | null
          ville?: string | null
        }
        Update: {
          adresse_ligne_1?: string | null
          adresse_ligne_2?: string | null
          adresse_nom?: string | null
          client_id?: string | null
          code_postal?: string | null
          date_creation?: string | null
          date_modification?: string | null
          devise?: string | null
          email_client?: never
          facturation_code_postal?: string | null
          facturation_ligne_1?: string | null
          facturation_ligne_2?: string | null
          facturation_nom?: never
          facturation_pays_code?: string | null
          facturation_ville?: string | null
          id?: string | null
          methode_expedition?: string | null
          nom_client?: never
          numero_commande?: string | null
          numero_facture_commerciale?: string | null
          pays_code?: string | null
          poids_total?: number | null
          remarques?: string | null
          sendcloud_id?: string | null
          source?: string | null
          statut_wms?: string | null
          telephone_client?: never
          transporteur?: string | null
          valeur_totale?: number | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
        ]
      }
      sendcloud_event_stats: {
        Row: {
          avg_processing_time_ms: number | null
          direction: string | null
          event_type: string | null
          failed_events: number | null
          last_event_at: string | null
          successful_events: number | null
          total_events: number | null
        }
        Relationships: []
      }
      sendcloud_failed_webhooks: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          event_type: string | null
          id: string | null
          max_retries: number | null
          next_retry_at: string | null
          retry_count: number | null
        }
        Relationships: []
      }
      stock_disponible: {
        Row: {
          nom: string | null
          produit_id: string | null
          reference: string | null
          stock_actuel: number | null
          stock_disponible: number | null
          stock_reserve: number | null
        }
        Relationships: []
      }
      users_overview: {
        Row: {
          client_id: string | null
          client_nom: string | null
          email: string | null
          id: string | null
          nom_complet: string | null
          role: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
      v_commandes_avec_statut: {
        Row: {
          adresse_ligne_1: string | null
          adresse_ligne_2: string | null
          adresse_nom: string | null
          assurance_demandee: boolean | null
          client_id: string | null
          code_hs: string | null
          code_postal: string | null
          conditions_paiement: string | null
          date_creation: string | null
          date_expedition: string | null
          date_expedition_demandee: string | null
          date_expiration_commande: string | null
          date_livraison_estimee: string | null
          date_livraison_reelle: string | null
          date_modification: string | null
          date_packing: string | null
          date_picking: string | null
          devise: string | null
          documents_douane_requis: string[] | null
          email_client: string | null
          expediteur_adresse_ligne_1: string | null
          expediteur_adresse_ligne_2: string | null
          expediteur_code_postal: string | null
          expediteur_email: string | null
          expediteur_entreprise: string | null
          expediteur_nom: string | null
          expediteur_pays_code: string | null
          expediteur_telephone: string | null
          expediteur_ville: string | null
          facturation_code_postal: string | null
          facturation_ligne_1: string | null
          facturation_ligne_2: string | null
          facturation_nom: string | null
          facturation_pays_code: string | null
          facturation_siret: string | null
          facturation_tva_numero: string | null
          facturation_ville: string | null
          id: string | null
          incoterm: string | null
          instructions_livraison: string | null
          label_pregenere: boolean | null
          label_source: string | null
          label_url: string | null
          methode_expedition: string | null
          nature_marchandise: string | null
          nb_transitions: number | null
          nom_client: string | null
          notes_expedition: string | null
          numero_commande: string | null
          numero_facture_commerciale: string | null
          pays_code: string | null
          pays_origine_marchandise: string | null
          poids_reel_kg: number | null
          poids_total: number | null
          poids_volumetrique_kg: number | null
          point_relais_id: string | null
          priorite_expedition: string | null
          reference_client: string | null
          reference_interne: string | null
          remarques: string | null
          sendcloud_id: string | null
          sendcloud_shipment_id: string | null
          source: string | null
          sous_client: string | null
          statut_affichage_fr: string | null
          statut_libelle: string | null
          statut_wms: Database["public"]["Enums"]["statut_commande_enum"] | null
          statut_wms_old: string | null
          tags: string[] | null
          telephone_client: string | null
          tracking_number: string | null
          tracking_url: string | null
          transporteur: string | null
          transporteur_choisi: string | null
          type_carton_id: string | null
          valeur_assuree: number | null
          valeur_declaree_douane: number | null
          valeur_totale: number | null
          ville: string | null
          zone_livraison: string | null
        }
        Insert: {
          adresse_ligne_1?: string | null
          adresse_ligne_2?: string | null
          adresse_nom?: string | null
          assurance_demandee?: boolean | null
          client_id?: string | null
          code_hs?: string | null
          code_postal?: string | null
          conditions_paiement?: string | null
          date_creation?: string | null
          date_expedition?: string | null
          date_expedition_demandee?: string | null
          date_expiration_commande?: string | null
          date_livraison_estimee?: string | null
          date_livraison_reelle?: string | null
          date_modification?: string | null
          date_packing?: string | null
          date_picking?: string | null
          devise?: string | null
          documents_douane_requis?: string[] | null
          email_client?: string | null
          expediteur_adresse_ligne_1?: string | null
          expediteur_adresse_ligne_2?: string | null
          expediteur_code_postal?: string | null
          expediteur_email?: string | null
          expediteur_entreprise?: string | null
          expediteur_nom?: string | null
          expediteur_pays_code?: string | null
          expediteur_telephone?: string | null
          expediteur_ville?: string | null
          facturation_code_postal?: string | null
          facturation_ligne_1?: string | null
          facturation_ligne_2?: string | null
          facturation_nom?: string | null
          facturation_pays_code?: string | null
          facturation_siret?: string | null
          facturation_tva_numero?: string | null
          facturation_ville?: string | null
          id?: string | null
          incoterm?: string | null
          instructions_livraison?: string | null
          label_pregenere?: boolean | null
          label_source?: string | null
          label_url?: string | null
          methode_expedition?: string | null
          nature_marchandise?: string | null
          nb_transitions?: never
          nom_client?: string | null
          notes_expedition?: string | null
          numero_commande?: string | null
          numero_facture_commerciale?: string | null
          pays_code?: string | null
          pays_origine_marchandise?: string | null
          poids_reel_kg?: number | null
          poids_total?: number | null
          poids_volumetrique_kg?: number | null
          point_relais_id?: string | null
          priorite_expedition?: string | null
          reference_client?: string | null
          reference_interne?: string | null
          remarques?: string | null
          sendcloud_id?: string | null
          sendcloud_shipment_id?: string | null
          source?: string | null
          sous_client?: string | null
          statut_affichage_fr?: never
          statut_libelle?: never
          statut_wms?:
            | Database["public"]["Enums"]["statut_commande_enum"]
            | null
          statut_wms_old?: string | null
          tags?: string[] | null
          telephone_client?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          transporteur?: string | null
          transporteur_choisi?: string | null
          type_carton_id?: string | null
          valeur_assuree?: number | null
          valeur_declaree_douane?: number | null
          valeur_totale?: number | null
          ville?: string | null
          zone_livraison?: string | null
        }
        Update: {
          adresse_ligne_1?: string | null
          adresse_ligne_2?: string | null
          adresse_nom?: string | null
          assurance_demandee?: boolean | null
          client_id?: string | null
          code_hs?: string | null
          code_postal?: string | null
          conditions_paiement?: string | null
          date_creation?: string | null
          date_expedition?: string | null
          date_expedition_demandee?: string | null
          date_expiration_commande?: string | null
          date_livraison_estimee?: string | null
          date_livraison_reelle?: string | null
          date_modification?: string | null
          date_packing?: string | null
          date_picking?: string | null
          devise?: string | null
          documents_douane_requis?: string[] | null
          email_client?: string | null
          expediteur_adresse_ligne_1?: string | null
          expediteur_adresse_ligne_2?: string | null
          expediteur_code_postal?: string | null
          expediteur_email?: string | null
          expediteur_entreprise?: string | null
          expediteur_nom?: string | null
          expediteur_pays_code?: string | null
          expediteur_telephone?: string | null
          expediteur_ville?: string | null
          facturation_code_postal?: string | null
          facturation_ligne_1?: string | null
          facturation_ligne_2?: string | null
          facturation_nom?: string | null
          facturation_pays_code?: string | null
          facturation_siret?: string | null
          facturation_tva_numero?: string | null
          facturation_ville?: string | null
          id?: string | null
          incoterm?: string | null
          instructions_livraison?: string | null
          label_pregenere?: boolean | null
          label_source?: string | null
          label_url?: string | null
          methode_expedition?: string | null
          nature_marchandise?: string | null
          nb_transitions?: never
          nom_client?: string | null
          notes_expedition?: string | null
          numero_commande?: string | null
          numero_facture_commerciale?: string | null
          pays_code?: string | null
          pays_origine_marchandise?: string | null
          poids_reel_kg?: number | null
          poids_total?: number | null
          poids_volumetrique_kg?: number | null
          point_relais_id?: string | null
          priorite_expedition?: string | null
          reference_client?: string | null
          reference_interne?: string | null
          remarques?: string | null
          sendcloud_id?: string | null
          sendcloud_shipment_id?: string | null
          source?: string | null
          sous_client?: string | null
          statut_affichage_fr?: never
          statut_libelle?: never
          statut_wms?:
            | Database["public"]["Enums"]["statut_commande_enum"]
            | null
          statut_wms_old?: string | null
          tags?: string[] | null
          telephone_client?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          transporteur?: string | null
          transporteur_choisi?: string | null
          type_carton_id?: string | null
          valeur_assuree?: number | null
          valeur_declaree_douane?: number | null
          valeur_totale?: number | null
          ville?: string | null
          zone_livraison?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commande_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_user_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "commande_type_carton_id_fkey"
            columns: ["type_carton_id"]
            isOneToOne: false
            referencedRelation: "type_carton"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ajouter_stock_manuel: {
        Args: {
          p_emplacement_id: string
          p_produit_id: string
          p_quantite: number
          p_raison?: string
          p_remarques?: string
        }
        Returns: Json
      }
      backfill_missing_profiles: { Args: never; Returns: undefined }
      calculate_next_retry: {
        Args: { base_delay_minutes?: number; retry_count: number }
        Returns: string
      }
      calculer_poids_volumetrique_commande: {
        Args: { p_commande_id: string; p_transporteur_code?: string }
        Returns: {
          details: Json
          facteur_utilise: number
          poids_facturable: number
          poids_reel_total: number
          poids_volumetrique_total: number
        }[]
      }
      calculer_poids_volumetrique_produit: {
        Args: {
          p_facteur_division?: number
          p_hauteur_cm: number
          p_largeur_cm: number
          p_longueur_cm: number
        }
        Returns: number
      }
      can_client_create_user: { Args: { _client_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          _identifier: string
          _max_requests: number
          _window_seconds: number
        }
        Returns: Json
      }
      check_unanimite_suggestion: {
        Args: { p_suggestion_id: string }
        Returns: Json
      }
      cleanup_webhook_rate_limit: { Args: never; Returns: undefined }
      creer_notification: {
        Args: {
          p_lien_action?: string
          p_message: string
          p_metadata?: Json
          p_severite: string
          p_titre: string
          p_type: string
          p_user_ids: string[]
        }
        Returns: undefined
      }
      execute_sql_admin: { Args: { statements: string[] }; Returns: Json }
      expedier_commande_stock: {
        Args: { p_commande_id: string }
        Returns: Json
      }
      generer_emplacements_auto: {
        Args: {
          p_allees?: string
          p_capacite_kg?: number
          p_nb_racks?: number
          p_positions?: string
        }
        Returns: number
      }
      generer_recommandations_optimisation: {
        Args: {
          p_commande_id: string
          p_ecart_pourcentage: number
          p_poids_reel_kg: number
          p_poids_volumetrique_kg: number
        }
        Returns: Json
      }
      get_commande_historique: {
        Args: { p_commande_id: string }
        Returns: {
          date_transition: string
          metadata: Json
          raison: string
          statut_nouveau: string
          statut_precedent: string
          utilisateur_nom: string
        }[]
      }
      get_statut_label: {
        Args: { statut: Database["public"]["Enums"]["statut_commande_enum"] }
        Returns: string
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      liberer_stock_commande: { Args: { p_commande_id: string }; Returns: Json }
      peut_transitionner: {
        Args: {
          p_statut_actuel: Database["public"]["Enums"]["statut_commande_enum"]
          p_statut_cible: Database["public"]["Enums"]["statut_commande_enum"]
        }
        Returns: boolean
      }
      process_commande_services: {
        Args: { p_commande_id: string; p_services: Json }
        Returns: Json
      }
      promote_user_to_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
      refresh_materialized_views: { Args: never; Returns: undefined }
      reintegrer_produits_retour: {
        Args: { p_retour_id: string }
        Returns: Json
      }
      reserver_stock: {
        Args: {
          p_commande_id: string
          p_produit_id: string
          p_quantite: number
          p_reference_origine: string
        }
        Returns: Json
      }
      reserver_stock_commande: {
        Args: { p_commande_id: string; p_lignes: Json }
        Returns: Json
      }
      retirer_stock_manuel: {
        Args: {
          p_emplacement_id: string
          p_quantite: number
          p_raison?: string
          p_remarques?: string
        }
        Returns: Json
      }
      rollback_transition: {
        Args: {
          p_raison: string
          p_transition_id: string
          p_type: string
          p_user_id: string
        }
        Returns: Json
      }
      supprimer_emplacements_zone: { Args: { p_zone?: string }; Returns: Json }
      transition_statut_attendu: {
        Args: {
          p_attendu_id: string
          p_metadata?: Json
          p_nouveau_statut: Database["public"]["Enums"]["statut_attendu_reception"]
          p_raison?: string
          p_utilisateur_id?: string
        }
        Returns: Json
      }
      transition_statut_commande:
        | {
            Args: {
              p_commande_id: string
              p_nouveau_statut: string
              p_remarques?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_commande_id: string
              p_metadata?: Json
              p_nouveau_statut: Database["public"]["Enums"]["statut_commande_enum"]
              p_raison?: string
              p_utilisateur_id?: string
            }
            Returns: Json
          }
      transition_statut_retour: {
        Args: {
          p_metadata?: Json
          p_nouveau_statut: string
          p_raison?: string
          p_retour_id: string
          p_utilisateur_id?: string
        }
        Returns: Json
      }
      validate_n8n_api_key: { Args: { _api_key: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "operateur" | "gestionnaire" | "client"
      statut_attendu_reception:
        | "prévu"
        | "en_transit"
        | "arrivé"
        | "en_cours_réception"
        | "réceptionné_partiellement"
        | "réceptionné_totalement"
        | "anomalie"
        | "annulé"
      statut_commande_enum:
        | "en_attente_reappro"
        | "stock_reserve"
        | "en_picking"
        | "picking_termine"
        | "en_preparation"
        | "pret_expedition"
        | "etiquette_generee"
        | "expedie"
        | "livre"
        | "annule"
        | "erreur"
        | "en_attente_validation"
      statut_ligne_attendu:
        | "attendu"
        | "réceptionné"
        | "manquant"
        | "excédent"
        | "endommagé"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operateur", "gestionnaire", "client"],
      statut_attendu_reception: [
        "prévu",
        "en_transit",
        "arrivé",
        "en_cours_réception",
        "réceptionné_partiellement",
        "réceptionné_totalement",
        "anomalie",
        "annulé",
      ],
      statut_commande_enum: [
        "en_attente_reappro",
        "stock_reserve",
        "en_picking",
        "picking_termine",
        "en_preparation",
        "pret_expedition",
        "etiquette_generee",
        "expedie",
        "livre",
        "annule",
        "erreur",
        "en_attente_validation",
      ],
      statut_ligne_attendu: [
        "attendu",
        "réceptionné",
        "manquant",
        "excédent",
        "endommagé",
      ],
    },
  },
} as const
