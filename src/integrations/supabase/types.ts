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
        ]
      }
      commande: {
        Row: {
          adresse_ligne_1: string
          adresse_ligne_2: string | null
          adresse_nom: string
          code_postal: string
          date_creation: string
          date_modification: string
          devise: string | null
          email_client: string | null
          facturation_code_postal: string | null
          facturation_ligne_1: string | null
          facturation_ligne_2: string | null
          facturation_nom: string | null
          facturation_pays_code: string | null
          facturation_ville: string | null
          id: string
          methode_expedition: string | null
          nom_client: string
          numero_commande: string
          numero_facture_commerciale: string | null
          pays_code: string
          poids_total: number | null
          remarques: string | null
          sendcloud_id: string | null
          source: string
          statut_wms: string
          telephone_client: string | null
          transporteur: string | null
          valeur_totale: number
          ville: string
        }
        Insert: {
          adresse_ligne_1: string
          adresse_ligne_2?: string | null
          adresse_nom: string
          code_postal: string
          date_creation?: string
          date_modification?: string
          devise?: string | null
          email_client?: string | null
          facturation_code_postal?: string | null
          facturation_ligne_1?: string | null
          facturation_ligne_2?: string | null
          facturation_nom?: string | null
          facturation_pays_code?: string | null
          facturation_ville?: string | null
          id?: string
          methode_expedition?: string | null
          nom_client: string
          numero_commande: string
          numero_facture_commerciale?: string | null
          pays_code: string
          poids_total?: number | null
          remarques?: string | null
          sendcloud_id?: string | null
          source: string
          statut_wms?: string
          telephone_client?: string | null
          transporteur?: string | null
          valeur_totale?: number
          ville: string
        }
        Update: {
          adresse_ligne_1?: string
          adresse_ligne_2?: string | null
          adresse_nom?: string
          code_postal?: string
          date_creation?: string
          date_modification?: string
          devise?: string | null
          email_client?: string | null
          facturation_code_postal?: string | null
          facturation_ligne_1?: string | null
          facturation_ligne_2?: string | null
          facturation_nom?: string | null
          facturation_pays_code?: string | null
          facturation_ville?: string | null
          id?: string
          methode_expedition?: string | null
          nom_client?: string
          numero_commande?: string
          numero_facture_commerciale?: string | null
          pays_code?: string
          poids_total?: number | null
          remarques?: string | null
          sendcloud_id?: string | null
          source?: string
          statut_wms?: string
          telephone_client?: string | null
          transporteur?: string | null
          valeur_totale?: number
          ville?: string
        }
        Relationships: []
      }
      emplacement: {
        Row: {
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
      ligne_service_commande: {
        Row: {
          commande_id: string | null
          date_creation: string | null
          genere_automatiquement: boolean | null
          id: string
          prix_total: number | null
          prix_unitaire: number
          quantite: number
          remarques: string | null
          service_id: string | null
        }
        Insert: {
          commande_id?: string | null
          date_creation?: string | null
          genere_automatiquement?: boolean | null
          id?: string
          prix_total?: number | null
          prix_unitaire: number
          quantite?: number
          remarques?: string | null
          service_id?: string | null
        }
        Update: {
          commande_id?: string | null
          date_creation?: string | null
          genere_automatiquement?: boolean | null
          id?: string
          prix_total?: number | null
          prix_unitaire?: number
          quantite?: number
          remarques?: string | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ligne_service_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commande"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligne_service_commande_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_logistique"
            referencedColumns: ["id"]
          },
        ]
      }
      mouvement_stock: {
        Row: {
          commande_id: string | null
          created_by: string | null
          date_mouvement: string | null
          emplacement_destination_id: string | null
          emplacement_source_id: string | null
          id: string
          numero_mouvement: string
          produit_id: string
          quantite: number
          reference_origine: string | null
          remarques: string | null
          statut_mouvement: string | null
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
          numero_mouvement: string
          produit_id: string
          quantite: number
          reference_origine?: string | null
          remarques?: string | null
          statut_mouvement?: string | null
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
          numero_mouvement?: string
          produit_id?: string
          quantite?: number
          reference_origine?: string | null
          remarques?: string | null
          statut_mouvement?: string | null
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
      produit: {
        Row: {
          categorie_emballage: number | null
          classe_danger: string | null
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
          reference: string
          statut_actif: boolean | null
          stock_actuel: number | null
          stock_maximum: number | null
          stock_minimum: number | null
          taux_tva: number | null
          temperature_stockage: string | null
          valeur_douaniere: number | null
          volume_m3: number | null
        }
        Insert: {
          categorie_emballage?: number | null
          classe_danger?: string | null
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
          reference: string
          statut_actif?: boolean | null
          stock_actuel?: number | null
          stock_maximum?: number | null
          stock_minimum?: number | null
          taux_tva?: number | null
          temperature_stockage?: string | null
          valeur_douaniere?: number | null
          volume_m3?: number | null
        }
        Update: {
          categorie_emballage?: number | null
          classe_danger?: string | null
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
          reference?: string
          statut_actif?: boolean | null
          stock_actuel?: number | null
          stock_maximum?: number | null
          stock_minimum?: number | null
          taux_tva?: number | null
          temperature_stockage?: string | null
          valeur_douaniere?: number | null
          volume_m3?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          id: string
          nom_complet: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          nom_complet?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom_complet?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      retour_produit: {
        Row: {
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
            foreignKeyName: "retour_produit_commande_origine_id_fkey"
            columns: ["commande_origine_id"]
            isOneToOne: false
            referencedRelation: "commande"
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
          id: string
          nom_service: string
          prix_unitaire: number
          type_facturation: string
        }
        Insert: {
          actif?: boolean | null
          categorie: string
          code_service: string
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          id?: string
          nom_service: string
          prix_unitaire: number
          type_facturation: string
        }
        Update: {
          actif?: boolean | null
          categorie?: string
          code_service?: string
          date_creation?: string | null
          date_modification?: string | null
          description?: string | null
          id?: string
          nom_service?: string
          prix_unitaire?: number
          type_facturation?: string
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
    }
    Views: {
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
    }
    Functions: {
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
      reserver_stock: {
        Args: {
          p_commande_id: string
          p_produit_id: string
          p_quantite: number
          p_reference_origine: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "operateur" | "gestionnaire" | "client"
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
    },
  },
} as const
