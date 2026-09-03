import React, { useState, useMemo, useRef } from 'react';
import { POLineItem, PurchaseOrderGroup, AppUser } from '../types';
import { formatCurrency } from '../utils/storage';
import { exportPOsToExcel } from '../utils/excelParser';
import { 
  Search, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  RotateCcw, 
  Trash2, 
  Receipt, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Layers,
  Building2,
  ChevronDown,
  ChevronRight,
  PackageCheck,
  FileText,
  Mic,
  Sparkles,
  Plus,
  Edit3,
  X,
  PlusCircle,
  Save,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

interface POManagerProps {
  poLines: POLineItem[];
  poGroups: PurchaseOrderGroup[];
  onUploadFile?: (file: File) => void;
  onUploadExcel?: (file: File) => void;
  onDownloadTemplate: () => void;
  onResetData?: () => void;
  onClearData?: () => void;
  onSelectPOForInvoice?: (poNumber: string) => void;
  onCreateInvoiceForPO?: (poNumber: string) => void;
  onNavigateToInvoice?: () => void;
  initialSearchTerm?: string;
  onOpenVoiceSearch?: () => void;
  currentUser?: AppUser;
  onAddPO?: (newLines: POLineItem[]) => void;
  onEditPODetails?: (poNumber: string, details: { customerName: string; destination: string; contract: string; date: string }) => void;
  onAddPOLine?: (newLine: POLineItem) => void;
  onUpdatePOLine?: (updatedLine: POLineItem) => void;
  onDeletePOLine?: (lineId: string) => void;
}

interface VendorPOGroup {
  vendorName: string;
  pos: PurchaseOrderGroup[];
  totalPOs: number;
  totalLines: number;
  totalQuantity: number;
  invoicedQuantity: number;
  remainingQuantity: number;
  totalValueBeforeVat: number;
  totalVat: number;
  totalValueAfterVat: number;
  invoicedValueAfterVat: number;
  remainingValueAfterVat: number;
  status: 'PENDING' | 'PARTIALLY_INVOICED' | 'FULLY_INVOICED';
}

export const POManager: React.FC<POManagerProps> = ({
  poLines,
  poGroups,
  onUploadFile,
  onUploadExcel,
  onDownloadTemplate,
  onResetData,
  onClearData,
  onSelectPOForInvoice,
  onCreateInvoiceForPO,
  onNavigateToInvoice = () => {},
  initialSearchTerm = '',
  onOpenVoiceSearch,
  currentUser,
  onAddPO,
  onEditPODetails,
  onAddPOLine,
  onUpdatePOLine,
  onDeletePOLine,
}) => {
  const handleUpload = onUploadFile || onUploadExcel || (() => {});
  const handleSelectInvoicePO = onSelectPOForInvoice || onCreateInvoiceForPO || (() => {});
  const isAdmin = currentUser?.role === 'Admin';

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'vendor_groups' | 'grouped_pos' | 'line_items'>('vendor_groups');
  const [expandedVendors, setExpandedVendors] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals for Admin PO Editing
  const [isAddPOModalOpen, setIsAddPOModalOpen] = useState(false);
  const [isEditPODetailsModalOpen, setIsEditPODetailsModalOpen] = useState(false);
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [isEditLineModalOpen, setIsEditLineModalOpen] = useState(false);

  // State for Add PO Modal
  const [newPoNumber, setNewPoNumber] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [newContract, setNewContract] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPoLinesInput, setNewPoLinesInput] = useState<Array<{
    description: string;
    uom: string;
    quantity: number;
    unitCost: number;
    unitPrice: number;
    vatRate: number;
  }>>([
    { description: '', uom: 'PCS', quantity: 10, unitCost: 15, unitPrice: 20, vatRate: 0.18 },
  ]);

  // State for Edit PO Details Modal
  const [editingPoNumber, setEditingPoNumber] = useState('');
  const [editDetailsCustomer, setEditDetailsCustomer] = useState('');
  const [editDetailsDestination, setEditDetailsDestination] = useState('');
  const [editDetailsContract, setEditDetailsContract] = useState('');
  const [editDetailsDate, setEditDetailsDate] = useState('');

  // State for Add Line Modal
  const [targetPoForNewLine, setTargetPoForNewLine] = useState<PurchaseOrderGroup | null>(null);
  const [newLineDesc, setNewLineDesc] = useState('');
  const [newLineUOM, setNewLineUOM] = useState('PCS');
  const [newLineQty, setNewLineQty] = useState(1);
  const [newLineCost, setNewLineCost] = useState(10);
  const [newLinePrice, setNewLinePrice] = useState(15);
  const [newLineVatRate, setNewLineVatRate] = useState(0.18);

  // State for Edit Single Line Modal
  const [editingLineItem, setEditingLineItem] = useState<POLineItem | null>(null);

  // Sync initialSearchTerm if changed
  React.useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // Unique customers/vendors for filter
  const customers = useMemo(() => {
    const list = Array.from(new Set(poLines.map((l) => l.customerName))).filter(Boolean);
    return list.sort();
  }, [poLines]);

  // Filtered line items
  const filteredLines = useMemo(() => {
    return poLines.filter((item) => {
      const matchesSearch =
        searchTerm === '' ||
        item.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contract.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemDescription.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCustomer = selectedCustomer === 'ALL' || item.customerName === selectedCustomer;

      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'UNINVOICED' && (item.status === 'UNINVOICED' || !item.invoicedQuantity)) ||
        (selectedStatus === 'PARTIAL' && item.status === 'PARTIALLY_INVOICED') ||
        (selectedStatus === 'FULLY_INVOICED' && item.status === 'FULLY_INVOICED');

      return matchesSearch && matchesCustomer && matchesStatus;
    });
  }, [poLines, searchTerm, selectedCustomer, selectedStatus]);

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return poGroups.filter((grp) => {
      const matchesSearch =
        searchTerm === '' ||
        grp.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grp.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grp.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grp.contract.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCustomer = selectedCustomer === 'ALL' || grp.customerName === selectedCustomer;

      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'UNINVOICED' && grp.status === 'PENDING') ||
        (selectedStatus === 'PARTIAL' && grp.status === 'PARTIALLY_INVOICED') ||
        (selectedStatus === 'FULLY_INVOICED' && grp.status === 'FULLY_INVOICED');

      return matchesSearch && matchesCustomer && matchesStatus;
    });
  }, [poGroups, searchTerm, selectedCustomer, selectedStatus]);

  // Filtered POs grouped by Vendor
  const vendorGroups = useMemo(() => {
    const map = new Map<string, PurchaseOrderGroup[]>();
    filteredGroups.forEach((grp) => {
      const vName = grp.customerName || 'Unassigned Vendor';
      if (!map.has(vName)) {
        map.set(vName, []);
      }
      map.get(vName)!.push(grp);
    });

    const result: VendorPOGroup[] = [];
    map.forEach((pos, vendorName) => {
      let totalLines = 0;
      let totalQuantity = 0;
      let invoicedQuantity = 0;
      let remainingQuantity = 0;
      let totalValueBeforeVat = 0;
      let totalVat = 0;
      let totalValueAfterVat = 0;
      let invoicedValueAfterVat = 0;
      let remainingValueAfterVat = 0;

      pos.forEach((po) => {
        totalLines += po.lines.length;
        totalQuantity += po.totalQuantity;
        invoicedQuantity += po.invoicedQuantity;
        remainingQuantity += po.remainingQuantity;
        totalValueBeforeVat += po.totalValueBeforeVat;
        totalVat += po.totalVat;
        totalValueAfterVat += po.totalValueAfterVat;
        invoicedValueAfterVat += po.invoicedValueAfterVat;
        remainingValueAfterVat += po.remainingValueAfterVat;
      });

      let status: 'PENDING' | 'PARTIALLY_INVOICED' | 'FULLY_INVOICED' = 'PENDING';
      if (invoicedQuantity >= totalQuantity && totalQuantity > 0) {
        status = 'FULLY_INVOICED';
      } else if (invoicedQuantity > 0) {
        status = 'PARTIALLY_INVOICED';
      }

      result.push({
        vendorName,
        pos,
        totalPOs: pos.length,
        totalLines,
        totalQuantity,
        invoicedQuantity,
        remainingQuantity,
        totalValueBeforeVat: Math.round(totalValueBeforeVat * 100) / 100,
        totalVat: Math.round(totalVat * 100) / 100,
        totalValueAfterVat: Math.round(totalValueAfterVat * 100) / 100,
        invoicedValueAfterVat: Math.round(invoicedValueAfterVat * 100) / 100,
        remainingValueAfterVat: Math.round(remainingValueAfterVat * 100) / 100,
        status,
      });
    });

    return result.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  }, [filteredGroups]);

  // Toggle vendor collapse
  const toggleVendorExpand = (vendorName: string) => {
    setExpandedVendors((prev) => ({
      ...prev,
      [vendorName]: prev[vendorName] === undefined ? false : !prev[vendorName],
    }));
  };

  // Totals of filtered data
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalBeforeVat = 0;
    let totalVat = 0;
    let totalAfterVat = 0;
    let totalInvoicedQty = 0;
    let totalRemainingQty = 0;

    filteredLines.forEach((l) => {
      totalQty += l.quantity;
      totalBeforeVat += l.valueBeforeVat;
      totalVat += l.vatAmount;
      totalAfterVat += l.valueAfterVat;
      totalInvoicedQty += l.invoicedQuantity || 0;
      totalRemainingQty += l.remainingQuantity !== undefined ? l.remainingQuantity : l.quantity;
    });

    return {
      totalQty,
      totalBeforeVat: Math.round(totalBeforeVat * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalAfterVat: Math.round(totalAfterVat * 100) / 100,
      totalInvoicedQty,
      totalRemainingQty,
    };
  }, [filteredLines]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  };

  // Open Edit PO Details Modal
  const handleOpenEditPODetails = (grp: PurchaseOrderGroup) => {
    if (!isAdmin) {
      alert('Only Administrator users can edit PO details.');
      return;
    }
    setEditingPoNumber(grp.poNumber);
    setEditDetailsCustomer(grp.customerName);
    setEditDetailsDestination(grp.destination);
    setEditDetailsContract(grp.contract);
    setEditDetailsDate(grp.date);
    setIsEditPODetailsModalOpen(true);
  };

  // Save Edit PO Details
  const handleSavePODetails = () => {
    if (!onEditPODetails) return;
    onEditPODetails(editingPoNumber, {
      customerName: editDetailsCustomer.trim(),
      destination: editDetailsDestination.trim(),
      contract: editDetailsContract.trim(),
      date: editDetailsDate,
    });
    setIsEditPODetailsModalOpen(false);
  };

  // Open Add Line Modal
  const handleOpenAddLine = (grp: PurchaseOrderGroup) => {
    if (!isAdmin) {
      alert('Only Administrator users can add PO lines.');
      return;
    }
    setTargetPoForNewLine(grp);
    setNewLineDesc('');
    setNewLineUOM('PCS');
    setNewLineQty(10);
    setNewLineCost(10);
    setNewLinePrice(15);
    setNewLineVatRate(0.18);
    setIsAddLineModalOpen(true);
  };

  // Save New Line to PO
  const handleSaveNewLine = () => {
    if (!onAddPOLine || !targetPoForNewLine) return;
    if (!newLineDesc.trim()) {
      alert('Please enter an item description.');
      return;
    }

    const valBefore = Math.round(newLineQty * newLinePrice * 100) / 100;
    const vatAmt = Math.round(valBefore * newLineVatRate * 100) / 100;
    const valAfter = Math.round((valBefore + vatAmt) * 100) / 100;

    const newLine: POLineItem = {
      id: `POLINE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      poNumber: targetPoForNewLine.poNumber,
      customerName: targetPoForNewLine.customerName,
      destination: targetPoForNewLine.destination,
      contract: targetPoForNewLine.contract,
      date: targetPoForNewLine.date,
      itemDescription: newLineDesc.trim(),
      unitOfMeasure: newLineUOM.trim() || 'PCS',
      quantity: Number(newLineQty),
      unitCost: Number(newLineCost),
      unitPrice: Number(newLinePrice),
      valueBeforeVat: valBefore,
      vatRate: Number(newLineVatRate),
      vatAmount: vatAmt,
      valueAfterVat: valAfter,
      invoicedQuantity: 0,
      remainingQuantity: Number(newLineQty),
      status: 'UNINVOICED',
    };

    onAddPOLine(newLine);
    setIsAddLineModalOpen(false);
  };

  // Open Edit Single Line Modal
  const handleOpenEditLine = (item: POLineItem) => {
    if (!isAdmin) {
      alert('Only Administrator users can edit PO line items.');
      return;
    }
    setEditingLineItem({ ...item });
    setIsEditLineModalOpen(true);
  };

  // Save Single Line Edit
  const handleSaveEditLine = () => {
    if (!onUpdatePOLine || !editingLineItem) return;

    const valBefore = Math.round(editingLineItem.quantity * editingLineItem.unitPrice * 100) / 100;
    const vatAmt = Math.round(valBefore * (editingLineItem.vatRate || 0.18) * 100) / 100;
    const valAfter = Math.round((valBefore + vatAmt) * 100) / 100;

    const updated: POLineItem = {
      ...editingLineItem,
      valueBeforeVat: valBefore,
      vatAmount: vatAmt,
      valueAfterVat: valAfter,
      remainingQuantity: Math.max(0, editingLineItem.quantity - (editingLineItem.invoicedQuantity || 0)),
    };

    onUpdatePOLine(updated);
    setIsEditLineModalOpen(false);
  };

  // Handle Save New PO Modal
  const handleSaveNewPO = () => {
    if (!onAddPO) return;
    if (!newPoNumber.trim()) {
      alert('Please enter a PO Number.');
      return;
    }
    if (!newCustomerName.trim()) {
      alert('Please enter Customer Name.');
      return;
    }

    const validLines = newPoLinesInput.filter((l) => l.description.trim() && l.quantity > 0);
    if (validLines.length === 0) {
      alert('Please enter at least one valid line item with description and quantity.');
      return;
    }

    const createdLines: POLineItem[] = validLines.map((l, idx) => {
      const valBefore = Math.round(l.quantity * l.unitPrice * 100) / 100;
      const vatAmt = Math.round(valBefore * l.vatRate * 100) / 100;
      const valAfter = Math.round((valBefore + vatAmt) * 100) / 100;

      return {
        id: `POLINE-${Date.now()}-${idx}`,
        poNumber: newPoNumber.trim(),
        customerName: newCustomerName.trim(),
        destination: newDestination.trim() || 'Head Office',
        contract: newContract.trim() || 'General Supply',
        date: newDate,
        itemDescription: l.description.trim(),
        unitOfMeasure: l.uom.trim() || 'PCS',
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
        unitPrice: Number(l.unitPrice),
        valueBeforeVat: valBefore,
        vatRate: Number(l.vatRate),
        vatAmount: vatAmt,
        valueAfterVat: valAfter,
        invoicedQuantity: 0,
        remainingQuantity: Number(l.quantity),
        status: 'UNINVOICED',
      };
    });

    onAddPO(createdLines);
    setIsAddPOModalOpen(false);
    // Reset fields
    setNewPoNumber('');
    setNewCustomerName('');
    setNewDestination('');
    setNewContract('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Excel Upload Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all bg-white ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".xlsx, .xls, .csv"
          className="hidden"
        />
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Upload Purchase Order Excel File</h2>
            <p className="text-xs text-slate-500 mt-1">
              Supports <span className="font-semibold text-slate-700">.xlsx, .xls, .csv</span> with headers: Customer/Vendor name, destination, PO number, contract, item description, date, unit cost, quantity, unit price, value before VAT & VAT, and optional Delivery Notes / General Remarks.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Browse Excel File
            </button>
            <button
              onClick={onDownloadTemplate}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template
            </button>

            {/* Admin: Add New PO Button */}
            {onAddPO && (
              <button
                onClick={() => {
                  if (!isAdmin) {
                    alert('Only Administrator users are permitted to manually add POs.');
                    return;
                  }
                  setIsAddPOModalOpen(true);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isAdmin
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
                title={isAdmin ? "Admin: Manually add a Purchase Order" : "Admin Only"}
              >
                <Plus className="w-3.5 h-3.5" />
                Add New PO (Admin)
              </button>
            )}

            <button
              onClick={onResetData}
              className="px-3 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
              title="Reload sample dataset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reload Samples
            </button>
            {poLines.length > 0 && (
              <button
                onClick={onClearData}
                className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                title="Clear all loaded PO lines"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Auto-Calculated Totals Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Filtered Vendors</span>
          <div className="text-xl font-bold text-slate-900 mt-1">{vendorGroups.length} <span className="text-xs font-normal text-slate-400">Vendors</span></div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Quantity</span>
          <div className="text-xl font-bold text-slate-900 mt-1">{totals.totalQty.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400">Rem: {totals.totalRemainingQty.toLocaleString()}</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Excl. VAT</span>
          <div className="text-xl font-bold text-slate-900 mt-1">TZS {formatCurrency(totals.totalBeforeVat)}</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">Total VAT (18%)</span>
          <div className="text-xl font-bold text-slate-900 mt-1">TZS {formatCurrency(totals.totalVat)}</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm bg-gradient-to-br from-blue-50/50 to-white">
          <span className="text-[11px] font-semibold text-blue-700 uppercase">Total Incl. VAT</span>
          <div className="text-xl font-bold text-blue-800 mt-1">TZS {formatCurrency(totals.totalAfterVat)}</div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase">Invoiced Qty</span>
          <div className="text-xl font-bold text-emerald-800 mt-1">
            {totals.totalInvoicedQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">/ {totals.totalQty}</span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="flex-1 relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vendor, PO number, destination, contract, or line item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {onOpenVoiceSearch && (
            <button
              type="button"
              onClick={onOpenVoiceSearch}
              className="absolute right-2.5 p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
              title="Speak to Search (Cmd+K)"
            >
              <Mic className="w-4 h-4 text-blue-500" />
            </button>
          )}
        </div>

        {/* Dropdown Filters & Views */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Customer / Vendor Filter */}
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Vendors ({customers.length})</option>
            {customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNINVOICED">Pending (Uninvoiced)</option>
            <option value="PARTIAL">Partially Invoiced</option>
            <option value="FULLY_INVOICED">Fully Invoiced</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('vendor_groups')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'vendor_groups'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Group by Vendor
            </button>
            <button
              onClick={() => setViewMode('grouped_pos')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grouped_pos'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Group by PO
            </button>
            <button
              onClick={() => setViewMode('line_items')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'line_items'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              All Lines
            </button>
          </div>

          {/* Export button */}
          <button
            onClick={() => exportPOsToExcel(filteredLines)}
            disabled={filteredLines.length === 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Export filtered lines to Excel"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Main View Render */}
      {viewMode === 'vendor_groups' && (
        <div className="space-y-4">
          {vendorGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              No Purchase Orders found matching your current filter.
            </div>
          ) : (
            vendorGroups.map((vGroup) => {
              const isExpanded = expandedVendors[vGroup.vendorName] !== false;
              const vendorPercent = vGroup.totalValueAfterVat > 0
                ? Math.round((vGroup.invoicedValueAfterVat / vGroup.totalValueAfterVat) * 100)
                : 0;

              return (
                <div
                  key={vGroup.vendorName}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all"
                >
                  {/* Vendor Header Bar */}
                  <div
                    onClick={() => toggleVendorExpand(vGroup.vendorName)}
                    className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-600/30 border border-blue-400/30 text-blue-300">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-white">{vGroup.vendorName}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                            {vGroup.totalPOs} {vGroup.totalPOs === 1 ? 'PO' : 'POs'} ({vGroup.totalLines} lines)
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {vGroup.invoicedQuantity.toLocaleString()} of {vGroup.totalQuantity.toLocaleString()} units invoiced • Rem. Value: TZS {formatCurrency(vGroup.remainingValueAfterVat)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Financial Status Badges */}
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-semibold text-slate-400 uppercase">Vendor PO Value</div>
                        <div className="text-sm font-bold text-white font-mono">
                          TZS {formatCurrency(vGroup.totalValueAfterVat)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {vGroup.status === 'FULLY_INVOICED' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Fully Invoiced (100%)
                          </span>
                        )}
                        {vGroup.status === 'PARTIALLY_INVOICED' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Invoiced ({vendorPercent}%)
                          </span>
                        )}
                        {vGroup.status === 'PENDING' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Pending (0%)
                          </span>
                        )}

                        <div className="p-1 rounded text-slate-400 hover:text-white">
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vendor Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-200">
                    <div
                      className={`h-full transition-all ${
                        vendorPercent === 100 ? 'bg-emerald-500' : vendorPercent > 0 ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                      style={{ width: `${vendorPercent}%` }}
                    />
                  </div>

                  {/* Expanded POs Under this Vendor */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {vGroup.pos.map((grp) => {
                          const poPercent = grp.totalValueAfterVat > 0
                            ? Math.round((grp.invoicedValueAfterVat / grp.totalValueAfterVat) * 100)
                            : 0;

                          return (
                            <div
                              key={grp.poNumber}
                              className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900 font-mono">
                                      {grp.poNumber}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-medium">
                                      {grp.contract}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {grp.destination} • Date: {grp.date}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {grp.status === 'FULLY_INVOICED' && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Closed
                                    </span>
                                  )}
                                  {grp.status === 'PARTIALLY_INVOICED' && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" /> {poPercent}%
                                    </span>
                                  )}
                                  {grp.status === 'PENDING' && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> Pending
                                    </span>
                                  )}

                                  {/* Admin PO Edit & Add Line Buttons */}
                                  {isAdmin && (
                                    <div className="flex items-center gap-1 ml-1 border-l border-slate-200 pl-1.5">
                                      <button
                                        onClick={() => handleOpenEditPODetails(grp)}
                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                        title="Admin: Edit PO Details"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleOpenAddLine(grp)}
                                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                        title="Admin: Add PO Line"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-600">
                                  <span>Invoiced: TZS {formatCurrency(grp.invoicedValueAfterVat)}</span>
                                  <span className="font-bold text-slate-900">TZS {formatCurrency(grp.totalValueAfterVat)}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                                    style={{ width: `${poPercent}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-400">
                                  <span>{grp.invoicedQuantity} of {grp.totalQuantity} items</span>
                                  <span className="text-amber-600 font-medium">Rem: TZS {formatCurrency(grp.remainingValueAfterVat)}</span>
                                </div>
                              </div>

                              {/* Line Items List */}
                              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-1 max-h-36 overflow-y-auto text-xs">
                                {grp.lines.map((ln) => (
                                  <div
                                    key={ln.id}
                                    className="flex items-center justify-between py-1 border-b border-slate-200/50 last:border-0 text-[11px]"
                                  >
                                    <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                                      {isAdmin && (
                                        <button
                                          onClick={() => handleOpenEditLine(ln)}
                                          className="text-slate-400 hover:text-blue-600 shrink-0 cursor-pointer"
                                          title="Admin: Edit Line"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                      )}
                                      <span className="truncate text-slate-700 font-medium" title={ln.itemDescription}>
                                        {ln.itemDescription}
                                      </span>
                                      {ln.remarks && (
                                        <span className="text-[10px] text-slate-400 truncate italic" title={`Delivery Notes / Remarks: ${ln.remarks}`}>
                                          ({ln.remarks})
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-slate-500 font-mono">
                                        {ln.invoicedQuantity || 0}/{ln.quantity} {ln.unitOfMeasure}
                                      </span>
                                      <span className="font-semibold text-slate-900">
                                        TZS {formatCurrency(ln.valueAfterVat)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                                <button
                                  onClick={() => {
                                    handleSelectInvoicePO(grp.poNumber);
                                    onNavigateToInvoice();
                                  }}
                                  disabled={grp.status === 'FULLY_INVOICED'}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    grp.status === 'FULLY_INVOICED'
                                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                                  }`}
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  Record Invoice for {grp.poNumber}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {viewMode === 'grouped_pos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGroups.map((grp) => {
            const percent = grp.totalValueAfterVat > 0
              ? Math.round((grp.invoicedValueAfterVat / grp.totalValueAfterVat) * 100)
              : 0;

            return (
              <div key={grp.poNumber} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-900 font-mono">{grp.poNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        {grp.contract}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mt-1">{grp.customerName}</div>
                    <div className="text-xs text-slate-500">{grp.destination} • Date: {grp.date}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {grp.status === 'FULLY_INVOICED' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Closed (100%)
                      </span>
                    )}
                    {grp.status === 'PARTIALLY_INVOICED' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Partial ({percent}%)
                      </span>
                    )}
                    {grp.status === 'PENDING' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Pending (0%)
                      </span>
                    )}

                    {isAdmin && (
                      <div className="flex items-center gap-1 ml-1 border-l border-slate-200 pl-1.5">
                        <button
                          onClick={() => handleOpenEditPODetails(grp)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                          title="Admin: Edit PO Details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenAddLine(grp)}
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                          title="Admin: Add PO Line"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Invoiced: TZS {formatCurrency(grp.invoicedValueAfterVat)}</span>
                    <span className="font-bold text-slate-900">Total: TZS {formatCurrency(grp.totalValueAfterVat)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{grp.invoicedQuantity} of {grp.totalQuantity} items invoiced</span>
                    <span className="text-amber-600 font-medium">Rem. balance: TZS {formatCurrency(grp.remainingValueAfterVat)}</span>
                  </div>
                </div>

                {/* Lines summary table */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1.5 max-h-36 overflow-y-auto text-xs">
                  {grp.lines.map((ln) => (
                    <div key={ln.id} className="flex items-center justify-between py-0.5 border-b border-slate-200/50 last:border-0">
                      <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEditLine(ln)}
                            className="text-slate-400 hover:text-blue-600 shrink-0 cursor-pointer"
                            title="Admin: Edit Line"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        )}
                        <span className="truncate text-slate-700 font-medium" title={ln.itemDescription}>
                          {ln.itemDescription}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">
                          {ln.invoicedQuantity || 0}/{ln.quantity} {ln.unitOfMeasure}
                        </span>
                        <span className="font-semibold text-slate-900">
                          TZS {formatCurrency(ln.valueAfterVat)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      handleSelectInvoicePO(grp.poNumber);
                      onNavigateToInvoice();
                    }}
                    disabled={grp.status === 'FULLY_INVOICED'}
                    className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      grp.status === 'FULLY_INVOICED'
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Record Invoice for {grp.poNumber}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'line_items' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-800 text-white sticky top-0 z-10 font-semibold tracking-wider uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">PO Number</th>
                  <th className="py-3 px-3">Vendor / Customer</th>
                  <th className="py-3 px-3">Destination</th>
                  <th className="py-3 px-3">Contract</th>
                  <th className="py-3 px-3 min-w-[220px]">Item Description</th>
                  <th className="py-3 px-3">Date (LPO)</th>
                  <th className="py-3 px-3">UOM</th>
                  <th className="py-3 px-3 text-right">PO Qty</th>
                  <th className="py-3 px-3 text-right">Invoiced</th>
                  <th className="py-3 px-3 text-right">Rem. Qty</th>
                  <th className="py-3 px-3 text-right">Unit Price</th>
                  <th className="py-3 px-3 text-right">Value (Incl. VAT)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-12 text-center text-slate-400">
                      No Purchase Order lines match your current search and filters.
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">{item.poNumber}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">{item.customerName}</td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{item.destination}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{item.contract}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[260px]" title={item.itemDescription}>
                        <div className="truncate">{item.itemDescription}</div>
                        {item.remarks && (
                          <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5" title={`Delivery Notes / Remarks: ${item.remarks}`}>
                            <span className="font-semibold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded text-[9px]">DN/Note</span>
                            <span className="truncate">{item.remarks}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{item.date}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-semibold text-[11px]">{item.unitOfMeasure}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                        {item.invoicedQuantity || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-amber-700">
                        {item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">TZS {formatCurrency(item.unitPrice)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">TZS {formatCurrency(item.valueAfterVat)}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {item.status === 'FULLY_INVOICED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Fully Invoiced
                          </span>
                        )}
                        {item.status === 'PARTIALLY_INVOICED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                            <AlertCircle className="w-3 h-3" /> Partial
                          </span>
                        )}
                        {(!item.status || item.status === 'UNINVOICED') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenEditLine(item)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                              title="Admin: Edit Line"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              handleSelectInvoicePO(item.poNumber);
                              onNavigateToInvoice();
                            }}
                            disabled={item.status === 'FULLY_INVOICED'}
                            className={`px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                              item.status === 'FULLY_INVOICED'
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200'
                            }`}
                          >
                            <Receipt className="w-3 h-3" />
                            Invoice
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
      )}

      {/* Modal: Admin Add New Purchase Order */}
      {isAddPOModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <PlusCircle className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Create New Purchase Order (Admin)</h3>
              </div>
              <button
                onClick={() => setIsAddPOModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">PO Number *</label>
                <input
                  type="text"
                  value={newPoNumber}
                  onChange={(e) => setNewPoNumber(e.target.value)}
                  placeholder="e.g. PO-2025-088"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Customer / Vendor Name *</label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="e.g. CRU Mining Ltd or GRB Mining"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Destination</label>
                <input
                  type="text"
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                  placeholder="e.g. Geita Site / Warehouse A"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Contract / Ref</label>
                <input
                  type="text"
                  value={newContract}
                  onChange={(e) => setNewContract(e.target.value)}
                  placeholder="e.g. CNT-2025-ENG"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">PO Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800">PO Line Items</h4>
                <button
                  type="button"
                  onClick={() =>
                    setNewPoLinesInput([
                      ...newPoLinesInput,
                      { description: '', uom: 'PCS', quantity: 10, unitCost: 15, unitPrice: 20, vatRate: 0.18 },
                    ])
                  }
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Line
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {newPoLinesInput.map((line, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-6 gap-2 text-xs">
                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-500 block">Item Description</label>
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => {
                          const updated = [...newPoLinesInput];
                          updated[idx].description = e.target.value;
                          setNewPoLinesInput(updated);
                        }}
                        placeholder="Description..."
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">UOM</label>
                      <input
                        type="text"
                        value={line.uom}
                        onChange={(e) => {
                          const updated = [...newPoLinesInput];
                          updated[idx].uom = e.target.value;
                          setNewPoLinesInput(updated);
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...newPoLinesInput];
                          updated[idx].quantity = Number(e.target.value);
                          setNewPoLinesInput(updated);
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded focus:outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">Unit Price</label>
                      <input
                        type="number"
                        step="any"
                        value={line.unitPrice}
                        onChange={(e) => {
                          const updated = [...newPoLinesInput];
                          updated[idx].unitPrice = Number(e.target.value);
                          setNewPoLinesInput(updated);
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded focus:outline-none font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddPOModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewPO}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Save Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit PO Details */}
      {isEditPODetailsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-600">
                <Edit3 className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Edit PO Details ({editingPoNumber})</h3>
              </div>
              <button
                onClick={() => setIsEditPODetailsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Modifying these fields will update all line items associated with PO <span className="font-mono font-bold text-slate-800">{editingPoNumber}</span>.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Customer / Vendor Name</label>
                <input
                  type="text"
                  value={editDetailsCustomer}
                  onChange={(e) => setEditDetailsCustomer(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Destination</label>
                <input
                  type="text"
                  value={editDetailsDestination}
                  onChange={(e) => setEditDetailsDestination(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Contract / Ref</label>
                <input
                  type="text"
                  value={editDetailsContract}
                  onChange={(e) => setEditDetailsContract(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">PO Date</label>
                <input
                  type="date"
                  value={editDetailsDate}
                  onChange={(e) => setEditDetailsDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditPODetailsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePODetails}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Line to Existing PO */}
      {isAddLineModalOpen && targetPoForNewLine && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <PlusCircle className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">
                  Add Line Item to {targetPoForNewLine.poNumber}
                </h3>
              </div>
              <button
                onClick={() => setIsAddLineModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Item Description *</label>
                <input
                  type="text"
                  value={newLineDesc}
                  onChange={(e) => setNewLineDesc(e.target.value)}
                  placeholder="e.g. Hydraulic Seal Kit 40mm"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">UOM</label>
                  <input
                    type="text"
                    value={newLineUOM}
                    onChange={(e) => setNewLineUOM(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={newLineQty}
                    onChange={(e) => setNewLineQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit Cost</label>
                  <input
                    type="number"
                    step="any"
                    value={newLineCost}
                    onChange={(e) => setNewLineCost(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit Price *</label>
                  <input
                    type="number"
                    step="any"
                    value={newLinePrice}
                    onChange={(e) => setNewLinePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold focus:outline-none text-blue-700"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">VAT Rate</label>
                  <select
                    value={newLineVatRate}
                    onChange={(e) => setNewLineVatRate(Number(e.target.value))}
                    className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
                  >
                    <option value={0.18}>18% (Standard)</option>
                    <option value={0}>0% (Exempt)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800">
                Calculated Line Total: TZS {formatCurrency(newLineQty * newLinePrice * (1 + newLineVatRate))} (Incl. VAT)
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddLineModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewLine}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Add Line Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing PO Line Item */}
      {isEditLineModalOpen && editingLineItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-600">
                <Edit3 className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Edit Line Item</h3>
              </div>
              <button
                onClick={() => setIsEditLineModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Item Description</label>
                <input
                  type="text"
                  value={editingLineItem.itemDescription}
                  onChange={(e) =>
                    setEditingLineItem({ ...editingLineItem, itemDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">UOM</label>
                  <input
                    type="text"
                    value={editingLineItem.unitOfMeasure}
                    onChange={(e) =>
                      setEditingLineItem({ ...editingLineItem, unitOfMeasure: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={editingLineItem.quantity}
                    onChange={(e) =>
                      setEditingLineItem({ ...editingLineItem, quantity: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit Cost</label>
                  <input
                    type="number"
                    step="any"
                    value={editingLineItem.unitCost}
                    onChange={(e) =>
                      setEditingLineItem({ ...editingLineItem, unitCost: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit Price</label>
                  <input
                    type="number"
                    step="any"
                    value={editingLineItem.unitPrice}
                    onChange={(e) =>
                      setEditingLineItem({ ...editingLineItem, unitPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Delivery Notes / General Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. DN-2026-089 / Partial delivery schedule"
                  value={editingLineItem.remarks || ''}
                  onChange={(e) =>
                    setEditingLineItem({ ...editingLineItem, remarks: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {editingLineItem.invoicedQuantity ? (
                <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  Note: {editingLineItem.invoicedQuantity} units have already been invoiced for this line.
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {onDeletePOLine ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this PO line item?')) {
                      onDeletePOLine(editingLineItem.id);
                      setIsEditLineModalOpen(false);
                    }
                  }}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Line
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditLineModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditLine}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
