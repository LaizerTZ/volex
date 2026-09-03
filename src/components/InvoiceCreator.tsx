import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PurchaseOrderGroup, 
  InvoiceRecord, 
  InvoiceLineItem, 
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
  FileText,
  BookOpen,
  Ban,
  Edit3,
  X,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';

interface InvoiceCreatorProps {
  poGroups?: PurchaseOrderGroup[];
  allPoLines?: POLineItem[];
  poLines?: POLineItem[]; // alias fallback
  invoices?: InvoiceRecord[];
  initialPoNumber?: string;
  preselectedPoNumber?: string; // alias fallback
  onSaveInvoice: (invoice: InvoiceRecord) => void;
  onViewInvoicePrint?: (invoice: InvoiceRecord) => void;
  onNavigateToHistory?: () => void;
  onViewInvoicesDatabase?: () => void; // alias fallback
  onSeriesConfigChanged?: () => void;
  editingInvoice?: InvoiceRecord | null;
  onCancelEdit?: () => void;
  currentUser?: AppUser;
}

export const InvoiceCreator: React.FC<InvoiceCreatorProps> = ({
  poGroups: passedPoGroups = [],
  allPoLines = [],
  poLines = [],
  invoices = [],
  initialPoNumber,
  preselectedPoNumber,
  onSaveInvoice,
  onViewInvoicePrint = (_inv?: InvoiceRecord) => {},
  onNavigateToHistory,
  onViewInvoicesDatabase,
  onSeriesConfigChanged,
  editingInvoice = null,
  onCancelEdit,
  currentUser,
}) => {
  const effectiveInitialPo = initialPoNumber || preselectedPoNumber || '';
  const effectiveLines = allPoLines.length > 0 ? allPoLines : poLines;

  // Fallback if poGroups was not supplied directly
  const poGroups = useMemo(() => {
    if (passedPoGroups && passedPoGroups.length > 0) return passedPoGroups;
    if (effectiveLines.length > 0) {
      return groupPOsByNumber(effectiveLines, invoices, []);
    }
    return [];
  }, [passedPoGroups, effectiveLines, invoices]);

  const handleNavigateToHistory = onNavigateToHistory || onViewInvoicesDatabase || (() => {});

  // Vendor / Customer filter
  const [selectedVendor, setSelectedVendor] = useState<string>('ALL');

  // PO search & selection
  const [poSearchInput, setPoSearchInput] = useState<string>(effectiveInitialPo);
  const [selectedPoGroup, setSelectedPoGroup] = useState<PurchaseOrderGroup | null>(null);
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Invoice header fields
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [headerComment, setHeaderComment] = useState<string>('Okay');
  const [vatRate] = useState<number>(0.18); // standard 18% VAT

  // Customer series book state & modal
  const [activeCustomerBook, setActiveCustomerBook] = useState<CustomerSeriesBook | null>(null);
  const [isBookModalOpen, setIsBookModalOpen] = useState<boolean>(false);
  const [bookPrefix, setBookPrefix] = useState<string>('CRU');
  const [bookStartNum, setBookStartNum] = useState<number>(1);
  const [bookEndNum, setBookEndNum] = useState<number>(200);
  const [bookCurrentNum, setBookCurrentNum] = useState<number>(1);
  const [bookPadding, setBookPadding] = useState<number>(3);

  // Cancel invoice modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('Cancelled (No PO Reference)');
  const [customCancelNote, setCustomCancelNote] = useState<string>('');

  // Line items state
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSavedInvoice, setSuccessSavedInvoice] = useState<InvoiceRecord | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

  // Update customer book whenever customer changes or is selected
  const syncCustomerBook = (customerName: string) => {
    if (!customerName || customerName === 'ALL') {
      const general = loadStoredSeriesConfig();
      setActiveCustomerBook(null);
      if (!editingInvoice) {
        setInvoiceNumber(
          formatSeriesNumber(
            general.invoiceSeries.prefix,
            general.invoiceSeries.currentNumber,
            general.invoiceSeries.padding
          )
        );
      }
      return;
    }

    const book = getCustomerSeriesBook(customerName);
    setActiveCustomerBook(book);
    setBookPrefix(book.invoicePrefix);
    setBookStartNum(book.invoiceStartNumber);
    setBookEndNum(book.invoiceEndNumber);
    setBookCurrentNum(book.invoiceCurrentNumber);
    setBookPadding(book.padding);

    if (!editingInvoice) {
      const nextNum = peekCustomerSeriesNumber(customerName, 'invoice');
      setInvoiceNumber(nextNum);
    }
  };

  // Initialize or load editing invoice
  useEffect(() => {
    if (editingInvoice) {
      setInvoiceNumber(editingInvoice.invoiceNumber);
      setInvoiceDate(editingInvoice.invoiceDate);
      setHeaderComment(editingInvoice.comment || 'Okay');
      setNotes(editingInvoice.notes || '');
      setSelectedVendor(editingInvoice.customerName);
      setPoSearchInput(editingInvoice.poNumber);

      const targetGroup = poGroups.find(
        (g) => g.poNumber.trim().toLowerCase() === editingInvoice.poNumber.trim().toLowerCase()
      );
      if (targetGroup) {
        setSelectedPoGroup(targetGroup);
      }

      // Populate lines with existing editing data and comments
      const restoredLines: InvoiceLineItem[] = editingInvoice.lines.map((l) => ({
        ...l,
        comment: l.comment || 'Okay',
        isSelected: true,
      }));
      setInvoiceLines(restoredLines);
      syncCustomerBook(editingInvoice.customerName);
    } else {
      // Default creation mode: load first series number
      if (!invoiceNumber) {
        const initialCustomer = selectedVendor !== 'ALL' ? selectedVendor : (poGroups[0]?.customerName || '');
        if (initialCustomer) {
          syncCustomerBook(initialCustomer);
        } else {
          const cfg = loadStoredSeriesConfig();
          setInvoiceNumber(formatSeriesNumber(cfg.invoiceSeries.prefix, cfg.invoiceSeries.currentNumber, cfg.invoiceSeries.padding));
        }
      }
    }
  }, [editingInvoice]);

  // Open invoice template by default on initial mount / when poGroups loaded
  useEffect(() => {
    if (editingInvoice) return;
    if (poGroups.length > 0 && !selectedPoGroup) {
      if (effectiveInitialPo) {
        handleSelectPO(effectiveInitialPo);
      } else {
        const activePO = poGroups.find((g) => g.status !== 'FULLY_INVOICED') || poGroups[0];
        if (activePO) {
          handleSelectPO(activePO.poNumber);
        }
      }
    }
  }, [poGroups, effectiveInitialPo]);

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
    if (targetGroup.customerName) {
      setSelectedVendor(targetGroup.customerName);
      syncCustomerBook(targetGroup.customerName);
    }

    // Initialize invoice lines from PO lines with default line comment "Okay"
    const lines: InvoiceLineItem[] = targetGroup.lines.map((poLine) => {
      const alreadyInvoiced = poLine.invoicedQuantity || 0;
      const available = Math.max(0, poLine.quantity - alreadyInvoiced);
      
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
        isSelected: available > 0,
        comment: 'Okay', // Default line comment
      };
    });

    setInvoiceLines(lines);
  };

  // Handler when vendor changes in top dropdown
  const handleVendorChange = (vendor: string) => {
    setSelectedVendor(vendor);
    syncCustomerBook(vendor);

    if (vendor === 'ALL') return;

    // Filter POs for this vendor
    const vendorPOs = poGroups.filter((po) => po.customerName === vendor);
    if (vendorPOs.length > 0) {
      if (!selectedPoGroup || selectedPoGroup.customerName !== vendor) {
        const firstActive = vendorPOs.find((p) => p.status !== 'FULLY_INVOICED') || vendorPOs[0];
        handleSelectPO(firstActive.poNumber);
      }
    }
  };

  // Manual advance series number button handler for customer book
  const handleAdvanceNextInvoiceSeries = () => {
    const cust = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : '');
    const nextFormatted = advanceCustomerSeriesNumber(cust, 'invoice');
    setInvoiceNumber(nextFormatted);
    if (cust) {
      const updatedBook = getCustomerSeriesBook(cust);
      setActiveCustomerBook(updatedBook);
    }
    if (onSeriesConfigChanged) onSeriesConfigChanged();
  };

  // Save changes to Customer Series Book
  const handleSaveCustomerBookSettings = () => {
    const cust = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : 'General Customer');
    const existing = getCustomerSeriesBook(cust);
    const updatedBook: CustomerSeriesBook = {
      ...existing,
      customerName: cust,
      invoicePrefix: bookPrefix.trim().toUpperCase() || 'INV',
      invoiceStartNumber: Number(bookStartNum) || 1,
      invoiceEndNumber: Number(bookEndNum) || 200,
      invoiceCurrentNumber: Number(bookCurrentNum) || 1,
      padding: Number(bookPadding) || 3,
      description: `Series book ${bookPrefix.trim().toUpperCase()} for ${cust}`,
    };
    saveOrUpdateCustomerSeriesBook(updatedBook);
    setActiveCustomerBook(updatedBook);
    setInvoiceNumber(formatSeriesNumber(updatedBook.invoicePrefix, updatedBook.invoiceCurrentNumber, updatedBook.padding));
    setIsBookModalOpen(false);
    if (onSeriesConfigChanged) onSeriesConfigChanged();
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

      if (newQty > target.availableQuantity && !editingInvoice) {
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

  // Modify line comment
  const handleLineCommentChange = (index: number, val: string) => {
    setInvoiceLines((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        comment: val,
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

  // Save invoice record (or update existing if editing)
  const handleSave = (andPrint: boolean = false) => {
    setErrorMessage(null);

    if (!selectedPoGroup && !editingInvoice) {
      setErrorMessage('Please select a valid Purchase Order first.');
      return;
    }

    if (!invoiceNumber.trim()) {
      setErrorMessage('Please enter a valid Invoice Number.');
      return;
    }

    // Check duplicate invoice number if not editing existing
    if (!editingInvoice) {
      const isDuplicate = invoices.some(
        (inv) => inv.invoiceNumber.trim().toLowerCase() === invoiceNumber.trim().toLowerCase()
      );
      if (isDuplicate) {
        setErrorMessage(`Invoice number "${invoiceNumber}" already exists in the database. Please use a unique invoice number.`);
        return;
      }
    }

    const selectedLines = invoiceLines.filter((l) => l.isSelected && l.invoicedQuantity > 0);
    if (selectedLines.length === 0) {
      setErrorMessage('Please select at least one line item with an invoiced quantity greater than 0.');
      return;
    }

    // Hide saving button to control double click
    setIsSaving(true);

    const customerName = selectedPoGroup?.customerName || editingInvoice?.customerName || selectedVendor;
    const currentInvNum = invoiceNumber.trim();

    // Build invoice record
    const recordToSave: InvoiceRecord = {
      id: editingInvoice ? editingInvoice.id : `INV-REC-${Date.now()}`,
      invoiceNumber: currentInvNum,
      invoiceDate: invoiceDate,
      poNumber: selectedPoGroup?.poNumber || editingInvoice?.poNumber || 'N/A',
      customerName: customerName,
      destination: selectedPoGroup?.destination || editingInvoice?.destination || 'N/A',
      contract: selectedPoGroup?.contract || editingInvoice?.contract || 'N/A',
      poDate: selectedPoGroup?.date || editingInvoice?.poDate || invoiceDate,
      lines: selectedLines.map((l) => ({
        ...l,
        comment: l.comment || 'Okay',
      })),
      subtotalBeforeVat: invoiceTotals.subtotalBeforeVat,
      totalVat: invoiceTotals.totalVat,
      totalAfterVat: invoiceTotals.totalAfterVat,
      paymentStatus: editingInvoice?.paymentStatus || 'UNPAID',
      paidAmount: editingInvoice?.paidAmount || 0,
      notes: notes.trim(),
      comment: headerComment.trim() || 'Okay',
      status: 'ACTIVE',
      isCancelled: false,
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastModifiedBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Administrator',
    };

    onSaveInvoice(recordToSave);
    setSuccessSavedInvoice(recordToSave);

    // If new invoice, advance the customer's series book
    let nextNum = '';
    if (!editingInvoice) {
      nextNum = advanceCustomerSeriesNumber(customerName, 'invoice');
      if (onSeriesConfigChanged) onSeriesConfigChanged();
    }

    if (andPrint) {
      onViewInvoicePrint(recordToSave);
    }

    // Automatically open a new next record
    setTimeout(() => {
      const targetNextNum = nextNum || peekCustomerSeriesNumber(customerName, 'invoice');
      setInvoiceNumber(targetNextNum);
      setHeaderComment('Okay');
      setNotes('');
      if (selectedPoGroup) {
        handleSelectPO(selectedPoGroup.poNumber);
      }
      if (editingInvoice && onCancelEdit) {
        onCancelEdit();
      }
      setIsSaving(false);
    }, 400);
  };

  // Cancel invoice number without PO reference by default and advance to next serial
  const handleConfirmCancelInvoiceNumber = () => {
    const cust = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : 'General Customer');
    const defaultReason = 'Cancelled (No PO Reference)';

    const cancelledRecord: InvoiceRecord = {
      id: `INV-CANCELLED-${Date.now()}`,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate: invoiceDate,
      poNumber: 'N/A (No PO Reference)',
      customerName: cust,
      destination: 'N/A',
      contract: 'N/A',
      poDate: invoiceDate,
      lines: [],
      subtotalBeforeVat: 0,
      totalVat: 0,
      totalAfterVat: 0,
      paymentStatus: 'UNPAID',
      paidAmount: 0,
      notes: defaultReason,
      comment: defaultReason,
      isCancelled: true,
      status: 'CANCELLED',
      cancelReason: defaultReason,
      createdAt: new Date().toISOString(),
      lastModifiedBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Administrator',
    };

    onSaveInvoice(cancelledRecord);

    // Advance customer book series to next serial number automatically
    const nextFormatted = advanceCustomerSeriesNumber(cust, 'invoice');
    setInvoiceNumber(nextFormatted);
    setIsCancelModalOpen(false);
    setHeaderComment('Okay');
    setErrorMessage(null);

    setSuccessSavedInvoice(cancelledRecord);
    if (onSeriesConfigChanged) onSeriesConfigChanged();
  };

  // Reset form for next invoice
  const handleStartNextInvoice = () => {
    setSuccessSavedInvoice(null);
    const cust = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : '');
    const nextNum = peekCustomerSeriesNumber(cust, 'invoice');
    setInvoiceNumber(nextNum);
    setHeaderComment('Okay');
    setNotes('');
    if (selectedPoGroup) {
      handleSelectPO(selectedPoGroup.poNumber);
    }
    if (editingInvoice && onCancelEdit) {
      onCancelEdit();
    }
  };

  const allSelected = invoiceLines.length > 0 && invoiceLines.every((l) => l.isSelected);
  const activeCustomer = selectedPoGroup?.customerName || (selectedVendor !== 'ALL' ? selectedVendor : 'General Customer');

  return (
    <div className="space-y-6 pb-12">
      {/* Admin Mode Editing Banner */}
      {editingInvoice && (
        <div className="bg-amber-500/10 border-2 border-amber-500 rounded-xl p-4 flex items-center justify-between gap-4 text-amber-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500 text-white">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">
                Reloaded Invoice for Correction: #{editingInvoice.invoiceNumber} (Admin Mode)
              </div>
              <div className="text-xs text-amber-800">
                You are modifying an existing registered invoice. Correct billing quantities, line comments, or customer remarks and click "Save Corrections".
              </div>
            </div>
          </div>
          {onCancelEdit && (
            <button
              onClick={onCancelEdit}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel Edit
            </button>
          )}
        </div>
      )}

      {/* Success Notification Banner after saving or cancelling */}
      {successSavedInvoice && (
        <div className={`border rounded-xl p-5 shadow-sm space-y-3 ${
          successSavedInvoice.isCancelled
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-emerald-50 border-emerald-300 text-emerald-900'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                successSavedInvoice.isCancelled ? 'bg-amber-200 text-amber-800' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {successSavedInvoice.isCancelled ? <Ban className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold">
                  {successSavedInvoice.isCancelled
                    ? `Invoice ${successSavedInvoice.invoiceNumber} Recorded as CANCELLED (No PO Reference)`
                    : `Invoice ${successSavedInvoice.invoiceNumber} Successfully Saved!`}
                </h3>
                <p className="text-xs mt-0.5 opacity-90">
                  {successSavedInvoice.isCancelled
                    ? `Serial mark recorded in database. Book advanced automatically. Ready for next serial.`
                    : `Recorded against PO ${successSavedInvoice.poNumber} (${successSavedInvoice.customerName}). Total: TZS ${formatCurrency(successSavedInvoice.totalAfterVat)}.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!successSavedInvoice.isCancelled && (
                <button
                  onClick={() => onViewInvoicePrint(successSavedInvoice)}
                  className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / PDF
                </button>
              )}
              <button
                onClick={handleNavigateToHistory}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                View Database
              </button>
              <button
                onClick={handleStartNextInvoice}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Next Invoice
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

      {/* Main Form Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Top Invoice Header */}
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
                  Customer-specific serial books, PO 3-way line item billing, customizable line comments, and official PDF generation.
                </p>
              </div>
            </div>

            {/* Quick Actions & Series Indicator */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBookModalOpen(true)}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Configure customer series book (e.g. CRU001-CRU200)"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                Customer Book: {activeCustomerBook ? `${activeCustomerBook.invoicePrefix} (${activeCustomerBook.invoiceStartNumber}-${activeCustomerBook.invoiceEndNumber})` : 'Default'}
              </button>

              <button
                type="button"
                onClick={handleConfirmCancelInvoiceNumber}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Mark this invoice number as Cancelled by default and advance serial number"
              >
                <Ban className="w-3.5 h-3.5 text-red-400" />
                Cancel This # (Mark Cancelled)
              </button>
            </div>
          </div>

          {/* Header Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
            {/* 1. Vendor Selection */}
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
                {activeCustomerBook ? `Book: ${activeCustomerBook.invoicePrefix}001 - ${activeCustomerBook.invoicePrefix}${activeCustomerBook.invoiceEndNumber}` : 'Customer series applies'}
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
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              po.status === 'FULLY_INVOICED'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {po.status === 'FULLY_INVOICED' ? 'Closed' : `TZS ${formatCurrency(po.remainingValueAfterVat)} rem`}
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
                  title="Advance customer series"
                >
                  <Sparkles className="w-3 h-3" />
                  Next #
                </button>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. CRU001 or GRB001"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Prefix: {activeCustomerBook?.invoicePrefix || 'Default'} (Customizable per client)
              </span>
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
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Sub-header: PO Metadata */}
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

        {/* Invoice Header Comment & Remarks Section */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              Invoice Status / Header Comment <span className="text-slate-400 font-normal">(Default: Okay)</span>
            </label>
            <input
              type="text"
              value={headerComment}
              onChange={(e) => setHeaderComment(e.target.value)}
              placeholder="Default is 'Okay', or 'Cancelled', 'No PO reference'..."
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Delivery Notes / General Remarks (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Partial dispatch batch #1, site receiving officer verified..."
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Line Items Selection & Table */}
        {selectedPoGroup || editingInvoice ? (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Line Items Billing & Comment Allocation
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Grand Total: ${formatCurrency(invoiceTotals.totalAfterVat)}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select items to bill, adjust quantity, and record a specific line comment (default is "Okay").
                </p>
              </div>

              {/* Action Buttons Aligned with Header */}
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
                  disabled={invoiceTotals.selectedCount === 0 || isSaving}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Save and preview printable invoice"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-300" />
                  Save & Print
                </button>

                {/* Primary Save Button: Save Invoice */}
                {!isSaving ? (
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={invoiceTotals.selectedCount === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {editingInvoice ? 'Save Invoice (Update)' : 'Save Invoice'}
                  </button>
                ) : (
                  <div className="px-5 py-2 bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-not-allowed">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Invoice...</span>
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
                      <th className="py-3 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3 min-w-[200px]">Item Description</th>
                      <th className="py-3 px-2 text-center">UOM</th>
                      <th className="py-3 px-3 text-right">PO Qty</th>
                      <th className="py-3 px-3 text-right text-slate-300">Invoiced</th>
                      <th className="py-3 px-3 text-right text-amber-300">Available</th>
                      <th className="py-3 px-3 text-center min-w-[130px]">
                        Bill Qty <span className="text-emerald-400 font-bold">*</span>
                      </th>
                      <th className="py-3 px-3 min-w-[160px]">Line Comment</th>
                      <th className="py-3 px-3 text-right">Unit Price</th>
                      <th className="py-3 px-3 text-right">VAT (18%)</th>
                      <th className="py-3 px-3 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceLines.map((line, idx) => {
                      const isDepleted = line.availableQuantity <= 0 && !editingInvoice;

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
                                Fully billed
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

                          {/* Invoiced */}
                          <td className="py-3 px-3 text-right text-slate-500">
                            {line.alreadyInvoicedQuantity}
                          </td>

                          {/* Available */}
                          <td className="py-3 px-3 text-right font-bold text-amber-700">
                            {line.availableQuantity}
                          </td>

                          {/* Bill Qty */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max={editingInvoice ? undefined : line.availableQuantity}
                                step="any"
                                value={line.invoicedQuantity}
                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                disabled={!line.isSelected || (isDepleted && !editingInvoice)}
                                className={`w-20 px-2 py-1 text-center font-bold text-xs rounded-lg border focus:outline-none ${
                                  !line.isSelected || (isDepleted && !editingInvoice)
                                    ? 'bg-slate-100 border-slate-200 text-slate-400'
                                    : 'bg-white border-blue-400 text-slate-900 focus:ring-2 focus:ring-blue-500/20'
                                }`}
                              />
                              {line.isSelected && line.availableQuantity > 0 && !editingInvoice && (
                                <button
                                  type="button"
                                  onClick={() => handleSetMaxQuantity(idx)}
                                  className="px-1.5 py-1 text-[9px] font-bold uppercase bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 cursor-pointer"
                                >
                                  Max
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Line Comment */}
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={line.comment ?? 'Okay'}
                              onChange={(e) => handleLineCommentChange(idx, e.target.value)}
                              placeholder="Line comment (Default: Okay)"
                              className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none"
                            />
                          </td>

                          {/* Unit Price */}
                          <td className="py-3 px-3 text-right font-semibold text-slate-800">
                            ${formatCurrency(line.unitPrice)}
                          </td>

                          {/* VAT */}
                          <td className="py-3 px-3 text-right text-slate-500">
                            ${formatCurrency(line.isSelected ? line.vatAmount : 0)}
                          </td>

                          {/* Line Total */}
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

            {/* Calculations and Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Series & Billing Summary
                </div>
                <p className="text-slate-600">
                  Customer Series: <span className="font-bold text-slate-900">{activeCustomer}</span> ({activeCustomerBook?.invoicePrefix || 'Default'} book series).
                </p>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  Selected Items: <span className="font-bold text-slate-800">{invoiceTotals.selectedCount} lines</span> ({invoiceTotals.totalItemsCount.toLocaleString()} total units).
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Excl. VAT:</span>
                  <span className="font-bold text-slate-900">${formatCurrency(invoiceTotals.subtotalBeforeVat)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total VAT (18%):</span>
                  <span className="font-bold text-slate-900">${formatCurrency(invoiceTotals.totalVat)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Grand Total (Incl. VAT):</span>
                  <span className="text-emerald-700 font-mono text-lg">${formatCurrency(invoiceTotals.totalAfterVat)}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleStartNextInvoice}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Form
              </button>

              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={invoiceTotals.selectedCount === 0 || isSaving}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                Save & Print Preview
              </button>

              {!isSaving ? (
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={invoiceTotals.selectedCount === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {editingInvoice ? 'Save Invoice (Update)' : 'Save Invoice'}
                </button>
              ) : (
                <div className="px-6 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-bold inline-flex items-center gap-2 shadow-xs cursor-not-allowed">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Invoice...</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            Please select or search a PO Number from the header above to load line items.
          </div>
        )}
      </div>

      {/* Modal: Customer Series Book Settings */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base">Customer Series Book Setup</h3>
              </div>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Each customer has their own dedicated prefix and serial number range (e.g. CRU001–CRU200, GRB001–GRB100).
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
                    Invoice Prefix (e.g. CRU, GRB)
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

      {/* Modal: Mark Invoice Number as Cancelled (No PO Reference) */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <Ban className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Cancel Invoice Number</h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Mark invoice leaflet <span className="font-mono font-bold text-red-600">{invoiceNumber}</span> as Cancelled (No PO Reference). This records the cancelled serial number in the database and automatically advances to the next serial number.
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
                  <option value="Spoiled / Voided physical leaflet">Spoiled / Voided physical leaflet</option>
                  <option value="Customer order cancellation">Customer order cancellation</option>
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
                onClick={handleConfirmCancelInvoiceNumber}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                Confirm & Mark Cancelled
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
