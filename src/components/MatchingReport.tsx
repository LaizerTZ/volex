import React, { useState, useMemo } from 'react';
import { 
  POLineItem, 
  DeliveryNoteRecord, 
  InvoiceRecord, 
  PurchaseOrderGroup,
  MatchingItem 
} from '../types';
import { generateMatchingReport, formatCurrency } from '../utils/storage';
import * as XLSX from 'xlsx';
import { 
  GitCompare, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Truck, 
  Receipt, 
  ChevronRight, 
  Eye, 
  X, 
  Building2, 
  Package, 
  FileSpreadsheet,
  ArrowUpDown,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface MatchingReportProps {
  poLines: POLineItem[];
  deliveryNotes: DeliveryNoteRecord[];
  invoices: InvoiceRecord[];
  poGroups?: PurchaseOrderGroup[];
  initialFilter?: 'ALL' | 'UNMATCHED' | 'UNDELIVERED' | 'MATCHED';
  onSelectPOForInvoice?: (poNumber: string) => void;
  onNavigateToInvoice?: () => void;
  onOpenAutoReport?: () => void;
}

export const MatchingReport: React.FC<MatchingReportProps> = ({
  poLines,
  deliveryNotes,
  invoices,
  poGroups = [],
  initialFilter = 'ALL',
  onSelectPOForInvoice,
  onNavigateToInvoice,
  onOpenAutoReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFilter);
  const [drilldownItem, setDrilldownItem] = useState<MatchingItem | null>(null);

  // Generate full matching dataset
  const matchingData = useMemo(() => {
    return generateMatchingReport(poLines, deliveryNotes, invoices);
  }, [poLines, deliveryNotes, invoices]);

  // Unique vendors / customers
  const vendors = useMemo(() => {
    const set = new Set<string>();
    matchingData.forEach((m) => set.add(m.customerName));
    return Array.from(set).sort();
  }, [matchingData]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return matchingData.filter((item) => {
      const matchSearch =
        item.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contract.toLowerCase().includes(searchTerm.toLowerCase());

      const matchVendor = selectedVendor === 'ALL' || item.customerName === selectedVendor;

      let matchStatus = true;
      if (selectedStatus === 'MATCHED') {
        matchStatus = item.status === 'FULLY_MATCHED';
      } else if (selectedStatus === 'UNMATCHED') {
        // Items with remaining un-invoiced quantity
        matchStatus = item.unmatchedQty > 0;
      } else if (selectedStatus === 'UNDELIVERED') {
        // Items with remaining undelivered quantity
        matchStatus = item.undeliveredQty > 0;
      } else if (selectedStatus === 'PARTIAL') {
        matchStatus = item.status === 'PARTIALLY_MATCHED';
      }

      return matchSearch && matchVendor && matchStatus;
    });
  }, [matchingData, searchTerm, selectedVendor, selectedStatus]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalPoQty = 0;
    let totalPoVal = 0;
    let totalDeliveredQty = 0;
    let totalDeliveredVal = 0;
    let totalInvoicedQty = 0;
    let totalInvoicedVal = 0;
    let totalUnmatchedQty = 0;
    let totalUndeliveredQty = 0;

    matchingData.forEach((m) => {
      totalPoQty += m.poQuantity;
      totalPoVal += m.poTotalValue;
      totalDeliveredQty += m.deliveredQuantity;
      totalDeliveredVal += m.deliveredValue;
      totalInvoicedQty += m.invoicedQuantity;
      totalInvoicedVal += m.invoicedValue;
      totalUnmatchedQty += m.unmatchedQty;
      totalUndeliveredQty += m.undeliveredQty;
    });

    return {
      totalPoQty,
      totalPoVal,
      totalDeliveredQty,
      totalDeliveredVal,
      totalInvoicedQty,
      totalInvoicedVal,
      totalUnmatchedQty,
      totalUndeliveredQty,
      matchRate: totalPoQty > 0 ? Math.round((totalInvoicedQty / totalPoQty) * 100) : 0,
      deliveryRate: totalPoQty > 0 ? Math.round((totalDeliveredQty / totalPoQty) * 100) : 0,
    };
  }, [matchingData]);

  // Export report to Excel
  const handleExportExcel = () => {
    const exportRows = filteredItems.map((item, idx) => ({
      '#': idx + 1,
      'PO Number': item.poNumber,
      'Vendor / Customer': item.customerName,
      'Contract Ref': item.contract,
      'Destination Site': item.destination,
      'PO Date': item.poDate,
      'Item Description': item.itemDescription,
      'Unit of Measure': item.unitOfMeasure,
      'PO Ordered Qty': item.poQuantity,
      'PO Unit Price': item.poUnitPrice,
      'PO Total Value (Incl. VAT)': item.poTotalValue,
      'Delivered Qty (Received)': item.deliveredQuantity,
      'Delivered Value': item.deliveredValue,
      'Invoiced Qty': item.invoicedQuantity,
      'Invoiced Value': item.invoicedValue,
      'Un-invoiced Qty (Unmatched)': item.unmatchedQty,
      'Undelivered Qty': item.undeliveredQty,
      'Delivery vs Invoice Variance': item.receivedVsInvoicedVarianceQty,
      'Matching Status': item.status,
      'Delivery Notes': item.deliveryNoteNumbers.join(', ') || 'None',
      'Invoices Issued': item.invoiceNumbers.join(', ') || 'None',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PO_Invoice_Matching_Report');
    XLSX.writeFile(workbook, `PO_Invoice_Matching_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">PO vs Invoice vs Delivery Matching Report</h1>
              <p className="text-slate-400 text-xs mt-0.5">
                Item-by-item quantity & value reconciliation across Purchase Orders, Deliveries (Received), and Invoices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {onOpenAutoReport && (
            <button
              onClick={onOpenAutoReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              AI Audit Report
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Matching Excel
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total PO Ordered */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>PO Ordered Total</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">
              {stats.totalPoQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">Units</span>
            </div>
            <div className="text-xs text-slate-600 mt-1 font-medium">
              Value: <span className="font-bold text-slate-800">TZS {formatCurrency(stats.totalPoVal)}</span>
            </div>
          </div>
        </div>

        {/* Received / Delivered */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Delivered / Received</span>
            <Truck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-indigo-700">
              {stats.totalDeliveredQty.toLocaleString()} <span className="text-xs font-normal text-indigo-500">Units</span>
            </div>
            <div className="text-xs text-slate-600 mt-1 flex justify-between">
              <span>Val: TZS {formatCurrency(stats.totalDeliveredVal)}</span>
              <span className="font-bold text-indigo-600">{stats.deliveryRate}% Received</span>
            </div>
          </div>
        </div>

        {/* Invoiced Quantity */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Invoiced Quantity</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-700">
              {stats.totalInvoicedQty.toLocaleString()} <span className="text-xs font-normal text-emerald-500">Units</span>
            </div>
            <div className="text-xs text-slate-600 mt-1 flex justify-between">
              <span>Val: TZS {formatCurrency(stats.totalInvoicedVal)}</span>
              <span className="font-bold text-emerald-600">{stats.matchRate}% Invoiced</span>
            </div>
          </div>
        </div>

        {/* Unmatched / Undelivered */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Unmatched / Undelivered</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-700">
              {stats.totalUnmatchedQty.toLocaleString()} <span className="text-xs font-normal text-amber-600">Uninvoiced</span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Undelivered: <span className="font-semibold text-slate-800">{stats.totalUndeliveredQty.toLocaleString()} units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO #, vendor, item name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          {/* Vendor Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 font-medium">Vendor:</span>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Vendors ({vendors.length})</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Status Tabs */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                selectedStatus === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Items ({matchingData.length})
            </button>
            <button
              onClick={() => setSelectedStatus('UNMATCHED')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                selectedStatus === 'UNMATCHED' ? 'bg-white text-amber-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unmatched Invoices ({matchingData.filter((i) => i.unmatchedQty > 0).length})
            </button>
            <button
              onClick={() => setSelectedStatus('UNDELIVERED')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                selectedStatus === 'UNDELIVERED' ? 'bg-white text-indigo-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Undelivered ({matchingData.filter((i) => i.undeliveredQty > 0).length})
            </button>
            <button
              onClick={() => setSelectedStatus('MATCHED')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                selectedStatus === 'MATCHED' ? 'bg-white text-emerald-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fully Matched ({matchingData.filter((i) => i.status === 'FULLY_MATCHED').length})
            </button>
          </div>
        </div>
      </div>

      {/* Matching Items Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">PO Items vs Invoice & Delivery Line Details</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {filteredItems.length} Records
            </span>
          </div>
          <span className="text-xs text-slate-400">Click any row to drill down into order documents & variance</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-3">PO & Vendor</th>
                <th className="py-3 px-3">Item Description</th>
                <th className="py-3 px-2 text-center">UOM</th>
                <th className="py-3 px-3 text-right">PO Qty</th>
                <th className="py-3 px-3 text-right">Delivered (DN)</th>
                <th className="py-3 px-3 text-right">Invoiced Qty</th>
                <th className="py-3 px-3 text-right">Un-Invoiced (Unmatch)</th>
                <th className="py-3 px-3 text-right">Undelivered</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No line items found matching your current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isFullyInvoiced = item.status === 'FULLY_MATCHED';
                  const isPartial = item.status === 'PARTIALLY_MATCHED';

                  return (
                    <tr
                      key={item.poLineId || idx}
                      onClick={() => setDrilldownItem(item)}
                      className="hover:bg-blue-50/60 transition-colors cursor-pointer group"
                    >
                      {/* PO & Vendor */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.poNumber}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]" title={item.customerName}>
                          {item.customerName}
                        </div>
                        <div className="text-[10px] text-slate-400">{item.poDate}</div>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 max-w-[260px] line-clamp-2" title={item.itemDescription}>
                          {item.itemDescription}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Unit: TZS {formatCurrency(item.poUnitPrice)} • Dest: {item.destination}
                        </div>
                      </td>

                      {/* UOM */}
                      <td className="py-3 px-2 text-center font-mono text-slate-600">
                        {item.unitOfMeasure}
                      </td>

                      {/* PO Ordered Qty */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {item.poQuantity.toLocaleString()}
                        <div className="text-[10px] text-slate-400">TZS {formatCurrency(item.poTotalValue)}</div>
                      </td>

                      {/* Delivered Qty */}
                      <td className="py-3 px-3 text-right font-semibold text-indigo-700">
                        {item.deliveredQuantity.toLocaleString()}
                        <div className="text-[10px] text-indigo-500">TZS {formatCurrency(item.deliveredValue)}</div>
                      </td>

                      {/* Invoiced Qty */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-700">
                        {item.invoicedQuantity.toLocaleString()}
                        <div className="text-[10px] text-emerald-600">TZS {formatCurrency(item.invoicedValue)}</div>
                      </td>

                      {/* Unmatched / Uninvoiced Qty */}
                      <td className="py-3 px-3 text-right font-bold">
                        {item.unmatchedQty > 0 ? (
                          <span className="text-amber-700">{item.unmatchedQty.toLocaleString()}</span>
                        ) : (
                          <span className="text-emerald-700">0</span>
                        )}
                      </td>

                      {/* Undelivered Qty */}
                      <td className="py-3 px-3 text-right font-semibold">
                        {item.undeliveredQty > 0 ? (
                          <span className="text-red-700">{item.undeliveredQty.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {isFullyInvoiced && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Fully Matched
                          </span>
                        )}
                        {isPartial && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> Partial
                          </span>
                        )}
                        {!isFullyInvoiced && !isPartial && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                            <AlertCircle className="w-3 h-3" /> Unmatched
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setDrilldownItem(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            title="Drill down item details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {item.unmatchedQty > 0 && (
                            <button
                              onClick={() => {
                                onSelectPOForInvoice(item.poNumber);
                                onNavigateToInvoice();
                              }}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
                              title="Create Invoice for remaining balance"
                            >
                              Invoice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down Modal for Item Matching Details */}
      {drilldownItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <GitCompare className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-base">Item Matching & 3-Way Audit Trail</h3>
                  <p className="text-xs text-slate-400 font-mono">PO: {drilldownItem.poNumber} • {drilldownItem.contract}</p>
                </div>
              </div>
              <button
                onClick={() => setDrilldownItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 text-xs text-slate-700">
              {/* Item Master Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="text-sm font-bold text-slate-900">{drilldownItem.itemDescription}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Vendor / Client</span>
                    <span className="font-medium text-slate-800">{drilldownItem.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Destination</span>
                    <span className="font-medium text-slate-800">{drilldownItem.destination}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Unit Price</span>
                    <span className="font-medium text-slate-800">TZS {formatCurrency(drilldownItem.poUnitPrice)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">UOM</span>
                    <span className="font-mono font-bold text-slate-800">{drilldownItem.unitOfMeasure}</span>
                  </div>
                </div>
              </div>

              {/* 3-Way Reconciliation Comparison Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                {/* PO Ordered */}
                <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200/80">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">1. PO Ordered</span>
                  <div className="text-xl font-bold text-blue-900 mt-1">
                    {drilldownItem.poQuantity} <span className="text-xs font-normal text-blue-700">{drilldownItem.unitOfMeasure}</span>
                  </div>
                  <div className="text-[11px] text-blue-700 mt-0.5 font-medium">TZS {formatCurrency(drilldownItem.poTotalValue)}</div>
                </div>

                {/* Received / Delivered */}
                <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200/80">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">2. Received (DN)</span>
                  <div className="text-xl font-bold text-indigo-900 mt-1">
                    {drilldownItem.deliveredQuantity} <span className="text-xs font-normal text-indigo-700">{drilldownItem.unitOfMeasure}</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 mt-0.5 font-medium">TZS {formatCurrency(drilldownItem.deliveredValue)}</div>
                </div>

                {/* Invoiced */}
                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">3. Invoiced Billed</span>
                  <div className="text-xl font-bold text-emerald-900 mt-1">
                    {drilldownItem.invoicedQuantity} <span className="text-xs font-normal text-emerald-700">{drilldownItem.unitOfMeasure}</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">TZS {formatCurrency(drilldownItem.invoicedValue)}</div>
                </div>
              </div>

              {/* Variances & Unmatched Breakdown */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                  Variance & Audit Checks
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-amber-900 block">Uninvoiced Balance (Unmatched):</span>
                      <span className="text-[11px] text-amber-700">Remaining to be billed</span>
                    </div>
                    <span className="text-base font-bold text-amber-900 font-mono">
                      {drilldownItem.unmatchedQty} {drilldownItem.unitOfMeasure}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Undelivered Balance:</span>
                      <span className="text-[11px] text-slate-500">Physical receipt pending</span>
                    </div>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {drilldownItem.undeliveredQty} {drilldownItem.unitOfMeasure}
                    </span>
                  </div>
                </div>
              </div>

              {/* Linked Documents (Delivery Notes & Invoices) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Linked Delivery Notes */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Linked Delivery Notes ({drilldownItem.deliveryNoteNumbers.length})</span>
                  </div>
                  {drilldownItem.deliveryNoteNumbers.length === 0 ? (
                    <div className="text-slate-400 text-[11px]">No delivery note recorded for this item yet.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {drilldownItem.deliveryNoteNumbers.map((dn) => (
                        <span key={dn} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-semibold text-[11px] border border-indigo-200">
                          {dn}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linked Invoices */}
                <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Linked Invoices Issued ({drilldownItem.invoiceNumbers.length})</span>
                  </div>
                  {drilldownItem.invoiceNumbers.length === 0 ? (
                    <div className="text-slate-400 text-[11px]">No invoice issued for this item yet.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {drilldownItem.invoiceNumbers.map((inv) => (
                        <span key={inv} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-semibold text-[11px] border border-emerald-200">
                          {inv}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setDrilldownItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                {drilldownItem.unmatchedQty > 0 && (
                  <button
                    onClick={() => {
                      onSelectPOForInvoice(drilldownItem.poNumber);
                      setDrilldownItem(null);
                      onNavigateToInvoice();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    Create Invoice for This PO
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
