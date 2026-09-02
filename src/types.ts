export interface POLineItem {
  id: string;
  customerName: string; // Vendor or Customer Name
  destination: string;
  poNumber: string;
  contract: string;
  itemDescription: string;
  date: string; // LPO Date
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  valueBeforeVat: number;
  vatRate: number; // e.g. 0.18 for 18% or standard VAT
  vatAmount: number;
  valueAfterVat: number;
  // Tracking fields calculated dynamically
  invoicedQuantity?: number;
  remainingQuantity?: number;
  deliveredQuantity?: number;
  undeliveredQuantity?: number;
  status?: 'UNINVOICED' | 'PARTIALLY_INVOICED' | 'FULLY_INVOICED';
}

export interface PurchaseOrderGroup {
  poNumber: string;
  customerName: string; // Vendor or Customer
  destination: string;
  contract: string;
  date: string;
  totalLines: number;
  totalQuantity: number;
  totalValueBeforeVat: number;
  totalVat: number;
  totalValueAfterVat: number;
  invoicedQuantity: number;
  remainingQuantity: number;
  invoicedValueAfterVat: number;
  remainingValueAfterVat: number;
  deliveredQuantity: number;
  deliveredValueAfterVat: number;
  status: 'PENDING' | 'PARTIALLY_INVOICED' | 'FULLY_INVOICED';
  lines: POLineItem[];
}

export interface InvoiceLineItem {
  poLineId: string;
  itemDescription: string;
  unitOfMeasure: string;
  poQuantity: number;
  alreadyInvoicedQuantity: number;
  availableQuantity: number;
  invoicedQuantity: number; // edited by user
  unitCost: number;
  unitPrice: number;
  valueBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  valueAfterVat: number;
  isSelected: boolean;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  poNumber: string;
  customerName: string;
  destination: string;
  contract: string;
  poDate: string;
  lines: InvoiceLineItem[];
  subtotalBeforeVat: number;
  totalVat: number;
  totalAfterVat: number;
  paidAmount?: number;
  paymentStatus?: 'PAID' | 'PARTIAL' | 'UNPAID';
  notes?: string;
  createdAt: string;
}

export interface DeliveryNoteLineItem {
  poLineId: string;
  itemDescription: string;
  unitOfMeasure: string;
  poQuantity: number;
  alreadyDeliveredQuantity: number;
  availableQuantity: number;
  deliveredQuantity: number;
  unitCost?: number;
  unitPrice: number;
  valueBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  valueAfterVat: number;
  isSelected?: boolean;
}

export interface DeliveryNoteRecord {
  id: string;
  deliveryNoteNumber: string;
  deliveryDate: string;
  poNumber: string;
  customerName: string;
  destination: string;
  contract: string;
  poDate?: string;
  carrier?: string;
  vehicleNumber?: string;
  driverName?: string;
  receivedBy?: string;
  lines: DeliveryNoteLineItem[];
  subtotalBeforeVat?: number;
  totalVat?: number;
  totalDeliveredQuantity: number;
  totalDeliveredValue: number;
  notes?: string;
  createdAt: string;
}

export interface PaymentAllocationItem {
  invoiceId: string;
  invoiceNumber: string;
  poNumber: string;
  customerName: string;
  invoiceTotal: number;
  alreadyPaid: number;
  pendingBalance: number;
  allocatedAmount: number;
}

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  invoiceId?: string;
  invoiceNumber: string;
  poNumber: string;
  customerName: string;
  amountPaid: number;
  paymentMethod: 'Bank Transfer' | 'Cheque' | 'Cash' | 'EFT' | 'Mobile Money';
  referenceNumber: string;
  depositAccount?: string;
  allocations?: PaymentAllocationItem[];
  notes?: string;
  createdAt: string;
}

export interface NumberSeriesConfig {
  prefix: string;
  startNumber: number;
  endNumber: number;
  currentNumber: number;
  padding: number;
  autoIncrement: boolean;
}

export interface SeriesSettings {
  invoiceSeries: NumberSeriesConfig;
  deliverySeries: NumberSeriesConfig;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Finance Officer' | 'Logistics Manager' | 'Billing Clerk' | 'Auditor';
  department: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  lastLoginAt?: string;
  accessToken?: string;
}

export interface EmailAccessInvitation {
  id: string;
  email: string;
  name: string;
  role: AppUser['role'];
  department: string;
  token: string;
  accessUrl: string;
  createdAt: string;
  expiresAt: string;
  status: 'Active' | 'Pending' | 'Revoked';
  invitedBy?: string;
  lastUsedAt?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetName: string;
  accessToken: string | null;
  tokenExpiry: number | null;
  userEmail: string | null;
  isConnected: boolean;
  autoSync: boolean;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

export interface SystemBackupPackage {
  backupFormat: 'FAMOLA_NINJA_FULL_SYSTEM_BACKUP';
  backupVersion: string;
  exportedAt: string;
  exportedBy: string;
  checksum: string;
  data: {
    poLines: POLineItem[];
    invoices: InvoiceRecord[];
    deliveryNotes: DeliveryNoteRecord[];
    payments: PaymentRecord[];
    seriesConfig: SeriesSettings;
    users: AppUser[];
    emailInvitations: EmailAccessInvitation[];
    googleSheetsConfig?: Partial<GoogleSheetsConfig>;
  };
  systemMetadata: {
    appName: string;
    version: string;
    description: string;
    workflowArchitecture: string;
    businessRules: {
      standardVatRate: number;
      invoiceRange: string;
      deliveryNoteRange: string;
      threeWayReconciliationRule: string;
      partialInvoicingPolicy: string;
      autoAllocationMethod: string;
    };
  };
}

export interface MatchingItem {
  poLineId: string;
  poNumber: string;
  customerName: string;
  contract: string;
  destination: string;
  poDate: string;
  itemDescription: string;
  unitOfMeasure: string;
  poQuantity: number;
  poUnitPrice: number;
  poTotalValue: number;
  deliveredQuantity: number;
  deliveredValue: number;
  invoicedQuantity: number;
  invoicedValue: number;
  unmatchedQty: number; // PO Qty - Invoiced Qty
  undeliveredQty: number; // PO Qty - Delivered Qty
  receivedVsInvoicedVarianceQty: number; // Delivered Qty - Invoiced Qty
  status: 'FULLY_MATCHED' | 'PARTIALLY_MATCHED' | 'UNMATCHED_PENDING';
  deliveryNoteNumbers: string[];
  invoiceNumbers: string[];
}

export interface DashboardMetrics {
  totalPOs: number;
  totalPoValue: number;
  totalInvoicedValue: number;
  totalRemainingValue: number;
  totalInvoicesCount: number;
  totalDeliveryNotesCount: number;
  totalDeliveredValue: number;
  totalPaymentsReceived: number;
  totalOutstandingPayments: number;
  fullyInvoicedPOs: number;
  partiallyInvoicedPOs: number;
  pendingPOs: number;
  fulfillmentRate: number;
  totalUndeliveredItemsCount: number;
  totalUnmatchedItemsCount: number;
}

