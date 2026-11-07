import { Type } from '@google/genai';

export const INVOICE_PARSER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    supplierName: { type: Type.STRING, description: 'Name of vendor, supplier, or distributor' },
    supplierGstin: { type: Type.STRING, description: 'Supplier 15-digit GSTIN alphanumeric code if present' },
    supplierAddress: { type: Type.STRING, description: 'Supplier physical store address or city' },
    supplierPhone: { type: Type.STRING, description: 'Supplier contact or mobile number' },
    invoiceNumber: { type: Type.STRING, description: 'Invoice, Bill, or Cash Memo number' },
    invoiceDate: { type: Type.STRING, description: 'Invoice date strictly in YYYY-MM-DD format' },
    items: {
      type: Type.ARRAY,
      description: 'Extracted line items from the purchase invoice or delivery challan',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Product description, feed ingredient, medicine, bird batch, or brand name' },
          hsn: { type: Type.STRING, description: 'HSN or SAC code if printed' },
          quantity: { type: Type.NUMBER, description: 'Quantity purchased' },
          unit: { type: Type.STRING, description: 'Unit of measurement (e.g. PCS, KGS, BAGS, BTL, LTR, DOZ)' },
          rate: { type: Type.NUMBER, description: 'Unit purchase price before GST' },
          discount: { type: Type.NUMBER, description: 'Line item discount amount if noted' },
          gstRate: { type: Type.NUMBER, description: 'Exact GST percentage (e.g. 0, 5, 12, 18, 28). If non-GST or handwritten without tax, set strictly to 0' },
          taxableAmount: { type: Type.NUMBER, description: 'Taxable value before taxes' },
          totalAmount: { type: Type.NUMBER, description: 'Total item line amount including taxes' }
        },
        required: ['name', 'quantity', 'rate', 'gstRate', 'totalAmount']
      }
    },
    subtotal: { type: Type.NUMBER, description: 'Total taxable amount of all items' },
    taxAmount: { type: Type.NUMBER, description: 'Total GST amount' },
    grandTotal: { type: Type.NUMBER, description: 'Grand total payable invoice amount' }
  },
  required: ['supplierName', 'items', 'grandTotal']
};
