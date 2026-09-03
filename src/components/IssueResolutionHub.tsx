import React, { useState, useMemo } from 'react';
import { 
  DocumentIssueRecord, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord, 
  AppUser,
  LineItemIssue,
  IssueDiscussionComment 
} from '../types';
import { formatCurrency } from '../utils/storage';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  Edit3, 
  MessageSquare, 
  Plus, 
  FileText, 
  Truck, 
  CreditCard, 
  Eye, 
  Check, 
  RotateCcw, 
  Trash2, 
  ArrowUpRight, 
  User, 
  Calendar, 
  Building2, 
  FileSpreadsheet, 
  ShieldCheck,
  Send,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface IssueResolutionHubProps {
  issues: DocumentIssueRecord[];
  invoices: InvoiceRecord[];
  deliveryNotes: DeliveryNoteRecord[];
  payments: PaymentRecord[];
  onUpdateIssue: (issue: DocumentIssueRecord) => void;
  onResolveIssue: (issueId: string, resolvedBy: string, resolutionNotes: string) => void;
  onDeleteIssue?: (issueId: string) => void;
  onReloadInvoice: (invoice: InvoiceRecord) => void;
  onOpenFlagModal: (preselected?: { type: 'INVOICE' | 'DELIVERY' | 'PAYMENT'; invoice?: InvoiceRecord; deliveryNote?: DeliveryNoteRecord; payment?: PaymentRecord }) => void;
  currentUser?: AppUser;
}

export const IssueResolutionHub: React.FC<IssueResolutionHubProps> = ({
  issues = [],
  invoices = [],
  deliveryNotes = [],
  payments = [],
  onUpdateIssue,
  onResolveIssue,
  onDeleteIssue,
  onReloadInvoice,
  onOpenFlagModal,
  currentUser,
}) => {
  const [activeEntityType, setActiveEntityType] = useState<'INVOICE' | 'DELIVERY' | 'PAYMENT'>('INVOICE');
  
  // Filters
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [selectedPo, setSelectedPo] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL' | 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED'>('ACTIVE');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Expanded row IDs (single-line with option to expand invoice line)
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());

  // Active work comment inputs per issue: issueId -> commentText
  const [workComments, setWorkComments] = useState<Record<string, string>>({});
  
  // Line-level work comment edits: `${issueId}-${lineId}` -> commentText
  const [lineWorkComments, setLineWorkComments] = useState<Record<string, string>>({});
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  // Quick Resolve Modal State
  const [resolvingIssue, setResolvingIssue] = useState<DocumentIssueRecord | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Auditor';
  const authorName = currentUser?.name || 'Current User';
  const authorRole = currentUser?.role || 'Billing Clerk';

  // Toggle single-line row expansion
  const toggleExpand = (issueId: string) => {
    setExpandedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  // Filter issues by active entity type
  const entityIssues = useMemo(() => {
    return issues.filter((i) => i.entityType === activeEntityType);
  }, [issues, activeEntityType]);

  // Unique customers for the active entity
  const availableCustomers = useMemo(() => {
    const custs = new Set<string>();
    entityIssues.forEach((i) => {
      if (i.customerName) custs.add(i.customerName);
    });
    return Array.from(custs).sort();
  }, [entityIssues]);

  // Unique POs with issues for the active entity
  const availablePOsWithIssues = useMemo(() => {
    const pos = new Set<string>();
    entityIssues.forEach((i) => {
      if (i.poNumber) pos.add(i.poNumber);
    });
    return Array.from(pos).sort();
  }, [entityIssues]);

  // Filtered issues list
  const filteredIssues = useMemo(() => {
    return entityIssues.filter((item) => {
      // Customer filter
      if (selectedCustomer !== 'ALL' && item.customerName !== selectedCustomer) {
        return false;
      }

      // PO filter
      if (selectedPo !== 'ALL' && item.poNumber !== selectedPo) {
        return false;
      }

      // Status filter
      if (statusFilter === 'ACTIVE') {
        if (item.status === 'RESOLVED') return false; // moves out of the issue invoice!
      } else if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const matchRef = item.referenceNumber.toLowerCase().includes(query);
        const matchPo = item.poNumber.toLowerCase().includes(query);
        const matchCust = item.customerName.toLowerCase().includes(query);
        const matchTitle = item.issueTitle.toLowerCase().includes(query);
        const matchComment = item.headerComment.toLowerCase().includes(query);
        const matchLine = item.lineIssues?.some(
          (l) =>
            l.itemDescription.toLowerCase().includes(query) ||
            l.issueComment.toLowerCase().includes(query)
        );
        return matchRef || matchPo || matchCust || matchTitle || matchComment || matchLine;
      }

      return true;
    });
  }, [entityIssues, selectedCustomer, selectedPo, statusFilter, severityFilter, searchTerm]);

  // Metrics calculations for the active entity
  const metrics = useMemo(() => {
    const totalRaised = entityIssues.length;
    const pending = entityIssues.filter((i) => i.status === 'PENDING').length;
    const underReview = entityIssues.filter((i) => i.status === 'UNDER_REVIEW').length;
    const resolved = entityIssues.filter((i) => i.status === 'RESOLVED').length;
    const disputedValue = entityIssues
      .filter((i) => i.status !== 'RESOLVED')
      .reduce((acc, i) => acc + (i.totalValue || 0), 0);

    return { totalRaised, pending, underReview, resolved, disputedValue };
  }, [entityIssues]);

  // Global counts for the top tabs
  const tabCounts = useMemo(() => {
    return {
      invoiceActive: issues.filter((i) => i.entityType === 'INVOICE' && i.status !== 'RESOLVED').length,
      deliveryActive: issues.filter((i) => i.entityType === 'DELIVERY' && i.status !== 'RESOLVED').length,
      paymentActive: issues.filter((i) => i.entityType === 'PAYMENT' && i.status !== 'RESOLVED').length,
    };
  }, [issues]);

  // Worker adds a work comment or submits for review
  const handleAddWorkComment = (issue: DocumentIssueRecord, submitForReview = false) => {
    const text = (workComments[issue.id] || '').trim();
    if (!text) {
      alert('Please enter your comment or review note.');
      return;
    }

    const newComment: IssueDiscussionComment = {
      id: `comm-${Date.now()}`,
      authorName,
      authorRole,
      comment: text,
      createdAt: new Date().toISOString(),
      type: submitForReview ? 'REVIEWER_NOTE' : 'WORK_NOTE',
    };

    const nextStatus = submitForReview ? 'UNDER_REVIEW' : issue.status;

    const updatedIssue: DocumentIssueRecord = {
      ...issue,
      status: nextStatus,
      comments: [...issue.comments, newComment],
    };

    onUpdateIssue(updatedIssue);
    setWorkComments((prev) => ({ ...prev, [issue.id]: '' }));
  };

  // Save line-level work comment
  const handleSaveLineWorkComment = (issue: DocumentIssueRecord, lineId: string) => {
    const key = `${issue.id}-${lineId}`;
    const comment = (lineWorkComments[key] || '').trim();

    const updatedLines = issue.lineIssues.map((line) => {
      if (line.lineId === lineId) {
        return {
          ...line,
          workComment: comment,
        };
      }
      return line;
    });

    const newComment: IssueDiscussionComment = {
      id: `comm-line-${Date.now()}`,
      authorName,
      authorRole,
      comment: `Updated line note on [${lineId}]: "${comment}"`,
      createdAt: new Date().toISOString(),
      type: 'WORK_NOTE',
    };

    const updatedIssue: DocumentIssueRecord = {
      ...issue,
      lineIssues: updatedLines,
      comments: [...issue.comments, newComment],
    };

    onUpdateIssue(updatedIssue);
    setEditingLineId(null);
  };

  // Trigger reload of invoice to correct it
  const handleLoadAndCorrect = (issue: DocumentIssueRecord) => {
    if (issue.entityType !== 'INVOICE') return;
    const inv = invoices.find((i) => i.id === issue.entityId || i.invoiceNumber === issue.referenceNumber);
    if (!inv) {
      alert(`Could not find invoice ${issue.referenceNumber} in database.`);
      return;
    }
    // Reload into invoice creator
    onReloadInvoice(inv);
  };

  // Execute issue resolution
  const handleConfirmResolve = () => {
    if (!resolvingIssue) return;
    const note = resolutionText.trim() || 'Issue verified, invoice/document corrected, and resolved.';
    onResolveIssue(resolvingIssue.id, `${authorName} (${authorRole})`, note);
    setResolvingIssue(null);
    setResolutionText('');
  };

  // Re-open an issue
  const handleReopenIssue = (issue: DocumentIssueRecord) => {
    const updated: DocumentIssueRecord = {
      ...issue,
      status: 'PENDING',
      resolvedBy: undefined,
      resolvedAt: undefined,
      resolutionNotes: undefined,
      comments: [
        ...issue.comments,
        {
          id: `comm-reopen-${Date.now()}`,
          authorName,
          authorRole,
          comment: 'Issue re-opened for further investigation.',
          createdAt: new Date().toISOString(),
          type: 'WORK_NOTE',
        }
      ]
    };
    onUpdateIssue(updated);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Screen Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-2xl p-6 text-white shadow-xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Operational Quality & Discrepancy Control</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Issue Tracking & Resolution Hub
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            All marked invoices, delivery notes, and payments with discrepancies are pooled here. 
            Investigate line-by-line comments, submit findings for review, reload invoices to correct quantities or prices, 
            and resolve issues to automatically clear them from the pending list.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onOpenFlagModal({ type: activeEntityType })}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Flag / Report Issue
          </button>
        </div>
      </div>

      {/* Entity Switcher Pills (Invoice, Delivery, Payment) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => {
            setActiveEntityType('INVOICE');
            setSelectedCustomer('ALL');
            setSelectedPo('ALL');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeEntityType === 'INVOICE'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Invoices with Issues</span>
          {tabCounts.invoiceActive > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeEntityType === 'INVOICE' ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-800'
            }`}>
              {tabCounts.invoiceActive}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveEntityType('DELIVERY');
            setSelectedCustomer('ALL');
            setSelectedPo('ALL');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeEntityType === 'DELIVERY'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Delivery Notes with Issues</span>
          {tabCounts.deliveryActive > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeEntityType === 'DELIVERY' ? 'bg-white text-indigo-700' : 'bg-amber-100 text-amber-800'
            }`}>
              {tabCounts.deliveryActive}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveEntityType('PAYMENT');
            setSelectedCustomer('ALL');
            setSelectedPo('ALL');
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeEntityType === 'PAYMENT'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payments with Issues</span>
          {tabCounts.paymentActive > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeEntityType === 'PAYMENT' ? 'bg-white text-emerald-700' : 'bg-amber-100 text-amber-800'
            }`}>
              {tabCounts.paymentActive}
            </span>
          )}
        </button>
      </div>

      {/* Metrics Cards (Cards to issue, raised, resolved, pending) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
        
        {/* Total Issues Raised */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Raised</span>
            <AlertCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.totalRaised}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            All-time {activeEntityType.toLowerCase()} issues
          </div>
        </div>

        {/* Pending Action */}
        <div className="bg-amber-50/70 rounded-xl border border-amber-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900">{metrics.pending}</div>
          <div className="text-[11px] text-amber-700 mt-1">
            Requires initial work comment
          </div>
        </div>

        {/* Under Review */}
        <div className="bg-blue-50/70 rounded-xl border border-blue-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-800 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Under Review</span>
            <Eye className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900">{metrics.underReview}</div>
          <div className="text-[11px] text-blue-700 mt-1">
            Comments ready for reviewer
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-emerald-50/70 rounded-xl border border-emerald-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900">{metrics.resolved}</div>
          <div className="text-[11px] text-emerald-700 mt-1">
            Corrected & cleared
          </div>
        </div>

        {/* Disputed / Impacted Value */}
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-slate-900 text-white rounded-xl p-4 shadow-xs border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Disputed Value</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">
            TZS {formatCurrency(metrics.disputedValue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            Pending resolution
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (Customer select, PO filter, search) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeEntityType.toLowerCase()} #, PO #, comment...`}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Customer Filter Dropdown */}
          <div>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Customers / Vendors</option>
              {availableCustomers.map((cust) => (
                <option key={cust} value={cust}>
                  {cust}
                </option>
              ))}
            </select>
          </div>

          {/* PO Filter Dropdown */}
          <div>
            <select
              value={selectedPo}
              onChange={(e) => setSelectedPo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All POs with Issues</option>
              {availablePOsWithIssues.map((po) => (
                <option key={po} value={po}>
                  {po}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ACTIVE">Active Issues Only (Pending + Review)</option>
              <option value="ALL">All Statuses (Including Resolved)</option>
              <option value="PENDING">Pending Only</option>
              <option value="UNDER_REVIEW">Under Review Only</option>
              <option value="RESOLVED">Resolved Only</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Only</option>
              <option value="MEDIUM">Medium Only</option>
              <option value="LOW">Low Only</option>
            </select>
          </div>
        </div>

        {/* Quick status indicator & reset filter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div>
            Showing <span className="font-bold text-slate-800">{filteredIssues.length}</span> {activeEntityType.toLowerCase()} issues
            {statusFilter === 'ACTIVE' && ' (Resolved items are automatically hidden)'}
          </div>
          {(selectedCustomer !== 'ALL' || selectedPo !== 'ALL' || statusFilter !== 'ACTIVE' || severityFilter !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedCustomer('ALL');
                setSelectedPo('ALL');
                setStatusFilter('ACTIVE');
                setSeverityFilter('ALL');
                setSearchTerm('');
              }}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Single-Line Table with Expand Option */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredIssues.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
            <div className="text-sm font-bold text-slate-700">
              No issues found matching current filters!
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              All {activeEntityType.toLowerCase()} records in this view are either reconciled or free of active discrepancies.
              {statusFilter === 'ACTIVE' && ' To view resolved issues, change the status filter above to "Resolved Only" or "All Statuses".'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredIssues.map((issue) => {
              const isExpanded = expandedIssueIds.has(issue.id);
              const isResolved = issue.status === 'RESOLVED';
              const isUnderReview = issue.status === 'UNDER_REVIEW';

              // Find associated invoice if applicable
              const matchedInvoice = issue.entityType === 'INVOICE'
                ? invoices.find((i) => i.id === issue.entityId || i.invoiceNumber === issue.referenceNumber)
                : null;

              return (
                <div key={issue.id} className="transition-colors">
                  
                  {/* Single Line Header Bar ("load invoice on a single line with option to expand invoice line") */}
                  <div
                    className={`px-4 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs ${
                      isResolved
                        ? 'bg-slate-50/50 hover:bg-slate-50 opacity-80'
                        : isUnderReview
                        ? 'bg-blue-50/30 hover:bg-blue-50/60'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    {/* Left: Expand button + Status + Identifiers */}
                    <div className="flex items-center flex-wrap gap-2.5 min-w-0">
                      
                      {/* Expand / Collapse toggle button */}
                      <button
                        onClick={() => toggleExpand(issue.id)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse line details' : 'Expand invoice lines & comments'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      {/* Status Badge */}
                      {issue.status === 'RESOLVED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolved
                        </span>
                      ) : issue.status === 'UNDER_REVIEW' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                          <Eye className="w-3 h-3 text-blue-600" /> Under Review
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" /> Pending Work
                        </span>
                      )}

                      {/* Severity Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        issue.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-800'
                          : issue.severity === 'HIGH'
                          ? 'bg-orange-100 text-orange-800'
                          : issue.severity === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {issue.severity}
                      </span>

                      {/* Reference Number */}
                      <div className="font-mono font-bold text-sm text-blue-700">
                        {issue.referenceNumber}
                      </div>

                      {/* PO Number */}
                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                        {issue.poNumber}
                      </span>

                      {/* Customer Name */}
                      <span className="font-bold text-slate-800 whitespace-nowrap">
                        {issue.customerName}
                      </span>

                      {/* Value */}
                      <span className="font-bold text-emerald-700 whitespace-nowrap font-mono">
                        TZS {formatCurrency(issue.totalValue || 0)}
                      </span>

                      {/* Issue Category pill */}
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {issue.issueType}
                      </span>
                    </div>

                    {/* Middle: Brief summary comment */}
                    <div className="text-slate-600 text-[11px] truncate max-w-md italic lg:mx-2">
                      "{issue.headerComment}"
                    </div>

                    {/* Right: Quick Action Buttons on single line */}
                    <div className="flex items-center gap-1.5 shrink-0 justify-end">
                      
                      {/* Work on comments button */}
                      <button
                        onClick={() => toggleExpand(issue.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Open lines and comments"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                        <span>Work on Issue</span>
                        {issue.comments?.length > 0 && (
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                            {issue.comments.length}
                          </span>
                        )}
                      </button>

                      {/* Load & Correct button for invoices */}
                      {issue.entityType === 'INVOICE' && !isResolved && (
                        <button
                          onClick={() => handleLoadAndCorrect(issue)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                          title="Load this invoice in Invoice Creator to amend lines and correct discrepancies"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Load & Correct</span>
                        </button>
                      )}

                      {/* Mark as Resolved button */}
                      {!isResolved ? (
                        <button
                          onClick={() => {
                            setResolvingIssue(issue);
                            setResolutionText('');
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                          title="Mark this issue resolved and clear from active list"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Resolve</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReopenIssue(issue)}
                          className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs inline-flex items-center gap-1 transition-all cursor-pointer"
                          title="Re-open this issue for further investigation"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Re-open</span>
                        </button>
                      )}

                      {/* Delete button (if admin) */}
                      {isAdmin && onDeleteIssue && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove issue record on ${issue.referenceNumber}?`)) {
                              onDeleteIssue(issue.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Delete issue record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details Panel: Lines Table + Comments Workspace */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-200 p-5 space-y-5">
                      
                      {/* Issue Header Info Bar */}
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Flagged By & Date</span>
                          <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            {issue.flaggedBy} on {new Date(issue.flaggedAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Contract / Destination</span>
                          <span className="font-semibold text-slate-800 mt-0.5 block">
                            {issue.contract || 'N/A'} — {issue.destination || 'N/A'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Resolution Status</span>
                          <span className="font-bold text-slate-800 mt-0.5 block">
                            {issue.status === 'RESOLVED' ? (
                              <span className="text-emerald-700">Resolved by {issue.resolvedBy}</span>
                            ) : issue.status === 'UNDER_REVIEW' ? (
                              <span className="text-blue-700">Under Review (Comments pending reviewer)</span>
                            ) : (
                              <span className="text-amber-700">Pending Investigation</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Line Items Table Breakdown (For Invoices and Delivery Notes) */}
                      {issue.lineIssues && issue.lineIssues.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                          <div className="bg-slate-800 px-4 py-2.5 text-white flex items-center justify-between">
                            <div className="font-bold text-xs flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                              Line Items & Line-by-Line Discrepancy Comments
                            </div>
                            <span className="text-[11px] text-slate-300">
                              {issue.lineIssues.length} line(s) with issue details
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3">#</th>
                                  <th className="py-2.5 px-3">Item Description</th>
                                  <th className="py-2.5 px-3 text-right">PO Qty</th>
                                  <th className="py-2.5 px-3 text-right">Billed / Delivered</th>
                                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                                  <th className="py-2.5 px-3 text-right">Total Value</th>
                                  <th className="py-2.5 px-3 min-w-[200px]">Line Discrepancy Comment</th>
                                  <th className="py-2.5 px-3 min-w-[220px]">Worker Investigation Note</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {issue.lineIssues.map((line, idx) => {
                                  const key = `${issue.id}-${line.lineId}`;
                                  const isEditingThis = editingLineId === key;
                                  const currentDraft = lineWorkComments[key] !== undefined ? lineWorkComments[key] : (line.workComment || '');

                                  return (
                                    <tr key={line.lineId || idx} className="hover:bg-slate-50/70">
                                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                                        {line.itemDescription}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-600">
                                        {line.poQuantity || '—'} {line.unitOfMeasure || ''}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                        {line.billedOrDeliveredQuantity || '—'} {line.unitOfMeasure || ''}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                                        TZS {formatCurrency(line.unitPrice || 0)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">
                                        TZS {formatCurrency(line.valueAfterVat || 0)}
                                      </td>
                                      
                                      {/* Line Issue Comment */}
                                      <td className="py-2.5 px-3">
                                        {line.issueComment ? (
                                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                                            {line.issueComment}
                                          </div>
                                        ) : (
                                          <span className="text-slate-400 italic text-[11px]">No specific line issue reported</span>
                                        )}
                                      </td>

                                      {/* Worker's Line Note */}
                                      <td className="py-2.5 px-3">
                                        {isEditingThis ? (
                                          <div className="space-y-1.5">
                                            <input
                                              type="text"
                                              value={currentDraft}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setLineWorkComments((prev) => ({ ...prev, [key]: val }));
                                              }}
                                              placeholder="Enter line findings / resolution comment..."
                                              className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                onClick={() => handleSaveLineWorkComment(issue, line.lineId)}
                                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                              >
                                                Save
                                              </button>
                                              <button
                                                onClick={() => setEditingLineId(null)}
                                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] cursor-pointer"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-slate-700 text-xs">
                                              {line.workComment || (
                                                <span className="text-slate-400 italic text-[11px]">
                                                  No investigation note added yet
                                                </span>
                                              )}
                                            </span>
                                            {!isResolved && (
                                              <button
                                                onClick={() => {
                                                  setEditingLineId(key);
                                                  setLineWorkComments((prev) => ({
                                                    ...prev,
                                                    [key]: line.workComment || '',
                                                  }));
                                                }}
                                                className="text-blue-600 hover:text-blue-800 text-[10px] font-bold shrink-0 cursor-pointer"
                                              >
                                                Edit
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Work Notes & Reviewer Conversation Collaboration Pane */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        
                        {/* Left: Chronological Discussion / Work Log */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-blue-600" />
                              Audit Trail & Collaboration Log
                            </h4>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {issue.comments?.length || 0} note(s)
                            </span>
                          </div>

                          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                            {issue.comments?.map((c, idx) => (
                              <div
                                key={c.id || idx}
                                className={`p-3 rounded-xl border text-xs space-y-1 ${
                                  c.type === 'RESOLUTION_NOTE'
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : c.type === 'REVIEWER_NOTE'
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-slate-800">
                                    {c.authorName} ({c.authorRole})
                                  </span>
                                  <span className="text-slate-400">
                                    {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(c.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-slate-700 leading-relaxed">{c.comment}</p>
                              </div>
                            ))}
                          </div>

                          {/* Resolution Notice if Resolved */}
                          {isResolved && issue.resolutionNotes && (
                            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-1">
                              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                Final Resolution Details
                              </div>
                              <p className="text-emerald-800">{issue.resolutionNotes}</p>
                              <div className="text-[10px] text-emerald-700">
                                Resolved by {issue.resolvedBy} on {issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleString() : 'N/A'}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right: Worker / Reviewer Action Box */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <Edit3 className="w-4 h-4 text-amber-600" />
                                Work on this Issue & Submit for Review
                              </h4>
                              <span className="text-[10px] font-bold uppercase text-slate-400">
                                Active User: {authorName}
                              </span>
                            </div>

                            {!isResolved ? (
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Add Investigation Findings / Notes
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={workComments[issue.id] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setWorkComments((prev) => ({ ...prev, [issue.id]: val }));
                                    }}
                                    placeholder="Enter findings: E.g., Contacted supplier, confirmed delivery was short by 5 tons. Proposed amending invoice to 25 tons..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    onClick={() => handleAddWorkComment(issue, false)}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                                  >
                                    Save Work Note
                                  </button>

                                  <button
                                    onClick={() => handleAddWorkComment(issue, true)}
                                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Submit for Review
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 space-y-1">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                                <div className="font-bold text-slate-800">Issue is Closed & Resolved</div>
                                <p>To add more notes or re-investigate, click "Re-open" above.</p>
                              </div>
                            )}
                          </div>

                          {/* Reviewer / Admin Actions Bar */}
                          {!isResolved && (
                            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-amber-50/40 p-3 rounded-xl border border-amber-100">
                              <div>
                                <span className="text-[11px] font-bold text-amber-900 block">
                                  Reviewer & Admin Action
                                </span>
                                <span className="text-[10px] text-amber-700">
                                  Load invoice to modify lines and resolve
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {issue.entityType === 'INVOICE' && (
                                  <button
                                    onClick={() => handleLoadAndCorrect(issue)}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                                    title="Load into Invoice Creator to amend lines"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Load & Correct Invoice
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setResolvingIssue(issue);
                                    setResolutionText('');
                                  }}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Mark as Resolved
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Resolve Modal */}
      {resolvingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-base">
                <CheckCircle2 className="w-6 h-6" />
                Resolve Issue on {resolvingIssue.referenceNumber}
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Marking this issue as resolved will record your resolution summary, update line items to resolved, 
              and <strong>move this invoice out of the active issues list</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Resolution Notes & Corrective Actions Taken <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="E.g. Invoice CRU005 loaded into creator; corrected Line 1 quantity to 25 tons to match warehouse gate receipt. Re-saved and cleared with client procurement."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setResolvingIssue(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolve}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Confirm & Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
