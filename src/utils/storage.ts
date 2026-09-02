import { 
  POLineItem, 
  PurchaseOrderGroup, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord, 
  MatchingItem, 
  DashboardMetrics,
  SeriesSettings,
  AppUser
} from '../types';
import { 
  INITIAL_PO_DATA, 
  INITIAL_INVOICES, 
  INITIAL_DELIVERY_NOTES, 
  INITIAL_PAYMENTS 
} from './sampleData';

const PO_STORAGE_KEY = 'po_tracker_master_po_v1';
const INVOICE_STORAGE_KEY = 'po_tracker_invoices_v1';
const DN_STORAGE_KEY = 'po_tracker_delivery_notes_v1';
const PAYMENT_STORAGE_KEY = 'po_tracker_payments_v1';
const SERIES_STORAGE_KEY = 'po_tracker_series_config_v1';
const USERS_STORAGE_KEY = 'po_tracker_users_v1';

export const DEFAULT_SERIES_CONFIG: SeriesSettings = {
  invoiceSeries: {
    prefix: 'INV-',
    startNumber: 1,
    endNumber: 600,
    currentNumber: 1,
    padding: 3,
    autoIncrement: true,
  },
  deliverySeries: {
    prefix: 'DN-',
    startNumber: 1,
    endNumber: 600,
    currentNumber: 1,
    padding: 3,
    autoIncrement: true,
  },
};

export const DEFAULT_USERS: AppUser[] = [
  {
    id: 'usr-1',
    name: 'Famola Admin',
    email: 'admin@enterprisegroup.com',
    role: 'Admin',
    department: 'Executive Management',
    status: 'Active',
    createdAt: '2026-01-15',
  },
  {
    id: 'usr-2',
    name: 'Sarah Mwangi',
    email: 'sarah.m@enterprisegroup.com',
    role: 'Finance Officer',
    department: 'Finance & Accounting',
    status: 'Active',
    createdAt: '2026-02-01',
  },
  {
    id: 'usr-3',
    name: 'James Kiprono',
    email: 'james.k@enterprisegroup.com',
    role: 'Logistics Manager',
    department: 'Supply Chain & Logistics',
    status: 'Active',
    createdAt: '2026-02-10',
  },
  {
    id: 'usr-4',
    name: 'David Ruvuma',
    email: 'david.r@enterprisegroup.com',
    role: 'Billing Clerk',
    department: 'Invoicing & Operations',
    status: 'Active',
    createdAt: '2026-02-18',
  },
];

export const loadStoredSeriesConfig = (): SeriesSettings => {
  try {
    const raw = localStorage.getItem(SERIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.invoiceSeries && parsed.deliverySeries) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load Series Config', e);
  }
  saveStoredSeriesConfig(DEFAULT_SERIES_CONFIG);
  return DEFAULT_SERIES_CONFIG;
};

export const saveStoredSeriesConfig = (config: SeriesSettings) => {
  try {
    localStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Series Config', e);
  }
};

export const formatSeriesNumber = (prefix: string, currentNumber: number, padding: number): string => {
  const padded = padding > 0 ? String(currentNumber).padStart(padding, '0') : String(currentNumber);
  return `${prefix || ''}${padded}`;
};

export const advanceSeriesNumber = (type: 'invoice' | 'delivery'): string => {
  const config = loadStoredSeriesConfig();
  const series = type === 'invoice' ? config.invoiceSeries : config.deliverySeries;
  
  const formatted = formatSeriesNumber(series.prefix, series.currentNumber, series.padding);
  
  if (series.currentNumber < series.endNumber) {
    series.currentNumber += 1;
  } else {
    // Wrap around or stop at end
    series.currentNumber = series.startNumber;
  }

  saveStoredSeriesConfig(config);
  return formatted;
};

export const loadStoredUsers = (): AppUser[] => {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load Users', e);
  }
  saveStoredUsers(DEFAULT_USERS);
  return DEFAULT_USERS;
};

export const saveStoredUsers = (users: AppUser[]) => {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save Users', e);
  }
};

export const loadStoredPOs = (): POLineItem[] => {
  try {
    const raw = localStorage.getItem(PO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load POs from storage', e);
  }
  // Initialize with sample data if empty
  savePOs(INITIAL_PO_DATA);
  return INITIAL_PO_DATA;
};

export const savePOs = (pos: POLineItem[]) => {
  try {
    localStorage.setItem(PO_STORAGE_KEY, JSON.stringify(pos));
  } catch (e) {
    console.error('Failed to save POs to storage', e);
  }
};

export const loadStoredInvoices = (): InvoiceRecord[] => {
  try {
    const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load Invoices from storage', e);
  }
  saveInvoices(INITIAL_INVOICES);
  return INITIAL_INVOICES;
};

export const saveInvoices = (invoices: InvoiceRecord[]) => {
  try {
    localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));
  } catch (e) {
    console.error('Failed to save Invoices to storage', e);
  }
};

export const loadStoredDeliveryNotes = (): DeliveryNoteRecord[] => {
  try {
    const raw = localStorage.getItem(DN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load Delivery Notes from storage', e);
  }
  saveDeliveryNotes(INITIAL_DELIVERY_NOTES);
  return INITIAL_DELIVERY_NOTES;
};

export const saveDeliveryNotes = (dns: DeliveryNoteRecord[]) => {
  try {
    localStorage.setItem(DN_STORAGE_KEY, JSON.stringify(dns));
  } catch (e) {
    console.error('Failed to save Delivery Notes to storage', e);
  }
};

export const loadStoredPayments = (): PaymentRecord[] => {
  try {
    const raw = localStorage.getItem(PAYMENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load Payments from storage', e);
  }
  savePayments(INITIAL_PAYMENTS);
  return INITIAL_PAYMENTS;
};

export const savePayments = (payments: PaymentRecord[]) => {
  try {
    localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(payments));
  } catch (e) {
    console.error('Failed to save Payments to storage', e);
  }
};

export const resetToSampleData = () => {
  savePOs(INITIAL_PO_DATA);
  saveInvoices(INITIAL_INVOICES);
  saveDeliveryNotes(INITIAL_DELIVERY_NOTES);
  savePayments(INITIAL_PAYMENTS);
  return { 
    pos: INITIAL_PO_DATA, 
    invoices: INITIAL_INVOICES,
    deliveryNotes: INITIAL_DELIVERY_NOTES,
    payments: INITIAL_PAYMENTS,
  };
};

export const clearAllData = () => {
  savePOs([]);
  saveInvoices([]);
  saveDeliveryNotes([]);
  savePayments([]);
  return { pos: [], invoices: [], deliveryNotes: [], payments: [] };
};

// Reconcile and calculate line tracking against all recorded invoices and delivery notes
export const enrichPOLinesWithTracking = (
  rawLines: POLineItem[],
  invoices: InvoiceRecord[],
  deliveryNotes: DeliveryNoteRecord[] = []
): POLineItem[] => {
  // Map of total invoiced qty by poLineId or (poNumber + itemDescription)
  const invoicedQtyByLineId = new Map<string, number>();
  const invoicedQtyByDesc = new Map<string, number>();

  invoices.forEach((inv) => {
    inv.lines.forEach((line) => {
      const currentIdQty = invoicedQtyByLineId.get(line.poLineId) || 0;
      invoicedQtyByLineId.set(line.poLineId, currentIdQty + (line.invoicedQuantity || 0));

      const descKey = `${inv.poNumber}___${line.itemDescription}`;
      const currentDescQty = invoicedQtyByDesc.get(descKey) || 0;
      invoicedQtyByDesc.set(descKey, currentDescQty + (line.invoicedQuantity || 0));
    });
  });

  // Map of total delivered qty by poLineId or (poNumber + itemDescription)
  const deliveredQtyByLineId = new Map<string, number>();
  const deliveredQtyByDesc = new Map<string, number>();

  deliveryNotes.forEach((dn) => {
    dn.lines.forEach((line) => {
      const currentIdQty = deliveredQtyByLineId.get(line.poLineId) || 0;
      deliveredQtyByLineId.set(line.poLineId, currentIdQty + (line.deliveredQuantity || 0));

      const descKey = `${dn.poNumber}___${line.itemDescription}`;
      const currentDescQty = deliveredQtyByDesc.get(descKey) || 0;
      deliveredQtyByDesc.set(descKey, currentDescQty + (line.deliveredQuantity || 0));
    });
  });

  return rawLines.map((line) => {
    let invoicedQuantity = invoicedQtyByLineId.get(line.id);
    if (invoicedQuantity === undefined) {
      const descKey = `${line.poNumber}___${line.itemDescription}`;
      invoicedQuantity = invoicedQtyByDesc.get(descKey) || 0;
    }

    let deliveredQuantity = deliveredQtyByLineId.get(line.id);
    if (deliveredQuantity === undefined) {
      const descKey = `${line.poNumber}___${line.itemDescription}`;
      deliveredQuantity = deliveredQtyByDesc.get(descKey) || 0;
    }

    const remainingQuantity = Math.max(0, line.quantity - invoicedQuantity);
    const undeliveredQuantity = Math.max(0, line.quantity - deliveredQuantity);

    let status: 'UNINVOICED' | 'PARTIALLY_INVOICED' | 'FULLY_INVOICED' = 'UNINVOICED';
    if (invoicedQuantity >= line.quantity && line.quantity > 0) {
      status = 'FULLY_INVOICED';
    } else if (invoicedQuantity > 0) {
      status = 'PARTIALLY_INVOICED';
    }

    return {
      ...line,
      invoicedQuantity,
      remainingQuantity,
      deliveredQuantity,
      undeliveredQuantity,
      status,
    };
  });
};

// Group PO lines into structured PO Groups
export const groupPOsByNumber = (
  lines: POLineItem[],
  invoices: InvoiceRecord[],
  deliveryNotes: DeliveryNoteRecord[] = []
): PurchaseOrderGroup[] => {
  const enrichedLines = enrichPOLinesWithTracking(lines, invoices, deliveryNotes);
  const groupsMap = new Map<string, PurchaseOrderGroup>();

  enrichedLines.forEach((line) => {
    const key = line.poNumber.trim();
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        poNumber: line.poNumber,
        customerName: line.customerName,
        destination: line.destination,
        contract: line.contract,
        date: line.date,
        totalLines: 0,
        totalQuantity: 0,
        totalValueBeforeVat: 0,
        totalVat: 0,
        totalValueAfterVat: 0,
        invoicedQuantity: 0,
        remainingQuantity: 0,
        invoicedValueAfterVat: 0,
        remainingValueAfterVat: 0,
        deliveredQuantity: 0,
        deliveredValueAfterVat: 0,
        status: 'PENDING',
        lines: [],
      });
    }

    const grp = groupsMap.get(key)!;
    grp.lines.push(line);
    grp.totalLines += 1;
    grp.totalQuantity += line.quantity;
    grp.totalValueBeforeVat += line.valueBeforeVat;
    grp.totalVat += line.vatAmount;
    grp.totalValueAfterVat += line.valueAfterVat;
    grp.invoicedQuantity += line.invoicedQuantity || 0;
    grp.remainingQuantity += line.remainingQuantity !== undefined ? line.remainingQuantity : line.quantity;
    grp.deliveredQuantity += line.deliveredQuantity || 0;

    // Calculate proportional invoiced value after VAT for this line
    const unitPriceWithVat = line.quantity > 0 ? line.valueAfterVat / line.quantity : 0;
    const lineInvoicedVal = (line.invoicedQuantity || 0) * unitPriceWithVat;
    grp.invoicedValueAfterVat += lineInvoicedVal;

    const lineDeliveredVal = (line.deliveredQuantity || 0) * unitPriceWithVat;
    grp.deliveredValueAfterVat += lineDeliveredVal;
  });

  // Finalize remaining values and status
  return Array.from(groupsMap.values()).map((grp) => {
    grp.totalValueBeforeVat = Math.round(grp.totalValueBeforeVat * 100) / 100;
    grp.totalVat = Math.round(grp.totalVat * 100) / 100;
    grp.totalValueAfterVat = Math.round(grp.totalValueAfterVat * 100) / 100;
    grp.invoicedValueAfterVat = Math.round(grp.invoicedValueAfterVat * 100) / 100;
    grp.deliveredValueAfterVat = Math.round(grp.deliveredValueAfterVat * 100) / 100;
    grp.remainingValueAfterVat = Math.max(0, Math.round((grp.totalValueAfterVat - grp.invoicedValueAfterVat) * 100) / 100);

    if (grp.totalQuantity > 0 && grp.invoicedQuantity >= grp.totalQuantity) {
      grp.status = 'FULLY_INVOICED';
    } else if (grp.invoicedQuantity > 0) {
      grp.status = 'PARTIALLY_INVOICED';
    } else {
      grp.status = 'PENDING';
    }

    return grp;
  });
};

// Comprehensive PO Items vs Delivery (Received) vs Invoiced matching generator
export const generateMatchingReport = (
  rawLines: POLineItem[],
  deliveryNotes: DeliveryNoteRecord[],
  invoices: InvoiceRecord[]
): MatchingItem[] => {
  const enriched = enrichPOLinesWithTracking(rawLines, invoices, deliveryNotes);

  return enriched.map((line) => {
    const poQty = line.quantity;
    const invQty = line.invoicedQuantity || 0;
    const delQty = line.deliveredQuantity || 0;

    const unitPriceWithVat = poQty > 0 ? line.valueAfterVat / poQty : line.unitPrice * (1 + line.vatRate);
    const poTotalVal = line.valueAfterVat;
    const invoicedVal = Math.round(invQty * unitPriceWithVat * 100) / 100;
    const deliveredVal = Math.round(delQty * unitPriceWithVat * 100) / 100;

    const unmatchedQty = Math.max(0, poQty - invQty);
    const undeliveredQty = Math.max(0, poQty - delQty);
    const receivedVsInvoicedVarianceQty = delQty - invQty;

    let status: 'FULLY_MATCHED' | 'PARTIALLY_MATCHED' | 'UNMATCHED_PENDING' = 'UNMATCHED_PENDING';
    if (invQty >= poQty && poQty > 0) {
      status = 'FULLY_MATCHED';
    } else if (invQty > 0) {
      status = 'PARTIALLY_MATCHED';
    }

    // Find linked DNs and Invoices
    const deliveryNoteNumbers = deliveryNotes
      .filter((dn) => dn.poNumber === line.poNumber && dn.lines.some((l) => l.poLineId === line.id || l.itemDescription === line.itemDescription))
      .map((dn) => dn.deliveryNoteNumber);

    const invoiceNumbers = invoices
      .filter((inv) => inv.poNumber === line.poNumber && inv.lines.some((l) => l.poLineId === line.id || l.itemDescription === line.itemDescription))
      .map((inv) => inv.invoiceNumber);

    return {
      poLineId: line.id,
      poNumber: line.poNumber,
      customerName: line.customerName,
      contract: line.contract,
      destination: line.destination,
      poDate: line.date,
      itemDescription: line.itemDescription,
      unitOfMeasure: line.unitOfMeasure,
      poQuantity: poQty,
      poUnitPrice: line.unitPrice,
      poTotalValue: poTotalVal,
      deliveredQuantity: delQty,
      deliveredValue: deliveredVal,
      invoicedQuantity: invQty,
      invoicedValue: invoicedVal,
      unmatchedQty,
      undeliveredQty,
      receivedVsInvoicedVarianceQty,
      status,
      deliveryNoteNumbers,
      invoiceNumbers,
    };
  });
};

export const calculateDashboardMetrics = (
  poGroups: PurchaseOrderGroup[],
  invoices: InvoiceRecord[],
  deliveryNotes: DeliveryNoteRecord[] = [],
  payments: PaymentRecord[] = []
): DashboardMetrics => {
  const totalPOs = poGroups.length;
  let totalPoValue = 0;
  let totalInvoicedValue = 0;
  let fullyInvoicedPOs = 0;
  let partiallyInvoicedPOs = 0;
  let pendingPOs = 0;
  let totalUndeliveredItemsCount = 0;
  let totalUnmatchedItemsCount = 0;

  poGroups.forEach((grp) => {
    totalPoValue += grp.totalValueAfterVat;
    totalInvoicedValue += grp.invoicedValueAfterVat;
    if (grp.status === 'FULLY_INVOICED') fullyInvoicedPOs++;
    else if (grp.status === 'PARTIALLY_INVOICED') partiallyInvoicedPOs++;
    else pendingPOs++;

    grp.lines.forEach((line) => {
      if ((line.undeliveredQuantity || line.quantity) > 0) {
        totalUndeliveredItemsCount++;
      }
      if ((line.remainingQuantity || line.quantity) > 0) {
        totalUnmatchedItemsCount++;
      }
    });
  });

  // Delivery Notes metrics
  let totalDeliveredValue = 0;
  deliveryNotes.forEach((dn) => {
    totalDeliveredValue += dn.totalDeliveredValue;
  });

  // Payments metrics
  let totalPaymentsReceived = 0;
  payments.forEach((p) => {
    totalPaymentsReceived += p.amountPaid;
  });

  totalPoValue = Math.round(totalPoValue * 100) / 100;
  totalInvoicedValue = Math.round(totalInvoicedValue * 100) / 100;
  totalDeliveredValue = Math.round(totalDeliveredValue * 100) / 100;
  totalPaymentsReceived = Math.round(totalPaymentsReceived * 100) / 100;

  const totalRemainingValue = Math.max(0, Math.round((totalPoValue - totalInvoicedValue) * 100) / 100);
  const totalOutstandingPayments = Math.max(0, Math.round((totalInvoicedValue - totalPaymentsReceived) * 100) / 100);
  const fulfillmentRate = totalPoValue > 0 ? Math.round((totalInvoicedValue / totalPoValue) * 1000) / 10 : 0;

  return {
    totalPOs,
    totalPoValue,
    totalInvoicedValue,
    totalRemainingValue,
    totalInvoicesCount: invoices.length,
    totalDeliveryNotesCount: deliveryNotes.length,
    totalDeliveredValue,
    totalPaymentsReceived,
    totalOutstandingPayments,
    fullyInvoicedPOs,
    partiallyInvoicedPOs,
    pendingPOs,
    fulfillmentRate,
    totalUndeliveredItemsCount,
    totalUnmatchedItemsCount,
  };
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

