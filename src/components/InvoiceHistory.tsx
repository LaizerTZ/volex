import React, { useState, useMemo } from 'react';
import { InvoiceRecord, AppUser, DocumentIssueRecord } from '../types';
import { formatCurrency } from '../utils/storage';
import { exportInvoicesToExcel } from '../utils/excelParser';
import { canEditScreen, isAdminUser, canLoadDatabase, canExportDatabase } from '../utils/authService';
import { 
  Database, 
  Search, 
  Printer, 
  Trash2, 
  Download, 
  Upload,
  Receipt, 
  FileText, 
  Calendar, 
  Building2, 
  ArrowUpRight,
  Plus,
  Edit3,
  Ban,
  MessageSquare,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { InvoiceDatabaseImportModal } from './InvoiceDatabaseImportModal';

interface InvoiceHistoryProps {
  invoices?: InvoiceRecord[];
  issues?: DocumentIssueRecord[];
  onViewInvoicePrint?: (invoice: InvoiceRecord) => void;
  onPrintInvoice?: (invoice: InvoiceRecord) => void; // alias fallback
  onDeleteInvoice: (invoiceId: string) => void;
  onNavigateToCreateInvoice?: () => void;
  onCreateNewInvoice?: () => void; // alias fallback
  onReloadInvoice?: (invoice: InvoiceRecord) => void;
  onFlagIssue?: (invoice: InvoiceRecord) => void;
  onViewIssuesTab?: () => void;
  onImportInvoices?: (invoices: InvoiceRecord[], mode: 'append' | 'replace') => void;
  currentUser?: AppUser;
}

export const InvoiceHistory: React.FC<InvoiceHistoryProps> = ({
  invoices = [],
  issues = [],
  onViewInvoicePrint,
  onPrintInvoice,
  onDeleteInvoice,
  onNavigateToCreateInvoice,
  onCreateNewInvoice,
  onReloadInvoice,
  onFlagIssue,
  onViewIssuesTab,
  onImportInvoices,
  currentUser,
}) => {
  const handlePrint = onViewInvoicePrint || onPrintInvoice || (() => {});
  const handleNewInvoice = onNavigateToCreateInvoice || onCreateNewInvoice || (() => {});
  const isAdmin = isAdminUser(currentUser);
  const canEdit = canEditScreen(currentUser, 'invoices_db');
  const canCreate = canEditScreen(currentUser, 'create_invoice');
  const canLoadDB = canLoadDatabase(currentUser);
  const canExportDB = canExportDatabase(currentUser);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Unique customers from invoices
  const customers = useMemo(() => {
    const list = Array.from(new Set(invoices.map((inv) => inv.customerName))).filter(Boolean);
    return list.sort();
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        searchTerm === '' ||
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.contract.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.comment && inv.comment.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCustomer = selectedCustomer === 'ALL' || inv.customerName === selectedCustomer;
      const matchesStatus = 
        selectedStatus === 'ALL' ||
        (selectedStatus === 'CANCELLED' && (inv.isCancelled || inv.status === 'CANCELLED')) ||
        (selectedStatus === 'ACTIVE' && !inv.isCancelled && inv.status !== 'CANCELLED');

      return matchesSearch && matchesCustomer && matchesStatus;
    });
  }, [invoices, searchTerm, selectedCustomer, selectedStatus]);

  // Summary totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let vat = 0;
    let grandTotal = 0;
    let totalLineItems = 0;
    let cancelledCount = 0;

    filteredInvoices.forEach((inv) => {
      if (inv.isCancelled || inv.status === 'CANCELLED') {
        cancelledCount += 1;
        return;
      }
      subtotal += inv.subtotalBeforeVat || 0;
      vat += inv.totalVat || 0;
      grandTotal += inv.totalAfterVat || 0;
      totalLineItems += inv.lines?.length || 0;
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      totalLineItems,
      cancelledCount,
    };
  }, [filteredInvoices]);

  const handleDeleteConfirm = (inv: InvoiceRecord) => {
    if (
      window.confirm(
        `Are you sure you want to delete Invoice "${inv.invoiceNumber}"? This will return the billed quantities back to PO "${inv.poNumber}" balance.`
      )
    ) {
      onDeleteInvoice(inv.id);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top summary header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Invoiced PO Database
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete historical registry of invoices, serial numbers, customer books, and line item billing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onImportInvoices && canLoadDB && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Admin Only: Load existing invoice database (.xlsx, .csv) with field mapping & extract template"
            >
              <Upload className="w-3.5 h-3.5" />
              Load Existing Database
            </button>
          )}

          {canExportDB && (
            <button
              onClick={() => exportInvoicesToExcel(filteredInvoices)}
              disabled={filteredInvoices.length === 0}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Admin Only: Export Invoices to Excel"
            >
              <Download className="w-3.5 h-3.5" />
              Export Invoices Excel
            </button>
          )}

          {canCreate && (
            <button
              onClick={handleNewInvoice}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Invoice
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Invoices Registered</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{filteredInvoices.length}</div>
          <span className="text-[10px] text-slate-400">
            {totals.cancelledCount > 0 ? `${totals.cancelledCount} Cancelled / Void` : `${totals.totalLineItems} Billed Lines`}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Billed Excl. VAT</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">TZS {formatCurrency(totals.subtotal)}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total VAT Collected</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">TZS {formatCurrency(totals.vat)}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50/60 to-white">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase">Total Billed (Incl. VAT)</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">TZS {formatCurrency(totals.grandTotal)}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice number, PO number, customer, comments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="ALL">All Customers ({customers.length})</option>
          {customers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Invoices</option>
          <option value="CANCELLED">Cancelled / No PO Ref</option>
        </select>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800 text-white sticky top-0 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Invoice Number</th>
                <th className="py-3 px-3">Invoice Date</th>
                <th className="py-3 px-3">Linked PO</th>
                <th className="py-3 px-3">Customer Name</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 min-w-[140px]">Comment</th>
                <th className="py-3 px-3 text-center">Lines</th>
                <th className="py-3 px-3 text-right">Subtotal (TZS)</th>
                <th className="py-3 px-3 text-right font-bold">Total (TZS)</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No invoices found matching your search. Click "New Invoice" to create one.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, idx) => {
                  const isCancelled = inv.isCancelled || inv.status === 'CANCELLED';

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        isCancelled ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold font-mono text-blue-700 text-sm">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{inv.invoiceDate}</td>
                      <td className="py-3 px-3 font-bold font-mono text-slate-900">
                        {inv.poNumber}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {inv.customerName}
                      </td>
                      <td className="py-3 px-3">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 inline-flex items-center gap-1">
                            <Ban className="w-3 h-3" /> CANCELLED
                          </span>
                        ) : (() => {
                          const activeIssue = issues.find(
                            (i) => (i.entityId === inv.id || i.referenceNumber === inv.invoiceNumber) && i.status !== 'RESOLVED'
                          );
                          if (activeIssue) {
                            return (
                              <button
                                type="button"
                                onClick={() => onViewIssuesTab?.()}
                                className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                                title={`Flagged Issue: ${activeIssue.issueType}. Click to open Issue Resolution Hub.`}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                {activeIssue.status === 'UNDER_REVIEW' ? 'UNDER REVIEW' : 'ISSUE FLAGGED'}
                              </button>
                            );
                          }
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              ACTIVE
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <span className="font-medium text-xs">
                          {inv.comment || (isCancelled ? 'Cancelled - No PO reference' : 'Okay')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {inv.lines?.length || 0}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        TZS {formatCurrency(inv.subtotalBeforeVat || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 text-sm">
                        TZS {formatCurrency(inv.totalAfterVat || 0)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Flag Issue button */}
                          {onFlagIssue && !isCancelled && (
                            <button
                              onClick={() => onFlagIssue(inv)}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                              title="Flag / Report Discrepancy on this Invoice"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Reload & Edit button (Admin only) */}
                          {onReloadInvoice && isAdmin && (
                            <button
                              onClick={() => onReloadInvoice(inv)}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                              title="Admin: Reload invoice to correct and save again"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {!isCancelled && (
                            <button
                              onClick={() => handlePrint(inv)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              title="Print / View Invoice Document"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => handleDeleteConfirm(inv)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Delete/Void Invoice (Restores PO Available Quantity)"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Invoice Database Import Modal */}
      {isImportModalOpen && onImportInvoices && (
        <InvoiceDatabaseImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          existingInvoices={invoices}
          onImportInvoices={(imported, mode) => {
            const normalizedMode = (String(mode).toLowerCase() === 'replace' ? 'replace' : 'append');
            onImportInvoices(imported, normalizedMode);
            setIsImportModalOpen(false);
          }}
          onImport={(imported, mode) => {
            const normalizedMode = (String(mode).toLowerCase() === 'replace' ? 'replace' : 'append');
            onImportInvoices(imported, normalizedMode);
            setIsImportModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
