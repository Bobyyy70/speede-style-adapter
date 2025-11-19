// Feature disabled - thermal printer tables not configured in database
export type DocumentType = 'picking_slip' | 'packing_list' | 'shipping_label' | 'product_label' | 'cn23' | 'barcode';
export type PrintFormat = 'html_thermal' | 'escpos' | 'zpl' | 'pdf';

export function useThermalPrinter() {
  return {
    printers: [],
    loadingPrinters: false,
    isPrinting: false,
    printLogs: [],
    loadingLogs: false,
    print: () => {},
    printAsync: async () => ({ success: false, url: '', printer: '', duration: 0 }),
    getDefaultPrinter: () => null,
    testPrinterConnection: async () => false,
    generateThermalDocument: async () => ({ success: false }),
    hasPickingPrinter: false,
    hasShippingPrinter: false,
    hasLabelPrinter: false,
  };
}
