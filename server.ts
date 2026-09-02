import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

// Lazy initializer for Gemini API client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

/**
 * AI Voice & Natural Language Search Command Parser
 * Interprets queries like:
 * - "Find purchase orders for vendor Acme"
 * - "Show me all partially invoiced POs"
 * - "What is the status of PO 4500018902?"
 * - "Show unmatched items in matching report"
 * - "Create invoice for PO 4500018903"
 */
app.post('/api/ai/command', async (req, res) => {
  try {
    const { query, poGroups = [], invoices = [], deliveryNotes = [], payments = [], matchingItems = [] } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const ai = getAIClient();

    // Prepare compact context snapshot for the model
    const poSummary = poGroups.slice(0, 30).map((po: any) => ({
      poNumber: po.poNumber,
      vendor: po.customerName,
      status: po.status,
      date: po.date,
      contract: po.contract,
      destination: po.destination,
      totalValue: po.totalValueAfterVat,
      remainingValue: po.remainingValueAfterVat,
      invoicedQty: po.invoicedQuantity,
      totalQty: po.totalQuantity,
      deliveredQty: po.deliveredQuantity,
    }));

    const matchingSummary = matchingItems.slice(0, 30).map((m: any) => ({
      poNumber: m.poNumber,
      item: m.itemDescription,
      status: m.status,
      poQty: m.poQuantity,
      deliveredQty: m.deliveredQuantity,
      invoicedQty: m.invoicedQuantity,
      unmatchedQty: m.unmatchedQty,
      undeliveredQty: m.undeliveredQty,
    }));

    if (ai) {
      const prompt = `You are the AI Voice Copilot for FAMOLA Excel Ninja ERP.
A user gave this voice or text command: "${query}"

Here is the current ERP dataset context:
Purchase Orders (${poGroups.length} total, sample):
${JSON.stringify(poSummary, null, 2)}

Invoices count: ${invoices.length}
Delivery Notes count: ${deliveryNotes.length}
Payments count: ${payments.length}
Matching Items sample:
${JSON.stringify(matchingSummary, null, 2)}

Analyze the user's intent and return a clean JSON object (WITHOUT markdown formatting, raw JSON only):
{
  "spokenAnswer": "A crisp, natural, professional 1-3 sentence verbal response summarizing the result or answer to their question with exact figures if applicable.",
  "intent": "SEARCH_PO" | "FILTER_STATUS" | "NAVIGATE_TAB" | "CREATE_INVOICE" | "AUDIT_CHECK" | "SUMMARY_METRICS" | "GENERAL_QA",
  "suggestedTab": "po_master" | "create_invoice" | "invoices_db" | "delivery_notes" | "matching_report" | "payments" | "dashboard" | "ledger" | "settings",
  "searchKeyword": "extracted PO number, vendor name, item keyword, contract, or empty string",
  "statusFilter": "ALL" | "PENDING" | "PARTIALLY_INVOICED" | "FULLY_INVOICED" | "UNMATCHED" | "UNDELIVERED" | "MATCHED",
  "matchingPoNumbers": ["list", "of", "exact", "matching", "poNumbers"],
  "highlightMetric": "Optional short badge like '$45,200 Remaining' or '3 Unmatched Lines'",
  "action": {
    "type": "NONE" | "OPEN_INVOICE_CREATOR" | "FILTER_MATCHING" | "APPLY_SEARCH",
    "targetPo": "PO number if user wants to invoice or inspect a specific PO",
    "matchingFilter": "ALL" | "UNMATCHED" | "UNDELIVERED" | "MATCHED"
  }
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '{}';
      try {
        const parsed = JSON.parse(responseText.trim());
        return res.json(parsed);
      } catch (parseErr) {
        console.warn('Failed to parse Gemini JSON output:', responseText);
      }
    }

    // High-performance Rule-based fallback if Gemini key is not configured or parsing fails
    const cleanQuery = query.toLowerCase().trim();
    let suggestedTab: string = 'po_master';
    let statusFilter = 'ALL';
    let searchKeyword = '';
    let matchingPoNumbers: string[] = [];
    let spokenAnswer = '';
    let action = { type: 'APPLY_SEARCH', targetPo: '', matchingFilter: 'ALL' };

    // Check for specific PO number pattern
    const poMatch = cleanQuery.match(/(?:po|order|number|#)?\s*([0-9]{3,10}|lpo-[0-9]+)/i);
    const extractedNum = poMatch ? poMatch[1] : '';

    if (cleanQuery.includes('create invoice') || cleanQuery.includes('record invoice') || cleanQuery.includes('bill')) {
      suggestedTab = 'create_invoice';
      const foundPo = poGroups.find((p: any) => p.poNumber.toLowerCase().includes(extractedNum));
      if (foundPo) {
        action = { type: 'OPEN_INVOICE_CREATOR', targetPo: foundPo.poNumber, matchingFilter: 'ALL' };
        spokenAnswer = `Opening Invoice Creator for Purchase Order ${foundPo.poNumber} (${foundPo.customerName}). Remaining balance is $${(foundPo.remainingValueAfterVat || 0).toLocaleString()}.`;
      } else {
        spokenAnswer = 'Navigating to Invoice Creator. Select or search a Purchase Order to begin recording.';
      }
    } else if (cleanQuery.includes('unmatched') || cleanQuery.includes('matching') || cleanQuery.includes('reconciliation') || cleanQuery.includes('audit') || cleanQuery.includes('discrepanc')) {
      suggestedTab = 'matching_report';
      statusFilter = cleanQuery.includes('undelivered') ? 'UNDELIVERED' : 'UNMATCHED';
      action = { type: 'FILTER_MATCHING', targetPo: '', matchingFilter: statusFilter };
      spokenAnswer = `Showing 3-Way Reconciliation Audit report. Filtered for ${statusFilter.toLowerCase()} items across all Purchase Orders.`;
    } else if (cleanQuery.includes('delivery') || cleanQuery.includes('grn') || cleanQuery.includes('dispatch')) {
      suggestedTab = 'delivery_notes';
      searchKeyword = extractedNum || '';
      spokenAnswer = `Showing Delivery Notes log. ${deliveryNotes.length} delivery receipts registered.`;
    } else if (cleanQuery.includes('payment') || cleanQuery.includes('paid') || cleanQuery.includes('remittance')) {
      suggestedTab = 'payments';
      spokenAnswer = `Showing Payments ledger. ${payments.length} payment receipts recorded in system.`;
    } else if (cleanQuery.includes('invoice') || cleanQuery.includes('invoiced')) {
      suggestedTab = 'invoices_db';
      searchKeyword = extractedNum || '';
      spokenAnswer = `Showing Invoiced PO database. ${invoices.length} historical invoices found.`;
    } else if (cleanQuery.includes('pending') || cleanQuery.includes('uninvoiced') || cleanQuery.includes('partial')) {
      suggestedTab = 'po_master';
      statusFilter = cleanQuery.includes('partial') ? 'PARTIALLY_INVOICED' : 'PENDING';
      spokenAnswer = `Filtering Purchase Orders by status: ${statusFilter.replace('_', ' ')}.`;
    } else {
      // General PO search
      searchKeyword = extractedNum || cleanQuery.replace(/(search|find|show|look for|po|order|purchase order)/gi, '').trim();
      const matched = poGroups.filter((p: any) => 
        p.poNumber.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        p.customerName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (p.contract && p.contract.toLowerCase().includes(searchKeyword.toLowerCase()))
      );
      matchingPoNumbers = matched.map((p: any) => p.poNumber);
      spokenAnswer = matched.length > 0 
        ? `Found ${matched.length} Purchase Order${matched.length > 1 ? 's' : ''} matching "${searchKeyword}".`
        : `Searched for "${searchKeyword}". Check the PO Master list for all matching lines.`;
    }

    return res.json({
      spokenAnswer,
      intent: 'SEARCH_PO',
      suggestedTab,
      searchKeyword,
      statusFilter,
      matchingPoNumbers,
      highlightMetric: matchingPoNumbers.length > 0 ? `${matchingPoNumbers.length} POs matched` : undefined,
      action,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/command:', err);
    res.status(500).json({
      error: 'Failed to process voice command',
      details: err?.message,
    });
  }
});

/**
 * AI Automated Report Generator
 * Generates comprehensive Executive, Financial, Audit & Operational Reports
 */
app.post('/api/ai/generate-report', async (req, res) => {
  try {
    const {
      reportType = 'EXECUTIVE_AUDIT',
      customPrompt = '',
      summaryMetrics = {},
      poData = [],
      invoicesData = [],
      deliveryNotesData = [],
      paymentsData = [],
      matchingData = [],
    } = req.body;

    const ai = getAIClient();

    // Compute key statistics for prompt
    const totalPOs = poData.length;
    const totalPoVal = summaryMetrics.totalPoValue || 0;
    const totalInvoicedVal = summaryMetrics.totalInvoicedValue || 0;
    const totalRemainingVal = summaryMetrics.totalRemainingValue || 0;
    const totalPayments = summaryMetrics.totalPaymentsReceived || 0;
    const outstandingPayments = summaryMetrics.totalOutstandingPayments || 0;
    const totalDeliveredVal = summaryMetrics.totalDeliveredValue || 0;
    const unmatchedCount = summaryMetrics.totalUnmatchedItemsCount || 0;
    const undeliveredCount = summaryMetrics.totalUndeliveredItemsCount || 0;

    // High-risk items (unmatched or delivery discrepancies)
    const riskItems = matchingData
      .filter((m: any) => m.unmatchedQty > 0 || m.undeliveredQty > 0 || m.receivedVsInvoicedVarianceQty !== 0)
      .slice(0, 15);

    if (ai) {
      const prompt = `You are the Chief Financial Auditor and ERP Intelligence Specialist for FAMOLA Excel Ninja.
Generate an in-depth, authoritative, executive-ready analytical report.

Report Type Requested: ${reportType}
${customPrompt ? `User Custom Instructions: "${customPrompt}"` : ''}

ERP Dataset Summary:
- Total PO Count: ${totalPOs}
- Total PO Value Committed: $${totalPoVal.toLocaleString()}
- Total Invoiced Value: $${totalInvoicedVal.toLocaleString()}
- Total Remaining PO Balance: $${totalRemainingVal.toLocaleString()}
- Total Delivered Goods Value: $${totalDeliveredVal.toLocaleString()}
- Total Payments Settled: $${totalPayments.toLocaleString()}
- Outstanding Invoiced Balance (Unpaid AP): $${outstandingPayments.toLocaleString()}
- 3-Way Unmatched PO Lines Count: ${unmatchedCount}
- Undelivered Items Count: ${undeliveredCount}

Top POs Snapshot:
${JSON.stringify(poData.slice(0, 10).map((p: any) => ({
  poNumber: p.poNumber,
  vendor: p.customerName,
  totalValue: p.totalValueAfterVat,
  remainingValue: p.remainingValueAfterVat,
  status: p.status,
  deliveredQty: p.deliveredQuantity,
  totalQty: p.totalQuantity,
})), null, 2)}

Sample High-Risk & Variance Items:
${JSON.stringify(riskItems, null, 2)}

Generate a structured JSON report (RAW JSON only, NO backticks or markdown fences):
{
  "title": "Clear, professional executive report title",
  "subtitle": "Subtitle describing the scope and analysis period",
  "generatedAt": "${new Date().toISOString()}",
  "reportType": "${reportType}",
  "executiveSummary": "A comprehensive, 2-3 paragraph executive brief detailing overall financial health, PO utilization rate, billing efficiency, 3-way reconciliation integrity, and cashflow outlook.",
  "keyMetrics": [
    { "label": "Total Order Value", "value": "$${totalPoVal.toLocaleString()}", "changeOrStatus": "100% committed", "sentiment": "neutral" },
    { "label": "Invoicing Progress", "value": "${totalPoVal > 0 ? ((totalInvoicedVal / totalPoVal) * 100).toFixed(1) : 0}%", "changeOrStatus": "$${totalInvoicedVal.toLocaleString()} billed", "sentiment": "positive" },
    { "label": "Delivered Fulfillment", "value": "${totalPoVal > 0 ? ((totalDeliveredVal / totalPoVal) * 100).toFixed(1) : 0}%", "changeOrStatus": "$${totalDeliveredVal.toLocaleString()} received", "sentiment": "positive" },
    { "label": "Unsettled Payables", "value": "$${outstandingPayments.toLocaleString()}", "changeOrStatus": "Pending settlement", "sentiment": "warning" },
    { "label": "Reconciliation Exceptions", "value": "${unmatchedCount}", "changeOrStatus": "Requires audit review", "sentiment": "danger" }
  ],
  "findingsAndRisks": [
    {
      "category": "3-Way Match Audit | Cashflow | Delivery Lag | Contract Compliance",
      "title": "Specific issue or observation headline",
      "description": "Detailed explanation with numerical evidence, root-cause assessment, and impact on operations.",
      "severity": "HIGH" | "MEDIUM" | "LOW" | "INFO",
      "affectedPOs": ["PO-4500018901", "PO-4500018902"]
    }
  ],
  "tabularBreakdown": {
    "sectionTitle": "Title of the primary breakdown table (e.g. Vendor Liability & Reconciliation Matrix)",
    "headers": ["Vendor / Customer", "PO Number", "Committed Value", "Invoiced", "Delivered Value", "Status", "Audit Flag"],
    "rows": [
      ["Vendor Name", "PO-12345", "$10,000", "$6,000", "$6,000", "Partially Invoiced", "On Track"]
    ]
  },
  "strategicRecommendations": [
    "Prioritized, actionable bullet recommendation 1",
    "Prioritized, actionable bullet recommendation 2",
    "Prioritized, actionable bullet recommendation 3",
    "Prioritized, actionable bullet recommendation 4"
  ],
  "fullMarkdown": "Full formatted markdown document of the complete report with headers, bullet points, and tables, formatted for instant copying or executive printing."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const responseText = response.text || '{}';
      try {
        const parsed = JSON.parse(responseText.trim());
        return res.json(parsed);
      } catch (parseErr) {
        console.warn('Failed to parse Gemini Report JSON:', responseText);
      }
    }

    // Built-in intelligent report generator fallback
    const fulfillmentPct = totalPoVal > 0 ? ((totalDeliveredVal / totalPoVal) * 100).toFixed(1) : '0';
    const invoicingPct = totalPoVal > 0 ? ((totalInvoicedVal / totalPoVal) * 100).toFixed(1) : '0';

    const fallbackReport = {
      title: reportType === 'EXECUTIVE_AUDIT' 
        ? 'Executive 3-Way Reconciliation & PO Audit Report' 
        : reportType === 'AP_FINANCIAL_AGING'
        ? 'Accounts Payable & Cashflow Liability Aging Analysis'
        : reportType === 'LOGISTICS_FULFILLMENT'
        ? 'Vendor Delivery Performance & Logistics Fulfillment Report'
        : 'Enterprise Purchase Order Comprehensive Health Review',
      subtitle: `Automated Intelligence Review covering ${totalPOs} Purchase Orders & ${invoicesData.length} Invoices`,
      generatedAt: new Date().toISOString(),
      reportType,
      executiveSummary: `This executive audit encompasses ${totalPOs} purchase orders totaling $${totalPoVal.toLocaleString()} in committed value. Currently, $${totalInvoicedVal.toLocaleString()} (${invoicingPct}%) has been billed across ${invoicesData.length} generated invoices, while delivery fulfillment stands at $${totalDeliveredVal.toLocaleString()} (${fulfillmentPct}%). 
      
Total cash remittances settled to date equal $${totalPayments.toLocaleString()}, leaving an active accounts payable balance of $${outstandingPayments.toLocaleString()} awaiting settlement. There are ${unmatchedCount} line items currently requiring 3-way matching resolution between Purchase Order commitments, Delivery Note receipts, and Invoiced quantities.`,
      keyMetrics: [
        { label: 'Total Committed POs', value: `$${totalPoVal.toLocaleString()}`, changeOrStatus: `${totalPOs} active orders`, sentiment: 'neutral' },
        { label: 'Invoiced Progress', value: `${invoicingPct}%`, changeOrStatus: `$${totalInvoicedVal.toLocaleString()}`, sentiment: 'positive' },
        { label: 'Delivered Value', value: `${fulfillmentPct}%`, changeOrStatus: `$${totalDeliveredVal.toLocaleString()}`, sentiment: 'positive' },
        { label: 'Outstanding Payables', value: `$${outstandingPayments.toLocaleString()}`, changeOrStatus: 'Unpaid balance', sentiment: 'warning' },
        { label: 'Audit Exceptions', value: `${unmatchedCount}`, changeOrStatus: `${undeliveredCount} undelivered lines`, sentiment: unmatchedCount > 0 ? 'danger' : 'positive' },
      ],
      findingsAndRisks: [
        {
          category: '3-Way Reconciliation Integrity',
          title: unmatchedCount > 0 ? `${unmatchedCount} Unmatched Line Items Detected` : 'All Active Lines Reconciled',
          description: unmatchedCount > 0
            ? `There are ${unmatchedCount} PO line items where invoiced quantities do not match confirmed delivered quantities. Review is recommended before finalizing remaining payments.`
            : 'All recorded invoices match confirmed goods receipts without variance.',
          severity: unmatchedCount > 0 ? 'HIGH' : 'LOW',
          affectedPOs: riskItems.map((r: any) => r.poNumber).filter((v: any, i: any, a: any) => a.indexOf(v) === i),
        },
        {
          category: 'Accounts Payable Cashflow',
          title: `Active Outstanding Liability of $${outstandingPayments.toLocaleString()}`,
          description: `Out of $${totalInvoicedVal.toLocaleString()} invoiced, $${outstandingPayments.toLocaleString()} remains pending across unpaid/partial invoices. Ensure payment allocation matches approved delivery notes.`,
          severity: outstandingPayments > 0 ? 'MEDIUM' : 'LOW',
          affectedPOs: [],
        },
        {
          category: 'Vendor Delivery Performance',
          title: `${fulfillmentPct}% Overall Goods Receipt Fulfillment`,
          description: `Warehouse receipts indicate $${totalDeliveredVal.toLocaleString()} of goods received. $${(totalPoVal - totalDeliveredVal).toLocaleString()} in pending orders remains to be delivered.`,
          severity: 'INFO',
          affectedPOs: [],
        },
      ],
      tabularBreakdown: {
        sectionTitle: 'Purchase Order Tracking & 3-Way Match Matrix',
        headers: ['PO Number', 'Vendor / Customer', 'Committed Value', 'Invoiced Value', 'Delivered Value', 'Status', 'Risk Level'],
        rows: poData.slice(0, 12).map((po: any) => [
          po.poNumber,
          po.customerName,
          `$${(po.totalValueAfterVat || 0).toLocaleString()}`,
          `$${(po.invoicedValueAfterVat || 0).toLocaleString()}`,
          `$${(po.deliveredValueAfterVat || 0).toLocaleString()}`,
          po.status?.replace('_', ' ') || 'Pending',
          po.invoicedQuantity > (po.deliveredQuantity || 0) ? 'High (Over-invoiced)' : (po.deliveredQuantity || 0) > po.invoicedQuantity ? 'Medium (Pending Billing)' : 'Balanced',
        ]),
      },
      strategicRecommendations: [
        'Perform targeted 3-way matching sign-off on high-variance PO lines before releasing next disbursement batch.',
        'Issue formal delivery reminders to vendors with outstanding delivery note fulfillment below 80%.',
        'Leverage automated Google Sheets database sync to maintain synchronized cross-department records.',
        'Apply partial payment allocation directly against verified invoice line items to maintain clean audit trails.',
      ],
      fullMarkdown: `# ${reportType === 'EXECUTIVE_AUDIT' ? 'Executive 3-Way Reconciliation & PO Audit Report' : 'Enterprise PO Financial & Operational Report'}
**Generated:** ${new Date().toLocaleString()} | **Scope:** ${totalPOs} Purchase Orders

## 1. Executive Summary
This report analyzes **${totalPOs} Purchase Orders** totaling **$${totalPoVal.toLocaleString()}**. 
- Invoicing completion stands at **${invoicingPct}%** ($${totalInvoicedVal.toLocaleString()}).
- Delivery fulfillment stands at **${fulfillmentPct}%** ($${totalDeliveredVal.toLocaleString()}).
- Settled payments total **$${totalPayments.toLocaleString()}**, leaving **$${outstandingPayments.toLocaleString()}** outstanding.
- **${unmatchedCount} reconciliation exceptions** require departmental review.

## 2. Key Metrics
- **Total PO Value:** $${totalPoVal.toLocaleString()}
- **Total Invoiced:** $${totalInvoicedVal.toLocaleString()}
- **Delivered Goods:** $${totalDeliveredVal.toLocaleString()}
- **Outstanding Payables:** $${outstandingPayments.toLocaleString()}
- **Unmatched Lines:** ${unmatchedCount}

## 3. Strategic Action Items
1. Reconcile ${unmatchedCount} flagged items against physical delivery notes.
2. Settle verified supplier invoices according to priority terms.
3. Keep records synchronized to Google Sheets cloud database.
`,
    };

    return res.json(fallbackReport);
  } catch (err: any) {
    console.error('Error in /api/ai/generate-report:', err);
    res.status(500).json({
      error: 'Failed to generate AI report',
      details: err?.message,
    });
  }
});

// Vite middleware for development & Static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
