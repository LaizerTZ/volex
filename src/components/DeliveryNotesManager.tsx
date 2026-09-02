import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PurchaseOrderGroup, 
  DeliveryNoteRecord, 
  DeliveryNoteLineItem, 
  POLineItem 
} from '../types';
import { 
  formatCurrency, 
  loadStoredSeriesConfig, 
  advanceSeriesNumber, 
  formatSeriesNumber 
} from '../utils/storage';
import * as XLSX from 'xlsx';
import { 
  Truck, 
  Search, 
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
  FileText,
  Package,
  MapPin,
  ChevronRight,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import { DeliveryNotePrintModal } from './DeliveryNotePrintModal';

interface DeliveryNotesManagerProps {
  deliveryNotes: DeliveryNoteRecord[];
  poGroups: PurchaseOrderGroup[];
  allPoLines: POLineItem[];
  onSaveDeliveryNote: (dn: DeliveryNoteRecord) => void;
  onNavigateToMatching: () => void;
  onSeriesConfigChanged?: () => void;
}

export const DeliveryNotesManager: React.FC<DeliveryNotesManagerProps> = ({
  deliveryNotes,
  poGroups,
  allPoLines,
  onSaveDeliveryNote,
  onNavigateToMatching,
  onSeriesConfigChanged,
}) => {
  const [viewMode, setViewMode] = useState<'create' | 'database'>('create');

  // Vendor filter
  const [selectedVendor, setSelectedVendor] = useState<string>('ALL');

  // PO search & selection
  const [poSearchInput, setPoSearchInput] = useState<string>('');
  const [selectedPoGroup, setSelectedPoGroup] = useState<PurchaseOrderGroup | null>(null);
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Delivery Note header fields
  const [dnNumber, setDnNumber] = useState<string>('');
  const [dnDate, setDnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [carrier, setCarrier] = useState<string>('Enterprise Logistics Fleet');
  const [vehicleNumber, setVehicleNumber] = useState<string>('T 492 DXB');
  const [driverName, setDriverName] = useState<string>('Hassan Rashid');
  const [receivedBy, setReceivedBy] = useState<string>('Site Receiving Officer');
  const [notes, setNotes] = useState<string>('');
  const [vatRate] = useState<number>(0.18);

  // Line items state
  const [deliveryLines, setDeliveryLines] = useState<DeliveryNoteLineItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSavedDN, setSuccessSavedDN] = useState<DeliveryNoteRecord | null>(null);

  // Print modal state
  const [printingDN, setPrintingDN] = useState<DeliveryNoteRecord | null>(null);

  // Database search
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbVendorFilter, setDbVendorFilter] = useState('ALL');

  // Auto-generate next delivery note number from series
  const getNextDNFromSeries = () => {
    const config = loadStoredSeriesConfig();
    return formatSeriesNumber(
      config.deliverySeries.prefix,
      config.deliverySeries.currentNumber,
      config.deliverySeries.padding
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

  // Initialize DN number on mount
  useEffect(() => {
    if (!dnNumber) {
      setDnNumber(getNextDNFromSeries());
    }
  }, []);

  // Open delivery note template by default on initial mount with first active PO
  useEffect(() => {
    if (poGroups.length > 0 && !selectedPoGroup) {
      const activePO = poGroups.find((g) => {
        const hasUndelivered = g.lines.some((l) => (l.undeliveredQuantity ?? l.quantity) > 0);
        return hasUndelivered;
      }) || poGroups[0];

      if (activePO) {
        handleSelectPO(activePO.poNumber);
      }
    }
  }, [poGroups]);

  // Handler when a PO is searched / selected
  const handleSelectPO = (poNum: string) => {
    setErrorMessage(null);
    setSuccessSavedDN(null);
    setIsPoDropdownOpen(false);

    const targetGroup = poGroups.find(
      (g) => g.poNumber.trim().toLowerCase() === poNum.trim().toLowerCase()
    );

    if (!targetGroup) {
      setSelectedPoGroup(null);
      setDeliveryLines([]);
      setErrorMessage(`Purchase Order "${poNum}" was not found in the loaded PO Master Data.`);
      return;
    }

    setSelectedPoGroup(targetGroup);
    setPoSearchInput(targetGroup.poNumber);
    if (selectedVendor !== 'ALL' && targetGroup.customerName !== selectedVendor) {
      setSelectedVendor(targetGroup.customerName);
    }

    // Initialize delivery lines from PO lines with delivery tracking
    const lines: DeliveryNoteLineItem[] = targetGroup.lines.map((poLine) => {
      const alreadyDelivered = poLine.deliveredQuantity || 0;
      const available = Math.max(0, poLine.quantity - alreadyDelivered);
      
      const initDeliveredQty = available;
      const valBeforeVat = Math.round(initDeliveredQty * poLine.unitPrice * 100) / 100;
      const vatAmt = Math.round(valBeforeVat * (poLine.vatRate || vatRate) * 100) / 100;
      const valAfterVat = Math.round((valBeforeVat + vatAmt) * 100) / 100;

      return {
        poLineId: poLine.id,
        itemDescription: poLine.itemDescription,
        unitOfMeasure: poLine.unitOfMeasure,
        poQuantity: poLine.quantity,
        alreadyDeliveredQuantity: alreadyDelivered,
        availableQuantity: available,
        deliveredQuantity: initDeliveredQty,
        unitCost: poLine.unitCost,
        unitPrice: poLine.unitPrice,
        valueBeforeVat: valBeforeVat,
        vatRate: poLine.vatRate || vatRate,
        vatAmount: vatAmt,
        valueAfterVat: valAfterVat,
        isSelected: available > 0,
      };
    });

    setDeliveryLines(lines);
  };

  // Handler when vendor changes in top dropdown
  const handleVendorChange = (vendor: string) => {
    setSelectedVendor(vendor);
    if (vendor === 'ALL') return;

    const vendorPOs = poGroups.filter((po) => po.customerName === vendor);
    if (vendorPOs.length > 0) {
      if (!selectedPoGroup || selectedPoGroup.customerName !== vendor) {
        const firstActive = vendorPOs.find((p) => p.lines.some((l) => (l.undeliveredQuantity ?? l.quantity) > 0)) || vendorPOs[0];
        handleSelectPO(firstActive.poNumber);
      }
    }
  };

  // Toggle select all lines
  const handleToggleSelectAll = (select: boolean) => {
    setDeliveryLines((prev) =>
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
    setDeliveryLines((prev) => {
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

    setDeliveryLines((prev) => {
      const next = [...prev];
      const target = next[index];

      if (newQty > target.availableQuantity) {
        setErrorMessage(
          `Delivered quantity (${newQty}) cannot exceed remaining undelivered PO quantity (${target.availableQuantity}) for line: "${target.itemDescription}"`
        );
      } else {
        setErrorMessage(null);
      }

      const valBeforeVat = Math.round(newQty * target.unitPrice * 100) / 100;
      const vatAmt = Math.round(valBeforeVat * target.vatRate * 100) / 100;
      const valAfterVat = Math.round((valBeforeVat + vatAmt) * 100) / 100;

      next[index] = {
        ...target,
        deliveredQuantity: newQty,
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
    setDeliveryLines((prev) => {
      const next = [...prev];
      const target = next[index];
      const maxQty = target.availableQuantity;
      const valBeforeVat = Math.round(maxQty * target.unitPrice * 100) / 100;
      const vatAmt = Math.round(valBeforeVat * target.vatRate * 100) / 100;
      const valAfterVat = Math.round((valBeforeVat + vatAmt) * 100) / 100;

      next[index] = {
        ...target,
        deliveredQuantity: maxQty,
        valueBeforeVat: valBeforeVat,
        vatAmount: vatAmt,
        valueAfterVat: valAfterVat,
        isSelected: true,
      };
      return next;
    });
  };

  // Calculations for active delivery note
  const deliveryTotals = useMemo(() => {
    const selectedLines = deliveryLines.filter((l) => l.isSelected && l.deliveredQuantity > 0);

    let subtotalBeforeVat = 0;
    let totalVat = 0;
    let totalAfterVat = 0;
    let totalItemsCount = 0;

    selectedLines.forEach((l) => {
      subtotalBeforeVat += l.valueBeforeVat;
      totalVat += l.vatAmount;
      totalAfterVat += l.valueAfterVat;
      totalItemsCount += l.deliveredQuantity;
    });

    let isFullyDelivered = false;
    if (selectedPoGroup) {
      let totalRemainingAfterThis = 0;
      deliveryLines.forEach((l) => {
        const remainingNow = l.availableQuantity - (l.isSelected ? l.deliveredQuantity : 0);
        totalRemainingAfterThis += Math.max(0, remainingNow);
      });
      isFullyDelivered = totalRemainingAfterThis <= 0;
    }

    return {
      selectedCount: selectedLines.length,
      totalItemsCount,
      subtotalBeforeVat: Math.round(subtotalBeforeVat * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalAfterVat: Math.round(totalAfterVat * 100) / 100,
      isFullyDelivered,
    };
  }, [deliveryLines, selectedPoGroup]);

  // Advance to next DN series number manually
  const handleAdvanceToNextDNNumber = () => {
    const nextFormatted = advanceSeriesNumber('delivery');
    setDnNumber(nextFormatted);
    if (onSeriesConfigChanged) onSeriesConfigChanged();
  };

  // Save Delivery Note record
  const handleSave = (andPrint: boolean = false) => {
    setErrorMessage(null);

    if (!selectedPoGroup) {
      setErrorMessage('Please select a valid Purchase Order first.');
      return;
    }

    if (!dnNumber.trim()) {
      setErrorMessage('Please enter a valid Delivery Note Number.');
      return;
    }

    const isDuplicate = deliveryNotes.some(
      (dn) => dn.deliveryNoteNumber.trim().toLowerCase() === dnNumber.trim().toLowerCase()
    );
    if (isDuplicate) {
      setErrorMessage(`Delivery Note number "${dnNumber}" already exists in the database. Please use a unique DN number.`);
      return;
    }

    const selectedLines = deliveryLines.filter((l) => l.isSelected && l.deliveredQuantity > 0);
    if (selectedLines.length === 0) {
      setErrorMessage('Please select at least one line item with a delivered quantity greater than 0.');
      return;
    }

    for (const line of selectedLines) {
      if (line.deliveredQuantity > line.availableQuantity) {
        setErrorMessage(
          `Line "${line.itemDescription}" delivered quantity (${line.deliveredQuantity}) exceeds available quantity (${line.availableQuantity}).`
        );
        return;
      }
    }

    const newDN: DeliveryNoteRecord = {
      id: `DN-REC-${Date.now()}`,
      deliveryNoteNumber: dnNumber.trim(),
      deliveryDate: dnDate,
      poNumber: selectedPoGroup.poNumber,
      customerName: selectedPoGroup.customerName,
      destination: selectedPoGroup.destination,
      contract: selectedPoGroup.contract,
      poDate: selectedPoGroup.date,
      carrier: carrier.trim(),
      vehicleNumber: vehicleNumber.trim(),
      driverName: driverName.trim(),
      receivedBy: receivedBy.trim(),
      lines: selectedLines,
      subtotalBeforeVat: deliveryTotals.subtotalBeforeVat,
      totalVat: deliveryTotals.totalVat,
      totalDeliveredQuantity: deliveryTotals.totalItemsCount,
      totalDeliveredValue: deliveryTotals.totalAfterVat,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    onSaveDeliveryNote(newDN);
    setSuccessSavedDN(newDN);

    // Automatically advance series number for next delivery note
    advanceSeriesNumber('delivery');
    if (onSeriesConfigChanged) onSeriesConfigChanged();

    if (andPrint) {
      setPrintingDN(newDN);
    }
  };

  // Reset form for next delivery note
  const handleStartNextDN = () => {
    setSuccessSavedDN(null);
    setDnNumber(getNextDNFromSeries());
    setNotes('');
    if (selectedPoGroup) {
      handleSelectPO(selectedPoGroup.poNumber);
    }
  };

  const allSelected = deliveryLines.length > 0 && deliveryLines.every((l) => l.isSelected);

  // Filtered delivery notes for database view
  const filteredDatabaseNotes = useMemo(() => {
    return deliveryNotes.filter((dn) => {
      const matchSearch =
        dn.deliveryNoteNumber.toLowerCase().includes(dbSearchTerm.toLowerCase()) ||
        dn.poNumber.toLowerCase().includes(dbSearchTerm.toLowerCase()) ||
        dn.customerName.toLowerCase().includes(dbSearchTerm.toLowerCase()) ||
        dn.destination.toLowerCase().includes(dbSearchTerm.toLowerCase());

      const matchVendor = dbVendorFilter === 'ALL' || dn.customerName === dbVendorFilter;
      return matchSearch && matchVendor;
    });
  }, [deliveryNotes, dbSearchTerm, dbVendorFilter]);

  const handleExportDNExcel = () => {
    const exportData = filteredDatabaseNotes.map((dn, idx) => ({
      '#': idx + 1,
      'Delivery Note #': dn.deliveryNoteNumber,
      'Delivery Date': dn.deliveryDate,
      'PO Number': dn.poNumber,
      'Customer / Vendor': dn.customerName,
      'Destination': dn.destination,
      'Carrier': dn.carrier || '',
      'Vehicle #': dn.vehicleNumber || '',
      'Received By': dn.receivedBy || '',
      'Delivered Qty': dn.totalDeliveredQuantity,
      'Delivered Value ($)': dn.totalDeliveredValue,
      'Notes': dn.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery_Notes');
    XLSX.writeFile(workbook, `Delivery_Notes_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Record Delivery Note</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Logistics Dispatch
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Mirror of invoice workflow: select vendor, load PO line items, track dispatch quantities and auto-advance DN number series.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'create' ? 'database' : 'create')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {viewMode === 'create' ? (
              <>
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                View DN Database ({deliveryNotes.length})
              </>
            ) : (
              <>
                <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                Back to Record Delivery Note
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successSavedDN && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">
                  Delivery Note {successSavedDN.deliveryNoteNumber} Successfully Recorded!
                </h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Logged into Delivery Database against PO <span className="font-mono font-bold">{successSavedDN.poNumber}</span> ({successSavedDN.customerName}). Total Items: <span className="font-bold">{successSavedDN.totalDeliveredQuantity} units</span> (${formatCurrency(successSavedDN.totalDeliveredValue)}).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPrintingDN(successSavedDN)}
                className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Delivery Note
              </button>
              <button
                onClick={() => setViewMode('database')}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                View Database
              </button>
              <button
                onClick={handleStartNextDN}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Record Next DN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: CREATE / RECORD DELIVERY NOTE */}
      {viewMode === 'create' && (
        <div className="space-y-6">
          {/* TOP CONTROLS: VENDOR & SEARCHABLE PO SELECTOR */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Vendor Selector */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Select Vendor / Customer
                </label>
                <select
                  value={selectedVendor}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
                >
                  <option value="ALL">All Vendors / Customers ({vendors.length})</option>
                  {vendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* PO Searchable Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  Select PO Number
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
                    placeholder="Type PO # or pick from list..."
                    className="w-full text-xs font-mono font-bold px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPoDropdownOpen(!isPoDropdownOpen)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Dropdown popup */}
                {isPoDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in">
                    {suggestedPOs.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 text-center">No matching POs found</div>
                    ) : (
                      suggestedPOs.map((po) => (
                        <div
                          key={po.poNumber}
                          onClick={() => handleSelectPO(po.poNumber)}
                          className={`p-3 text-xs cursor-pointer hover:bg-indigo-50 transition-colors flex items-center justify-between ${
                            selectedPoGroup?.poNumber === po.poNumber ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : ''
                          }`}
                        >
                          <div>
                            <div className="font-mono font-bold text-slate-900">{po.poNumber}</div>
                            <div className="text-[11px] text-slate-500">{po.customerName} • {po.destination}</div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {po.lines.length} items
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Delivery Note Number with Next Series Button */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    Delivery Note #
                  </span>
                  <button
                    type="button"
                    onClick={handleAdvanceToNextDNNumber}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                    title="Advance to next series number"
                  >
                    <Sparkles className="w-3 h-3" />
                    Next Series #
                  </button>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={dnNumber}
                    onChange={(e) => setDnNumber(e.target.value)}
                    placeholder="e.g. DN-001"
                    className="w-full text-xs font-mono font-bold text-indigo-700 px-3 py-2.5 bg-indigo-50/40 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Delivery Date
                </label>
                <input
                  type="date"
                  required
                  value={dnDate}
                  onChange={(e) => setDnDate(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Additional Carrier & Dispatch Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Carrier / Transporter</label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g. Enterprise Logistics"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Vehicle / Reg Number</label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g. T 492 DXB"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Driver / Dispatcher</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Hassan Rashid"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Receiving Officer (Site)</label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="e.g. Authorized Consignee"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* ERROR MESSAGE ALERT */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ACTIVE PO DETAILS BAR */}
          {selectedPoGroup && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-indigo-300">{selectedPoGroup.poNumber}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="font-bold text-xs text-white">{selectedPoGroup.customerName}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Site: <span className="text-slate-200">{selectedPoGroup.destination}</span> • Contract: <span className="text-slate-200">{selectedPoGroup.contract}</span> • PO Date: <span className="text-slate-200">{selectedPoGroup.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(!allSelected)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{allSelected ? 'Unselect All' : 'Select All Items'}</span>
                </button>
              </div>
            </div>
          )}

          {/* LINE ITEMS TABLE */}
          {deliveryLines.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-3.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5 px-3">Item Description</th>
                      <th className="py-3.5 px-2 text-center">UOM</th>
                      <th className="py-3.5 px-3 text-right">PO Qty</th>
                      <th className="py-3.5 px-3 text-right">Already Deliv.</th>
                      <th className="py-3.5 px-3 text-right text-indigo-300">Available</th>
                      <th className="py-3.5 px-3 text-right w-36">Delivering Qty</th>
                      <th className="py-3.5 px-3 text-right">Unit Price</th>
                      <th className="py-3.5 px-3 text-right">Subtotal</th>
                      <th className="py-3.5 px-3 text-right">VAT (18%)</th>
                      <th className="py-3.5 px-3 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {deliveryLines.map((line, idx) => {
                      const isAvailable = line.availableQuantity > 0;
                      return (
                        <tr
                          key={line.poLineId || idx}
                          className={`transition-colors ${
                            line.isSelected ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'hover:bg-slate-50/60 opacity-80'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={line.isSelected || false}
                              disabled={!isAvailable && line.availableQuantity <= 0}
                              onChange={() => handleToggleLine(idx)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900 max-w-xs truncate">
                            {line.itemDescription}
                          </td>
                          <td className="py-3 px-2 text-center font-mono text-slate-600">{line.unitOfMeasure}</td>
                          <td className="py-3 px-3 text-right text-slate-500">{line.poQuantity}</td>
                          <td className="py-3 px-3 text-right text-slate-500">{line.alreadyDeliveredQuantity}</td>
                          <td className="py-3 px-3 text-right font-bold text-indigo-700">
                            {line.availableQuantity}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="0"
                                max={line.availableQuantity}
                                step="any"
                                value={line.deliveredQuantity}
                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                disabled={!isAvailable}
                                className="w-20 text-right font-bold text-xs px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleSetMaxQuantity(idx)}
                                disabled={!isAvailable}
                                className="px-1.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded disabled:opacity-30 cursor-pointer"
                                title="Set maximum available quantity"
                              >
                                Max
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-700">${formatCurrency(line.unitPrice)}</td>
                          <td className="py-3 px-3 text-right text-slate-800">${formatCurrency(line.valueBeforeVat)}</td>
                          <td className="py-3 px-3 text-right text-slate-500">${formatCurrency(line.vatAmount)}</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">${formatCurrency(line.valueAfterVat)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-sm">Please select a Purchase Order to load line items for delivery.</p>
            </div>
          )}

          {/* SUMMARY FINANCIAL BOX & ACTION BAR */}
          {deliveryLines.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Special Delivery Remarks */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <label className="block text-xs font-bold uppercase text-slate-600">
                  Delivery Remarks & Special Instructions
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Delivered directly to Central Warehouse Bay #3. Inspected and approved by Site Engineer."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>

              {/* Totals & Submit */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 pb-2 border-b border-slate-100">
                  Delivery Note Financial Summary
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Lines Selected:</span>
                    <span className="font-bold text-slate-900">{deliveryTotals.selectedCount} / {deliveryLines.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Delivered Units:</span>
                    <span className="font-bold text-slate-900">{deliveryTotals.totalItemsCount} units</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Before VAT:</span>
                    <span className="font-semibold text-slate-800">${formatCurrency(deliveryTotals.subtotalBeforeVat)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>VAT Amount (18%):</span>
                    <span className="font-semibold text-slate-800">${formatCurrency(deliveryTotals.totalVat)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-indigo-950">
                    <span>Total Delivered Value:</span>
                    <span className="font-mono text-base">${formatCurrency(deliveryTotals.totalAfterVat)}</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Save Delivery Note
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Save & Print Preview
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: DELIVERY NOTES DATABASE */}
      {viewMode === 'database' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Delivery Notes Database & Dispatch Ledger</h3>
                <p className="text-xs text-slate-500">Historical delivery note records linked to purchase orders</p>
              </div>

              <button
                type="button"
                onClick={handleExportDNExcel}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export Ledger (Excel)
              </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={dbSearchTerm}
                  onChange={(e) => setDbSearchTerm(e.target.value)}
                  placeholder="Search by DN #, PO #, Customer, Destination..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <select
                value={dbVendorFilter}
                onChange={(e) => setDbVendorFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-xl bg-slate-50"
              >
                <option value="ALL">All Customers / Vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-3">DN #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">PO Reference</th>
                    <th className="py-3 px-3">Customer / Site</th>
                    <th className="py-3 px-3">Carrier / Vehicle</th>
                    <th className="py-3 px-3 text-right">Items</th>
                    <th className="py-3 px-3 text-right">Total Delivered Value</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDatabaseNotes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No delivery notes found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDatabaseNotes.map((dn) => (
                      <tr key={dn.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3 font-mono font-bold text-indigo-700">{dn.deliveryNoteNumber}</td>
                        <td className="py-3 px-3 text-slate-600">{dn.deliveryDate}</td>
                        <td className="py-3 px-3 font-mono text-slate-900 font-semibold">{dn.poNumber}</td>
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {dn.customerName}
                          <div className="text-[10px] text-slate-500">{dn.destination}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {dn.carrier || 'Internal'}
                          {dn.vehicleNumber && <span className="font-mono text-[10px] block text-slate-400">{dn.vehicleNumber}</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-800">{dn.totalDeliveredQuantity}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">${formatCurrency(dn.totalDeliveredValue)}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setPrintingDN(dn)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Print Delivery Note"
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

      {/* Printable Delivery Note Modal */}
      <DeliveryNotePrintModal
        deliveryNote={printingDN}
        onClose={() => setPrintingDN(null)}
      />
    </div>
  );
};
