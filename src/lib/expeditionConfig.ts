import { N8nConfig, TransporteurRule } from '@/pages/expedition/types';

const N8N_CONFIG_KEY = 'expedition_n8n_config';
const TRANSPORTEUR_RULES_KEY = 'expedition_transporteur_rules';

export const DEFAULT_N8N_CONFIG: N8nConfig = {
  baseUrl: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  tables: {
    orders: 'commande',
    orderItems: 'ligne_commande',
  },
  fields: {
    shipping_method_id: 'shipping_method_id',
    parcel_id: 'sendcloud_parcel_id',
    label_url: 'label_url',
    tracking_code: 'tracking_code',
    carrier: 'carrier',
    service: 'service',
  },
};

export function getN8nConfig(): N8nConfig {
  try {
    const stored = localStorage.getItem(N8N_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading n8n config:', error);
  }
  return DEFAULT_N8N_CONFIG;
}

export function saveN8nConfig(config: N8nConfig): void {
  try {
    localStorage.setItem(N8N_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving n8n config:', error);
    throw error;
  }
}

export function getTransporteurRules(): TransporteurRule[] {
  try {
    const stored = localStorage.getItem(TRANSPORTEUR_RULES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading transporteur rules:', error);
  }
  return [];
}

export function saveTransporteurRules(rules: TransporteurRule[]): void {
  try {
    localStorage.setItem(TRANSPORTEUR_RULES_KEY, JSON.stringify(rules));
  } catch (error) {
    console.error('Error saving transporteur rules:', error);
    throw error;
  }
}

export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getN8nConfig();
  const rules = getTransporteurRules();

  if (!config.baseUrl) {
    errors.push('N8N Base URL est requis');
  }

  if (!config.supabaseUrl) {
    errors.push('Supabase URL est requis');
  }

  if (!config.supabaseAnonKey) {
    errors.push('Supabase Anon Key est requis');
  }

  if (rules.length === 0) {
    errors.push('Au moins une règle transporteur est requise');
  } else {
    const invalidRules = rules.filter(
      (rule) => !rule.carrier || !rule.service || !rule.shipping_method_id
    );
    if (invalidRules.length > 0) {
      errors.push('Toutes les règles doivent avoir un transporteur, service et shipping_method_id');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
