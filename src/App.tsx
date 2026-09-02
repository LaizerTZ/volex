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
import { 
  POLineItem, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord,
  AppUser,
  GoogleSheetsConfig
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
  loadStoredUsers,
  loadStoredSeriesConfig,
  enrichPOLinesWithTracking, 
  groupPOsByNumber, 
  calculateDashboardMetrics,
  resetToSampleData,
  clearAllData
} from './utils/storage';
import { parseExcelPOData, generateSampleExcelTemplate } from './utils/excelParser';
import { getCurrentSessionUser, validateEmailAccessToken } from './utils/authService';
import { loadSheetsConfig, syncAllDataToGoogleSheets } from './utils/googleSheetsService';
import { CheckCircle2, AlertCircle, X, Sparkles, Cloud, Mic } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [poLines, setPoLines] = useState<POLineItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [matchingFilter, setMatchingFilter] = useState<'ALL' | 'UNMATCHED' | 'UNDELIVERED' | 'MATCHED'>('ALL');

  const [selectedPoForInvoice, setSelectedPoForInvoice] = useState<string>('');
  const [printingInvoice, setPrintingInvoice] = useState<InvoiceRecord | null>(null);
  const [isMasterExportOpen, setIsMasterExportOpen] = useState(false);

  // AI Modal States
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);
  const [isAutoReportOpen, setIsAutoReportOpen] = useState(false);
  const [poSearchTerm, setPoSearchTerm] = useState('');

  // Authentication & Google Sheets state
  const [currentUser, setCurrentUser] = useState<AppUser>(() => getCurrentSessionUser());
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(() => loadSheetsConfig());

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

    setPoLines(loadedPOs);
    setInvoices(loadedInvoices);
    setDeliveryNotes(loadedDNs);
    setPayments(loadedPayments);
    setSheetsConfig(loadSheetsConfig());
    setCurrentUser(getCurrentSessionUser());
  }, []);

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

  // Auto-sync helper to push state to Google Sheets if auto-sync is active
  const triggerAutoSyncIfEnabled = (
    newPOs = poLines,
    newInvoices = invoices,
    newDNs = deliveryNotes,
    newPayments = payments
  ) => {
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

  // Handle saving an Invoice
  const handleSaveInvoice = (newInvoice: InvoiceRecord) => {
    const updatedInvoices = [newInvoice, ...invoices];
    setInvoices(updatedInvoices);
    saveInvoices(updatedInvoices);
    triggerAutoSyncIfEnabled(poLines, updatedInvoices, deliveryNotes, payments);
    showToast('success', `Invoice "${newInvoice.invoiceNumber}" saved and recorded to database.`);
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
        onOpenNewInvoice={() => {
          setSelectedPoForInvoice('');
          setActiveTab('create_invoice');
        }}
        onOpenMasterExport={() => setIsMasterExportOpen(true)}
        onOpenVoiceSearch={() => setIsVoiceSearchOpen(true)}
        onOpenAutoReport={() => setIsAutoReportOpen(true)}
        sheetsConfig={sheetsConfig}
        currentUser={currentUser}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
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
          />
        )}

        {activeTab === 'create_invoice' && (
          <InvoiceCreator
            poLines={enrichedLines}
            invoices={invoices}
            preselectedPoNumber={selectedPoForInvoice}
            onSaveInvoice={handleSaveInvoice}
            onViewInvoicesDatabase={() => setActiveTab('invoices_db')}
          />
        )}

        {activeTab === 'invoices_db' && (
          <InvoiceHistory
            invoices={invoices}
            deliveryNotes={deliveryNotes}
            onDeleteInvoice={handleDeleteInvoice}
            onCreateNewInvoice={() => {
              setSelectedPoForInvoice('');
              setActiveTab('create_invoice');
            }}
            onPrintInvoice={(inv) => setPrintingInvoice(inv)}
          />
        )}

        {activeTab === 'delivery_notes' && (
          <DeliveryNotesManager
            poLines={enrichedLines}
            deliveryNotes={deliveryNotes}
            onSaveDeliveryNote={handleSaveDeliveryNote}
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
    </div>
  );
}
