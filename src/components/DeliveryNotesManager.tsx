import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PurchaseOrderGroup, 
  DeliveryNoteRecord, 
  DeliveryNoteLineItem, 
  POLineItem,
  CustomerSeriesBook,
  AppUser
} from '../types';
import { 
  formatCurrency, 
  loadStoredSeriesConfig, 
  advanceSeriesNumber, 
  formatSeriesNumber,
  loadStoredCustomerSeriesBooks,
  saveOrUpdateCustomerSeriesBook,
  getCustomerSeriesBook,
  peekCustomerSeriesNumber,
  advanceCustomerSeriesNumber,
  groupPOsByNumber
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
  Trash2,
  BookOpen,
  Ban,
  MessageSquare,
  X
} from 'lucide-react';
import { DeliveryNotePrintModal } from './DeliveryNotePrintModal';

interface DeliveryNotesManagerProps {
  deliveryNotes?: DeliveryNoteRecord[];
  poGroups?: PurchaseOrderGroup[];
  allPoLines?: POLineItem[];
  poLines?: POLineItem[]; // alias fallback
  onSaveDeliveryNote: (dn: DeliveryNoteRecord) => void;
  onNavigateToMatching?: () => void;
  onSeriesConfigChanged?: () => void;
  currentUser?: AppUser;
}

export const DeliveryNotesManager: React.FC<DeliveryNotesManagerProps> = ({
  deliveryNotes = [],
  poGroups: passedPoGroups = [],
  allPoLines = [],
  poLines = [],
  onSaveDeliveryNote,
  onNavigateToMatching = () => {},
  onSeriesConfigChanged,
  currentUser,
}) => {
  const [viewMode, setViewMode] = useState<'create' | 'database'>('create');

  const effectiveLines = allPoLines.length > 0 ? allPoLines : poLines;

  // Fallback if poGroups was not supplied directly
  const poGroups = useMemo(() => {
    if (passedPoGroups && passedPoGroups.length > 0) return passedPoGroups;
    if (effectiveLines.length > 0) {
      return groupPOsByNumber(effectiveLines, [], deliveryNotes);
    }
    return [];
  }, [passedPoGroups, effectiveLines, deliveryNotes]);

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
  const [headerComment, setHeaderComment] = useState<string>('Okay');
  const [vatRate] = useState<number>(0.18);

  // Customer series book state & modal
  const [activeCustomerBook, setActiveCustomerBook] = useState<CustomerSeriesBook | null>(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState<boolean>(false);
  const [bookPrefix, setBookPrefix] = useState<string>('CRU');
  const [bookStartNum, setBookStartNum] = useState<number>(1);
  const [bookEndNum, setBookEndNum] = useState<number>(200);
  const [bookCurrentNum, setBookCurrentNum] = useState<number>(1);
  const [bookPadding, setBookPadding] = useState<number>(3);

  // Cancel delivery note modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('No PO reference');
  const [customCancelNote, setCustomCancelNote] = useState<string>('');

  // Line items state
  const [deliveryLines, setDeliveryLines] = useState<DeliveryNoteLineItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSavedDN, setSuccessSavedDN] = useState<DeliveryNoteRecord | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Print modal state
  const [printingDN, setPrintingDN] = useState<DeliveryNoteRecord | null>(null);

  // Database search
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbVendorFilter, setDbVendorFilter] = useState('ALL');

  // Unique vendors / customers list from POs and stored customer books
  const vendors = useMemo(() => {
    const set = new Set<string>();
    poGroups.forEach((g) => {
      if (g.customerName) set.add(g.customerName);
    });
    const storedBooks = loadStoredCustomerSeriesBooks();
    storedBooks.forEach((b) => {
      if (b.customerName) set.add(b.customerName);
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

  // Update customer book whenever customer changes
  const syncCustomerBook = (customerName: string) => {
    if (!customerName || customerName === 'ALL') {
      const general = loadStoredSeriesConfig();
      setActiveCustomerBook(null);
      setDnNumber(
        formatSeriesNumber(
          general.deliverySeries.prefix,
          general.deliverySeries.currentNumber,
          general.deliverySeries.padding
        )
      );
      return;
    }

    const book = getCustomerSeriesBook(customerName);
    setActiveCustomerBook(book);
    setBookPrefix(book.deliveryPrefix || book.invoicePrefix);
    setBookStartNum(book.deliveryStartNumber || 1);
    setBookEndNum(book.deliveryEndNumber || 200);
    setBookCurrentNum(book.deliveryCurrentNumber || 1);
    setBookPadding(book.padding || 3);

    const nextNum = peekCustomerSeriesNumber(customerName, 'delivery');
    setDnNumber(nextNum);
  };

  // Initialize on mount
  useEffect(() => {
    if (!dnNumber) {
      const initialCust = selectedVendor !== 'ALL' ? selectedVendor : (poGroups[0]?.customerName || '');
      if (initialCust) {
        syncCustomerBook(initialCust);
      } else {
        const config = loadStoredSeriesConfig();
        setDnNumber(formatSeriesNumber(config.deliverySeries.prefix, config.deliverySeries.currentNumber, config.deliverySeries.padding));
      }
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
    if (targetGroup.customerName) {
      setSelectedVendor(targetGroup.customerName);
      syncCustomerBook(targetGroup.customerName);
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
    syncCustomerBook(vendor);
    if (vendor === 'ALL') return;

    const vendorPOs = poGroups.filter((po) => po.customerName === vendor);
    if (vendorPOs.length > 0) {
      if (!selectedPoGroup || selectedPoGroup.customerName !== vendor) {
        const firstActive = vendorPOs.find((p) => p.lines.some((l) => (l.undeliveredQuantity ?? l.quantity) > 0)) || vendorPOs[0];
        handleSelectPO(firstActive.poNumber);
      }
    }
  };

  // Advance to next DN series number manually
  const handleAdvanceToNextDNNumber = () => {
    const cust = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : '');
    const nextFormatted = advanceCustomerSeriesNumber(cust, 'delivery');
    setDnNumber(nextFormatted);
    if (cust) {
      const updatedBook = getCustomerSeriesBook(cust);
      setActiveCustomerBook(updatedBook);
    }
    if (onSeriesConfigChanged) onSeriesConfigChanged();
  };

  // Save changes to Customer Delivery Book Settings
  const handleSaveCustomerBookSettings = () => {
    const cust = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : 'General Customer');
    const existing = getCustomerSeriesBook(cust);
    const updatedBook: CustomerSeriesBook = {
      ...existing,
      customerName: cust,
      deliveryPrefix: bookPrefix.trim().toUpperCase() || 'DN',
      deliveryStartNumber: Number(bookStartNum) || 1,
      deliveryEndNumber: Number(bookEndNum) || 200,
      deliveryCurrentNumber: Number(bookCurrentNum) || 1,
      padding: Number(bookPadding) || 3,
    };
    saveOrUpdateCustomerSeriesBook(updatedBook);
    setActiveCustomerBook(updatedBook);
    setDnNumber(formatSeriesNumber(updatedBook.deliveryPrefix, updatedBook.deliveryCurrentNumber, updatedBook.padding));
    setIsBookModalOpen(false);
    if (onSeriesConfigChanged) onSeriesConfigChanged();
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

    const customerName = selectedPoGroup.customerName;

    const totalDeliveredQuantity = selectedLines.reduce(
      (acc, l) => acc + (Number(l.deliveredQuantity) || 0),
      0
    );
    const totalDeliveredValue =
      Math.round(
        selectedLines.reduce((acc, l) => acc + (Number(l.valueAfterVat) || 0), 0) * 100
      ) / 100;

    const newDN: DeliveryNoteRecord = {
      id: `DN-REC-${Date.now()}`,
      deliveryNoteNumber: dnNumber.trim(),
      deliveryDate: dnDate,
      poNumber: selectedPoGroup.poNumber,
      customerName: customerName,
      destination: selectedPoGroup.destination,
      contract: selectedPoGroup.contract,
      poDate: selectedPoGroup.date,
      lines: selectedLines,
      totalDeliveredQuantity,
      totalDeliveredValue,
      carrier: carrier.trim(),
      vehicleNumber: vehicleNumber.trim(),
      driverName: driverName.trim(),
      receivedBy: receivedBy.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      matchedInvoiceNumber: undefined,
      isFullyInvoiced: false,
    };

    // Hide saving button to control double click
    setIsSaving(true);

    onSaveDeliveryNote(newDN);
    setSuccessSavedDN(newDN);

    // Advance series configuration for customer
    const nextFormatted = advanceCustomerSeriesNumber(customerName, 'delivery');
    if (onSeriesConfigChanged) onSeriesConfigChanged();

    if (andPrint) {
      setPrintingDN(newDN);
    }

    // Automatically open a new next record
    setTimeout(() => {
      setDnNumber(nextFormatted);
      setNotes('');
      setCarrier('');
      setVehicleNumber('');
      setDriverName('');
      setReceivedBy('');
      if (selectedPoGroup) {
        handleSelectPO(selectedPoGroup.poNumber);
      }
      setIsSaving(false);
    }, 400);
  };

  // Cancel Delivery Note Number without PO Reference
  const handleConfirmCancelDeliveryNumber = () => {
    const cust = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : 'General Customer');
    const finalReason = cancelReason === 'Other custom reason' ? (customCancelNote || 'Cancelled') : cancelReason;

    const cancelledDN: DeliveryNoteRecord = {
      id: `DN-CANCELLED-${Date.now()}`,
      deliveryNoteNumber: dnNumber.trim(),
      deliveryDate: dnDate,
      poNumber: 'N/A (No PO Reference)',
      customerName: cust,
      destination: 'N/A',
      contract: 'N/A',
      poDate: dnDate,
      carrier: 'N/A',
      vehicleNumber: 'N/A',
      driverName: 'N/A',
      receivedBy: 'N/A',
      lines: [],
      totalDeliveredQuantity: 0,
      totalDeliveredValue: 0,
      isCancelled: true,
      cancelReason: finalReason,
      notes: `CANCELLED: ${finalReason}`,
      createdAt: new Date().toISOString(),
    };

    onSaveDeliveryNote(cancelledDN);

    const nextFormatted = advanceCustomerSeriesNumber(cust, 'delivery');
    setDnNumber(nextFormatted);
    setIsCancelModalOpen(false);
    setHeaderComment('Okay');
    setErrorMessage(null);

    setSuccessSavedDN(cancelledDN);
    if (onSeriesConfigChanged) onSeriesConfigChanged();
  };

  // Reset form for next delivery note
  const handleStartNextDN = () => {
    setSuccessSavedDN(null);
    const cust = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : '');
    const nextNum = peekCustomerSeriesNumber(cust, 'delivery');
    setDnNumber(nextNum);
    setNotes('');
    if (selectedPoGroup) {
      handleSelectPO(selectedPoGroup.poNumber);
    }
  };

  // Export Delivery Notes to Excel
  const handleExportToExcel = () => {
    if (deliveryNotes.length === 0) return;

    const exportRows: any[] = [];
    deliveryNotes.forEach((dn) => {
      if (dn.lines && dn.lines.length > 0) {
        dn.lines.forEach((l) => {
          exportRows.push({
            'DN Number': dn.deliveryNoteNumber,
            'DN Date': dn.deliveryDate,
            'PO Number': dn.poNumber,
            'Customer': dn.customerName,
            'Destination': dn.destination,
            'Carrier': dn.carrier,
            'Vehicle': dn.vehicleNumber,
            'Driver': dn.driverName,
            'Received By': dn.receivedBy,
            'Item Description': l.itemDescription,
            'UOM': l.unitOfMeasure,
            'Delivered Qty': l.deliveredQuantity,
            'Matched Invoice': dn.matchedInvoiceNumber || 'Pending Invoice',
            'Notes': dn.notes || '',
          });
        });
      } else {
        exportRows.push({
          'DN Number': dn.deliveryNoteNumber,
          'DN Date': dn.deliveryDate,
          'PO Number': dn.poNumber,
          'Customer': dn.customerName,
          'Destination': dn.destination,
          'Carrier': dn.carrier,
          'Vehicle': dn.vehicleNumber,
          'Driver': dn.driverName,
          'Received By': dn.receivedBy,
          'Item Description': 'N/A (Cancelled)',
          'UOM': '',
          'Delivered Qty': 0,
          'Matched Invoice': '',
          'Notes': dn.notes || '',
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DeliveryNotes');
    XLSX.writeFile(workbook, `Delivery_Notes_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const allSelected = deliveryLines.length > 0 && deliveryLines.every((l) => l.isSelected);
  const activeCustomer = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : 'General Customer');

  // Filtered Delivery Notes Database
  const filteredDatabaseDNs = useMemo(() => {
    return deliveryNotes.filter((dn) => {
      const matchSearch =
        !dbSearchTerm ||
        dn.deliveryNoteNumber.toLowerCase().includes(dbSearchTerm.toLowerCase()) ||
        dn.poNumber.toLowerCase().includes(dbSearchTerm.toLowerCase()) ||
        dn.customerName.toLowerCase().includes(dbSearchTerm.toLowerCase()) ||
        (dn.carrier && dn.carrier.toLowerCase().includes(dbSearchTerm.toLowerCase()));

      const matchVendor = dbVendorFilter === 'ALL' || dn.customerName === dbVendorFilter;
      return matchSearch && matchVendor;
    });
  }, [deliveryNotes, dbSearchTerm, dbVendorFilter]);

  return (
    <div className="space-y-6 pb-12">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('create')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'create'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Truck className="w-4 h-4" />
            Issue Delivery Note
          </button>
          <button
            onClick={() => setViewMode('database')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'database'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Delivery Notes Database ({deliveryNotes.length})
          </button>
        </div>

        {viewMode === 'database' && (
          <button
            onClick={handleExportToExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export to Excel
          </button>
        )}
      </div>

      {viewMode === 'create' ? (
        <div className="space-y-6">
          {/* Success Banner */}
          {successSavedDN && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-900">
                      Delivery Note {successSavedDN.deliveryNoteNumber} Recorded!
                    </h3>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Logged against PO <span className="font-mono font-bold">{successSavedDN.poNumber}</span> ({successSavedDN.customerName}).
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPrintingDN(successSavedDN)}
                    className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print / PDF
                  </button>
                  <button
                    onClick={() => setViewMode('database')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View DN Database
                  </button>
                  <button
                    onClick={handleStartNextDN}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Issue Another DN
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

          {/* Delivery Note Form Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Top Dark Header */}
            <div className="bg-slate-900 text-white p-5 sm:p-6 border-b border-slate-800">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="font-bold text-lg text-white">Official Goods Delivery Note</h1>
                      {selectedPoGroup && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono font-semibold">
                          {selectedPoGroup.poNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Generate delivery notes with client-specific serial numbering, dispatch carrier details, and line item tracking.
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBookModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Configure customer series book (e.g. CRU001-CRU200)"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                    Customer Book: {activeCustomerBook ? `${activeCustomerBook.deliveryPrefix || activeCustomerBook.invoicePrefix} (${activeCustomerBook.deliveryStartNumber || 1}-${activeCustomerBook.deliveryEndNumber || 200})` : 'Default'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(true)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Mark this delivery note as Cancelled / No PO reference and advance serial number"
                  >
                    <Ban className="w-3.5 h-3.5 text-red-400" />
                    Cancel This # (No PO Ref)
                  </button>
                </div>
              </div>

              {/* Form Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
                {/* 1. Customer Selection */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    Customer Name <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedVendor}
                    onChange={(e) => handleVendorChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">-- Select or Filter Customer --</option>
                    {vendors.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {activeCustomerBook ? `Prefix: ${activeCustomerBook.deliveryPrefix || activeCustomerBook.invoicePrefix}` : 'Customer book applies'}
                  </span>
                </div>

                {/* 2. PO Number Selection */}
                <div className="relative" ref={dropdownRef}>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-blue-400" />
                      PO Number <span className="text-red-400">*</span>
                    </span>
                    {vendorFilteredPOs.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        {vendorFilteredPOs.length} available
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
                      className="w-full pl-3 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIsPoDropdownOpen(!isPoDropdownOpen)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Dropdown Suggestions */}
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
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-500/20 text-blue-300">
                                {po.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Delivery Note Number */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-400" />
                      DN Number <span className="text-red-400">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAdvanceToNextDNNumber}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                      title="Advance customer series"
                    >
                      <Sparkles className="w-3 h-3" />
                      Next #
                    </button>
                  </label>
                  <input
                    type="text"
                    value={dnNumber}
                    onChange={(e) => setDnNumber(e.target.value)}
                    placeholder="e.g. CRU001 or GRB001"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono font-bold text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Prefix: {activeCustomerBook?.deliveryPrefix || activeCustomerBook?.invoicePrefix || 'Default'}
                  </span>
                </div>

                {/* 4. Delivery Date */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    Delivery Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={dnDate}
                    onChange={(e) => setDnDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Logistics & Dispatch Metadata Sub-panel */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Carrier / Transporter</label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Vehicle Plate #</label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Driver Name</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Receiving Officer / Site</label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Line Items Selection & Quantity Allocation Table */}
            {selectedPoGroup ? (
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Line Items Physical Dispatch Allocation
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                        {deliveryTotals.selectedCount} items ({deliveryTotals.totalItemsCount} units)
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select lines dispatched in this delivery batch and enter the verified quantities.
                    </p>
                  </div>

                  {/* Actions Aligned with Header */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(true)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(false)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      Unselect All
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSave(true)}
                      disabled={deliveryTotals.selectedCount === 0 || isSaving}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Save & Print
                    </button>

                    {/* Primary Save Button: Save Delivery */}
                    {!isSaving ? (
                      <button
                        type="button"
                        onClick={() => handleSave(false)}
                        disabled={deliveryTotals.selectedCount === 0}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Save Delivery
                      </button>
                    ) : (
                      <div className="px-5 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-not-allowed">
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving Delivery...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table */}
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
                          <th className="py-3 px-3 min-w-[220px]">Item Description</th>
                          <th className="py-3 px-2 text-center">UOM</th>
                          <th className="py-3 px-3 text-right">PO Total</th>
                          <th className="py-3 px-3 text-right text-slate-300">Delivered</th>
                          <th className="py-3 px-3 text-right text-amber-300">Remaining</th>
                          <th className="py-3 px-3 text-center min-w-[150px]">
                            Dispatch Qty <span className="text-blue-400 font-bold">*</span>
                          </th>
                          <th className="py-3 px-3 text-right">Unit Price</th>
                          <th className="py-3 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deliveryLines.map((line, idx) => {
                          const isDepleted = line.availableQuantity <= 0;

                          return (
                            <tr
                              key={line.poLineId || idx}
                              className={`transition-colors ${
                                !line.isSelected
                                  ? 'bg-slate-50/40 text-slate-400'
                                  : isDepleted
                                  ? 'bg-amber-50/20'
                                  : 'bg-white hover:bg-blue-50/30'
                              }`}
                            >
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={line.isSelected}
                                  onChange={() => handleToggleLine(idx)}
                                  disabled={isDepleted && line.deliveredQuantity === 0}
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-900">
                                <div>{line.itemDescription}</div>
                                {isDepleted && (
                                  <span className="text-[10px] text-amber-600 font-semibold">
                                    Already fully delivered
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-center text-slate-600 font-mono font-semibold">
                                {line.unitOfMeasure}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-slate-700">
                                {line.poQuantity}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-500">
                                {line.alreadyDeliveredQuantity}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-amber-700">
                                {line.availableQuantity}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    max={line.availableQuantity}
                                    step="any"
                                    value={line.deliveredQuantity}
                                    onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                    disabled={!line.isSelected || isDepleted}
                                    className={`w-20 px-2.5 py-1.5 text-center font-bold text-sm rounded-lg border focus:outline-none ${
                                      !line.isSelected || isDepleted
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-white border-blue-400 text-slate-900 focus:ring-2 focus:ring-blue-500/20'
                                    }`}
                                  />
                                  {line.isSelected && line.availableQuantity > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetMaxQuantity(idx)}
                                      className="px-1.5 py-1 text-[10px] font-bold uppercase bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 cursor-pointer"
                                    >
                                      Max
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-slate-800">
                                TZS {formatCurrency(line.unitPrice)}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900">
                                TZS {formatCurrency(line.isSelected ? line.valueAfterVat : 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-600">
                    Selected lines: <span className="font-bold text-slate-900">{deliveryTotals.selectedCount}</span> ({deliveryTotals.totalItemsCount.toLocaleString()} total units).
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartNextDN}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 inline-block mr-1" />
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave(true)}
                      disabled={deliveryTotals.selectedCount === 0 || isSaving}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Printer className="w-4 h-4 inline-block mr-1" />
                      Save & Print DN
                    </button>
                    {!isSaving ? (
                      <button
                        type="button"
                        onClick={() => handleSave(false)}
                        disabled={deliveryTotals.selectedCount === 0}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <Save className="w-4 h-4" />
                        Save Delivery
                      </button>
                    ) : (
                      <div className="px-6 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-not-allowed inline-flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving Delivery...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs">
                Please select or search a PO Number from the header above to load line items.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Database View */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={dbSearchTerm}
                onChange={(e) => setDbSearchTerm(e.target.value)}
                placeholder="Search DN, PO, or Customer..."
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 focus:outline-none focus:border-blue-500"
              />
              <select
                value={dbVendorFilter}
                onChange={(e) => setDbVendorFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Customers</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredDatabaseDNs.length} of {deliveryNotes.length} Delivery Notes
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-800 text-white font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-3">DN Number</th>
                    <th className="py-3 px-3">Delivery Date</th>
                    <th className="py-3 px-3">PO Number</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Destination</th>
                    <th className="py-3 px-3">Vehicle</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDatabaseDNs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No delivery notes recorded yet. Issue one using the 'Issue Delivery Note' tab.
                      </td>
                    </tr>
                  ) : (
                    filteredDatabaseDNs.map((dn) => (
                      <tr key={dn.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-blue-700">
                          {dn.deliveryNoteNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{dn.deliveryDate}</td>
                        <td className="py-3 px-3 font-mono text-slate-800 font-semibold">{dn.poNumber}</td>
                        <td className="py-3 px-3 text-slate-800">{dn.customerName}</td>
                        <td className="py-3 px-3 text-slate-600">{dn.destination}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{dn.vehicleNumber}</td>
                        <td className="py-3 px-3">
                          {dn.poNumber.includes('No PO') ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                              CANCELLED
                            </span>
                          ) : dn.matchedInvoiceNumber ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Matched ({dn.matchedInvoiceNumber})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                              Pending Invoice
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setPrintingDN(dn)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                            title="Print / View Delivery Note"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* Modal: Customer Delivery Series Book Setup */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base">Customer Delivery Series Book Setup</h3>
              </div>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Each customer has their own dedicated prefix and serial number range for delivery notes (e.g. CRU001–CRU200, GRB001–GRB100).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Customer Name</label>
                <input
                  type="text"
                  disabled
                  value={activeCustomer}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Delivery Prefix (e.g. CRU, GRB)
                  </label>
                  <input
                    type="text"
                    value={bookPrefix}
                    onChange={(e) => setBookPrefix(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-blue-700 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Padding Digits
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={bookPadding}
                    onChange={(e) => setBookPadding(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Start Number</label>
                  <input
                    type="number"
                    value={bookStartNum}
                    onChange={(e) => setBookStartNum(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">End Number</label>
                  <input
                    type="number"
                    value={bookEndNum}
                    onChange={(e) => setBookEndNum(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Current Serial #</label>
                  <input
                    type="number"
                    value={bookCurrentNum}
                    onChange={(e) => setBookCurrentNum(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-blue-400 rounded-lg font-bold text-blue-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800">
                Preview Next Number:{' '}
                <span className="font-mono font-bold text-blue-900">
                  {formatSeriesNumber(bookPrefix, bookCurrentNum, bookPadding)}
                </span>{' '}
                (Range: {formatSeriesNumber(bookPrefix, bookStartNum, bookPadding)} to {formatSeriesNumber(bookPrefix, bookEndNum, bookPadding)})
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBookModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomerBookSettings}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Save Book Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mark Delivery Note Number as Cancelled (No PO Reference) */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <Ban className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Cancel Delivery Note Number</h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Mark delivery note leaflet <span className="font-mono font-bold text-red-600">{dnNumber}</span> as Cancelled (No PO Reference). This records the cancelled serial number in the database and automatically advances to the next serial number.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Customer Attribution</label>
                <input
                  type="text"
                  disabled
                  value={activeCustomer}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Cancellation Reason</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 font-medium"
                >
                  <option value="No PO reference">No PO reference</option>
                  <option value="Spoiled / Voided physical DN leaflet">Spoiled / Voided physical DN leaflet</option>
                  <option value="Order cancelled before dispatch">Order cancelled before dispatch</option>
                  <option value="Printed with errors - replaced">Printed with errors - replaced</option>
                  <option value="Other custom reason">Other custom reason</option>
                </select>
              </div>

              {cancelReason === 'Other custom reason' && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Custom Note</label>
                  <input
                    type="text"
                    value={customCancelNote}
                    onChange={(e) => setCustomCancelNote(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-red-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelDeliveryNumber}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                Confirm & Mark Cancelled
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print / PDF Modal */}
      {printingDN && (
        <DeliveryNotePrintModal
          deliveryNote={printingDN}
          onClose={() => setPrintingDN(null)}
        />
      )}
    </div>
  );
};
