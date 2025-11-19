// Feature disabled - thermal printer tables not configured in database
export type DocumentType = 'picking_slip' | 'packing_list' | 'shipping_label' | 'product_label' | 'cn23' | 'barcode';
export type PrintFormat = 'html_thermal' | 'escpos' | 'zpl' | 'pdf';

interface PrintOptions {
  commandeId: string;
  documentType: DocumentType;
  format?: PrintFormat;
  printerId?: string;
  copies?: number;
  autoOpen?: boolean;
}

export function useThermalPrinter() {
  return {
    printers: [],
    loadingPrinters: false,
    isPrinting: false,
    printLogs: [],
    loadingLogs: false,
    print: (_options: PrintOptions) => {},
    printAsync: async (_options: PrintOptions) => ({ success: false, url: '', printer: '', duration: 0 }),
    getDefaultPrinter: (_documentType: DocumentType) => null,
    testPrinterConnection: async (_printerId: string) => false,
    generateThermalDocument: async (_commandeId: string, _documentType: DocumentType, _format?: PrintFormat, _printerWidth?: number) => ({ success: false }),
    hasPickingPrinter: false,
    hasShippingPrinter: false,
    hasLabelPrinter: false,
  };
}
