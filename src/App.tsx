/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ActiveTab, Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { POManager } from './components/POManager';
import { InvoiceCreator } from './components/InvoiceCreator';
import { InvoiceHistory } from './components/InvoiceHistory';
import { POTrackingLedger } from './components/POTrackingLedger';
import { MatchingReport } from './components/MatchingReport';
import { DeliveryNotesManager } from './components/DeliveryNotesManager';
import { PaymentsManager } from './components/PaymentsManager';
import { SettingsManager } from './components/SettingsManager';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { MasterExportModal } from './components/MasterExportModal';
import { AIVoiceCommandModal } from './components/AIVoiceCommandModal';
import { AIAutoReportModal } from './components/AIAutoReportModal';
import { IssueResolutionHub } from './components/IssueResolutionHub';
import { FlagIssueModal } from './components/FlagIssueModal';
import { PinLoginModal } from './components/PinLoginModal';
import { 
  POLineItem, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord,
  AppUser,
  GoogleSheetsConfig,
  DocumentIssueRecord
} from './types';
import { 
  loadStoredPOs, 
  savePOs, 
  loadStoredInvoices, 
  saveInvoices, 
  loadStoredDeliveryNotes,
  saveDeliveryNotes,
  loadStoredPayments,
  savePayments,
  loadStoredIssues,
  saveIssues,
  addOrUpdateIssue,
  resolveDocumentIssue,
  loadStoredUsers,
  loadStoredSeriesConfig,
  enrichPOLinesWithTracking, 
  groupPOsByNumber, 
  calculateDashboardMetrics,
  resetToSampleData,
  clearAllData
} from './utils/storage';
import { parseExcelPOData, generateSampleExcelTemplate } from './utils/excelParser';
import { getCurrentSessionUser, validateEmailAccessToken, canViewScreen } from './utils/authService';
import { loadSheetsConfig, syncAllDataToGoogleSheets } from './utils/googleSheetsService';
import { CheckCircle2, AlertCircle, X, Sparkles, Cloud, Mic, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [poLines, setPoLines] = useState<POLineItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [issues, setIssues] = useState<DocumentIssueRecord[]>([]);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [preselectedFlagEntity, setPreselectedFlagEntity] = useState<{
    type: 'INVOICE' | 'DELIVERY' | 'PAYMENT';
    invoice?: InvoiceRecord;
    deliveryNote?: DeliveryNoteRecord;
    payment?: PaymentRecord;
  } | null>(null);

  const [matchingFilter, setMatchingFilter] = useState<'ALL' | 'UNMATCHED' | 'UNDELIVERED' | 'MATCHED'>('ALL');

  const [selectedPoForInvoice, setSelectedPoForInvoice] = useState<string>('');
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<InvoiceRecord | null>(null);
  const [isMasterExportOpen, setIsMasterExportOpen] = useState(false);

  // AI Modal States
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);
  const [isAutoReportOpen, setIsAutoReportOpen] = useState(false);
  const [poSearchTerm, setPoSearchTerm] = useState('');

  // Authentication & Google Sheets state
  const [currentUser, setCurrentUser] = useState<AppUser>(() => getCurrentSessionUser());
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(() => loadSheetsConfig());
  const [isPinLoginOpen, setIsPinLoginOpen] = useState(false);
  const [pinLoginTargetUser, setPinLoginTargetUser] = useState<AppUser | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Check URL parameters for Email Magic Access Links on initial load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('access_token');
    const email = urlParams.get('access_email');
    const pinParam = urlParams.get('login');

    if (pinParam === 'pin' || urlParams.get('pin_login') === 'true') {
      setIsPinLoginOpen(true);
    }

    if (token) {
      const authResult = validateEmailAccessToken(token, email);
      if (authResult.success && authResult.user) {
        setCurrentUser(authResult.user);
        showToast('success', authResult.message);
        // Clean URL to prevent sharing token accidentally
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        showToast('error', authResult.message);
      }
    }
  }, []);

  // Load stored data on initial mount
  useEffect(() => {
    const loadedPOs = loadStoredPOs();
    const loadedInvoices = loadStoredInvoices();
    const loadedDNs = loadStoredDeliveryNotes();
    const loadedPayments = loadStoredPayments();
    const loadedIssues = loadStoredIssues();

    setPoLines(loadedPOs);
    setInvoices(loadedInvoices);
    setDeliveryNotes(loadedDNs);
    setPayments(loadedPayments);
    setIssues(loadedIssues);
    setSheetsConfig(loadSheetsConfig());
    setCurrentUser(getCurrentSessionUser());
  }, []);

  const pendingIssuesCount = useMemo(() => {
    return issues.filter((i) => i.status !== 'RESOLVED').length;
  }, [issues]);

  // Compute enriched PO lines and grouped POs with real-time tracking
  const enrichedLines = useMemo(() => {
    return enrichPOLinesWithTracking(poLines, invoices, deliveryNotes);
  }, [poLines, invoices, deliveryNotes]);

  const poGroups = useMemo(() => {
    return groupPOsByNumber(poLines, invoices, deliveryNotes);
  }, [poLines, invoices, deliveryNotes]);

  const metrics = useMemo(() => {
    return calculateDashboardMetrics(poGroups, invoices, deliveryNotes, payments);
  }, [poGroups, invoices, deliveryNotes, payments]);

  // Auto-sync helper to push state to Google Sheets if auto-sync is active (Admin only)
  const triggerAutoSyncIfEnabled = (
    newPOs = poLines,
    newInvoices = invoices,
    newDNs = deliveryNotes,
    newPayments = payments
  ) => {
    // Only Admin can write or sync directly to Google Sheets database
    if (currentUser?.role !== 'Admin') {
      return;
    }

    const cfg = loadSheetsConfig();
    if (cfg.isConnected && cfg.autoSync && cfg.accessToken) {
      syncAllDataToGoogleSheets(
        {
          poLines: newPOs,
          invoices: newInvoices,
          deliveryNotes: newDNs,
          payments: newPayments,
          users: loadStoredUsers(),
          seriesConfig: loadStoredSeriesConfig(),
        },
        cfg.accessToken
      ).catch((e) => console.warn('Background Google Sheets auto-sync error:', e));
    }
  };

  // Handle uploading Excel file
  const handleUploadExcelFile = async (file: File) => {
    try {
      showToast('info', `Reading Excel file "${file.name}"...`);
      const parsedItems = await parseExcelPOData(file);

      // Merge or append to existing PO lines
      const updatedLines = [...parsedItems, ...poLines];
      setPoLines(updatedLines);
      savePOs(updatedLines);
      triggerAutoSyncIfEnabled(updatedLines, invoices, deliveryNotes, payments);

      showToast(
        'success',
        `Successfully loaded ${parsedItems.length} PO line items from "${file.name}".`
      );
      setActiveTab('po_master');
    } catch (err: any) {
      console.error(err);
      showToast(
        'error',
        err?.message || 'Failed to parse Excel file. Please ensure columns match the required PO headers.'
      );
    }
  };

  // Handle saving an Invoice (Supports create and admin correction/reload)
  const handleSaveInvoice = (newInvoice: InvoiceRecord) => {
    const existingIndex = invoices.findIndex(
      (i) => i.id === newInvoice.id || i.invoiceNumber.trim().toLowerCase() === newInvoice.invoiceNumber.trim().toLowerCase()
    );
    let updatedInvoices: InvoiceRecord[];
    if (existingIndex >= 0) {
      updatedInvoices = [...invoices];
      updatedInvoices[existingIndex] = newInvoice;
    } else {
      updatedInvoices = [newInvoice, ...invoices];
    }
    setInvoices(updatedInvoices);
    saveInvoices(updatedInvoices);
    setEditingInvoice(null);
    triggerAutoSyncIfEnabled(poLines, updatedInvoices, deliveryNotes, payments);

    // If this invoice had an active issue, automatically resolve it!
    const linkedIssue = issues.find(
      (i) => (i.entityId === newInvoice.id || i.referenceNumber.trim().toLowerCase() === newInvoice.invoiceNumber.trim().toLowerCase()) && i.status !== 'RESOLVED'
    );

    if (linkedIssue) {
      const resName = currentUser?.name ? `${currentUser.name} (${currentUser.role})` : 'Administrator / Reviewer';
      const updatedIss = resolveDocumentIssue(
        linkedIssue.id,
        resName,
        `Invoice reloaded and corrected in Invoice Creator. Values and lines updated and verified.`
      );
      setIssues(updatedIss);
      showToast('success', `Invoice "${newInvoice.invoiceNumber}" updated. Issue marked as RESOLVED and moved out of active issues!`);
    } else {
      showToast('success', `Invoice "${newInvoice.invoiceNumber}" saved and recorded to database.`);
    }
  };

  // Issue Management Handlers
  const handleSaveIssue = (newIssue: DocumentIssueRecord) => {
    const updated = addOrUpdateIssue(newIssue);
    setIssues(updated);

    // Update document if invoice
    if (newIssue.entityType === 'INVOICE') {
      const updatedInvoices = invoices.map((inv) => {
        if (inv.id === newIssue.entityId || inv.invoiceNumber === newIssue.referenceNumber) {
          return { ...inv, hasIssue: true, issueId: newIssue.id, issueStatus: 'PENDING' as const };
        }
        return inv;
      });
      setInvoices(updatedInvoices);
      saveInvoices(updatedInvoices);
    }
    showToast('success', `Issue flagged on ${newIssue.referenceNumber}. Viewable in Issue Resolution Hub.`);
  };

  const handleUpdateIssue = (updatedIssue: DocumentIssueRecord) => {
    const updated = addOrUpdateIssue(updatedIssue);
    setIssues(updated);
    showToast('success', `Updated issue record on ${updatedIssue.referenceNumber}.`);
  };

  const handleResolveIssue = (issueId: string, resolvedBy: string, resolutionNotes: string) => {
    const updated = resolveDocumentIssue(issueId, resolvedBy, resolutionNotes);
    setIssues(updated);

    const resolvedItem = updated.find((i) => i.id === issueId);
    if (resolvedItem && resolvedItem.entityType === 'INVOICE') {
      const updatedInvoices = invoices.map((inv) => {
        if (inv.id === resolvedItem.entityId || inv.invoiceNumber === resolvedItem.referenceNumber) {
          return { ...inv, hasIssue: false, issueStatus: 'RESOLVED' as const };
        }
        return inv;
      });
      setInvoices(updatedInvoices);
      saveInvoices(updatedInvoices);
    }
    showToast('success', `Issue resolved and moved out of active issue invoices.`);
  };

  const handleImportInvoices = (importedInvoices: InvoiceRecord[], mode: 'append' | 'replace' | string = 'append') => {
    let finalInvoices: InvoiceRecord[] = [];
    const isReplace = String(mode).toLowerCase() === 'replace';
    if (isReplace) {
      finalInvoices = importedInvoices;
    } else {
      // Append mode: merge imported records with existing records
      const map = new Map<string, InvoiceRecord>();
      invoices.forEach((inv) => map.set(inv.invoiceNumber.toLowerCase().trim(), inv));
      importedInvoices.forEach((inv) => map.set(inv.invoiceNumber.toLowerCase().trim(), inv));
      finalInvoices = Array.from(map.values());
    }

    setInvoices(finalInvoices);
    saveInvoices(finalInvoices);
    triggerAutoSyncIfEnabled(poLines, finalInvoices, deliveryNotes, payments);
    showToast('success', `Successfully loaded ${importedInvoices.length} invoices into database (${isReplace ? 'replace' : 'append'} mode). Total database: ${finalInvoices.length} invoices.`);
  };

  const handleDeleteIssue = (issueId: string) => {
    const updated = issues.filter((i) => i.id !== issueId);
    setIssues(updated);
    saveIssues(updated);
    showToast('info', 'Issue record deleted.');
  };

  const handleOpenFlagModal = (preselected?: {
    type: 'INVOICE' | 'DELIVERY' | 'PAYMENT';
    invoice?: InvoiceRecord;
    deliveryNote?: DeliveryNoteRecord;
    payment?: PaymentRecord;
  }) => {
    setPreselectedFlagEntity(preselected || null);
    setIsFlagModalOpen(true);
  };

  // Admin: Handle adding new PO
  const handleAddPO = (newLines: POLineItem[]) => {
    const updated = [...newLines, ...poLines];
    setPoLines(updated);
    savePOs(updated);
    triggerAutoSyncIfEnabled(updated, invoices, deliveryNotes, payments);
    showToast('success', `Added Purchase Order with ${newLines.length} line(s).`);
  };

  // Admin: Handle editing PO header details across all lines
  const handleEditPODetails = (
    poNumber: string,
    details: { customerName: string; destination: string; contract: string; date: string }
  ) => {
    const updated = poLines.map((l) => {
      if (l.poNumber.trim().toLowerCase() === poNumber.trim().toLowerCase()) {
        return {
          ...l,
          customerName: details.customerName || l.customerName,
          destination: details.destination || l.destination,
          contract: details.contract || l.contract,
          date: details.date || l.date,
        };
      }
      return l;
    });
    setPoLines(updated);
    savePOs(updated);
    triggerAutoSyncIfEnabled(updated, invoices, deliveryNotes, payments);
    showToast('success', `Updated details for PO "${poNumber}".`);
  };

  // Admin: Handle adding a new line to an existing PO
  const handleAddPOLine = (newLine: POLineItem) => {
    const updated = [newLine, ...poLines];
    setPoLines(updated);
    savePOs(updated);
    triggerAutoSyncIfEnabled(updated, invoices, deliveryNotes, payments);
    showToast('success', `Added line item to PO "${newLine.poNumber}".`);
  };

  // Admin: Handle updating a single PO line item
  const handleUpdatePOLine = (updatedLine: POLineItem) => {
    const updated = poLines.map((l) => (l.id === updatedLine.id ? updatedLine : l));
    setPoLines(updated);
    savePOs(updated);
    triggerAutoSyncIfEnabled(updated, invoices, deliveryNotes, payments);
    showToast('success', `Updated line item "${updatedLine.itemDescription}".`);
  };

  // Admin: Handle deleting a single PO line item
  const handleDeletePOLine = (lineId: string) => {
    const updated = poLines.filter((l) => l.id !== lineId);
    setPoLines(updated);
    savePOs(updated);
    triggerAutoSyncIfEnabled(updated, invoices, deliveryNotes, payments);
    showToast('info', 'PO line item removed.');
  };

  // Handle deleting/voiding an Invoice
  const handleDeleteInvoice = (invoiceId: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    const updatedInvoices = invoices.filter((i) => i.id !== invoiceId);
    setInvoices(updatedInvoices);
    saveInvoices(updatedInvoices);
    triggerAutoSyncIfEnabled(poLines, updatedInvoices, deliveryNotes, payments);
    showToast('info', `Invoice "${target?.invoiceNumber || invoiceId}" removed. PO balance restored.`);
  };

  // Handle saving a Delivery Note
  const handleSaveDeliveryNote = (newDN: DeliveryNoteRecord) => {
    const updatedDNs = [newDN, ...deliveryNotes];
    setDeliveryNotes(updatedDNs);
    saveDeliveryNotes(updatedDNs);
    triggerAutoSyncIfEnabled(poLines, invoices, updatedDNs, payments);
    showToast('success', `Delivery Note "${newDN.deliveryNoteNumber}" recorded successfully.`);
  };

  // Handle saving a Payment with invoice allocation updates
  const handleSavePayment = (newPayment: PaymentRecord, updatedInvoices: InvoiceRecord[]) => {
    const updatedPayments = [newPayment, ...payments];
    setPayments(updatedPayments);
    savePayments(updatedPayments);
    setInvoices(updatedInvoices);
    saveInvoices(updatedInvoices);
    triggerAutoSyncIfEnabled(poLines, updatedInvoices, deliveryNotes, updatedPayments);
    showToast('success', `Payment "${newPayment.paymentNumber}" of $${newPayment.amountPaid.toLocaleString()} recorded and allocated.`);
  };

  // Handle deep navigation from Dashboard
  const handleDashboardNavigate = (tab: ActiveTab, subFilter?: string) => {
    if (tab === 'matching_report' && subFilter) {
      setMatchingFilter(subFilter as any);
    } else {
      setMatchingFilter('ALL');
    }
    setActiveTab(tab);
  };

  // Handle full restore from disaster backup or Google Sheets pull
  const handleDataRestored = (restored: {
    poLines: POLineItem[];
    invoices: InvoiceRecord[];
    deliveryNotes: DeliveryNoteRecord[];
    payments: PaymentRecord[];
  }) => {
    setPoLines(restored.poLines);
    setInvoices(restored.invoices);
    setDeliveryNotes(restored.deliveryNotes);
    setPayments(restored.payments);
    setSheetsConfig(loadSheetsConfig());
    setCurrentUser(getCurrentSessionUser());
    showToast('success', 'Workspace successfully updated and synchronized!');
  };

  // Reset to sample data
  const handleResetData = () => {
    if (window.confirm('Reset all data to sample Purchase Orders, Invoices, Delivery Notes, and Payments?')) {
      const res = resetToSampleData();
      setPoLines(res.pos);
      setInvoices(res.invoices);
      setDeliveryNotes(res.deliveryNotes);
      setPayments(res.payments);
      showToast('success', 'Reset application to demonstration dataset.');
    }
  };

  // Clear all data
  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all loaded PO data, invoices, delivery notes, and payments?')) {
      const res = clearAllData();
      setPoLines(res.pos);
      setInvoices(res.invoices);
      setDeliveryNotes(res.deliveryNotes);
      setPayments(res.payments);
      showToast('info', 'All data cleared from local workspace.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 max-w-md animate-in fade-in slide-in-from-top-3">
          <div
            className={`p-4 rounded-xl shadow-lg border flex items-center justify-between gap-3 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                : toast.type === 'error'
                ? 'bg-red-900 text-red-100 border-red-700'
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
              {toast.type === 'info' && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(t) => {
          setMatchingFilter('ALL');
          setActiveTab(t);
        }}
        totalPOsCount={poGroups.length}
        totalInvoicesCount={invoices.length}
        totalDNsCount={deliveryNotes.length}
        pendingIssuesCount={pendingIssuesCount}
        onOpenNewInvoice={() => {
          setSelectedPoForInvoice('');
          setActiveTab('create_invoice');
        }}
        onOpenMasterExport={() => setIsMasterExportOpen(true)}
        onOpenVoiceSearch={() => setIsVoiceSearchOpen(true)}
        onOpenAutoReport={() => setIsAutoReportOpen(true)}
        sheetsConfig={sheetsConfig}
        currentUser={currentUser}
        onOpenPinLogin={() => setIsPinLoginOpen(true)}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {!canViewScreen(currentUser, activeTab) ? (
          <div className="max-w-xl mx-auto my-12 bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your account does not currently have permission to view the <strong className="text-slate-900">{activeTab.replace('_', ' ').toUpperCase()}</strong> module.
            </p>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 text-left space-y-1">
              <p><span className="font-semibold text-slate-900">User:</span> {currentUser.name}</p>
              <p><span className="font-semibold text-slate-900">Role:</span> {currentUser.role} ({currentUser.department})</p>
              <p><span className="font-semibold text-slate-900">Status:</span> {currentUser.status}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Return to Dashboard
              </button>
              <button
                type="button"
                onClick={() => setIsPinLoginOpen(true)}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Enter 4-Digit PIN / Switch Account
              </button>
            </div>
          </div>
        ) : (
          <>
        {activeTab === 'dashboard' && (
          <Dashboard
            metrics={metrics}
            poGroups={poGroups}
            poLines={enrichedLines}
            invoices={invoices}
            deliveryNotes={deliveryNotes}
            payments={payments}
            onNavigate={handleDashboardNavigate}
            onSelectPOForInvoice={(poNum) => {
              setSelectedPoForInvoice(poNum);
              setActiveTab('create_invoice');
            }}
            onOpenUploadModal={() => setActiveTab('settings')}
            onDownloadTemplate={generateSampleExcelTemplate}
            onOpenVoiceSearch={() => setIsVoiceSearchOpen(true)}
            onOpenAutoReport={() => setIsAutoReportOpen(true)}
          />
        )}

        {activeTab === 'po_master' && (
          <POManager
            poLines={enrichedLines}
            poGroups={poGroups}
            initialSearchTerm={poSearchTerm}
            onUploadExcel={handleUploadExcelFile}
            onCreateInvoiceForPO={(poNum) => {
              setSelectedPoForInvoice(poNum);
              setActiveTab('create_invoice');
            }}
            onDownloadTemplate={generateSampleExcelTemplate}
            onOpenVoiceSearch={() => setIsVoiceSearchOpen(true)}
            currentUser={currentUser}
            onAddPO={handleAddPO}
            onEditPODetails={handleEditPODetails}
            onAddPOLine={handleAddPOLine}
            onUpdatePOLine={handleUpdatePOLine}
            onDeletePOLine={handleDeletePOLine}
          />
        )}

        {activeTab === 'create_invoice' && (
          <InvoiceCreator
            allPoLines={enrichedLines}
            poLines={enrichedLines}
            poGroups={poGroups}
            invoices={invoices}
            preselectedPoNumber={selectedPoForInvoice}
            onSaveInvoice={handleSaveInvoice}
            onViewInvoicesDatabase={() => setActiveTab('invoices_db')}
            editingInvoice={editingInvoice}
            onCancelEdit={() => setEditingInvoice(null)}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'invoices_db' && (
          <InvoiceHistory
            invoices={invoices}
            issues={issues}
            onDeleteInvoice={handleDeleteInvoice}
            onCreateNewInvoice={() => {
              setSelectedPoForInvoice('');
              setEditingInvoice(null);
              setActiveTab('create_invoice');
            }}
            onPrintInvoice={(inv) => setPrintingInvoice(inv)}
            onReloadInvoice={(inv) => {
              setEditingInvoice(inv);
              setActiveTab('create_invoice');
            }}
            onFlagIssue={(inv) => handleOpenFlagModal({ type: 'INVOICE', invoice: inv })}
            onViewIssuesTab={() => setActiveTab('issue_tracking')}
            onImportInvoices={handleImportInvoices}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'issue_tracking' && (
          <IssueResolutionHub
            issues={issues}
            invoices={invoices}
            deliveryNotes={deliveryNotes}
            payments={payments}
            onUpdateIssue={handleUpdateIssue}
            onResolveIssue={handleResolveIssue}
            onDeleteIssue={handleDeleteIssue}
            onReloadInvoice={(inv) => {
              setEditingInvoice(inv);
              setActiveTab('create_invoice');
            }}
            onOpenFlagModal={handleOpenFlagModal}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'delivery_notes' && (
          <DeliveryNotesManager
            allPoLines={enrichedLines}
            poLines={enrichedLines}
            poGroups={poGroups}
            deliveryNotes={deliveryNotes}
            onSaveDeliveryNote={handleSaveDeliveryNote}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentsManager
            invoices={invoices}
            payments={payments}
            onSavePayment={handleSavePayment}
          />
        )}

        {activeTab === 'matching_report' && (
          <MatchingReport
            poLines={poLines}
            deliveryNotes={deliveryNotes}
            invoices={invoices}
            poGroups={poGroups}
            initialFilter={matchingFilter}
            onSelectPOForInvoice={(poNum) => {
              setSelectedPoForInvoice(poNum);
              setActiveTab('create_invoice');
            }}
            onNavigateToInvoice={() => setActiveTab('create_invoice')}
            onOpenAutoReport={() => setIsAutoReportOpen(true)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsManager
            poLines={poLines}
            invoices={invoices}
            deliveryNotes={deliveryNotes}
            payments={payments}
            onUploadExcelPO={handleUploadExcelFile}
            onDownloadTemplate={generateSampleExcelTemplate}
            onResetData={handleResetData}
            onClearData={handleClearData}
            onDataRestored={handleDataRestored}
            onSheetsSynced={() => setSheetsConfig(loadSheetsConfig())}
            onUserRoleSwitched={(u) => {
              setCurrentUser(u);
              showToast('success', `Session user switched to ${u.name} (${u.role})`);
            }}
          />
        )}

        {activeTab === 'ledger' && (
          <POTrackingLedger
            poLines={enrichedLines}
            invoices={invoices}
            deliveryNotes={deliveryNotes}
            onCreateInvoice={(poNum) => {
              setSelectedPoForInvoice(poNum);
              setActiveTab('create_invoice');
            }}
          />
        )}
          </>
        )}
      </main>

      {/* Invoice Print Modal */}
      {printingInvoice && (
        <InvoicePrintModal
          invoice={printingInvoice}
          onClose={() => setPrintingInvoice(null)}
        />
      )}

      {/* Master Export All Details Modal */}
      <MasterExportModal
        isOpen={isMasterExportOpen}
        onClose={() => setIsMasterExportOpen(false)}
        poLines={poLines}
        invoices={invoices}
        deliveryNotes={deliveryNotes}
        payments={payments}
        users={loadStoredUsers()}
      />

      {/* AI Voice Command & Search Modal */}
      <AIVoiceCommandModal
        isOpen={isVoiceSearchOpen}
        onClose={() => setIsVoiceSearchOpen(false)}
        poLines={enrichedLines}
        invoices={invoices}
        deliveryNotes={deliveryNotes}
        payments={payments}
        onNavigate={(tab, subFilter) => {
          handleDashboardNavigate(tab as ActiveTab, subFilter);
        }}
        onSelectPOForInvoice={(poNum) => {
          setSelectedPoForInvoice(poNum);
          setActiveTab('create_invoice');
        }}
        onApplyFilter={(searchTerm) => {
          setPoSearchTerm(searchTerm);
          setActiveTab('po_master');
        }}
      />

      {/* AI Automated Executive, Financial & Audit Report Modal */}
      <AIAutoReportModal
        isOpen={isAutoReportOpen}
        onClose={() => setIsAutoReportOpen(false)}
        poLines={enrichedLines}
        invoices={invoices}
        deliveryNotes={deliveryNotes}
        payments={payments}
        metrics={metrics}
        currentUser={currentUser}
      />

      {/* Flag / Report Discrepancy Issue Modal */}
      <FlagIssueModal
        isOpen={isFlagModalOpen}
        onClose={() => {
          setIsFlagModalOpen(false);
          setPreselectedFlagEntity(null);
        }}
        onSaveIssue={handleSaveIssue}
        currentUser={currentUser}
        initialEntity={preselectedFlagEntity}
        invoices={invoices}
        deliveryNotes={deliveryNotes}
        payments={payments}
      />

      {/* 4-Digit PIN Authentication & User Switcher Modal */}
      <PinLoginModal
        isOpen={isPinLoginOpen}
        onClose={() => {
          setIsPinLoginOpen(false);
          setPinLoginTargetUser(null);
        }}
        targetUser={pinLoginTargetUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsPinLoginOpen(false);
          setPinLoginTargetUser(null);
          showToast('success', `Signed in as ${user.name} (${user.role})`);
        }}
      />
    </div>
  );
}
