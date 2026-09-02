import React, { useState, useMemo } from 'react';
import { InvoiceRecord } from '../types';
import { formatCurrency } from '../utils/storage';
import { exportInvoicesToExcel } from '../utils/excelParser';
import { 
  Database, 
  Search, 
  Printer, 
  Trash2, 
  Download, 
  Receipt, 
  FileText, 
  Calendar, 
  Building2, 
  ArrowUpRight,
  Plus
} from 'lucide-react';

interface InvoiceHistoryProps {
  invoices: InvoiceRecord[];
  onViewInvoicePrint: (invoice: InvoiceRecord) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onNavigateToCreateInvoice: () => void;
}

export const InvoiceHistory: React.FC<InvoiceHistoryProps> = ({
  invoices,
  onViewInvoicePrint,
  onDeleteInvoice,
  onNavigateToCreateInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

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
        inv.contract.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCustomer = selectedCustomer === 'ALL' || inv.customerName === selectedCustomer;

      return matchesSearch && matchesCustomer;
    });
  }, [invoices, searchTerm, selectedCustomer]);

  // Summary totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let vat = 0;
    let grandTotal = 0;
    let totalLineItems = 0;

    filteredInvoices.forEach((inv) => {
      subtotal += inv.subtotalBeforeVat;
      vat += inv.totalVat;
      grandTotal += inv.totalAfterVat;
      totalLineItems += inv.lines.length;
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      totalLineItems,
    };
  }, [filteredInvoices]);

  const handleDeleteConfirm = (inv: InvoiceRecord) => {
    if (
      window.confirm(
        `Are you sure you want to delete Invoice "${inv.invoiceNumber}"? This will return the billed quantities back to PO "${inv.poNumber}" balance.`
      )
    ) {
      onDeleteInvoice(inv.id);
      if (selectedInvoice?.id === inv.id) {
        setSelectedInvoice(null);
      }
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
            Historical repository of all invoices generated against Purchase Orders with full line reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportInvoicesToExcel(filteredInvoices)}
            disabled={filteredInvoices.length === 0}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export Invoices Excel
          </button>

          <button
            onClick={onNavigateToCreateInvoice}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Invoices Issued</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{filteredInvoices.length}</div>
          <span className="text-[10px] text-slate-400">{totals.totalLineItems} Total billed lines</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Billed Excl. VAT</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">${formatCurrency(totals.subtotal)}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total VAT Collected</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">${formatCurrency(totals.vat)}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50/60 to-white">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase">Total Billed (Incl. VAT)</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">${formatCurrency(totals.grandTotal)}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice number, PO number, customer, destination..."
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
                <th className="py-3 px-3">Linked PO Number</th>
                <th className="py-3 px-3">Customer Name</th>
                <th className="py-3 px-3">Destination</th>
                <th className="py-3 px-3">Contract</th>
                <th className="py-3 px-3 text-center">Lines</th>
                <th className="py-3 px-3 text-right">Subtotal</th>
                <th className="py-3 px-3 text-right">VAT (18%)</th>
                <th className="py-3 px-3 text-right font-bold">Total (Incl. VAT)</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    No invoices recorded in the database yet. Click "New Invoice" to issue an invoice.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                    <td className="py-3 px-3 font-bold font-mono text-blue-700 text-sm">{inv.invoiceNumber}</td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{inv.invoiceDate}</td>
                    <td className="py-3 px-3 font-bold font-mono text-slate-900">{inv.poNumber}</td>
                    <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">{inv.customerName}</td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{inv.destination}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{inv.contract}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {inv.lines.length} lines
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">${formatCurrency(inv.subtotalBeforeVat)}</td>
                    <td className="py-3 px-3 text-right text-slate-500">${formatCurrency(inv.totalVat)}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700 text-sm">
                      ${formatCurrency(inv.totalAfterVat)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewInvoicePrint(inv)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          title="Print / View Invoice Document"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteConfirm(inv)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Delete/Void Invoice (Restores PO Available Quantity)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
