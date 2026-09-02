import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PurchaseOrderGroup, 
  InvoiceRecord, 
  InvoiceLineItem, 
  POLineItem 
} from '../types';
import { 
  formatCurrency, 
  loadStoredSeriesConfig, 
  advanceSeriesNumber, 
  formatSeriesNumber 
} from '../utils/storage';
import { 
  Search, 
  Receipt, 
  Calendar, 
  CheckSquare, 
  Square, 
  Save, 
  Printer, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  RotateCcw, 
  Sparkles, 
  ChevronDown, 
  PlusCircle, 
  FileSpreadsheet,
  FileText
} from 'lucide-react';

interface InvoiceCreatorProps {
  poGroups: PurchaseOrderGroup[];
  allPoLines: POLineItem[];
  invoices: InvoiceRecord[];
  initialPoNumber?: string;
  onSaveInvoice: (invoice: InvoiceRecord) => void;
  onViewInvoicePrint: (invoice: InvoiceRecord) => void;
  onNavigateToHistory: () => void;
  onSeriesConfigChanged?: () => void;
}

export const InvoiceCreator: React.FC<InvoiceCreatorProps> = ({
  poGroups,
  allPoLines,
  invoices,
  initialPoNumber,
  onSaveInvoice,
  onViewInvoicePrint,
  onNavigateToHistory,
  onSeriesConfigChanged,
}) => {
  // Vendor filter
  const [selectedVendor, setSelectedVendor] = useState<string>('ALL');

  // PO search & selection
  const [poSearchInput, setPoSearchInput] = useState<string>(initialPoNumber || '');
  const [selectedPoGroup, setSelectedPoGroup] = useState<PurchaseOrderGroup | null>(null);
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Invoice header fields
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [vatRate] = useState<number>(0.18); // standard 18% VAT

  // Line items state
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSavedInvoice, setSuccessSavedInvoice] = useState<InvoiceRecord | null>(null);

  // Auto-generate next invoice number from series (1-600 or custom)
  const getNextInvoiceFromSeries = () => {
    const config = loadStoredSeriesConfig();
    return formatSeriesNumber(
      config.invoiceSeries.prefix,
      config.invoiceSeries.currentNumber,
      config.invoiceSeries.padding
    );
  };

  // Unique vendors list
  const vendors = useMemo(() => {
    const set = new Set<string>();
    poGroups.forEach((g) => {
      if (g.customerName) set.add(g.customerName);
    });
    return Array.from(set).sort();
  }, [poGroups]);

  // Filtered POs according to selected vendor
  const vendorFilteredPOs = useMemo(() => {
    if (selectedVendor === 'ALL') return poGroups;
    return poGroups.filter((po) => po.customerName === selectedVendor);
  }, [poGroups, selectedVendor]);

  // Suggested POs for live dropdown search
  const suggestedPOs = useMemo(() => {
    const query = poSearchInput.trim().toLowerCase();
    return vendorFilteredPOs.filter((po) => {
      if (!query) return true;
      return (
        po.poNumber.toLowerCase().includes(query) ||
        po.customerName.toLowerCase().includes(query) ||
        po.contract.toLowerCase().includes(query) ||
        po.destination.toLowerCase().includes(query)
      );
    });
  }, [vendorFilteredPOs, poSearchInput]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set default invoice number on mount
  useEffect(() => {
    if (!invoiceNumber) {
      setInvoiceNumber(getNextInvoiceFromSeries());
    }
  }, []);

  // Manual advance series number button handler
  const handleAdvanceNextInvoiceSeries = () => {
    const nextFormatted = advanceSeriesNumber('invoice');
    setInvoiceNumber(nextFormatted);
    if (onSeriesConfigChanged) onSeriesConfigChanged();
  };

  // Open invoice template by default on initial mount / when poGroups loaded
  useEffect(() => {
    if (poGroups.length > 0 && !selectedPoGroup) {
      if (initialPoNumber) {
        handleSelectPO(initialPoNumber);
      } else {
        // Find first PO that is not fully invoiced, or default to first PO
        const activePO = poGroups.find((g) => g.status !== 'FULLY_INVOICED') || poGroups[0];
        if (activePO) {
          handleSelectPO(activePO.poNumber);
        }
      }
    }
  }, [poGroups, initialPoNumber]);

  // Handler when a PO is searched / selected
  const handleSelectPO = (poNum: string) => {
    setErrorMessage(null);
    setSuccessSavedInvoice(null);
    setIsPoDropdownOpen(false);

    const targetGroup = poGroups.find(
      (g) => g.poNumber.trim().toLowerCase() === poNum.trim().toLowerCase()
    );

    if (!targetGroup) {
      setSelectedPoGroup(null);
      setInvoiceLines([]);
      setErrorMessage(`Purchase Order "${poNum}" was not found in the loaded PO Master Data.`);
      return;
    }

    setSelectedPoGroup(targetGroup);
    setPoSearchInput(targetGroup.poNumber);
    if (selectedVendor !== 'ALL' && targetGroup.customerName !== selectedVendor) {
      setSelectedVendor(targetGroup.customerName);
    }

    // Initialize invoice lines from PO lines
    const lines: InvoiceLineItem[] = targetGroup.lines.map((poLine) => {
      const alreadyInvoiced = poLine.invoicedQuantity || 0;
      const available = Math.max(0, poLine.quantity - alreadyInvoiced);
      
      // Default invoiced quantity to all remaining available
      const initInvoicedQty = available;
      const valBeforeVat = Math.round(initInvoicedQty * poLine.unitPrice * 100) / 100;
      const vatAmt = Math.round(valBeforeVat * (poLine.vatRate || vatRate) * 100) / 100;
      const valAfterVat = Math.round((valBeforeVat + vatAmt) * 100) / 100;

      return {
        poLineId: poLine.id,
        itemDescription: poLine.itemDescription,
        unitOfMeasure: poLine.unitOfMeasure,
        poQuantity: poLine.quantity,
        alreadyInvoicedQuantity: alreadyInvoiced,
        availableQuantity: available,
        invoicedQuantity: initInvoicedQty,
        unitCost: poLine.unitCost,
        unitPrice: poLine.unitPrice,
        valueBeforeVat: valBeforeVat,
        vatRate: poLine.vatRate || vatRate,
        vatAmount: vatAmt,
        valueAfterVat: valAfterVat,
        isSelected: available > 0, // auto select if remaining > 0
      };
    });

    setInvoiceLines(lines);
  };

  // Handler when vendor changes in top dropdown
  const handleVendorChange = (vendor: string) => {
    setSelectedVendor(vendor);
    if (vendor === 'ALL') return;

    // Filter POs for this vendor
    const vendorPOs = poGroups.filter((po) => po.customerName === vendor);
    if (vendorPOs.length > 0) {
      // If current PO is not under this vendor, switch to first available PO of this vendor
      if (!selectedPoGroup || selectedPoGroup.customerName !== vendor) {
        const firstActive = vendorPOs.find((p) => p.status !== 'FULLY_INVOICED') || vendorPOs[0];
        handleSelectPO(firstActive.poNumber);
      }
    }
  };

  // Toggle select all lines
  const handleToggleSelectAll = (select: boolean) => {
    setInvoiceLines((prev) =>
      prev.map((line) => {
        if (line.availableQuantity <= 0 && select) {
          return line;
        }
        return {
          ...line,
          isSelected: select,
        };
      })
    );
  };

  // Toggle single line item
  const handleToggleLine = (index: number) => {
    setInvoiceLines((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        isSelected: !next[index].isSelected,
      };
      return next;
    });
  };

  // Modify quantity for line item
  const handleQuantityChange = (index: number, newQtyStr: string) => {
    const rawVal = parseFloat(newQtyStr);
    const newQty = isNaN(rawVal) ? 0 : Math.max(0, rawVal);

    setInvoiceLines((prev) => {
      const next = [...prev];
      const target = next[index];

      // Validate not exceeding available quantity
      if (newQty > target.availableQuantity) {
        setErrorMessage(
          `Invoiced quantity (${newQty}) cannot exceed remaining PO quantity (${target.availableQuantity}) for line: "${target.itemDescription}"`
        );
      } else {
        setErrorMessage(null);
      }

      const valBeforeVat = Math.round(newQty * target.unitPrice * 100) / 100;
      const vatAmt = Math.round(valBeforeVat * target.vatRate * 100) / 100;
      const valAfterVat = Math.round((valBeforeVat + vatAmt) * 100) / 100;

      next[index] = {
        ...target,
        invoicedQuantity: newQty,
        valueBeforeVat: valBeforeVat,
        vatAmount: vatAmt,
        valueAfterVat: valAfterVat,
        isSelected: newQty > 0 ? true : target.isSelected,
      };
      return next;
    });
  };

  // Fill Max available quantity
  const handleSetMaxQuantity = (index: number) => {
    setInvoiceLines((prev) => {
      const next = [...prev];
      const target = next[index];
      const maxQty = target.availableQuantity;
      const valBeforeVat = Math.round(maxQty * target.unitPrice * 100) / 100;
      const vatAmt = Math.round(valBeforeVat * target.vatRate * 100) / 100;
      const valAfterVat = Math.round((valBeforeVat + vatAmt) * 100) / 100;

      next[index] = {
        ...target,
        invoicedQuantity: maxQty,
        valueBeforeVat: valBeforeVat,
        vatAmount: vatAmt,
        valueAfterVat: valAfterVat,
        isSelected: true,
      };
      return next;
    });
  };

  // Calculations for active invoice
  const invoiceTotals = useMemo(() => {
    const selectedLines = invoiceLines.filter((l) => l.isSelected && l.invoicedQuantity > 0);

    let subtotalBeforeVat = 0;
    let totalVat = 0;
    let totalAfterVat = 0;
    let totalItemsCount = 0;

    selectedLines.forEach((l) => {
      subtotalBeforeVat += l.valueBeforeVat;
      totalVat += l.vatAmount;
      totalAfterVat += l.valueAfterVat;
      totalItemsCount += l.invoicedQuantity;
    });

    // Check if after this invoice, the PO will be fully invoiced
    let isFullyInvoiced = false;
    if (selectedPoGroup) {
      let totalRemainingAfterThis = 0;
      invoiceLines.forEach((l) => {
        const remainingNow = l.availableQuantity - (l.isSelected ? l.invoicedQuantity : 0);
        totalRemainingAfterThis += Math.max(0, remainingNow);
      });
      isFullyInvoiced = totalRemainingAfterThis <= 0;
    }

    return {
      selectedCount: selectedLines.length,
      totalItemsCount,
      subtotalBeforeVat: Math.round(subtotalBeforeVat * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalAfterVat: Math.round(totalAfterVat * 100) / 100,
      isFullyInvoiced,
    };
  }, [invoiceLines, selectedPoGroup]);

  // Save invoice record
  const handleSave = (andPrint: boolean = false) => {
    setErrorMessage(null);

    if (!selectedPoGroup) {
      setErrorMessage('Please select a valid Purchase Order first.');
      return;
    }

    if (!invoiceNumber.trim()) {
      setErrorMessage('Please enter a valid Invoice Number.');
      return;
    }

    // Check if invoice number already used
    const isDuplicate = invoices.some(
      (inv) => inv.invoiceNumber.trim().toLowerCase() === invoiceNumber.trim().toLowerCase()
    );
    if (isDuplicate) {
      setErrorMessage(`Invoice number "${invoiceNumber}" already exists in the database. Please use a unique invoice number.`);
      return;
    }

    const selectedLines = invoiceLines.filter((l) => l.isSelected && l.invoicedQuantity > 0);
    if (selectedLines.length === 0) {
      setErrorMessage('Please select at least one line item with an invoiced quantity greater than 0.');
      return;
    }

    // Validate quantities against availability
    for (const line of selectedLines) {
      if (line.invoicedQuantity > line.availableQuantity) {
        setErrorMessage(
          `Line "${line.itemDescription}" invoiced quantity (${line.invoicedQuantity}) exceeds available quantity (${line.availableQuantity}).`
        );
        return;
      }
    }

    // Build the new invoice record
    const newInvoice: InvoiceRecord = {
      id: `INV-REC-${Date.now()}`,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate: invoiceDate,
      poNumber: selectedPoGroup.poNumber,
      customerName: selectedPoGroup.customerName,
      destination: selectedPoGroup.destination,
      contract: selectedPoGroup.contract,
      poDate: selectedPoGroup.date,
      lines: selectedLines,
      subtotalBeforeVat: invoiceTotals.subtotalBeforeVat,
      totalVat: invoiceTotals.totalVat,
      totalAfterVat: invoiceTotals.totalAfterVat,
      paymentStatus: 'UNPAID',
      paidAmount: 0,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    onSaveInvoice(newInvoice);
    setSuccessSavedInvoice(newInvoice);

    // Automatically advance series configuration to the next invoice number
    advanceSeriesNumber('invoice');
    if (onSeriesConfigChanged) onSeriesConfigChanged();

    if (andPrint) {
      onViewInvoicePrint(newInvoice);
    }
  };

  // Reset form for next invoice
  const handleStartNextInvoice = () => {
    setSuccessSavedInvoice(null);
    setInvoiceNumber(getNextInvoiceFromSeries());
    setNotes('');
    if (selectedPoGroup) {
      handleSelectPO(selectedPoGroup.poNumber);
    }
  };

  const allSelected = invoiceLines.length > 0 && invoiceLines.every((l) => l.isSelected);

  return (
    <div className="space-y-6 pb-12">
      {/* Success Notification Banner after saving */}
      {successSavedInvoice && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">
                  Invoice {successSavedInvoice.invoiceNumber} Successfully Recorded!
                </h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Saved to Invoiced PO Database against PO <span className="font-mono font-bold">{successSavedInvoice.poNumber}</span> ({successSavedInvoice.customerName}). Total Amount: <span className="font-bold">${formatCurrency(successSavedInvoice.totalAfterVat)}</span>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onViewInvoicePrint(successSavedInvoice)}
                className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / PDF
              </button>
              <button
                onClick={onNavigateToHistory}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                View Database
              </button>
              <button
                onClick={handleStartNextInvoice}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Record Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Empty PO State if no master POs exist */}
      {poGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
          <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">No Purchase Orders Loaded</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Please load PO master data from the PO Master Data tab or reload sample data to start recording invoices.
          </p>
        </div>
      ) : (
        /* Invoice Template Document (Rendered by Default) */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Top Invoice Header: Vendor, PO Number, Invoice Number, Invoice Date */}
          <div className="bg-slate-900 text-white p-5 sm:p-6 border-b border-slate-800">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-bold text-lg text-white">Commercial Tax Invoice</h1>
                    {selectedPoGroup && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono font-semibold">
                        {selectedPoGroup.poNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select vendor and PO to load official line items, adjust billed quantities, and record to database.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              {selectedPoGroup && (
                <div className="flex items-center gap-2">
                  {selectedPoGroup.status === 'FULLY_INVOICED' && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> PO 100% Invoiced (Closed)
                    </span>
                  )}
                  {selectedPoGroup.status === 'PARTIALLY_INVOICED' && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Partially Invoiced PO
                    </span>
                  )}
                  {selectedPoGroup.status === 'PENDING' && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 100% Available PO
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Header Form Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
              {/* 1. Vendor Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  Select Vendor / Customer
                </label>
                <select
                  value={selectedVendor}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ALL">All Vendors ({vendors.length})</option>
                  {vendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {vendorFilteredPOs.length} POs available for this vendor
                </span>
              </div>

              {/* 2. PO Number (Searchable Dropdown with type-ahead & quick list) */}
              <div className="relative" ref={dropdownRef}>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-blue-400" />
                    PO Number <span className="text-red-400">*</span>
                  </span>
                  {vendorFilteredPOs.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      {vendorFilteredPOs.length} filtered
                    </span>
                  )}
                </label>

                <div className="relative">
                  <input
                    type="text"
                    value={poSearchInput}
                    onChange={(e) => {
                      setPoSearchInput(e.target.value);
                      setIsPoDropdownOpen(true);
                    }}
                    onFocus={() => setIsPoDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && suggestedPOs.length > 0) {
                        handleSelectPO(suggestedPOs[0].poNumber);
                      }
                    }}
                    placeholder="Type or select PO Number..."
                    className="w-full pl-3 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPoDropdownOpen(!isPoDropdownOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Dropdown Suggestions List */}
                {isPoDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-700 text-xs">
                    {suggestedPOs.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        No POs found matching "{poSearchInput}"
                      </div>
                    ) : (
                      suggestedPOs.map((po) => (
                        <div
                          key={po.poNumber}
                          onClick={() => handleSelectPO(po.poNumber)}
                          className={`p-2.5 hover:bg-slate-700 cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                            selectedPoGroup?.poNumber === po.poNumber ? 'bg-blue-600/30' : ''
                          }`}
                        >
                          <div>
                            <div className="font-mono font-bold text-white">{po.poNumber}</div>
                            <div className="text-[11px] text-slate-300 truncate max-w-[180px]">
                              {po.customerName}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                po.status === 'FULLY_INVOICED'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {po.status === 'FULLY_INVOICED' ? 'Closed' : `$${formatCurrency(po.remainingValueAfterVat)} rem`}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 3. Invoice Number */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                    Invoice Number <span className="text-red-400">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAdvanceNextInvoiceSeries}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                    title="Advance to next series number"
                  >
                    <Sparkles className="w-3 h-3" />
                    Next Series #
                  </button>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-001"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 4. Invoice Date */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Invoice Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Sub-header: Delivery Notes / Batch and PO Metadata */}
            {selectedPoGroup && (
              <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Destination:</span>
                  <span className="font-semibold text-white">{selectedPoGroup.destination}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Contract Ref:</span>
                  <span className="font-mono font-semibold text-white">{selectedPoGroup.contract}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Original PO Date:</span>
                  <span className="text-white">{selectedPoGroup.date}</span>
                </div>
              </div>
            )}
          </div>

          {/* Invoice Specific Notes */}
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Delivery Notes / Invoice Remarks (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Partial delivery batch 1 of 2 via logistics truck #4..."
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Line Items Selection & Quantity Allocation Table */}
          {selectedPoGroup ? (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Line Item Selection & Billing Quantities
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select lines to bill and edit the billed quantity. Descriptions, unit costs, and unit prices are strictly preserved.
                  </p>
                </div>

                {/* Bulk Select / Unselect */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleSelectAll(true)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    Select All Lines
                  </button>
                  <button
                    onClick={() => handleToggleSelectAll(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    Unselect All
                  </button>
                </div>
              </div>

              {/* Editable Line Item Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800 text-white font-semibold uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-3 text-center w-12">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-3 min-w-[200px]">Item Description (Locked)</th>
                        <th className="py-3 px-2 text-center">UOM</th>
                        <th className="py-3 px-3 text-right">PO Total</th>
                        <th className="py-3 px-3 text-right text-slate-300">Invoiced</th>
                        <th className="py-3 px-3 text-right text-amber-300">Available</th>
                        <th className="py-3 px-3 text-center min-w-[150px]">
                          Invoice Qty <span className="text-emerald-400 font-bold">(Edit)</span>
                        </th>
                        <th className="py-3 px-3 text-right">Unit Price</th>
                        <th className="py-3 px-3 text-right">Subtotal</th>
                        <th className="py-3 px-3 text-right">VAT (18%)</th>
                        <th className="py-3 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceLines.map((line, idx) => {
                        const isDepleted = line.availableQuantity <= 0;

                        return (
                          <tr
                            key={line.poLineId}
                            className={`transition-colors ${
                              !line.isSelected
                                ? 'bg-slate-50/40 text-slate-400'
                                : isDepleted
                                ? 'bg-amber-50/20'
                                : 'bg-white hover:bg-blue-50/30'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={line.isSelected}
                                onChange={() => handleToggleLine(idx)}
                                disabled={isDepleted && line.invoicedQuantity === 0}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                              />
                            </td>

                            {/* Description */}
                            <td className="py-3 px-3 font-medium text-slate-900">
                              <div>{line.itemDescription}</div>
                              {isDepleted && (
                                <span className="text-[10px] text-amber-600 font-semibold">
                                  Already fully invoiced
                                </span>
                              )}
                            </td>

                            {/* UOM */}
                            <td className="py-3 px-2 text-center text-slate-600 font-mono font-semibold">
                              {line.unitOfMeasure}
                            </td>

                            {/* PO Total Qty */}
                            <td className="py-3 px-3 text-right font-semibold text-slate-700">
                              {line.poQuantity}
                            </td>

                            {/* Already Invoiced Qty */}
                            <td className="py-3 px-3 text-right text-slate-500 font-semibold">
                              {line.alreadyInvoicedQuantity}
                            </td>

                            {/* Available to Invoice */}
                            <td className="py-3 px-3 text-right font-bold text-amber-700">
                              {line.availableQuantity}
                            </td>

                            {/* Editable Invoiced Quantity Input */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max={line.availableQuantity}
                                  step="any"
                                  value={line.invoicedQuantity}
                                  onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                  disabled={!line.isSelected || isDepleted}
                                  className={`w-20 px-2.5 py-1.5 text-center font-bold text-sm rounded-lg border focus:outline-none transition-all ${
                                    !line.isSelected || isDepleted
                                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                      : 'bg-white border-blue-400 text-slate-900 focus:ring-2 focus:ring-blue-500/20 shadow-xs'
                                  }`}
                                />
                                {line.isSelected && line.availableQuantity > 0 && (
                                  <button
                                    onClick={() => handleSetMaxQuantity(idx)}
                                    title="Fill all remaining available quantity"
                                    className="px-1.5 py-1 text-[10px] font-bold uppercase bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 cursor-pointer"
                                  >
                                    Max
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Unit Price (Locked) */}
                            <td className="py-3 px-3 text-right font-semibold text-slate-800">
                              ${formatCurrency(line.unitPrice)}
                            </td>

                            {/* Subtotal Before VAT */}
                            <td className="py-3 px-3 text-right text-slate-700 font-medium">
                              ${formatCurrency(line.isSelected ? line.valueBeforeVat : 0)}
                            </td>

                            {/* VAT Amount */}
                            <td className="py-3 px-3 text-right text-slate-500">
                              ${formatCurrency(line.isSelected ? line.vatAmount : 0)}
                            </td>

                            {/* Line Total After VAT */}
                            <td className="py-3 px-3 text-right font-bold text-slate-900">
                              ${formatCurrency(line.isSelected ? line.valueAfterVat : 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invoice Calculation Summary Box & Action Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                {/* Left info: Fulfillment Status */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Invoicing Classification
                  </div>
                  <p className="text-slate-600">
                    {invoiceTotals.isFullyInvoiced ? (
                      <span className="text-emerald-700 font-semibold">
                        Full Invoicing: This invoice will consume 100% of the remaining PO items and mark the PO as closed.
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold">
                        Partial Invoicing: Some line items or quantities will remain available on PO {selectedPoGroup.poNumber} for future billing.
                      </span>
                    )}
                  </p>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    Selected Items: <span className="font-bold text-slate-800">{invoiceTotals.selectedCount} lines</span> ({invoiceTotals.totalItemsCount.toLocaleString()} total units).
                  </div>
                </div>

                {/* Right Box: Grand Totals Breakdown */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Before VAT:</span>
                    <span className="font-bold text-slate-900">${formatCurrency(invoiceTotals.subtotalBeforeVat)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>VAT (18%):</span>
                    <span className="font-bold text-slate-900">${formatCurrency(invoiceTotals.totalVat)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total Invoice Amount (Incl. VAT):</span>
                    <span className="text-emerald-700 font-mono text-lg">${formatCurrency(invoiceTotals.totalAfterVat)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={handleStartNextInvoice}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Form
                </button>

                <button
                  onClick={() => handleSave(true)}
                  disabled={invoiceTotals.selectedCount === 0}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  Save & Print Preview
                </button>

                <button
                  onClick={() => handleSave(false)}
                  disabled={invoiceTotals.selectedCount === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save to Invoiced Database
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              Please select or search a PO Number from the header above to load line items.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
