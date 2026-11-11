import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { keyPool } from './keyPool.js';
import { INVOICE_PARSER_SCHEMA } from './aiSchemas.js';

// Valid Gemini models in order of speed and capability
const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
];

export const aiControllers = {
  /**
   * GET /api/ai/quota-status
   * Ultra-low-cost connectivity & quota verification probe (1 token maxOutput)
   */
  async getQuotaStatus(req: Request, res: Response) {
    await keyPool.ensureSynced();
    const instance = keyPool.getNextClient();
    if (!instance) {
      return res.json({ available: false, reason: 'NO_API_KEY_CONFIGURED' });
    }

    try {
      // 1-token health check on low latency flash model with 8-second timeout
      const probePromise = instance.client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: 'ping',
        config: { maxOutputTokens: 1 }
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Quota probe timeout')), 8000)
      );

      await Promise.race([probePromise, timeoutPromise]);
      return res.json({ available: true, quotaExceeded: false });
    } catch (err: any) {
      const status = err.status || err.code || (err.error && err.error.code);
      const msg = (err.message || '').toLowerCase();
      const isQuota = status === 429 || msg.includes('quota') || msg.includes('resource_exhausted');

      if (isQuota) {
        keyPool.markKeyCooldown(instance.keyId, 15 * 60 * 1000);
      }

      return res.json({
        available: keyPool.hasAvailableKey(),
        quotaExceeded: isQuota,
        reason: err.message
      });
    }
  },

  /**
   * POST /api/ai/parse-invoice
   * Multimodal Purchase Invoice, handwritten memo, and distributor PDF parser
   */
  async parseInvoice(req: Request, res: Response) {
    const { fileBase64, mimeType } = req.body || {};

    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: 'Missing required fileBase64 or mimeType.' });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(mimeType)) {
      return res.status(400).json({ error: 'Unsupported format. Please upload JPG, PNG, WEBP, or PDF.' });
    }

    // Ensure synced with cloud keys before picking a client
    await keyPool.ensureSynced();

    const clientInfo = keyPool.getNextClient();
    if (!clientInfo) {
      return res.status(503).json({ error: 'Gemini AI API key is not configured on the server. Please add a key in Developer Tools.' });
    }

    // Clean base64 string if data URL prefix exists
    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;

    const payloadParts = [
      {
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64
        }
      },
      {
        text: `You are an expert purchase invoice and handwritten bill parser for Indian GST accounting, poultry farm inventories, feed mills, and agricultural suppliers.
Extract all details from this purchase invoice image, handwritten sales slip, delivery challan, or distributor PDF:

1. Supplier/Vendor Details:
   - Business/Trade Name (e.g., Feed distributor, Medicine supplier, Hatchery, Equipment vendor)
   - 15-digit GSTIN (e.g. 27AAAAA1111A1Z1) if printed
   - Physical store address, city, district
   - Phone or mobile number if present

2. Bill & Date Details:
   - Invoice / Bill / Cash Memo Number
   - Invoice Date: Standardize strictly into YYYY-MM-DD (e.g., convert 05/11/2026 or 05-11-2026 to 2026-11-05).
   - If no year is present, assume the current calendar year.

3. Extracted Line Items:
   - Name: Product name, ingredient, medicine, bird breed, equipment, or brand name (retain original script: English, Marathi, Hindi).
   - HSN or SAC code if printed.
   - Quantity and Unit (e.g., PCS, KGS, BAGS, BTL, LTR, DOZ, BOX).
   - Unit Rate: Purchase rate before GST. If only single gross price is printed and GST% is mentioned, compute: rate = gross / (1 + gstRate/100).
   - GST Rate percentage: Exact tax rate (0, 0.1, 0.25, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40).
     CRITICAL RULE: If a handwritten bill, thermal receipt, or non-GST slip has no tax printed, strictly set gstRate to 0. DO NOT arbitrarily invent or default to 18%.
   - Discount if noted.
   - Taxable amount = (quantity * rate) - discount.
   - Total line amount = taxableAmount + (taxableAmount * gstRate / 100).

4. Totals:
   - Subtotal (sum of taxable amounts)
   - Total Tax Amount (sum of CGST + SGST + IGST)
   - Grand Total (net payable amount)

Strictly conform the output to the requested JSON schema.`
      }
    ];

    let parsedInvoice: any = null;
    let successfulModel: string | null = null;
    let lastError: any = null;

    // Failover across candidate models with a 22-second per-attempt timeout
    for (let i = 0; i < CANDIDATE_MODELS.length; i++) {
      const currentModel = CANDIDATE_MODELS[i];
      try {
        const generatePromise = clientInfo.client.models.generateContent({
          model: currentModel,
          contents: payloadParts,
          config: {
            responseMimeType: 'application/json',
            responseSchema: INVOICE_PARSER_SCHEMA
          }
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: Model ${currentModel} exceeded 22 seconds`)), 22000)
        );

        const response: any = await Promise.race([generatePromise, timeoutPromise]);

        const rawJson = response.text?.trim() || '{}';
        parsedInvoice = JSON.parse(rawJson);

        if (parsedInvoice && parsedInvoice.items && Array.isArray(parsedInvoice.items) && parsedInvoice.items.length > 0) {
          successfulModel = currentModel;
          break; // Extraction successful!
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        const status = modelErr.status || modelErr.code || (modelErr.error && modelErr.error.code);
        const msg = (modelErr.message || '').toLowerCase();

        console.warn(`[Invoice Scanner] Model '${currentModel}' attempt failed (${status}): ${modelErr.message}`);

        // Handle 429 quota exhaustion
        if (status === 429 || msg.includes('quota') || msg.includes('resource_exhausted')) {
          keyPool.markKeyCooldown(clientInfo.keyId, 15 * 60 * 1000);
          if (i < CANDIDATE_MODELS.length - 1) continue;
          break;
        }

        // Brief pause before trying next candidate model
        if (i < CANDIDATE_MODELS.length - 1) {
          await new Promise(r => setTimeout(r, 200));
          continue;
        }
      }
    }

    // Sanity checks
    if (!parsedInvoice || !parsedInvoice.items || parsedInvoice.items.length === 0) {
      const isQuota = lastError?.status === 429 || (lastError?.message || '').toLowerCase().includes('quota');
      return res.status(422).json({
        error: isQuota
          ? 'AI scanning quota is temporarily exhausted. Please enter bill details manually or try again in a few minutes.'
          : (lastError?.message || 'Could not parse readable line items from the document. Please ensure the invoice image or PDF is clear and legible.')
      });
    }

    // Standardize defaults
    if (!parsedInvoice.invoiceDate || parsedInvoice.invoiceDate.length < 8) {
      parsedInvoice.invoiceDate = new Date().toISOString().split('T')[0];
    }
    if (!parsedInvoice.invoiceNumber) {
      parsedInvoice.invoiceNumber = 'BILL-' + Date.now().toString().slice(-6);
    }

    return res.json({
      success: true,
      invoice: parsedInvoice,
      modelUsed: successfulModel
    });
  },

  /**
   * GET /api/developer/gemini-keys
   * Strictly Developer Only: List all configured keys (masked) and status
   */
  async listKeys(req: Request, res: Response) {
    try {
      await keyPool.ensureSynced();
      const keys = keyPool.getMaskedKeys();
      return res.json({
        success: true,
        keys,
        total: keys.length,
        hasAvailableKey: keyPool.hasAvailableKey()
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to list API keys' });
    }
  },

  /**
   * POST /api/developer/gemini-keys
   * Strictly Developer Only: Add a new key to the pool
   */
  async addKey(req: Request, res: Response) {
    try {
      const { apiKey } = req.body || {};
      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ error: 'Please provide a valid Gemini API key.' });
      }

      const result = await keyPool.addKey(apiKey);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      return res.json({
        success: true,
        message: result.message,
        keys: keyPool.getMaskedKeys()
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to save API key' });
    }
  },

  /**
   * DELETE /api/developer/gemini-keys/:id
   * Strictly Developer Only: Remove an API key from the pool
   */
  async removeKey(req: Request, res: Response) {
    try {
      const keyId = req.params.id;
      if (!keyId) {
        return res.status(400).json({ error: 'Missing key ID.' });
      }

      const result = await keyPool.removeKeyById(keyId);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      return res.json({
        success: true,
        message: result.message,
        keys: keyPool.getMaskedKeys()
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to remove API key' });
    }
  },

  /**
   * POST /api/developer/gemini-keys/test
   * Strictly Developer Only: Test key connectivity
   */
  async testKey(req: Request, res: Response) {
    try {
      await keyPool.ensureSynced();
      const { apiKey } = req.body || {};
      let targetClient: GoogleGenAI | undefined;
      if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 10) {
        targetClient = new GoogleGenAI({ apiKey: apiKey.trim() });
      } else {
        targetClient = keyPool.getNextClient()?.client;
      }

      if (!targetClient) {
        return res.status(400).json({ success: false, error: 'No API key provided or configured to test. Please add a key first.' });
      }

      const response = await targetClient.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: 'Hello, respond with OK.',
        config: { maxOutputTokens: 5 }
      });

      return res.json({
        success: true,
        message: 'API Key is verified and operational!',
        reply: response.text ? response.text.trim() : 'OK'
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to verify API key with Google Gemini service.'
      });
    }
  }
};
