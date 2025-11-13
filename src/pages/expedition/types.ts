export interface TransporteurRule {
  id: string;
  carrier: 'FedEx' | 'Colissimo' | 'Mondial Relay' | 'Autre';
  service: string;
  shipping_method_id: string;
  conditions?: string;
}

export interface N8nConfig {
  baseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  tables: {
    orders: string;
    orderItems: string;
  };
  fields: {
    shipping_method_id: string;
    parcel_id: string;
    label_url: string;
    tracking_code: string;
    carrier: string;
    service: string;
  };
}

export interface ParcelCreationPayload {
  order_id: string;
  carrier: string;
  service: string;
  shipping_method_id?: string | null;
  service_point_id?: string | null;
  request_label: boolean;
  mapping: TransporteurRule[];
  supabase: N8nConfig;
}

export interface ParcelCreationResponse {
  parcel_id: string;
  label_url: string;
  tracking_code: string;
  carrier: string;
  service: string;
}
