import React, { useState, useMemo } from 'react';
import { 
  PaymentRecord, 
  InvoiceRecord, 
  PaymentAllocationItem, 
  PurchaseOrderGroup 
} from '../types';
import { formatCurrency } from '../utils/storage';
import * as XLSX from 'xlsx';
import { 
  CreditCard, 
  Building2, 
  Search, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  Printer, 
  Download, 
  PlusCircle, 
  Layers, 
  Sparkles, 
  FileText,
  Save,
  RotateCcw
} from 'lucide-react';
import { PaymentReceiptModal } from './PaymentReceiptModal';

interface PaymentsManagerProps {
  payments: PaymentRecord[];
  invoices: InvoiceRecord[];
  poGroups: PurchaseOrderGroup[];
  onSavePayment: (payment: PaymentRecord, updatedInvoices: InvoiceRecord[]) => void;
}

export const PaymentsManager: React.FC<PaymentsManagerProps> = ({
  payments,
  invoices,
  poGroups,
  onSavePayment,
}) => {
  const [viewMode, setViewMode] = useState<'record' | 'ledger'>('record');

  // Customer selection
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');

  // Payment inputs
  const [totalAmountPaid, setTotalAmountPaid] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>(`TXN-${Date.now().toString().slice(-6)}`);
  const [depositAccount, setDepositAccount] = useState<string>('CRDB Corporate Account - 0150244900');
  const [notes, setNotes] = useState<string>('');

  // Allocation mapping: invoiceId -> allocated amount
  const [allocations, setAllocations] = useState<{ [invoiceId: string]: number }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPayment, setSuccessPayment] = useState<PaymentRecord | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Printing modal
  const [printingPayment, setPrintingPayment] = useState<PaymentRecord | null>(null);

  // Ledger search
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Unique customers who have invoices
  const customerList = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.customerName) set.add(inv.customerName);
    });
    return Array.from(set).sort();
  }, [invoices]);

  // Invoices for selected customer with pending balance calculation
  const customerPendingInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return invoices.filter((inv) => inv.customerName === selectedCustomer);
  }, [invoices, selectedCustomer]);

  // Handle selecting a customer
  const handleSelectCustomer = (customer: string) => {
    setSelectedCustomer(customer);
    setAllocations({});
    setErrorMessage(null);
    setSuccessPayment(null);
  };

  // Auto-allocate entered totalAmountPaid across pending invoices (oldest to newest)
  const handleAutoAllocate = () => {
    const rawTotal = parseFloat(totalAmountPaid);
    if (isNaN(rawTotal) || rawTotal <= 0) {
      setErrorMessage('Please enter a valid Total Amount Paid before auto-allocating.');
      return;
    }

    setErrorMessage(null);
    let remainingToAllocate = rawTotal;
    const newAllocations: { [invoiceId: string]: number } = {};

    // Sort invoices by date or invoice number (oldest first)
    const sorted = [...customerPendingInvoices].sort((a, b) => {
      return (a.invoiceDate || '').localeCompare(b.invoiceDate || '');
    });

    for (const inv of sorted) {
      const alreadyPaid = inv.paidAmount || 0;
      const unpaidBalance = Math.max(0, inv.totalAfterVat - alreadyPaid);

      if (unpaidBalance > 0 && remainingToAllocate > 0) {
        const canGive = Math.min(remainingToAllocate, unpaidBalance);
        newAllocations[inv.id] = Math.round(canGive * 100) / 100;
        remainingToAllocate -= canGive;
      } else {
        newAllocations[inv.id] = 0;
      }
    }

    setAllocations(newAllocations);
  };

  // Manual allocation input change for an invoice
  const handleAllocationChange = (invId: string, valueStr: string, maxBalance: number) => {
    const val = parseFloat(valueStr);
    const amount = isNaN(val) ? 0 : Math.max(0, val);

    if (amount > maxBalance) {
      setErrorMessage(`Allocation (TZS ${amount.toLocaleString()}) exceeds remaining unpaid balance (TZS ${maxBalance.toLocaleString()}) for this invoice.`);
    } else {
      setErrorMessage(null);
    }

    setAllocations((prev) => ({
      ...prev,
      [invId]: amount,
    }));
  };

  // Allocate 100% of a specific invoice balance
  const handleAllocateFullForInvoice = (invId: string, fullBalance: number) => {
    setAllocations((prev) => ({
      ...prev,
      [invId]: fullBalance,
    }));
  };

  // Clear allocations
  const handleClearAllocations = () => {
    setAllocations({});
  };

  // Total allocated calculation
  const totalAllocatedAmount = useMemo(() => {
    return Object.values(allocations).reduce((sum: number, val: number) => sum + (val || 0), 0);
  }, [allocations]);

  const rawEnteredTotal = parseFloat(totalAmountPaid) || 0;
  const unallocatedDifference = Math.round((rawEnteredTotal - totalAllocatedAmount) * 100) / 100;

  // Save payment
  const handleSavePayment = (andPrint: boolean = false) => {
    setErrorMessage(null);

    if (!selectedCustomer) {
      setErrorMessage('Please select a Customer first.');
      return;
    }

    if (rawEnteredTotal <= 0) {
      setErrorMessage('Please enter a valid Total Amount Paid.');
      return;
    }

    if (totalAllocatedAmount <= 0) {
      setErrorMessage('Please allocate the payment amount to at least one invoice.');
      return;
    }

    if (Math.abs(unallocatedDifference) > 0.01) {
      if (
        !window.confirm(
          `Total allocated (TZS ${formatCurrency(totalAllocatedAmount)}) does not match total amount paid (TZS ${formatCurrency(rawEnteredTotal)}). Difference: TZS ${formatCurrency(unallocatedDifference)}. Do you still want to proceed?`
        )
      ) {
        return;
      }
    }

    // Build allocation records & calculate updated invoice statuses
    const allocationItems: PaymentAllocationItem[] = [];
    const updatedInvoicesMap = new Map<string, InvoiceRecord>();

    customerPendingInvoices.forEach((inv) => {
      const allocated = allocations[inv.id] || 0;
      if (allocated > 0) {
        const prevPaid = inv.paidAmount || 0;
        const newPaidTotal = Math.round((prevPaid + allocated) * 100) / 100;
        const newBalance = Math.max(0, Math.round((inv.totalAfterVat - newPaidTotal) * 100) / 100);

        allocationItems.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          poNumber: inv.poNumber,
          customerName: inv.customerName,
          invoiceTotal: inv.totalAfterVat,
          alreadyPaid: prevPaid,
          pendingBalance: newBalance,
          allocatedAmount: allocated,
        });

        const newStatus =
          newBalance <= 0.01 ? 'PAID' : newPaidTotal > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

        updatedInvoicesMap.set(inv.id, {
          ...inv,
          paidAmount: newPaidTotal,
          paymentStatus: newStatus as any,
        });
      }
    });

    const primaryPo = allocationItems[0]?.poNumber || 'MULTI-PO';
    const primaryInv = allocationItems[0]?.invoiceNumber || 'MULTI-INV';

    const newPaymentRecord: PaymentRecord = {
      id: `PAY-${Date.now()}`,
      paymentNumber: `REC-${Date.now().toString().slice(-6)}`,
      paymentDate,
      customerName: selectedCustomer,
      poNumber: primaryPo,
      invoiceNumber: primaryInv,
      amountPaid: totalAllocatedAmount,
      paymentMethod,
      referenceNumber: referenceNumber.trim(),
      depositAccount: depositAccount.trim(),
      notes: notes.trim(),
      allocations: allocationItems,
      createdAt: new Date().toISOString(),
    };

    // Hide saving button to control double click
    setIsSaving(true);

    const allUpdatedInvoices = invoices.map((inv) =>
      updatedInvoicesMap.has(inv.id) ? updatedInvoicesMap.get(inv.id)! : inv
    );

    onSavePayment(newPaymentRecord, allUpdatedInvoices);
    setSuccessPayment(newPaymentRecord);

    if (andPrint) {
      setPrintingPayment(newPaymentRecord);
    }

    // Automatically open a new next record
    setTimeout(() => {
      setTotalAmountPaid('');
      setAllocations({});
      setNotes('');
      setReferenceNumber(`TXN-${Date.now().toString().slice(-6)}`);
      setIsSaving(false);
    }, 400);
  };

  const handleStartNextPayment = () => {
    setSuccessPayment(null);
    setTotalAmountPaid('');
    setAllocations({});
    setNotes('');
    setReferenceNumber(`TXN-${Date.now().toString().slice(-6)}`);
  };

  // Export payments ledger to Excel
  const handleExportPaymentsExcel = () => {
    const rows = payments.map((p, idx) => ({
      '#': idx + 1,
      'Receipt / Payment #': p.paymentNumber,
      'Payment Date': p.paymentDate,
      'Customer': p.customerName,
      'PO Reference': p.poNumber,
      'Amount Paid (TZS)': p.amountPaid,
      'Payment Method': p.paymentMethod,
      'Ref / Check #': p.referenceNumber,
      'Deposit Account': p.depositAccount || '',
      'Notes': p.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments_Ledger');
    XLSX.writeFile(workbook, `Payments_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filteredPaymentsLedger = useMemo(() => {
    return payments.filter((p) => {
      const q = ledgerSearch.toLowerCase();
      return (
        p.paymentNumber.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.poNumber.toLowerCase().includes(q) ||
        p.referenceNumber.toLowerCase().includes(q)
      );
    });
  }, [payments, ledgerSearch]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Record Customer Payment</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Treasury & Accounts
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter amount paid, pick customer, and allocate remittances across open invoices with live balance tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'record' ? 'ledger' : 'record')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {viewMode === 'record' ? (
              <>
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                View Payments Ledger ({payments.length})
              </>
            ) : (
              <>
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                Record New Payment
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successPayment && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">
                  Payment Receipt {successPayment.paymentNumber} Successfully Recorded!
                </h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Credited <span className="font-bold">TZS {formatCurrency(successPayment.amountPaid)}</span> from <span className="font-bold">{successPayment.customerName}</span> across {successPayment.allocations?.length || 1} open invoices.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPrintingPayment(successPayment)}
                className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Official Receipt
              </button>
              <button
                onClick={() => setViewMode('ledger')}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                View Ledger
              </button>
              <button
                onClick={handleStartNextPayment}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Record Another Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: RECORD PAYMENT & ALLOCATION */}
      {viewMode === 'record' && (
        <div className="space-y-6">
          {/* Step 1 & 2: Top Payment Header & Customer Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-500 pb-2 border-b border-slate-100">
              Payment Voucher & Remittance Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Amount Paid */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Total Amount Paid (TZS) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={totalAmountPaid}
                  onChange={(e) => setTotalAmountPaid(e.target.value)}
                  placeholder="e.g. 50000.00"
                  className="w-full text-sm font-mono font-bold text-emerald-800 px-3 py-2.5 bg-emerald-50/40 border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Select Customer */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Select Customer / Client <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {customerList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Bank Transfer">Bank Wire / TT</option>
                  <option value="Cheque / Draft">Corporate Cheque</option>
                  <option value="Mobile Money">Mobile Money (M-Pesa / Tigo)</option>
                  <option value="Cash Deposit">Direct Cash Deposit</option>
                  <option value="Letter of Credit">Letter of Credit (LC)</option>
                </select>
              </div>
            </div>

            {/* Additional Reference Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Bank Reference / Cheque # / Transaction ID
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. CRDB-TXN-884920"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Deposited Bank Account / Ledger
                </label>
                <input
                  type="text"
                  value={depositAccount}
                  onChange={(e) => setDepositAccount(e.target.value)}
                  placeholder="e.g. CRDB Corporate Account - 0150244900"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 3: Customer Pending Invoices Allocation Table */}
          {selectedCustomer && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">
                      Pending Invoices for {selectedCustomer}
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                      {customerPendingInvoices.length} invoices on file
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                      Allocated: TZS {formatCurrency(totalAllocatedAmount)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Allocate payments directly into individual invoice lines or use Auto-Distribute.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoAllocate}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Auto-Allocate
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllocations}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSavePayment(true)}
                    disabled={totalAllocatedAmount <= 0 || isSaving}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Save & Print
                  </button>

                  {/* Primary Save Button: Save Payment */}
                  {!isSaving ? (
                    <button
                      type="button"
                      onClick={() => handleSavePayment(false)}
                      disabled={totalAllocatedAmount <= 0}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      Save Payment
                    </button>
                  ) : (
                    <div className="px-5 py-2 bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-not-allowed">
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Payment...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-3 px-3">Invoice #</th>
                      <th className="py-3 px-3">Invoice Date</th>
                      <th className="py-3 px-3">PO Reference</th>
                      <th className="py-3 px-3 text-right">Invoice Total</th>
                      <th className="py-3 px-3 text-right">Previously Paid</th>
                      <th className="py-3 px-3 text-right text-amber-300">Remaining Balance</th>
                      <th className="py-3 px-3 text-right w-48 bg-emerald-950/60">Amount Allocated (TZS)</th>
                      <th className="py-3 px-3 text-center">Status After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {customerPendingInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-500">
                          No invoices found for this customer.
                        </td>
                      </tr>
                    ) : (
                      customerPendingInvoices.map((inv) => {
                        const prevPaid = inv.paidAmount || 0;
                        const unpaidBalance = Math.max(0, inv.totalAfterVat - prevPaid);
                        const allocated = allocations[inv.id] || 0;
                        const finalBalance = Math.max(0, unpaidBalance - allocated);
                        const isFullySettled = finalBalance <= 0.01;

                        return (
                          <tr
                            key={inv.id}
                            className={`transition-colors ${
                              allocated > 0 ? 'bg-emerald-50/50' : 'hover:bg-slate-50/60'
                            }`}
                          >
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                            <td className="py-3 px-3 text-slate-600">{inv.invoiceDate}</td>
                            <td className="py-3 px-3 font-mono text-slate-700">{inv.poNumber}</td>
                            <td className="py-3 px-3 text-right font-semibold text-slate-800">TZS {formatCurrency(inv.totalAfterVat)}</td>
                            <td className="py-3 px-3 text-right text-slate-500">TZS {formatCurrency(prevPaid)}</td>
                            <td className="py-3 px-3 text-right font-bold text-amber-700">TZS {formatCurrency(unpaidBalance)}</td>
                            <td className="py-2 px-3 text-right bg-emerald-50/30">
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={unpaidBalance}
                                  step="any"
                                  value={allocated || ''}
                                  onChange={(e) => handleAllocationChange(inv.id, e.target.value, unpaidBalance)}
                                  placeholder="0.00"
                                  className="w-28 text-right font-mono font-bold text-xs px-2.5 py-1.5 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAllocateFullForInvoice(inv.id, unpaidBalance)}
                                  className="px-2 py-1 text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded cursor-pointer"
                                  title="Pay full remaining balance"
                                >
                                  Full
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isFullySettled ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Full Paid
                                </span>
                              ) : allocated > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                  Partial (TZS {formatCurrency(finalBalance)} bal)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  Unchanged
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Allocation Summary & Submission */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                <div className="lg:col-span-2 space-y-2">
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Payment Notes & Bank Remittance Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Received via CRDB corporate wire transfer. Reference acknowledged by accounts department."
                    className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Amount Paid Entered:</span>
                    <span className="font-mono font-bold text-slate-900">TZS {formatCurrency(rawEnteredTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Allocated to Invoices:</span>
                    <span className="font-mono font-bold text-emerald-700">TZS {formatCurrency(totalAllocatedAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-slate-200 pt-2 text-slate-800">
                    <span>Unallocated Balance:</span>
                    <span className={`font-mono ${unallocatedDifference !== 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      TZS {formatCurrency(unallocatedDifference)}
                    </span>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    {!isSaving ? (
                      <button
                        type="button"
                        onClick={() => handleSavePayment(false)}
                        disabled={totalAllocatedAmount <= 0}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Save Payment
                      </button>
                    ) : (
                      <div className="w-full py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-xs cursor-not-allowed">
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving Payment...</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSavePayment(true)}
                      disabled={totalAllocatedAmount <= 0 || isSaving}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Printer className="w-4 h-4" />
                      Save & Print Official Receipt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: PAYMENTS LEDGER */}
      {viewMode === 'ledger' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Payments & Remittances Ledger</h3>
                <p className="text-xs text-slate-500">Historical customer payments, bank deposits and receipt numbers</p>
              </div>

              <button
                type="button"
                onClick={handleExportPaymentsExcel}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export Payments Ledger (Excel)
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search payments by Receipt #, Customer, PO, or Transaction Ref..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-3">Receipt #</th>
                    <th className="py-3 px-3">Payment Date</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Primary PO</th>
                    <th className="py-3 px-3">Payment Method</th>
                    <th className="py-3 px-3">Ref / Check #</th>
                    <th className="py-3 px-3 text-right">Amount Paid</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredPaymentsLedger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No payments found in ledger.
                      </td>
                    </tr>
                  ) : (
                    filteredPaymentsLedger.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3 font-mono font-bold text-emerald-700">{pay.paymentNumber}</td>
                        <td className="py-3 px-3 text-slate-600">{pay.paymentDate}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{pay.customerName}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">{pay.poNumber}</td>
                        <td className="py-3 px-3 text-slate-600">{pay.paymentMethod}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{pay.referenceNumber}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">TZS {formatCurrency(pay.amountPaid)}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setPrintingPayment(pay)}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Print Payment Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <PaymentReceiptModal
        payment={printingPayment}
        onClose={() => setPrintingPayment(null)}
      />
    </div>
  );
};
