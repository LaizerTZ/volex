import React, { useMemo, useState } from 'react';
import { 
  PurchaseOrderGroup, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord, 
  POLineItem, 
  DashboardMetrics,
  MatchingItem 
} from '../types';
import { formatCurrency, generateMatchingReport } from '../utils/storage';
import { 
  DollarSign, 
  Receipt, 
  Truck, 
  CreditCard, 
  GitCompare, 
  TrendingUp, 
  Upload, 
  Plus, 
  FileSpreadsheet, 
  ArrowRight, 
  Building2, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  ChevronDown,
  Eye,
  ExternalLink,
  Layers,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  FileText,
  Boxes,
  HelpCircle,
  X,
  Mic,
  Sparkles
} from 'lucide-react';

interface DashboardProps {
  metrics: DashboardMetrics;
  poGroups: PurchaseOrderGroup[];
  poLines: POLineItem[];
  invoices: InvoiceRecord[];
  deliveryNotes: DeliveryNoteRecord[];
  payments: PaymentRecord[];
  onNavigate: (tab: any, subFilter?: string) => void;
  onSelectPOForInvoice: (poNumber: string) => void;
  onOpenUploadModal: () => void;
  onDownloadTemplate: () => void;
  onOpenVoiceSearch?: () => void;
  onOpenAutoReport?: () => void;
}

type GroupingMode = 'PO' | 'VENDOR' | 'ITEMS';
type StatusFilter = 'ALL' | 'MATCHED' | 'UNMATCHED' | 'UNDELIVERED' | 'PARTIAL';

export const Dashboard: React.FC<DashboardProps> = ({
  metrics,
  poGroups,
  poLines,
  invoices,
  deliveryNotes,
  payments,
  onNavigate,
  onSelectPOForInvoice,
  onOpenUploadModal,
  onDownloadTemplate,
  onOpenVoiceSearch,
  onOpenAutoReport,
}) => {
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('PO');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [selectedDrilldownItem, setSelectedDrilldownItem] = useState<MatchingItem | null>(null);

  // Matching dataset
  const matchingData = useMemo(() => {
    return generateMatchingReport(poLines, deliveryNotes, invoices);
  }, [poLines, deliveryNotes, invoices]);

  // Delivery Notes summary per vendor
  const vendorDnStats = useMemo(() => {
    const map = new Map<string, { totalDnVal: number; totalDeliveredQty: number; dnCount: number }>();
    (deliveryNotes || []).forEach((dn) => {
      if (!dn) return;
      const existing = map.get(dn.customerName) || { totalDnVal: 0, totalDeliveredQty: 0, dnCount: 0 };
      existing.totalDnVal += dn.totalDeliveredValue || 0;
      existing.totalDeliveredQty += dn.totalDeliveredQuantity || 0;
      existing.dnCount += 1;
      map.set(dn.customerName, existing);
    });
    return Array.from(map.entries()).map(([vendor, data]) => ({
      vendor,
      totalDnVal: data.totalDnVal,
      totalDeliveredQty: data.totalDeliveredQty,
      dnCount: data.dnCount,
    }));
  }, [deliveryNotes]);

  // Unmatched Items (Un-invoiced lines)
  const unmatchedItems = useMemo(() => {
    return matchingData.filter((m) => m.unmatchedQty > 0);
  }, [matchingData]);

  // Undelivered Items (Remaining delivery pending)
  const undeliveredItems = useMemo(() => {
    return matchingData.filter((m) => m.undeliveredQty > 0);
  }, [matchingData]);

  // Fully Matched Items
  const fullyMatchedItems = useMemo(() => {
    return matchingData.filter((m) => m.status === 'FULLY_MATCHED');
  }, [matchingData]);

  // Toggle single group expand
  const toggleGroup = (key: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Expand / Collapse all
  const toggleAllGroups = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    if (groupingMode === 'PO') {
      (poReconciliationGroups || []).forEach((g) => {
        if (g && g.poNumber) next[g.poNumber] = expand;
      });
    } else if (groupingMode === 'VENDOR') {
      (vendorReconciliationGroups || []).forEach((g) => {
        if (g && g.vendor) next[g.vendor] = expand;
      });
    }
    setExpandedKeys(next);
  };

  // Filtered matching items based on search and status
  const filteredMatchingData = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    return (matchingData || []).filter((item) => {
      if (!item) return false;
      const matchesSearch =
        !q ||
        (item.poNumber || '').toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q) ||
        (item.itemDescription || '').toLowerCase().includes(q) ||
        (item.destination || '').toLowerCase().includes(q) ||
        (item.contract || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'MATCHED') return item.status === 'FULLY_MATCHED';
      if (statusFilter === 'PARTIAL') return item.status === 'PARTIALLY_MATCHED';
      if (statusFilter === 'UNMATCHED') return (item.unmatchedQty || 0) > 0;
      if (statusFilter === 'UNDELIVERED') return (item.undeliveredQty || 0) > 0;

      return true;
    });
  }, [matchingData, searchQuery, statusFilter]);

  // Grouping 1: Group by PO
  const poReconciliationGroups = useMemo(() => {
    const groupsMap = new Map<string, {
      poNumber: string;
      customerName: string;
      destination: string;
      contract: string;
      poDate: string;
      items: MatchingItem[];
      totalPoQty: number;
      totalPoVal: number;
      totalDeliveredQty: number;
      totalDeliveredVal: number;
      totalInvoicedQty: number;
      totalInvoicedVal: number;
      totalUnmatchedQty: number;
      totalUndeliveredQty: number;
    }>();

    (filteredMatchingData || []).forEach((item) => {
      if (!item || !item.poNumber) return;
      const existing = groupsMap.get(item.poNumber) || {
        poNumber: item.poNumber,
        customerName: item.customerName,
        destination: item.destination,
        contract: item.contract,
        poDate: item.poDate,
        items: [],
        totalPoQty: 0,
        totalPoVal: 0,
        totalDeliveredQty: 0,
        totalDeliveredVal: 0,
        totalInvoicedQty: 0,
        totalInvoicedVal: 0,
        totalUnmatchedQty: 0,
        totalUndeliveredQty: 0,
      };

      existing.items.push(item);
      existing.totalPoQty += item.poQuantity || 0;
      existing.totalPoVal += item.poTotalValue || 0;
      existing.totalDeliveredQty += item.deliveredQuantity || 0;
      existing.totalDeliveredVal += item.deliveredValue || 0;
      existing.totalInvoicedQty += item.invoicedQuantity || 0;
      existing.totalInvoicedVal += item.invoicedValue || 0;
      existing.totalUnmatchedQty += item.unmatchedQty || 0;
      existing.totalUndeliveredQty += item.undeliveredQty || 0;

      groupsMap.set(item.poNumber, existing);
    });

    return Array.from(groupsMap.values()).map((grp) => {
      const fulfillmentRate = grp.totalPoQty > 0 ? Math.round((grp.totalInvoicedQty / grp.totalPoQty) * 100) : 0;
      const deliveryRate = grp.totalPoQty > 0 ? Math.round((grp.totalDeliveredQty / grp.totalPoQty) * 100) : 0;
      
      let status: 'FULLY_MATCHED' | 'PARTIALLY_MATCHED' | 'UNMATCHED' = 'UNMATCHED';
      if (grp.totalInvoicedQty >= grp.totalPoQty && grp.totalPoQty > 0) {
        status = 'FULLY_MATCHED';
      } else if (grp.totalInvoicedQty > 0) {
        status = 'PARTIALLY_MATCHED';
      }

      return {
        ...grp,
        fulfillmentRate,
        deliveryRate,
        status,
      };
    });
  }, [filteredMatchingData]);

  // Grouping 2: Group by Vendor / Customer
  const vendorReconciliationGroups = useMemo(() => {
    const groupsMap = new Map<string, {
      vendor: string;
      poNumbersSet: Set<string>;
      items: MatchingItem[];
      totalPoQty: number;
      totalPoVal: number;
      totalDeliveredQty: number;
      totalDeliveredVal: number;
      totalInvoicedQty: number;
      totalInvoicedVal: number;
      totalUnmatchedQty: number;
      totalUndeliveredQty: number;
    }>();

    (filteredMatchingData || []).forEach((item) => {
      if (!item || !item.customerName) return;
      const existing = groupsMap.get(item.customerName) || {
        vendor: item.customerName,
        poNumbersSet: new Set<string>(),
        items: [],
        totalPoQty: 0,
        totalPoVal: 0,
        totalDeliveredQty: 0,
        totalDeliveredVal: 0,
        totalInvoicedQty: 0,
        totalInvoicedVal: 0,
        totalUnmatchedQty: 0,
        totalUndeliveredQty: 0,
      };

      existing.poNumbersSet.add(item.poNumber);
      existing.items.push(item);
      existing.totalPoQty += item.poQuantity || 0;
      existing.totalPoVal += item.poTotalValue || 0;
      existing.totalDeliveredQty += item.deliveredQuantity || 0;
      existing.totalDeliveredVal += item.deliveredValue || 0;
      existing.totalInvoicedQty += item.invoicedQuantity || 0;
      existing.totalInvoicedVal += item.invoicedValue || 0;
      existing.totalUnmatchedQty += item.unmatchedQty || 0;
      existing.totalUndeliveredQty += item.undeliveredQty || 0;

      groupsMap.set(item.customerName, existing);
    });

    return Array.from(groupsMap.values()).map((grp) => {
      const fulfillmentRate = grp.totalPoQty > 0 ? Math.round((grp.totalInvoicedQty / grp.totalPoQty) * 100) : 0;
      const deliveryRate = grp.totalPoQty > 0 ? Math.round((grp.totalDeliveredQty / grp.totalPoQty) * 100) : 0;
      
      let status: 'FULLY_MATCHED' | 'PARTIALLY_MATCHED' | 'UNMATCHED' = 'UNMATCHED';
      if (grp.totalInvoicedQty >= grp.totalPoQty && grp.totalPoQty > 0) {
        status = 'FULLY_MATCHED';
      } else if (grp.totalInvoicedQty > 0) {
        status = 'PARTIALLY_MATCHED';
      }

      return {
        ...grp,
        poCount: grp.poNumbersSet.size,
        poNumbers: Array.from(grp.poNumbersSet),
        fulfillmentRate,
        deliveryRate,
        status,
      };
    });
  }, [filteredMatchingData]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/60 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight">PO, Invoice & Delivery Analytics</span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Live Reconciled
              </span>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm mt-1">
              Interactive dashboard with 3-way reconciliation (PO vs. Delivery Note vs. Invoice) grouped by PO or Vendor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenVoiceSearch && (
              <button
                type="button"
                onClick={onOpenVoiceSearch}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer group"
                title="AI Voice Search POs (Cmd+K)"
              >
                <Mic className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                <span>AI Voice Search</span>
              </button>
            )}
            {onOpenAutoReport && (
              <button
                type="button"
                onClick={onOpenAutoReport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
                title="Generate AI Automated Reports"
              >
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>AI Auto Reports</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('matching_report')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <GitCompare className="w-4 h-4" />
              Full Matching Matrix
            </button>
            <button
              onClick={() => onNavigate('create_invoice')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Record Invoice
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4 PRIMARY INTERACTIVE SUMMARY CARDS (Clickable to navigate to full data)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Total Number of POs and Value */}
        <div
          onClick={() => onNavigate('po_master')}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                1. Total POs & Value
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 font-mono">
                TZS {formatCurrency(metrics.totalPoValue)}
              </div>
              <div className="text-xs text-slate-600 font-semibold mt-1 flex items-center gap-2">
                <span className="text-blue-600 font-bold">{metrics.totalPOs} Total POs</span>
                <span>•</span>
                <span>{poLines.length} Item Lines</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600 font-semibold">
            <span>View Full PO Master Data</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 2: Total Invoice and Value */}
        <div
          onClick={() => onNavigate('invoices_db')}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                2. Total Invoices Issued
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-700 font-mono">
                TZS {formatCurrency(metrics.totalInvoicedValue)}
              </div>
              <div className="text-xs text-slate-600 font-semibold mt-1 flex items-center gap-2">
                <span className="text-emerald-600 font-bold">{metrics.totalInvoicesCount} Invoices</span>
                <span>•</span>
                <span>{metrics.fulfillmentRate}% Fulfilled</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-600 font-semibold">
            <span>View Invoiced PO Database</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 3: Delivery Notes per Vendor (Total & Value) */}
        <div
          onClick={() => onNavigate('delivery_notes')}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                3. Delivery Notes (DNs)
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-indigo-700 font-mono">
                TZS {formatCurrency(metrics.totalDeliveredValue)}
              </div>
              <div className="text-xs text-slate-600 font-semibold mt-1 flex items-center gap-2">
                <span className="text-indigo-600 font-bold">{metrics.totalDeliveryNotesCount} Delivery Notes</span>
                <span>•</span>
                <span>{vendorDnStats.length} Vendors</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-semibold">
            <span>View Delivery Notes Ledger</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 4: Payment Received Against Invoices */}
        <div
          onClick={() => onNavigate('payments')}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                4. Payments Received
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 font-mono">
                TZS {formatCurrency(metrics.totalPaymentsReceived)}
              </div>
              <div className="text-xs text-slate-600 font-semibold mt-1 flex items-center justify-between">
                <span className="text-amber-700 font-medium">Unpaid: TZS {formatCurrency(metrics.totalOutstandingPayments)}</span>
                <span className="font-bold text-emerald-600">
                  {metrics.totalInvoicedValue > 0 ? Math.round((metrics.totalPaymentsReceived / metrics.totalInvoicedValue) * 100) : 0}% Paid
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700 font-semibold">
            <span>View Payments Received</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* =========================================================================
          RECONCILIATION & MATCHING: PO ITEMS VS DELIVERED VS INVOICED
          WITH GROUP BY PO OR VENDOR TOGGLE
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Section Header */}
        <div className="p-5 border-b border-slate-100 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <GitCompare className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Reconciliation & Matching: PO Items vs Delivered (Received) vs Invoiced
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                3-Way variance tracking across Ordered POs, Physical Delivery Notes, and Issued Invoices. Group by Purchase Order or Vendor.
              </p>
            </div>

            {/* Grouping Mode Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setGroupingMode('PO')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    groupingMode === 'PO'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Group by PO ({poGroups.length})
                </button>
                <button
                  onClick={() => setGroupingMode('VENDOR')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    groupingMode === 'VENDOR'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Group by Vendor ({vendorDnStats.length || poGroups.reduce((acc, g) => acc.add(g.customerName), new Set()).size})
                </button>
                <button
                  onClick={() => setGroupingMode('ITEMS')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    groupingMode === 'ITEMS'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  All Line Items ({matchingData.length})
                </button>
              </div>

              <button
                onClick={() => onNavigate('matching_report')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Full Matrix
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search, Status Filters and Expand All */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search PO, Vendor, Item, or Site..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status filter chips */}
              <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-medium">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All Statuses ({matchingData.length})
                </button>
                <button
                  onClick={() => setStatusFilter('MATCHED')}
                  className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'MATCHED'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Fully Matched ({fullyMatchedItems.length})
                </button>
                <button
                  onClick={() => setStatusFilter('UNMATCHED')}
                  className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'UNMATCHED'
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Un-invoiced ({unmatchedItems.length})
                </button>
                <button
                  onClick={() => setStatusFilter('UNDELIVERED')}
                  className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'UNDELIVERED'
                      ? 'bg-indigo-700 text-white border-indigo-700'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <Truck className="w-3 h-3" />
                  Undelivered ({undeliveredItems.length})
                </button>
              </div>
            </div>

            {groupingMode !== 'ITEMS' && (
              <div className="flex items-center gap-2 self-end md:self-auto text-xs">
                <button
                  onClick={() => toggleAllGroups(true)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  Expand All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => toggleAllGroups(false)}
                  className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3 Quick Reconciliation Stat Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/70 text-xs border-b border-slate-100">
          <div
            onClick={() => setStatusFilter('MATCHED')}
            className="p-3.5 hover:bg-emerald-50/50 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Fully Matched Lines</span>
                <span className="text-[11px] text-slate-500">100% Invoiced against PO</span>
              </div>
            </div>
            <span className="font-mono font-bold text-sm text-emerald-700">
              {fullyMatchedItems.length}
            </span>
          </div>

          <div
            onClick={() => setStatusFilter('UNMATCHED')}
            className="p-3.5 hover:bg-amber-50/50 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Unmatched Items on PO</span>
                <span className="text-[11px] text-amber-700 font-medium">Remaining balance to invoice</span>
              </div>
            </div>
            <span className="font-mono font-bold text-sm text-amber-700">
              {unmatchedItems.length}
            </span>
          </div>

          <div
            onClick={() => setStatusFilter('UNDELIVERED')}
            className="p-3.5 hover:bg-indigo-50/50 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Undelivered Items</span>
                <span className="text-[11px] text-indigo-700 font-medium">Pending physical delivery note</span>
              </div>
            </div>
            <span className="font-mono font-bold text-sm text-indigo-700">
              {undeliveredItems.length}
            </span>
          </div>
        </div>

        {/* =====================================================================
            VIEW MODE 1: GROUP BY PURCHASE ORDER (PO)
            ===================================================================== */}
        {groupingMode === 'PO' && (
          <div className="divide-y divide-slate-100">
            {poReconciliationGroups.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No Purchase Orders found matching the current search or filters.
              </div>
            ) : (
              poReconciliationGroups.map((poGroup) => {
                const isExpanded = expandedKeys[poGroup.poNumber];
                return (
                  <div key={poGroup.poNumber} className="bg-white hover:bg-slate-50/60 transition-colors">
                    {/* Header Row for PO */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left info: PO #, Vendor, Contract, Date */}
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => toggleGroup(poGroup.poNumber)}
                          className="mt-0.5 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title={isExpanded ? 'Collapse PO items' : 'Expand PO items'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {poGroup.poNumber}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{poGroup.customerName}</span>
                            {poGroup.contract && (
                              <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {poGroup.contract}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {poGroup.poDate} • {poGroup.destination}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                            <span>{poGroup.items.length} Line Items</span>
                            <span>•</span>
                            <span>
                              Ordered: <strong className="text-slate-800">{poGroup.totalPoQty.toLocaleString()} units</strong> (TZS {formatCurrency(poGroup.totalPoVal)})
                            </span>
                            <span>•</span>
                            <span>
                              Delivered: <strong className="text-indigo-700">{poGroup.totalDeliveredQty.toLocaleString()} units</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Invoiced: <strong className="text-emerald-700">{poGroup.totalInvoicedQty.toLocaleString()} units</strong> (TZS {formatCurrency(poGroup.totalInvoicedVal)})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right metrics, fulfillment bar & quick action */}
                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                        {/* Progress visual */}
                        <div className="w-32 hidden sm:block">
                          <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                            <span>Invoiced</span>
                            <span className={poGroup.fulfillmentRate >= 100 ? 'text-emerald-600 font-bold' : 'text-slate-700'}>
                              {poGroup.fulfillmentRate}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, poGroup.fulfillmentRate)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                            <span>Delivered: {poGroup.deliveryRate}%</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {poGroup.status === 'FULLY_MATCHED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Matched
                            </span>
                          ) : poGroup.status === 'PARTIALLY_MATCHED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3.5 h-3.5" />
                              Partial ({poGroup.totalUnmatchedQty} left)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Un-invoiced
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          {poGroup.totalUnmatchedQty > 0 && (
                            <button
                              onClick={() => {
                                onSelectPOForInvoice(poGroup.poNumber);
                                onNavigate('create_invoice');
                              }}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                              title="Create new invoice for remaining items on this PO"
                            >
                              + Invoice
                            </button>
                          )}
                          <button
                            onClick={() => toggleGroup(poGroup.poNumber)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            {isExpanded ? 'Hide' : 'Items'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sub-table: Line Items under this PO */}
                    {isExpanded && (
                      <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 py-3 overflow-x-auto">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Line Item Matching Details for PO #{poGroup.poNumber}
                        </div>
                        <table className="w-full text-left text-xs border-collapse bg-white rounded-xl shadow-xs overflow-hidden border border-slate-200/80">
                          <thead className="bg-slate-900 text-white text-[10px] uppercase font-semibold">
                            <tr>
                              <th className="py-2.5 px-3">Item Description</th>
                              <th className="py-2.5 px-3 text-right">PO Ordered</th>
                              <th className="py-2.5 px-3 text-right">Delivered (DN)</th>
                              <th className="py-2.5 px-3 text-right">Invoiced Qty</th>
                              <th className="py-2.5 px-3 text-right">Un-invoiced</th>
                              <th className="py-2.5 px-3 text-right">Undelivered</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                              <th className="py-2.5 px-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {poGroup.items.map((item, itemIdx) => (
                              <tr key={itemIdx} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="py-2 px-3 font-medium text-slate-900 max-w-xs truncate" title={item.itemDescription}>
                                  {item.itemDescription}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900">
                                  {item.poQuantity} {item.unitOfMeasure}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold text-indigo-700">
                                  {item.deliveredQuantity} {item.unitOfMeasure}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                  {item.invoicedQuantity} {item.unitOfMeasure}
                                </td>
                                <td className="py-2 px-3 text-right font-bold">
                                  {item.unmatchedQty > 0 ? (
                                    <span className="text-amber-700">{item.unmatchedQty} {item.unitOfMeasure}</span>
                                  ) : (
                                    <span className="text-emerald-700">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-medium">
                                  {item.undeliveredQty > 0 ? (
                                    <span className="text-red-600">{item.undeliveredQty} {item.unitOfMeasure}</span>
                                  ) : (
                                    <span className="text-slate-400">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {item.status === 'FULLY_MATCHED' ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Matched
                                    </span>
                                  ) : item.status === 'PARTIALLY_MATCHED' ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                      Partial
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      Unmatched
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    onClick={() => setSelectedDrilldownItem(item)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium cursor-pointer"
                                  >
                                    Drilldown
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* =====================================================================
            VIEW MODE 2: GROUP BY VENDOR / CUSTOMER
            ===================================================================== */}
        {groupingMode === 'VENDOR' && (
          <div className="divide-y divide-slate-100">
            {vendorReconciliationGroups.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No Vendors found matching the current search or filters.
              </div>
            ) : (
              vendorReconciliationGroups.map((vGroup) => {
                const isExpanded = expandedKeys[vGroup.vendor];
                return (
                  <div key={vGroup.vendor} className="bg-white hover:bg-slate-50/60 transition-colors">
                    {/* Header Row for Vendor */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left info: Vendor name, POs count, ordered vs invoiced */}
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => toggleGroup(vGroup.vendor)}
                          className="mt-0.5 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title={isExpanded ? 'Collapse Vendor details' : 'Expand Vendor details'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-blue-600" />
                              {vGroup.vendor}
                            </span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {vGroup.poCount} {vGroup.poCount === 1 ? 'PO' : 'POs'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              ({vGroup.poNumbers.slice(0, 3).join(', ')}{vGroup.poNumbers.length > 3 ? '…' : ''})
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                            <span>{vGroup.items.length} Item Lines</span>
                            <span>•</span>
                            <span>
                              Total PO Val: <strong className="text-slate-800">TZS {formatCurrency(vGroup.totalPoVal)}</strong> ({vGroup.totalPoQty.toLocaleString()} units)
                            </span>
                            <span>•</span>
                            <span>
                              Delivered: <strong className="text-indigo-700">TZS {formatCurrency(vGroup.totalDeliveredVal)}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Invoiced: <strong className="text-emerald-700">TZS {formatCurrency(vGroup.totalInvoicedVal)}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right metrics, fulfillment & action */}
                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                        {/* Progress visual */}
                        <div className="w-32 hidden sm:block">
                          <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                            <span>Fulfillment</span>
                            <span className={vGroup.fulfillmentRate >= 100 ? 'text-emerald-600 font-bold' : 'text-slate-700'}>
                              {vGroup.fulfillmentRate}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, vGroup.fulfillmentRate)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                            <span>Delivered: {vGroup.deliveryRate}%</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {vGroup.status === 'FULLY_MATCHED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Fully Matched
                            </span>
                          ) : vGroup.status === 'PARTIALLY_MATCHED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3.5 h-3.5" />
                              Partial ({vGroup.totalUnmatchedQty} left)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Un-invoiced
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleGroup(vGroup.vendor)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            {isExpanded ? 'Hide Details' : 'View POs & Items'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sub-table: Items belonging to this Vendor */}
                    {isExpanded && (
                      <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 py-3 overflow-x-auto">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          All Items & POs under Vendor: {vGroup.vendor}
                        </div>
                        <table className="w-full text-left text-xs border-collapse bg-white rounded-xl shadow-xs overflow-hidden border border-slate-200/80">
                          <thead className="bg-slate-900 text-white text-[10px] uppercase font-semibold">
                            <tr>
                              <th className="py-2.5 px-3">PO Number</th>
                              <th className="py-2.5 px-3">Item Description</th>
                              <th className="py-2.5 px-3 text-right">PO Ordered</th>
                              <th className="py-2.5 px-3 text-right">Delivered (DN)</th>
                              <th className="py-2.5 px-3 text-right">Invoiced Qty</th>
                              <th className="py-2.5 px-3 text-right">Un-invoiced</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                              <th className="py-2.5 px-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {vGroup.items.map((item, itemIdx) => (
                              <tr key={itemIdx} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="py-2 px-3 font-mono font-bold text-blue-600">
                                  {item.poNumber}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-900 max-w-xs truncate" title={item.itemDescription}>
                                  {item.itemDescription}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900">
                                  {item.poQuantity} {item.unitOfMeasure}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold text-indigo-700">
                                  {item.deliveredQuantity} {item.unitOfMeasure}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                  {item.invoicedQuantity} {item.unitOfMeasure}
                                </td>
                                <td className="py-2 px-3 text-right font-bold">
                                  {item.unmatchedQty > 0 ? (
                                    <span className="text-amber-700">{item.unmatchedQty} {item.unitOfMeasure}</span>
                                  ) : (
                                    <span className="text-emerald-700">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {item.status === 'FULLY_MATCHED' ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Matched
                                    </span>
                                  ) : item.status === 'PARTIALLY_MATCHED' ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                      Partial
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                      Unmatched
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => {
                                        onSelectPOForInvoice(item.poNumber);
                                        onNavigate('create_invoice');
                                      }}
                                      className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                                    >
                                      Invoice
                                    </button>
                                    <button
                                      onClick={() => setSelectedDrilldownItem(item)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium cursor-pointer"
                                    >
                                      Drilldown
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* =====================================================================
            VIEW MODE 3: ALL LINE ITEMS (FLAT LIST)
            ===================================================================== */}
        {groupingMode === 'ITEMS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">PO & Vendor</th>
                  <th className="py-3 px-3">Item Description</th>
                  <th className="py-3 px-3 text-right">PO Ordered</th>
                  <th className="py-3 px-3 text-right">Delivered (DN)</th>
                  <th className="py-3 px-3 text-right">Invoiced Qty</th>
                  <th className="py-3 px-3 text-right">Un-invoiced</th>
                  <th className="py-3 px-3 text-right">Undelivered</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredMatchingData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                      No line items matching search and status filter.
                    </td>
                  </tr>
                ) : (
                  filteredMatchingData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-blue-700 font-mono block">{item.poNumber}</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[140px] block">{item.customerName}</span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[220px] truncate" title={item.itemDescription}>
                        {item.itemDescription}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {item.poQuantity} {item.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-indigo-700">
                        {item.deliveredQuantity} {item.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {item.invoicedQuantity} {item.unitOfMeasure}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        {item.unmatchedQty > 0 ? (
                          <span className="text-amber-700">{item.unmatchedQty} {item.unitOfMeasure}</span>
                        ) : (
                          <span className="text-emerald-700">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">
                        {item.undeliveredQty > 0 ? (
                          <span className="text-red-600">{item.undeliveredQty} {item.unitOfMeasure}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.status === 'FULLY_MATCHED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Matched
                          </span>
                        ) : item.status === 'PARTIALLY_MATCHED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Partial
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Unmatched
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {item.unmatchedQty > 0 && (
                            <button
                              onClick={() => {
                                onSelectPOForInvoice(item.poNumber);
                                onNavigate('create_invoice');
                              }}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                              title="Create Invoice"
                            >
                              Invoice
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedDrilldownItem(item)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium cursor-pointer"
                          >
                            Drilldown
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          UNDELIVERED ITEMS & UNMATCHED ITEMS LIST PREVIEWS
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Undelivered Items by PO & Vendor */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              <h2 className="font-bold text-sm text-slate-900">Undelivered Items by Vendor & PO</h2>
            </div>
            <button
              onClick={() => onNavigate('matching_report', 'UNDELIVERED')}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
            >
              View All ({undeliveredItems.length})
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {undeliveredItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                All ordered items have been delivered via Delivery Notes!
              </div>
            ) : (
              undeliveredItems.slice(0, 5).map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate" title={item.itemDescription}>
                      {item.itemDescription}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <span className="font-mono text-blue-600 font-semibold">{item.poNumber}</span> • {item.customerName}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <span className="font-bold text-red-600 font-mono">
                        {item.undeliveredQty} {item.unitOfMeasure}
                      </span>
                      <span className="block text-[10px] text-slate-400">Undelivered</span>
                    </div>
                    <button
                      onClick={() => onNavigate('delivery_notes')}
                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                      title="Receive Delivery"
                    >
                      + DN
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unmatched Items on PO & Invoiced */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="font-bold text-sm text-slate-900">Unmatched / Un-invoiced PO Balances</h2>
            </div>
            <button
              onClick={() => onNavigate('matching_report', 'UNMATCHED')}
              className="text-xs text-amber-600 hover:text-amber-700 font-semibold cursor-pointer"
            >
              View All ({unmatchedItems.length})
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {unmatchedItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                All PO items have been completely matched and invoiced!
              </div>
            ) : (
              unmatchedItems.slice(0, 5).map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate" title={item.itemDescription}>
                      {item.itemDescription}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      <span className="font-mono text-blue-600 font-semibold">{item.poNumber}</span> • {item.customerName}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <span className="font-bold text-amber-700 font-mono">
                        {item.unmatchedQty} {item.unitOfMeasure}
                      </span>
                      <span className="block text-[10px] text-slate-400">Uninvoiced</span>
                    </div>
                    <button
                      onClick={() => {
                        onSelectPOForInvoice(item.poNumber);
                        onNavigate('create_invoice');
                      }}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold cursor-pointer"
                    >
                      Invoice
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          DRILLDOWN MODAL FOR DETAILED 3-WAY RECONCILIATION
          ========================================================================= */}
      {selectedDrilldownItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-400 bg-blue-950 px-2.5 py-0.5 rounded border border-blue-800 text-xs">
                    PO #{selectedDrilldownItem.poNumber}
                  </span>
                  <span className="font-bold text-base">{selectedDrilldownItem.customerName}</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 truncate max-w-md">
                  {selectedDrilldownItem.itemDescription}
                </p>
              </div>
              <button
                onClick={() => setSelectedDrilldownItem(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
              {/* 3-Way Reconciliation Comparison Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="text-[10px] font-bold text-blue-600 uppercase">1. Purchase Order</div>
                  <div className="text-xl font-bold text-blue-900 mt-1 font-mono">
                    {selectedDrilldownItem.poQuantity} <span className="text-xs font-normal">{selectedDrilldownItem.unitOfMeasure}</span>
                  </div>
                  <div className="text-[11px] text-blue-700 mt-1">
                    TZS {formatCurrency(selectedDrilldownItem.poTotalValue)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div className="text-[10px] font-bold text-indigo-600 uppercase">2. Delivered (DN)</div>
                  <div className="text-xl font-bold text-indigo-900 mt-1 font-mono">
                    {selectedDrilldownItem.deliveredQuantity} <span className="text-xs font-normal">{selectedDrilldownItem.unitOfMeasure}</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 mt-1">
                    TZS {formatCurrency(selectedDrilldownItem.deliveredValue)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">3. Invoiced Billed</div>
                  <div className="text-xl font-bold text-emerald-900 mt-1 font-mono">
                    {selectedDrilldownItem.invoicedQuantity} <span className="text-xs font-normal">{selectedDrilldownItem.unitOfMeasure}</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1">
                    TZS {formatCurrency(selectedDrilldownItem.invoicedValue)}
                  </div>
                </div>
              </div>

              {/* Variance & Status */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">Matching Breakdown & Variances:</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500">Un-invoiced Balance (PO vs Invoice):</span>
                    <div className="font-bold font-mono text-sm mt-0.5">
                      {selectedDrilldownItem.unmatchedQty > 0 ? (
                        <span className="text-amber-700">{selectedDrilldownItem.unmatchedQty} {selectedDrilldownItem.unitOfMeasure} pending invoice</span>
                      ) : (
                        <span className="text-emerald-700">0 (Fully Invoiced)</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Undelivered Balance (PO vs Delivery):</span>
                    <div className="font-bold font-mono text-sm mt-0.5">
                      {selectedDrilldownItem.undeliveredQty > 0 ? (
                        <span className="text-red-600">{selectedDrilldownItem.undeliveredQty} {selectedDrilldownItem.unitOfMeasure} pending receipt</span>
                      ) : (
                        <span className="text-emerald-700">0 (Fully Delivered)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked References */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800">Linked Documents:</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <span className="text-[11px] text-slate-500 font-semibold block">Delivery Notes:</span>
                    {selectedDrilldownItem.deliveryNoteNumbers.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedDrilldownItem.deliveryNoteNumbers.map((dn, i) => (
                          <span key={i} className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-bold">
                            {dn}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic mt-1 block">No delivery notes recorded</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <span className="text-[11px] text-slate-500 font-semibold block">Issued Invoices:</span>
                    {selectedDrilldownItem.invoiceNumbers.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedDrilldownItem.invoiceNumbers.map((inv, i) => (
                          <span key={i} className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                            {inv}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic mt-1 block">No invoices issued yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              {selectedDrilldownItem.unmatchedQty > 0 && (
                <button
                  onClick={() => {
                    const po = selectedDrilldownItem.poNumber;
                    setSelectedDrilldownItem(null);
                    onSelectPOForInvoice(po);
                    onNavigate('create_invoice');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Create Invoice for PO #{selectedDrilldownItem.poNumber}
                </button>
              )}
              <button
                onClick={() => setSelectedDrilldownItem(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

