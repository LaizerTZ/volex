import { 
  POLineItem, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord, 
  AppUser, 
  GoogleSheetsConfig, 
  SeriesSettings 
} from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id?: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

const SHEETS_CONFIG_STORAGE_KEY = 'po_tracker_google_sheets_config_v1';
export const SPREADSHEET_TITLE = 'FAMOLA_Excel_Ninja_Master_Database';

export const DEFAULT_SHEETS_CONFIG: GoogleSheetsConfig = {
  spreadsheetId: null,
  spreadsheetUrl: null,
  spreadsheetName: SPREADSHEET_TITLE,
  accessToken: null,
  tokenExpiry: null,
  userEmail: null,
  isConnected: false,
  autoSync: false,
  lastSyncTime: null,
  syncStatus: 'idle',
};

// Storage helper for Google Sheets configuration
export const loadSheetsConfig = (): GoogleSheetsConfig => {
  try {
    const raw = localStorage.getItem(SHEETS_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Verify token expiration if present
      if (parsed.tokenExpiry && Date.now() > parsed.tokenExpiry) {
        parsed.accessToken = null;
        parsed.isConnected = false;
      }
      return { ...DEFAULT_SHEETS_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load Google Sheets config', e);
  }
  return DEFAULT_SHEETS_CONFIG;
};

export const saveSheetsConfig = (config: GoogleSheetsConfig) => {
  try {
    localStorage.setItem(SHEETS_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Google Sheets config', e);
  }
};

/**
 * Initializes Google OAuth Client and triggers token request popup
 */
export const requestGoogleSheetsAuth = (
  clientId?: string,
  onSuccess?: (token: string) => void,
  onError?: (err: string) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const effectiveClientId =
      clientId ||
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      '152050954330-client.apps.googleusercontent.com'; // fallback

    if (!window.google?.accounts?.oauth2) {
      const err = 'Google Identity Services script is not loaded. Please ensure you are online.';
      if (onError) onError(err);
      reject(new Error(err));
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: effectiveClientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        callback: (response) => {
          if (response.error) {
            const err = `OAuth authorization error: ${response.error}`;
            if (onError) onError(err);
            reject(new Error(err));
            return;
          }
          if (response.access_token) {
            const config = loadSheetsConfig();
            config.accessToken = response.access_token;
            config.tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
            config.isConnected = true;
            saveSheetsConfig(config);
            if (onSuccess) onSuccess(response.access_token);
            resolve(response.access_token);
          }
        },
        error_callback: (err) => {
          const errStr = err?.message || 'Google OAuth request failed';
          if (onError) onError(errStr);
          reject(new Error(errStr));
        },
      });

      tokenClient.requestAccessToken();
    } catch (e: any) {
      const msg = e?.message || 'Failed to initialize Google OAuth token client';
      if (onError) onError(msg);
      reject(new Error(msg));
    }
  });
};

/**
 * Helper to call Google Sheets REST API
 */
async function callSheetsApi(endpoint: string, method: string = 'GET', body?: any, token?: string) {
  const currentConfig = loadSheetsConfig();
  const effectiveToken = token || currentConfig.accessToken;
  if (!effectiveToken) {
    throw new Error('Google OAuth access token is missing. Please connect to Google Sheets.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${effectiveToken}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const errMsg = errJson?.error?.message || `Google Sheets API call failed (${response.status}: ${response.statusText})`;
    throw new Error(errMsg);
  }

  return response.json();
}

/**
 * Creates or ensures the master FAMOLA Google Spreadsheet with 8 dedicated worksheets
 */
export const createMasterSpreadsheet = async (
  token?: string,
  title: string = SPREADSHEET_TITLE
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const sheetNames = [
    'PO_Lines',
    'Invoices',
    'Invoice_Items',
    'Delivery_Notes',
    'Delivery_Items',
    'Payments',
    'Payment_Allocations',
    'Users_Access',
    'System_Config',
  ];

  const requestBody = {
    properties: {
      title,
    },
    sheets: sheetNames.map((name) => ({
      properties: {
        title: name,
        gridProperties: {
          rowCount: 500,
          columnCount: 20,
          frozenRowCount: 1,
        },
      },
    })),
  };

  const res = await callSheetsApi('', 'POST', requestBody, token);
  const spreadsheetId = res.spreadsheetId;
  const spreadsheetUrl = res.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const config = loadSheetsConfig();
  config.spreadsheetId = spreadsheetId;
  config.spreadsheetUrl = spreadsheetUrl;
  config.spreadsheetName = title;
  config.isConnected = true;
  saveSheetsConfig(config);

  return { spreadsheetId, spreadsheetUrl };
};

/**
 * Pushes the complete application state (PO Lines, Invoices, Delivery Notes, Payments, Users, Config) to Google Sheets
 */
export const syncAllDataToGoogleSheets = async (
  data: {
    poLines: POLineItem[];
    invoices: InvoiceRecord[];
    deliveryNotes: DeliveryNoteRecord[];
    payments: PaymentRecord[];
    users: AppUser[];
    seriesConfig: SeriesSettings;
  },
  token?: string
): Promise<{ success: boolean; spreadsheetUrl: string; timestamp: string }> => {
  const config = loadSheetsConfig();
  let spreadsheetId = config.spreadsheetId;

  // If no spreadsheet exists yet, create one
  if (!spreadsheetId) {
    const created = await createMasterSpreadsheet(token);
    spreadsheetId = created.spreadsheetId;
  }

  // 1. Prepare PO_Lines data
  const poHeaders = [
    'Line ID',
    'PO Number',
    'Customer / Vendor',
    'Destination',
    'Contract Ref',
    'PO Date',
    'Item Description',
    'Unit of Measure',
    'PO Quantity',
    'Unit Price',
    'Value Before VAT',
    'VAT Rate',
    'VAT Amount',
    'Value After VAT',
    'Invoiced Qty',
    'Delivered Qty',
    'Tracking Status',
  ];
  const poRows = data.poLines.map((p) => [
    p.id,
    p.poNumber,
    p.customerName,
    p.destination,
    p.contract,
    p.date,
    p.itemDescription,
    p.unitOfMeasure,
    p.quantity,
    p.unitPrice,
    p.valueBeforeVat,
    p.vatRate,
    p.vatAmount,
    p.valueAfterVat,
    p.invoicedQuantity || 0,
    p.deliveredQuantity || 0,
    p.status || 'UNINVOICED',
  ]);

  // 2. Prepare Invoices data
  const invHeaders = [
    'Invoice ID',
    'Invoice Number',
    'Invoice Date',
    'PO Reference',
    'Customer / Vendor',
    'Destination',
    'Subtotal Before VAT',
    'Total VAT',
    'Total Amount After VAT',
    'Amount Paid',
    'Payment Status',
    'Notes',
    'Recorded Timestamp',
  ];
  const invRows = (data.invoices || []).map((inv) => [
    inv.id,
    inv.invoiceNumber,
    inv.invoiceDate,
    inv.poNumber,
    inv.customerName,
    inv.destination,
    inv.subtotalBeforeVat,
    inv.totalVat,
    inv.totalAfterVat,
    inv.paidAmount || 0,
    inv.paymentStatus || 'UNPAID',
    inv.notes || '',
    inv.createdAt,
  ]);

  // 3. Prepare Invoice_Items data
  const invItemHeaders = [
    'Invoice Number',
    'PO Line ID',
    'Item Description',
    'Unit of Measure',
    'PO Qty',
    'Invoiced Qty',
    'Unit Price',
    'Value Before VAT',
    'VAT Amount',
    'Value After VAT',
  ];
  const invItemRows: any[] = [];
  (data.invoices || []).forEach((inv) => {
    if (!inv) return;
    (inv.lines || []).forEach((line) => {
      if (!line) return;
      invItemRows.push([
        inv.invoiceNumber,
        line.poLineId,
        line.itemDescription,
        line.unitOfMeasure,
        line.poQuantity,
        line.invoicedQuantity,
        line.unitPrice,
        line.valueBeforeVat,
        line.vatAmount,
        line.valueAfterVat,
      ]);
    });
  });

  // 4. Prepare Delivery_Notes data
  const dnHeaders = [
    'DN ID',
    'Delivery Note Number',
    'Delivery Date',
    'PO Reference',
    'Customer / Vendor',
    'Destination',
    'Carrier Name',
    'Vehicle Number',
    'Driver Name',
    'Received By',
    'Total Delivered Qty',
    'Total Value After VAT',
    'Notes',
    'Created Timestamp',
  ];
  const dnRows = (data.deliveryNotes || []).map((dn) => [
    dn.id,
    dn.deliveryNoteNumber,
    dn.deliveryDate,
    dn.poNumber,
    dn.customerName,
    dn.destination,
    dn.carrier || '',
    dn.vehicleNumber || '',
    dn.driverName || '',
    dn.receivedBy || '',
    dn.totalDeliveredQuantity,
    dn.totalDeliveredValue,
    dn.notes || '',
    dn.createdAt,
  ]);

  // 5. Prepare Delivery_Items data
  const dnItemHeaders = [
    'Delivery Note #',
    'PO Line ID',
    'Item Description',
    'Unit of Measure',
    'Delivered Quantity',
    'Unit Price',
    'Value After VAT',
  ];
  const dnItemRows: any[] = [];
  (data.deliveryNotes || []).forEach((dn) => {
    if (!dn) return;
    (dn.lines || []).forEach((line) => {
      if (!line) return;
      dnItemRows.push([
        dn.deliveryNoteNumber,
        line.poLineId,
        line.itemDescription,
        line.unitOfMeasure,
        line.deliveredQuantity,
        line.unitPrice,
        line.valueAfterVat,
      ]);
    });
  });

  // 6. Prepare Payments data
  const payHeaders = [
    'Payment ID',
    'Payment Number',
    'Payment Date',
    'Customer / Vendor',
    'PO Reference',
    'Amount Paid',
    'Payment Method',
    'Reference / Check #',
    'Deposit Account',
    'Notes',
    'Recorded Timestamp',
  ];
  const payRows = (data.payments || []).map((p) => [
    p.id,
    p.paymentNumber,
    p.paymentDate,
    p.customerName,
    p.poNumber,
    p.amountPaid,
    p.paymentMethod,
    p.referenceNumber,
    p.depositAccount || '',
    p.notes || '',
    p.createdAt,
  ]);

  // 7. Prepare Payment_Allocations data
  const allocHeaders = [
    'Payment Number',
    'Invoice Number',
    'PO Number',
    'Customer',
    'Invoice Total',
    'Already Paid',
    'Remaining Balance',
    'Allocated Amount',
  ];
  const allocRows: any[] = [];
  (data.payments || []).forEach((p) => {
    if (!p) return;
    (p.allocations || []).forEach((al) => {
      if (!al) return;
      allocRows.push([
        p.paymentNumber,
        al.invoiceNumber,
        al.poNumber,
        al.customerName,
        al.invoiceTotal,
        al.alreadyPaid,
        al.pendingBalance,
        al.allocatedAmount,
      ]);
    });
  });

  // 8. Prepare Users_Access data
  const userHeaders = ['User ID', 'Name', 'Email', 'Role', 'Department', 'Status', 'Created Date'];
  const userRows = (data.users || []).map((u) => [
    u.id,
    u.name,
    u.email,
    u.role,
    u.department,
    u.status,
    u.createdAt,
  ]);

  // 9. Prepare System_Config data
  const configHeaders = ['Parameter', 'Value', 'Last Updated'];
  const configRows = [
    ['App Name', 'FAMOLA Excel Ninja', new Date().toISOString()],
    ['Invoice Series Current', String(data.seriesConfig.invoiceSeries.currentNumber), new Date().toISOString()],
    ['Invoice Series Range', `${data.seriesConfig.invoiceSeries.startNumber}-${data.seriesConfig.invoiceSeries.endNumber}`, new Date().toISOString()],
    ['Delivery Series Current', String(data.seriesConfig.deliverySeries.currentNumber), new Date().toISOString()],
    ['Delivery Series Range', `${data.seriesConfig.deliverySeries.startNumber}-${data.seriesConfig.deliverySeries.endNumber}`, new Date().toISOString()],
    ['Total PO Lines Count', String(data.poLines.length), new Date().toISOString()],
    ['Total Invoices Count', String(data.invoices.length), new Date().toISOString()],
    ['Total Delivery Notes Count', String(data.deliveryNotes.length), new Date().toISOString()],
    ['Total Payments Count', String(data.payments.length), new Date().toISOString()],
  ];

  // Batch update all sheets
  const updateData = [
    { range: 'PO_Lines!A1:Q500', values: [poHeaders, ...poRows] },
    { range: 'Invoices!A1:M500', values: [invHeaders, ...invRows] },
    { range: 'Invoice_Items!A1:J500', values: [invItemHeaders, ...invItemRows] },
    { range: 'Delivery_Notes!A1:N500', values: [dnHeaders, ...dnRows] },
    { range: 'Delivery_Items!A1:G500', values: [dnItemHeaders, ...dnItemRows] },
    { range: 'Payments!A1:K500', values: [payHeaders, ...payRows] },
    { range: 'Payment_Allocations!A1:H500', values: [allocHeaders, ...allocRows] },
    { range: 'Users_Access!A1:G500', values: [userHeaders, ...userRows] },
    { range: 'System_Config!A1:C50', values: [configHeaders, ...configRows] },
  ];

  // Call batchUpdate values endpoint
  await callSheetsApi(
    `/${spreadsheetId}/values:batchUpdate`,
    'POST',
    {
      valueInputOption: 'USER_ENTERED',
      data: updateData,
    },
    token
  );

  const timestamp = new Date().toLocaleString();
  const updatedConfig = loadSheetsConfig();
  updatedConfig.lastSyncTime = timestamp;
  updatedConfig.syncStatus = 'success';
  saveSheetsConfig(updatedConfig);

  const finalUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  return { success: true, spreadsheetUrl: finalUrl, timestamp };
};

/**
 * Pulls and reconstructs data from Google Sheets back into local memory
 */
export const fetchAllDataFromGoogleSheets = async (
  spreadsheetIdInput?: string,
  token?: string
): Promise<{
  poLines: POLineItem[];
  invoices: InvoiceRecord[];
  deliveryNotes: DeliveryNoteRecord[];
  payments: PaymentRecord[];
  users: AppUser[];
}> => {
  const config = loadSheetsConfig();
  const spreadsheetId = spreadsheetIdInput || config.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('No Google Spreadsheet connected.');
  }

  const ranges = [
    'PO_Lines!A2:Q500',
    'Invoices!A2:M500',
    'Invoice_Items!A2:J500',
    'Delivery_Notes!A2:N500',
    'Delivery_Items!A2:G500',
    'Payments!A2:K500',
    'Payment_Allocations!A2:H500',
    'Users_Access!A2:G500',
  ];

  const queryParams = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const res = await callSheetsApi(`/${spreadsheetId}/values:batchGet?${queryParams}`, 'GET', undefined, token);

  const valueRanges = res.valueRanges || [];
  const poRaw = valueRanges[0]?.values || [];
  const invRaw = valueRanges[1]?.values || [];
  const invItemsRaw = valueRanges[2]?.values || [];
  const dnRaw = valueRanges[3]?.values || [];
  const dnItemsRaw = valueRanges[4]?.values || [];
  const payRaw = valueRanges[5]?.values || [];
  const allocRaw = valueRanges[6]?.values || [];
  const userRaw = valueRanges[7]?.values || [];

  // Parse PO Lines
  const poLines: POLineItem[] = poRaw.map((r: any[], idx: number) => ({
    id: r[0] || `po-line-${idx + 1}`,
    poNumber: r[1] || `PO-${idx + 1}`,
    customerName: r[2] || 'Enterprise Client',
    destination: r[3] || 'Central Warehouse',
    contract: r[4] || 'STD-CONTRACT',
    date: r[5] || new Date().toISOString().slice(0, 10),
    itemDescription: r[6] || `Item #${idx + 1}`,
    unitOfMeasure: r[7] || 'PCS',
    quantity: parseFloat(r[8]) || 0,
    unitCost: (parseFloat(r[9]) || 0) * 0.75,
    unitPrice: parseFloat(r[9]) || 0,
    valueBeforeVat: parseFloat(r[10]) || 0,
    vatRate: parseFloat(r[11]) || 0.18,
    vatAmount: parseFloat(r[12]) || 0,
    valueAfterVat: parseFloat(r[13]) || 0,
    invoicedQuantity: parseFloat(r[14]) || 0,
    deliveredQuantity: parseFloat(r[15]) || 0,
    status: r[16] || 'UNINVOICED',
  }));

  // Parse Invoice Line Items grouped by Invoice Number
  const itemsByInvoice = new Map<string, any[]>();
  invItemsRaw.forEach((r: any[]) => {
    const invNum = r[0];
    if (!invNum) return;
    if (!itemsByInvoice.has(invNum)) itemsByInvoice.set(invNum, []);
    itemsByInvoice.get(invNum)!.push({
      poLineId: r[1] || '',
      itemDescription: r[2] || '',
      unitOfMeasure: r[3] || 'PCS',
      poQuantity: parseFloat(r[4]) || 0,
      alreadyInvoicedQuantity: 0,
      availableQuantity: 0,
      invoicedQuantity: parseFloat(r[5]) || 0,
      unitCost: (parseFloat(r[6]) || 0) * 0.75,
      unitPrice: parseFloat(r[6]) || 0,
      valueBeforeVat: parseFloat(r[7]) || 0,
      vatRate: 0.18,
      vatAmount: parseFloat(r[8]) || 0,
      valueAfterVat: parseFloat(r[9]) || 0,
      isSelected: true,
    });
  });

  // Parse Invoices
  const invoices: InvoiceRecord[] = invRaw.map((r: any[], idx: number) => {
    const invNum = r[1] || `INV-${String(idx + 1).padStart(3, '0')}`;
    return {
      id: r[0] || `inv-${Date.now()}-${idx}`,
      invoiceNumber: invNum,
      invoiceDate: r[2] || new Date().toISOString().slice(0, 10),
      poNumber: r[3] || '',
      customerName: r[4] || '',
      destination: r[5] || '',
      contract: 'STD-CONTRACT',
      poDate: r[2] || '',
      subtotalBeforeVat: parseFloat(r[6]) || 0,
      totalVat: parseFloat(r[7]) || 0,
      totalAfterVat: parseFloat(r[8]) || 0,
      paidAmount: parseFloat(r[9]) || 0,
      paymentStatus: (r[10] || 'UNPAID') as any,
      notes: r[11] || '',
      createdAt: r[12] || new Date().toISOString(),
      lines: itemsByInvoice.get(invNum) || [],
    };
  });

  // Parse Delivery Note Items grouped by DN Number
  const itemsByDN = new Map<string, any[]>();
  dnItemsRaw.forEach((r: any[]) => {
    const dnNum = r[0];
    if (!dnNum) return;
    if (!itemsByDN.has(dnNum)) itemsByDN.set(dnNum, []);
    itemsByDN.get(dnNum)!.push({
      poLineId: r[1] || '',
      itemDescription: r[2] || '',
      unitOfMeasure: r[3] || 'PCS',
      poQuantity: parseFloat(r[4]) || 0,
      alreadyDeliveredQuantity: 0,
      availableQuantity: 0,
      deliveredQuantity: parseFloat(r[4]) || 0,
      unitPrice: parseFloat(r[5]) || 0,
      valueBeforeVat: (parseFloat(r[6]) || 0) / 1.18,
      vatRate: 0.18,
      vatAmount: (parseFloat(r[6]) || 0) - (parseFloat(r[6]) || 0) / 1.18,
      valueAfterVat: parseFloat(r[6]) || 0,
    });
  });

  // Parse Delivery Notes
  const deliveryNotes: DeliveryNoteRecord[] = dnRaw.map((r: any[], idx: number) => {
    const dnNum = r[1] || `DN-${String(idx + 1).padStart(3, '0')}`;
    return {
      id: r[0] || `dn-${Date.now()}-${idx}`,
      deliveryNoteNumber: dnNum,
      deliveryDate: r[2] || new Date().toISOString().slice(0, 10),
      poNumber: r[3] || '',
      customerName: r[4] || '',
      destination: r[5] || '',
      contract: 'STD-CONTRACT',
      carrier: r[6] || '',
      vehicleNumber: r[7] || '',
      driverName: r[8] || '',
      receivedBy: r[9] || '',
      totalDeliveredQuantity: parseFloat(r[10]) || 0,
      totalDeliveredValue: parseFloat(r[11]) || 0,
      notes: r[12] || '',
      createdAt: r[13] || new Date().toISOString(),
      lines: itemsByDN.get(dnNum) || [],
    };
  });

  // Parse Allocations grouped by Payment Number
  const allocByPayment = new Map<string, any[]>();
  allocRaw.forEach((r: any[]) => {
    const pNum = r[0];
    if (!pNum) return;
    if (!allocByPayment.has(pNum)) allocByPayment.set(pNum, []);
    allocByPayment.get(pNum)!.push({
      invoiceId: `inv-${r[1]}`,
      invoiceNumber: r[1] || '',
      poNumber: r[2] || '',
      customerName: r[3] || '',
      invoiceTotal: parseFloat(r[4]) || 0,
      alreadyPaid: parseFloat(r[5]) || 0,
      pendingBalance: parseFloat(r[6]) || 0,
      allocatedAmount: parseFloat(r[7]) || 0,
    });
  });

  // Parse Payments
  const payments: PaymentRecord[] = payRaw.map((r: any[], idx: number) => {
    const pNum = r[1] || `REC-${String(idx + 1).padStart(3, '0')}`;
    return {
      id: r[0] || `pay-${Date.now()}-${idx}`,
      paymentNumber: pNum,
      paymentDate: r[2] || new Date().toISOString().slice(0, 10),
      customerName: r[3] || '',
      poNumber: r[4] || '',
      amountPaid: parseFloat(r[5]) || 0,
      paymentMethod: (r[6] || 'Bank Transfer') as any,
      referenceNumber: r[7] || '',
      depositAccount: r[8] || '',
      notes: r[9] || '',
      createdAt: r[10] || new Date().toISOString(),
      invoiceNumber: r[4] || '',
      allocations: allocByPayment.get(pNum) || [],
    };
  });

  // Parse Users
  const users: AppUser[] = userRaw.map((r: any[], idx: number) => ({
    id: r[0] || `usr-${idx + 1}`,
    name: r[1] || 'Authorized User',
    email: r[2] || 'user@enterprisegroup.com',
    role: (r[3] || 'Finance Officer') as any,
    department: r[4] || 'Finance & Accounts',
    status: (r[5] || 'Active') as any,
    createdAt: r[6] || '2026-01-01',
  }));

  return { poLines, invoices, deliveryNotes, payments, users };
};
