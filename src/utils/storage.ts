import { 
  POLineItem, 
  PurchaseOrderGroup, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord, 
  MatchingItem, 
  DashboardMetrics,
  SeriesSettings,
  CustomerSeriesBook,
  AppUser,
  DocumentIssueRecord,
  ScreenId,
  ScreenAccessLevel,
  ScreenPermissions
} from '../types';
import { 
  INITIAL_PO_DATA, 
  INITIAL_INVOICES, 
  INITIAL_DELIVERY_NOTES, 
  INITIAL_PAYMENTS,
  INITIAL_DOCUMENT_ISSUES
} from './sampleData';

const PO_STORAGE_KEY = 'po_tracker_master_po_v1';
const INVOICE_STORAGE_KEY = 'po_tracker_invoices_v1';
const DN_STORAGE_KEY = 'po_tracker_delivery_notes_v1';
const PAYMENT_STORAGE_KEY = 'po_tracker_payments_v1';
const ISSUES_STORAGE_KEY = 'po_tracker_document_issues_v1';
const SERIES_STORAGE_KEY = 'po_tracker_series_config_v1';
const CUSTOMER_SERIES_STORAGE_KEY = 'po_tracker_customer_series_books_v1';
const USERS_STORAGE_KEY = 'po_tracker_users_v1';

export const DEFAULT_CUSTOMER_BOOKS: CustomerSeriesBook[] = [
  {
    id: 'book-cru',
    customerName: 'CRU Mining Ltd',
    invoicePrefix: 'CRU',
    invoiceStartNumber: 1,
    invoiceEndNumber: 200,
    invoiceCurrentNumber: 1,
    deliveryPrefix: 'CRU',
    deliveryStartNumber: 1,
    deliveryEndNumber: 200,
    deliveryCurrentNumber: 1,
    padding: 3,
    description: 'Series book CRU001 - CRU200 for CRU Mining Ltd',
    updatedAt: '2026-03-01',
  },
  {
    id: 'book-grb',
    customerName: 'GRB Logistics',
    invoicePrefix: 'GRB',
    invoiceStartNumber: 1,
    invoiceEndNumber: 100,
    invoiceCurrentNumber: 1,
    deliveryPrefix: 'GRB',
    deliveryStartNumber: 1,
    deliveryEndNumber: 100,
    deliveryCurrentNumber: 1,
    padding: 3,
    description: 'Series book GRB001 - GRB100 for GRB Logistics',
    updatedAt: '2026-03-01',
  },
  {
    id: 'book-acacia',
    customerName: 'Acacia Mining PLC',
    invoicePrefix: 'ACA',
    invoiceStartNumber: 1,
    invoiceEndNumber: 200,
    invoiceCurrentNumber: 1,
    deliveryPrefix: 'ACA',
    deliveryStartNumber: 1,
    deliveryEndNumber: 200,
    deliveryCurrentNumber: 1,
    padding: 3,
    description: 'Series book ACA001 - ACA200 for Acacia Mining PLC',
    updatedAt: '2026-03-01',
  }
];

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

export const generateFourDigitPin = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const getDefaultScreenPermissionsForRole = (role: AppUser['role']): ScreenPermissions => {
  if (role === 'Admin') {
    return {
      dashboard: 'edit',
      po_master: 'edit',
      create_invoice: 'edit',
      invoices_db: 'edit',
      issue_tracking: 'edit',
      delivery_notes: 'edit',
      matching_report: 'edit',
      payments: 'edit',
      ledger: 'edit',
      settings: 'edit',
    };
  }

  if (role === 'Finance Officer') {
    return {
      dashboard: 'edit',
      po_master: 'view',
      create_invoice: 'edit',
      invoices_db: 'edit',
      issue_tracking: 'edit',
      delivery_notes: 'view',
      matching_report: 'view',
      payments: 'edit',
      ledger: 'view',
      settings: 'none',
    };
  }

  if (role === 'Logistics Manager') {
    return {
      dashboard: 'view',
      po_master: 'view',
      create_invoice: 'view',
      invoices_db: 'view',
      issue_tracking: 'edit',
      delivery_notes: 'edit',
      matching_report: 'view',
      payments: 'none',
      ledger: 'view',
      settings: 'none',
    };
  }

  if (role === 'Billing Clerk') {
    return {
      dashboard: 'view',
      po_master: 'view',
      create_invoice: 'edit',
      invoices_db: 'view',
      issue_tracking: 'view',
      delivery_notes: 'none',
      matching_report: 'none',
      payments: 'none',
      ledger: 'view',
      settings: 'none',
    };
  }

  // Auditor / default
  return {
    dashboard: 'view',
    po_master: 'view',
    create_invoice: 'view',
    invoices_db: 'view',
    issue_tracking: 'view',
    delivery_notes: 'view',
    matching_report: 'view',
    payments: 'view',
    ledger: 'view',
    settings: 'none',
  };
};

export const getUserScreenPermission = (user?: AppUser | null, screenId?: ScreenId): ScreenAccessLevel => {
  if (!user || !screenId) return 'none';
  if (user.role === 'Admin') return 'edit';
  if (user.screenPermissions && user.screenPermissions[screenId]) {
    return user.screenPermissions[screenId]!;
  }
  return getDefaultScreenPermissionsForRole(user.role)[screenId] || 'none';
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
    pinCode: '1234',
    screenPermissions: getDefaultScreenPermissionsForRole('Admin'),
  },
  {
    id: 'usr-2',
    name: 'Sarah Mwangi',
    email: 'sarah.m@enterprisegroup.com',
    role: 'Finance Officer',
    department: 'Finance & Accounting',
    status: 'Active',
    createdAt: '2026-02-01',
    pinCode: '2468',
    screenPermissions: getDefaultScreenPermissionsForRole('Finance Officer'),
  },
  {
    id: 'usr-3',
    name: 'James Kiprono',
    email: 'james.k@enterprisegroup.com',
    role: 'Logistics Manager',
    department: 'Supply Chain & Logistics',
    status: 'Active',
    createdAt: '2026-02-10',
    pinCode: '1357',
    screenPermissions: getDefaultScreenPermissionsForRole('Logistics Manager'),
  },
  {
    id: 'usr-4',
    name: 'David Ruvuma',
    email: 'david.r@enterprisegroup.com',
    role: 'Billing Clerk',
    department: 'Invoicing & Operations',
    status: 'Active',
    createdAt: '2026-02-18',
    pinCode: '5555',
    screenPermissions: getDefaultScreenPermissionsForRole('Billing Clerk'),
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

export const loadStoredCustomerSeriesBooks = (): CustomerSeriesBook[] => {
  try {
    const raw = localStorage.getItem(CUSTOMER_SERIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load Customer Series Books', e);
  }
  saveStoredCustomerSeriesBooks(DEFAULT_CUSTOMER_BOOKS);
  return DEFAULT_CUSTOMER_BOOKS;
};

export const saveStoredCustomerSeriesBooks = (books: CustomerSeriesBook[]) => {
  try {
    localStorage.setItem(CUSTOMER_SERIES_STORAGE_KEY, JSON.stringify(books));
  } catch (e) {
    console.error('Failed to save Customer Series Books', e);
  }
};

export const getCustomerSeriesBook = (customerName: string): CustomerSeriesBook => {
  const books = loadStoredCustomerSeriesBooks();
  const trimmed = (customerName || '').trim();
  const matched = books.find(
    (b) => b.customerName.toLowerCase() === trimmed.toLowerCase()
  );
  if (matched) return matched;

  // Auto-generate a series book if customer is not yet configured
  const cleaned = trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const prefix = cleaned.length >= 3 ? cleaned.slice(0, 3) : (cleaned || 'CUS').padEnd(3, 'X');
  
  const newBook: CustomerSeriesBook = {
    id: `book-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    customerName: trimmed || 'General Customer',
    invoicePrefix: prefix,
    invoiceStartNumber: 1,
    invoiceEndNumber: 200,
    invoiceCurrentNumber: 1,
    deliveryPrefix: prefix,
    deliveryStartNumber: 1,
    deliveryEndNumber: 200,
    deliveryCurrentNumber: 1,
    padding: 3,
    description: `Series book ${prefix}001 - ${prefix}200 for ${trimmed || 'General Customer'}`,
    updatedAt: new Date().toISOString().split('T')[0],
  };

  const updatedBooks = [...books, newBook];
  saveStoredCustomerSeriesBooks(updatedBooks);
  return newBook;
};

export const saveOrUpdateCustomerSeriesBook = (book: CustomerSeriesBook) => {
  const books = loadStoredCustomerSeriesBooks();
  const index = books.findIndex(
    (b) => b.id === book.id || b.customerName.toLowerCase() === book.customerName.toLowerCase()
  );
  let updated: CustomerSeriesBook[];
  if (index >= 0) {
    updated = [...books];
    updated[index] = { ...book, updatedAt: new Date().toISOString().split('T')[0] };
  } else {
    updated = [...books, { ...book, updatedAt: new Date().toISOString().split('T')[0] }];
  }
  saveStoredCustomerSeriesBooks(updated);
};

export const peekCustomerSeriesNumber = (customerName: string, type: 'invoice' | 'delivery'): string => {
  if (!customerName || customerName === 'ALL') {
    const config = loadStoredSeriesConfig();
    const series = type === 'invoice' ? config.invoiceSeries : config.deliverySeries;
    return formatSeriesNumber(series.prefix, series.currentNumber, series.padding);
  }
  const book = getCustomerSeriesBook(customerName);
  if (type === 'invoice') {
    return formatSeriesNumber(book.invoicePrefix, book.invoiceCurrentNumber, book.padding);
  } else {
    return formatSeriesNumber(book.deliveryPrefix, book.deliveryCurrentNumber, book.padding);
  }
};

export const advanceCustomerSeriesNumber = (customerName: string, type: 'invoice' | 'delivery'): string => {
  if (!customerName || customerName === 'ALL') {
    return advanceSeriesNumber(type);
  }
  const book = getCustomerSeriesBook(customerName);
  let formatted = '';
  if (type === 'invoice') {
    formatted = formatSeriesNumber(book.invoicePrefix, book.invoiceCurrentNumber, book.padding);
    if (book.invoiceCurrentNumber < book.invoiceEndNumber) {
      book.invoiceCurrentNumber += 1;
    } else {
      book.invoiceCurrentNumber = book.invoiceStartNumber;
    }
  } else {
    formatted = formatSeriesNumber(book.deliveryPrefix, book.deliveryCurrentNumber, book.padding);
    if (book.deliveryCurrentNumber < book.deliveryEndNumber) {
      book.deliveryCurrentNumber += 1;
    } else {
      book.deliveryCurrentNumber = book.deliveryStartNumber;
    }
  }
  saveOrUpdateCustomerSeriesBook(book);
  return formatted;
};

export const loadStoredUsers = (): AppUser[] => {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let changed = false;
        const normalized = parsed.map((u: any, idx: number) => {
          const defaultPin = idx === 0 ? '1234' : (u.pinCode || generateFourDigitPin());
          const permissions = u.screenPermissions || getDefaultScreenPermissionsForRole(u.role);
          const status = u.status === 'On Hold' ? 'On Hold' : (u.status === 'Inactive' ? 'Inactive' : 'Active');
          if (!u.pinCode || !u.screenPermissions) changed = true;
          return {
            ...u,
            status,
            pinCode: defaultPin,
            screenPermissions: permissions,
          };
        });
        if (changed) {
          saveStoredUsers(normalized);
        }
        return normalized;
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

export const loadStoredIssues = (): DocumentIssueRecord[] => {
  try {
    const raw = localStorage.getItem(ISSUES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load Issues from storage', e);
  }
  saveIssues(INITIAL_DOCUMENT_ISSUES);
  return INITIAL_DOCUMENT_ISSUES;
};

export const saveIssues = (issues: DocumentIssueRecord[]) => {
  try {
    localStorage.setItem(ISSUES_STORAGE_KEY, JSON.stringify(issues));
  } catch (e) {
    console.error('Failed to save Issues to storage', e);
  }
};

export const addOrUpdateIssue = (issue: DocumentIssueRecord): DocumentIssueRecord[] => {
  const current = loadStoredIssues();
  const index = current.findIndex((i) => i.id === issue.id);
  let updated: DocumentIssueRecord[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = issue;
  } else {
    updated = [issue, ...current];
  }
  saveIssues(updated);
  return updated;
};

export const resolveDocumentIssue = (
  issueId: string,
  resolvedBy: string,
  resolutionNotes: string
): DocumentIssueRecord[] => {
  const current = loadStoredIssues();
  const updated = current.map((item) => {
    if (item.id === issueId) {
      return {
        ...item,
        status: 'RESOLVED' as const,
        resolvedBy,
        resolvedAt: new Date().toISOString(),
        resolutionNotes,
        lineIssues: item.lineIssues.map((l) => ({ ...l, status: 'RESOLVED' as const })),
        comments: [
          ...item.comments,
          {
            id: `comm-res-${Date.now()}`,
            authorName: resolvedBy,
            authorRole: 'Reviewer / Admin',
            comment: `Issue marked as resolved: ${resolutionNotes}`,
            createdAt: new Date().toISOString(),
            type: 'RESOLUTION_NOTE' as const,
          }
        ]
      };
    }
    return item;
  });
  saveIssues(updated);
  return updated;
};

export const resetToSampleData = () => {
  savePOs(INITIAL_PO_DATA);
  saveInvoices(INITIAL_INVOICES);
  saveDeliveryNotes(INITIAL_DELIVERY_NOTES);
  savePayments(INITIAL_PAYMENTS);
  saveIssues(INITIAL_DOCUMENT_ISSUES);
  return { 
    pos: INITIAL_PO_DATA, 
    invoices: INITIAL_INVOICES,
    deliveryNotes: INITIAL_DELIVERY_NOTES,
    payments: INITIAL_PAYMENTS,
    issues: INITIAL_DOCUMENT_ISSUES,
  };
};

export const clearAllData = () => {
  savePOs([]);
  saveInvoices([]);
  saveDeliveryNotes([]);
  savePayments([]);
  saveIssues([]);
  return { pos: [], invoices: [], deliveryNotes: [], payments: [], issues: [] };
};

// Reconcile and calculate line tracking against all recorded invoices and delivery notes
export const enrichPOLinesWithTracking = (
  rawLines: POLineItem[] = [],
  invoices: InvoiceRecord[] = [],
  deliveryNotes: DeliveryNoteRecord[] = []
): POLineItem[] => {
  // Map of total invoiced qty by poLineId or (poNumber + itemDescription)
  const invoicedQtyByLineId = new Map<string, number>();
  const invoicedQtyByDesc = new Map<string, number>();

  (invoices || []).forEach((inv) => {
    if (!inv) return;
    (inv.lines || []).forEach((line) => {
      if (!line) return;
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

  (deliveryNotes || []).forEach((dn) => {
    if (!dn) return;
    (dn.lines || []).forEach((line) => {
      if (!line) return;
      const currentIdQty = deliveredQtyByLineId.get(line.poLineId) || 0;
      deliveredQtyByLineId.set(line.poLineId, currentIdQty + (line.deliveredQuantity || 0));

      const descKey = `${dn.poNumber}___${line.itemDescription}`;
      const currentDescQty = deliveredQtyByDesc.get(descKey) || 0;
      deliveredQtyByDesc.set(descKey, currentDescQty + (line.deliveredQuantity || 0));
    });
  });

  return (rawLines || []).map((line) => {
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
  lines: POLineItem[] = [],
  invoices: InvoiceRecord[] = [],
  deliveryNotes: DeliveryNoteRecord[] = []
): PurchaseOrderGroup[] => {
  const enrichedLines = enrichPOLinesWithTracking(lines, invoices, deliveryNotes);
  const groupsMap = new Map<string, PurchaseOrderGroup>();

  (enrichedLines || []).forEach((line) => {
    if (!line || !line.poNumber) return;
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
  rawLines: POLineItem[] = [],
  deliveryNotes: DeliveryNoteRecord[] = [],
  invoices: InvoiceRecord[] = []
): MatchingItem[] => {
  const enriched = enrichPOLinesWithTracking(rawLines, invoices, deliveryNotes);

  return (enriched || []).map((line) => {
    const poQty = line.quantity || 0;
    const invQty = line.invoicedQuantity || 0;
    const delQty = line.deliveredQuantity || 0;

    const unitPriceWithVat = poQty > 0 ? (line.valueAfterVat || 0) / poQty : (line.unitPrice || 0) * (1 + (line.vatRate || 0.18));
    const poTotalVal = line.valueAfterVat || 0;
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
    const deliveryNoteNumbers = (deliveryNotes || [])
      .filter((dn) => dn && dn.poNumber === line.poNumber && (dn.lines || []).some((l) => l && (l.poLineId === line.id || l.itemDescription === line.itemDescription)))
      .map((dn) => dn.deliveryNoteNumber);

    const invoiceNumbers = (invoices || [])
      .filter((inv) => inv && inv.poNumber === line.poNumber && (inv.lines || []).some((l) => l && (l.poLineId === line.id || l.itemDescription === line.itemDescription)))
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
  poGroups: PurchaseOrderGroup[] = [],
  invoices: InvoiceRecord[] = [],
  deliveryNotes: DeliveryNoteRecord[] = [],
  payments: PaymentRecord[] = []
): DashboardMetrics => {
  const totalPOs = (poGroups || []).length;
  let totalPoValue = 0;
  let totalInvoicedValue = 0;
  let fullyInvoicedPOs = 0;
  let partiallyInvoicedPOs = 0;
  let pendingPOs = 0;
  let totalUndeliveredItemsCount = 0;
  let totalUnmatchedItemsCount = 0;

  (poGroups || []).forEach((grp) => {
    if (!grp) return;
    totalPoValue += grp.totalValueAfterVat || 0;
    totalInvoicedValue += grp.invoicedValueAfterVat || 0;
    if (grp.status === 'FULLY_INVOICED') fullyInvoicedPOs++;
    else if (grp.status === 'PARTIALLY_INVOICED') partiallyInvoicedPOs++;
    else pendingPOs++;

    (grp.lines || []).forEach((line) => {
      if (!line) return;
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
  (deliveryNotes || []).forEach((dn) => {
    if (dn) {
      totalDeliveredValue += dn.totalDeliveredValue || 0;
    }
  });

  // Payments metrics
  let totalPaymentsReceived = 0;
  (payments || []).forEach((p) => {
    if (p) {
      totalPaymentsReceived += p.amountPaid || 0;
    }
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
    totalInvoicesCount: (invoices || []).length,
    totalDeliveryNotesCount: (deliveryNotes || []).length,
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

export const CURRENCY_CODE = 'TZS';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

export const formatMoney = (amount: number): string => {
  return `TZS ${formatCurrency(amount)}`;
};

