import React, { useState, useEffect } from 'react';
import { 
  AppUser, 
  SeriesSettings, 
  POLineItem, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord,
  EmailAccessInvitation,
  GoogleSheetsConfig,
  SystemBackupPackage
} from '../types';
import { 
  loadStoredUsers, 
  saveStoredUsers, 
  loadStoredSeriesConfig, 
  saveStoredSeriesConfig,
  formatSeriesNumber 
} from '../utils/storage';
import { 
  loadStoredInvitations, 
  saveStoredInvitations, 
  generateEmailAccessLink, 
  getEmailInvitationText,
  getCurrentSessionUser,
  setCurrentSessionUser
} from '../utils/authService';
import { 
  loadSheetsConfig, 
  saveSheetsConfig, 
  requestGoogleSheetsAuth, 
  syncAllDataToGoogleSheets, 
  fetchAllDataFromGoogleSheets,
  createMasterSpreadsheet,
  SPREADSHEET_TITLE
} from '../utils/googleSheetsService';
import { 
  exportMasterExcelWorkbook, 
  exportFullSystemBackup, 
  validateBackupFile, 
  restoreSystemFromBackup 
} from '../utils/backupExportService';
import { 
  Users, 
  Settings, 
  Hash, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  FileSpreadsheet, 
  Database, 
  Save, 
  UserCheck, 
  KeyRound, 
  Layers, 
  FileCheck2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  Mail,
  Copy,
  Check,
  Clock,
  Archive,
  Cloud,
  CloudLightning,
  Eye,
  LogOut,
  Info
} from 'lucide-react';

interface SettingsManagerProps {
  poLines: POLineItem[];
  invoices: InvoiceRecord[];
  deliveryNotes: DeliveryNoteRecord[];
  payments: PaymentRecord[];
  onUploadExcelPO: (file: File) => void;
  onDownloadTemplate: () => void;
  onResetData: () => void;
  onClearData: () => void;
  onSeriesConfigChanged?: () => void;
  onDataRestored?: (restored: {
    poLines: POLineItem[];
    invoices: InvoiceRecord[];
    deliveryNotes: DeliveryNoteRecord[];
    payments: PaymentRecord[];
  }) => void;
  onSheetsSynced?: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  poLines,
  invoices,
  deliveryNotes,
  payments,
  onUploadExcelPO,
  onDownloadTemplate,
  onResetData,
  onClearData,
  onSeriesConfigChanged,
  onDataRestored,
  onSheetsSynced,
}) => {
  const [activeTab, setActiveTab] = useState<'sheets' | 'backup' | 'series' | 'access'>('sheets');
  
  // Users & Access State
  const [users, setUsers] = useState<AppUser[]>(() => loadStoredUsers());
  const [invitations, setInvitations] = useState<EmailAccessInvitation[]>(() => loadStoredInvitations());
  const [currentUser, setCurrentUser] = useState<AppUser>(() => getCurrentSessionUser());
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AppUser['role']>('Finance Officer');
  const [inviteDept, setInviteDept] = useState('Finance & Operations');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [newlyGeneratedLink, setNewlyGeneratedLink] = useState<{ invitation: EmailAccessInvitation; link: string } | null>(null);

  // Google Sheets State
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(() => loadSheetsConfig());
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetsMessage, setSheetsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [showManualTokenField, setShowManualTokenField] = useState(false);

  // Number Series State
  const [seriesConfig, setSeriesConfig] = useState<SeriesSettings>(() => loadStoredSeriesConfig());
  const [seriesSaveSuccess, setSeriesSaveSuccess] = useState(false);

  // Backup & Restore State
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupValidation, setBackupValidation] = useState<{
    valid: boolean;
    packageData?: SystemBackupPackage;
    summary?: any;
    error?: string;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'REPLACE' | 'MERGE'>('REPLACE');
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupNotification, setBackupNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // PO Excel Dropzone state
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // ==========================================
  // GOOGLE SHEETS HANDLERS
  // ==========================================
  const handleConnectGoogleSheets = async () => {
    setIsSyncingSheets(true);
    setSheetsMessage(null);
    try {
      await requestGoogleSheetsAuth(
        undefined,
        async (token) => {
          // Connected! Create spreadsheet if not exists
          const current = loadSheetsConfig();
          current.accessToken = token;
          current.isConnected = true;
          saveSheetsConfig(current);
          setSheetsConfig(current);

          // Push initial data
          await handlePushToGoogleSheets(token);
        },
        (err) => {
          setSheetsMessage({ type: 'error', text: `Connection failed: ${err}` });
          setIsSyncingSheets(false);
        }
      );
    } catch (e: any) {
      setSheetsMessage({ type: 'error', text: e.message || 'Google OAuth failed' });
      setIsSyncingSheets(false);
    }
  };

  const handleApplyManualToken = async () => {
    if (!manualTokenInput.trim()) return;
    const config = loadSheetsConfig();
    config.accessToken = manualTokenInput.trim();
    config.isConnected = true;
    config.tokenExpiry = Date.now() + 3600 * 1000;
    saveSheetsConfig(config);
    setSheetsConfig(config);
    setManualTokenInput('');
    setShowManualTokenField(false);
    await handlePushToGoogleSheets(config.accessToken);
  };

  const handlePushToGoogleSheets = async (customToken?: string) => {
    setIsSyncingSheets(true);
    setSheetsMessage(null);
    try {
      const res = await syncAllDataToGoogleSheets(
        {
          poLines,
          invoices,
          deliveryNotes,
          payments,
          users,
          seriesConfig,
        },
        customToken
      );

      const updated = loadSheetsConfig();
      setSheetsConfig(updated);
      setSheetsMessage({
        type: 'success',
        text: `Successfully synced all data to Google Sheets database at ${res.timestamp}!`,
      });
      if (onSheetsSynced) onSheetsSynced();
    } catch (e: any) {
      setSheetsMessage({
        type: 'error',
        text: `Sync error: ${e.message}. Please verify Google account permissions.`,
      });
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handlePullFromGoogleSheets = async () => {
    if (!sheetsConfig.spreadsheetId) {
      setSheetsMessage({ type: 'error', text: 'No Google Spreadsheet linked yet.' });
      return;
    }
    if (!confirm('Pulling from Google Sheets will update your local workspace records with live Sheets data. Proceed?')) {
      return;
    }

    setIsSyncingSheets(true);
    setSheetsMessage(null);
    try {
      const fetched = await fetchAllDataFromGoogleSheets(sheetsConfig.spreadsheetId, sheetsConfig.accessToken || undefined);
      
      if (onDataRestored) {
        onDataRestored({
          poLines: fetched.poLines,
          invoices: fetched.invoices,
          deliveryNotes: fetched.deliveryNotes,
          payments: fetched.payments,
        });
      }

      if (fetched.users && fetched.users.length > 0) {
        setUsers(fetched.users);
        saveStoredUsers(fetched.users);
      }

      setSheetsMessage({
        type: 'success',
        text: `Successfully pulled ${fetched.poLines.length} PO lines, ${fetched.invoices.length} invoices, ${fetched.deliveryNotes.length} delivery notes from Google Sheets!`,
      });
    } catch (e: any) {
      setSheetsMessage({
        type: 'error',
        text: `Pull failed: ${e.message}`,
      });
    } finally {
      setIsSyncingSheets(false);
    }
  };

  const handleToggleAutoSync = () => {
    const updated = { ...sheetsConfig, autoSync: !sheetsConfig.autoSync };
    setSheetsConfig(updated);
    saveSheetsConfig(updated);
  };

  const handleDisconnectSheets = () => {
    if (confirm('Disconnect Google Sheets cloud database from this session?')) {
      const reset = { ...loadSheetsConfig(), isConnected: false, accessToken: null, tokenExpiry: null };
      setSheetsConfig(reset);
      saveSheetsConfig(reset);
      setSheetsMessage({ type: 'success', text: 'Google Sheets disconnected.' });
    }
  };

  // ==========================================
  // EMAIL LINK ACCESS & USERS HANDLERS
  // ==========================================
  const handleGenerateInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      alert('Please provide name and email address.');
      return;
    }

    const result = generateEmailAccessLink(
      inviteEmail,
      inviteName,
      inviteRole,
      inviteDept,
      currentUser.name
    );

    setNewlyGeneratedLink(result);
    setInvitations(loadStoredInvitations());
    setUsers(loadStoredUsers());
    setInviteEmail('');
    setInviteName('');
    setIsInviteOpen(false);
  };

  const handleCopyLink = (inv: EmailAccessInvitation) => {
    const url = inv.accessUrl || `${window.location.origin}${window.location.pathname}?access_token=${inv.token}&access_email=${encodeURIComponent(inv.email)}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(inv.id);
    setTimeout(() => setCopiedLinkId(null), 3000);
  };

  const handleCopyEmailTemplate = (inv: EmailAccessInvitation) => {
    const text = getEmailInvitationText(inv);
    navigator.clipboard.writeText(text);
    setCopiedTemplateId(inv.id);
    setTimeout(() => setCopiedTemplateId(null), 3000);
  };

  const handleToggleInvitationStatus = (id: string) => {
    const updated = invitations.map((inv) => {
      if (inv.id === id) {
        return {
          ...inv,
          status: (inv.status === 'Active' ? 'Revoked' : 'Active') as 'Active' | 'Revoked',
        };
      }
      return inv;
    });
    setInvitations(updated);
    saveStoredInvitations(updated);
  };

  const handleDeleteInvitation = (id: string) => {
    if (confirm('Delete this email access invitation?')) {
      const updated = invitations.filter((inv) => inv.id !== id);
      setInvitations(updated);
      saveStoredInvitations(updated);
    }
  };

  const handleSwitchSessionUser = (user: AppUser) => {
    setCurrentSessionUser(user);
    setCurrentUser(user);
    alert(`Switched active session to ${user.name} (${user.role}).`);
  };

  // ==========================================
  // BACKUP & RESTORE HANDLERS
  // ==========================================
  const handleBackupFileSelect = async (file: File) => {
    setBackupFile(file);
    const validation = await validateBackupFile(file);
    setBackupValidation(validation);
  };

  const handleExecuteRestore = () => {
    if (!backupValidation?.packageData) return;
    setIsRestoring(true);
    try {
      const restored = restoreSystemFromBackup(backupValidation.packageData, restoreMode);
      
      setUsers(loadStoredUsers());
      setInvitations(loadStoredInvitations());
      setSeriesConfig(loadStoredSeriesConfig());
      setSheetsConfig(loadSheetsConfig());

      if (onDataRestored) {
        onDataRestored({
          poLines: restored.poLines,
          invoices: restored.invoices,
          deliveryNotes: restored.deliveryNotes,
          payments: restored.payments,
        });
      }

      setBackupNotification({
        type: 'success',
        text: `System state fully restored! Restored ${restored.poLines.length} PO Lines, ${restored.invoices.length} Invoices, ${restored.deliveryNotes.length} Delivery Notes, and ${restored.payments.length} Payments.`,
      });

      setBackupFile(null);
      setBackupValidation(null);
    } catch (e: any) {
      setBackupNotification({
        type: 'error',
        text: `Restore failed: ${e.message}`,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Series settings save
  const handleSaveSeries = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSeriesConfig(seriesConfig);
    setSeriesSaveSuccess(true);
    if (onSeriesConfigChanged) onSeriesConfigChanged();
    setTimeout(() => setSeriesSaveSuccess(false), 3000);
  };

  const handleSetQuickRange = (type: 'invoice' | 'delivery', start: number, end: number, prefix: string) => {
    const updated: SeriesSettings = {
      ...seriesConfig,
      [type === 'invoice' ? 'invoiceSeries' : 'deliverySeries']: {
        ...seriesConfig[type === 'invoice' ? 'invoiceSeries' : 'deliverySeries'],
        prefix,
        startNumber: start,
        endNumber: end,
        currentNumber: start,
        padding: 3,
        autoIncrement: true,
      },
    };
    setSeriesConfig(updated);
    saveStoredSeriesConfig(updated);
    setSeriesSaveSuccess(true);
    if (onSeriesConfigChanged) onSeriesConfigChanged();
    setTimeout(() => setSeriesSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner with Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">System Settings & Data Control</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  v2.4.0
                </span>
                {sheetsConfig.isConnected && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                    <Cloud className="w-3 h-3" />
                    Google Sheets Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Google Sheets Database, Full System Disaster Backups, Email Magic Link RBAC, and 1-600 Number Series.
              </p>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-800/90 p-1.5 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('sheets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sheets'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Google Sheets Database
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'backup'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-indigo-400" />
              Backup & Disaster Recovery
            </button>
            <button
              onClick={() => setActiveTab('access')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'access'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              Email Link Access ({invitations.length})
            </button>
            <button
              onClick={() => setActiveTab('series')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'series'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Hash className="w-3.5 h-3.5 text-cyan-400" />
              Number Series (1-600)
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: GOOGLE SHEETS CLOUD DATABASE
          ========================================================================= */}
      {activeTab === 'sheets' && (
        <div className="space-y-6 animate-in fade-in">
          {sheetsMessage && (
            <div
              className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
                sheetsMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border border-red-300 text-red-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {sheetsMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{sheetsMessage.text}</span>
              </div>
              <button
                onClick={() => setSheetsMessage(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Google Sheets Connection & Sync Card */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Google Sheets as Primary Cloud Database</h2>
                    <p className="text-xs text-slate-500">
                      Synchronize POs, Invoices, Delivery Notes, and Payments directly to a live Google Sheet
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {sheetsConfig.isConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Connected & Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Not Connected
                    </span>
                  )}
                </div>
              </div>

              {/* Status and Action Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">Database Spreadsheet</span>
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {sheetsConfig.spreadsheetName || SPREADSHEET_TITLE}
                  </p>
                  {sheetsConfig.spreadsheetUrl ? (
                    <a
                      href={sheetsConfig.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 mt-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in Google Sheets
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Spreadsheet will be auto-created upon first sync.</span>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-500 block">Auto-Sync On Changes</span>
                    <button
                      type="button"
                      onClick={handleToggleAutoSync}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        sheetsConfig.autoSync ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          sheetsConfig.autoSync ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">
                    {sheetsConfig.autoSync
                      ? 'Enabled: New records will automatically push to Google Sheets in real-time.'
                      : 'Disabled: Manual sync required.'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Last sync: {sheetsConfig.lastSyncTime || 'Never'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {!sheetsConfig.isConnected ? (
                  <button
                    type="button"
                    onClick={handleConnectGoogleSheets}
                    disabled={isSyncingSheets}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {isSyncingSheets ? 'Connecting Google Sheets...' : 'Connect Google Sheets (OAuth)'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePushToGoogleSheets()}
                      disabled={isSyncingSheets}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingSheets ? 'animate-spin' : ''}`} />
                      {isSyncingSheets ? 'Pushing Data...' : 'Push Local Data to Sheets'}
                    </button>

                    <button
                      type="button"
                      onClick={handlePullFromGoogleSheets}
                      disabled={isSyncingSheets}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      Pull / Reload from Sheets
                    </button>

                    <button
                      type="button"
                      onClick={handleDisconnectSheets}
                      className="px-3 py-2.5 text-slate-500 hover:text-red-600 text-xs font-semibold cursor-pointer ml-auto"
                    >
                      Disconnect
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowManualTokenField(!showManualTokenField)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  {showManualTokenField ? 'Hide Token Input' : 'Advanced: Paste Access Token'}
                </button>
              </div>

              {/* Manual Token Drawer */}
              {showManualTokenField && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-in fade-in">
                  <label className="block text-xs font-bold text-slate-700">
                    Direct Google OAuth Bearer Token (Optional Override)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={manualTokenInput}
                      onChange={(e) => setManualTokenInput(e.target.value)}
                      placeholder="ya29.a0AfH6..."
                      className="flex-1 text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleApplyManualToken}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Apply & Sync
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Google Sheets Schema Blueprint Info */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Google Sheets Schema</h3>
                    <p className="text-xs text-slate-500">9 Automatic Worksheet Tabs</p>
                  </div>
                </div>

                <div className="space-y-2.5 mt-4 text-xs text-slate-700">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-700">1. PO_Lines</span>
                    <span className="text-slate-500">{poLines.length} rows</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-700">2. Invoices</span>
                    <span className="text-slate-500">{invoices.length} rows</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-700">3. Invoice_Items</span>
                    <span className="text-slate-500">{invoices.reduce((s, i) => s + i.lines.length, 0)} items</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-700">4. Delivery_Notes</span>
                    <span className="text-slate-500">{deliveryNotes.length} rows</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-700">5. Payments</span>
                    <span className="text-slate-500">{payments.length} rows</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-mono font-bold text-blue-700">6. Users_Access</span>
                    <span className="text-slate-500">{users.length} users</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  All changes made in Google Sheets or locally in this app stay completely aligned with zero formula breakage.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: BACKUP & DISASTER RECOVERY
          ========================================================================= */}
      {activeTab === 'backup' && (
        <div className="space-y-6 animate-in fade-in">
          {backupNotification && (
            <div
              className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
                backupNotification.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border border-red-300 text-red-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {backupNotification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{backupNotification.text}</span>
              </div>
              <button
                onClick={() => setBackupNotification(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* EXPORT MASTER BACKUP CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Archive className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Export Full System State & Disaster Backup</h2>
                    <p className="text-xs text-slate-500">
                      Save complete data, number series, RBAC users, and system flows to prevent any data loss
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mt-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                    <h4 className="font-bold text-slate-900">Included in this Comprehensive Backup:</h4>
                    <ul className="space-y-1 list-disc list-inside text-slate-600">
                      <li>Complete PO Master Lines ({poLines.length} items)</li>
                      <li>Invoices and Line Item Breakdowns ({invoices.length} invoices)</li>
                      <li>Delivery Notes and Dispatches ({deliveryNotes.length} notes)</li>
                      <li>Payments & Remittance Allocations ({payments.length} payments)</li>
                      <li>Number Series Configs (1-600 ranges & current sequence)</li>
                      <li>Team Member Accounts & Active Email Access Tokens</li>
                      <li>System Business Flow Schemas & 3-Way Audit Rules</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() =>
                    exportFullSystemBackup({
                      poLines,
                      invoices,
                      deliveryNotes,
                      payments,
                      seriesConfig,
                      users,
                      emailInvitations: invitations,
                    })
                  }
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  Export Full System Backup (.ninjabackup)
                </button>

                <button
                  type="button"
                  onClick={() => exportMasterExcelWorkbook(poLines, invoices, deliveryNotes, payments, users)}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export All (Excel Multi-Sheet)
                </button>
              </div>
            </div>

            {/* RELOAD & RESTORE BACKUP CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Reload & Restore System Backup</h2>
                    <p className="text-xs text-slate-500">
                      Upload any .ninjabackup or backup .json file to restore complete system state
                    </p>
                  </div>
                </div>

                {/* File Dropzone */}
                <div
                  className="mt-4 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-6 text-center bg-slate-50 cursor-pointer"
                  onClick={() => document.getElementById('backup-file-input')?.click()}
                >
                  <input
                    id="backup-file-input"
                    type="file"
                    accept=".ninjabackup, .json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleBackupFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <Archive className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    {backupFile ? backupFile.name : 'Select or Drop Backup File (.ninjabackup / .json)'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Automatic schema verification and integrity checking</p>
                </div>

                {/* Validation Summary */}
                {backupValidation && (
                  <div className="mt-4 p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-2">
                    {backupValidation.valid ? (
                      <>
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Backup Verified: Ready to Restore</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 pt-1">
                          <div>PO Lines: <span className="font-bold">{backupValidation.summary?.poCount}</span></div>
                          <div>Invoices: <span className="font-bold">{backupValidation.summary?.invCount}</span></div>
                          <div>Delivery Notes: <span className="font-bold">{backupValidation.summary?.dnCount}</span></div>
                          <div>Payments: <span className="font-bold">{backupValidation.summary?.payCount}</span></div>
                          <div>Exported Date: <span className="font-bold">{backupValidation.summary?.exportedAt}</span></div>
                          <div>Version: <span className="font-bold">{backupValidation.summary?.version}</span></div>
                        </div>

                        {/* Mode choice */}
                        <div className="pt-2 border-t border-blue-200/60 flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-slate-800 font-semibold cursor-pointer">
                            <input
                              type="radio"
                              name="restoreMode"
                              checked={restoreMode === 'REPLACE'}
                              onChange={() => setRestoreMode('REPLACE')}
                            />
                            Full System Replacement
                          </label>
                          <label className="flex items-center gap-1.5 text-slate-800 font-semibold cursor-pointer">
                            <input
                              type="radio"
                              name="restoreMode"
                              checked={restoreMode === 'MERGE'}
                              onChange={() => setRestoreMode('MERGE')}
                            />
                            Merge & Append
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-800 font-bold">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span>{backupValidation.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Restore Action */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={!backupValidation?.valid || isRestoring}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                  {isRestoring ? 'Restoring System State...' : 'Commit & Restore Everything Now'}
                </button>
              </div>
            </div>
          </div>

          {/* Reset / Clear Workspace Controls */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Workspace Management & Defaults</h4>
              <p className="text-xs text-slate-500">Reset demo dataset or clear all records for a brand new clean start</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResetData}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                Reset Sample Data
              </button>
              <button
                type="button"
                onClick={onClearData}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: EMAIL LINK ACCESS & TEAM MANAGEMENT
          ========================================================================= */}
      {activeTab === 'access' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Active Session Indicator */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-sm">
                {currentUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{currentUser.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300 border border-blue-400/30">
                    Current Active Session ({currentUser.role})
                  </span>
                </div>
                <p className="text-xs text-slate-400">{currentUser.email} &bull; {currentUser.department}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Generate Email Access Link
            </button>
          </div>

          {/* Newly Generated Access Link Banner */}
          {newlyGeneratedLink && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 text-emerald-950 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <h3 className="font-bold text-sm">
                    Magic Access Link Generated for {newlyGeneratedLink.invitation.name} ({newlyGeneratedLink.invitation.email})!
                  </h3>
                </div>
                <button
                  onClick={() => setNewlyGeneratedLink(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={newlyGeneratedLink.link}
                  className="flex-1 text-xs font-mono px-3 py-2 bg-white border border-emerald-300 rounded-lg text-slate-800"
                />
                <button
                  onClick={() => handleCopyLink(newlyGeneratedLink.invitation)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedLinkId === newlyGeneratedLink.invitation.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Link
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleCopyEmailTemplate(newlyGeneratedLink.invitation)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedTemplateId === newlyGeneratedLink.invitation.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied Email!
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" /> Copy Invitation Email
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Invitation Drawer Form */}
          {isInviteOpen && (
            <form onSubmit={handleGenerateInvitation} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900">Issue New User Email Access Link</h3>
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">User Full Name</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="e.g. j.doe@company.com"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Assigned Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Admin">Admin (Full Control)</option>
                    <option value="Finance Officer">Finance Officer (Invoices & Payments)</option>
                    <option value="Logistics Manager">Logistics Manager (Delivery Notes)</option>
                    <option value="Billing Clerk">Billing Clerk (Invoice Record)</option>
                    <option value="Auditor">Auditor (Read Only & Reports)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Department</label>
                  <input
                    type="text"
                    value={inviteDept}
                    onChange={(e) => setInviteDept(e.target.value)}
                    placeholder="e.g. Finance & Accounting"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Generate & Save Magic Link
                </button>
              </div>
            </form>
          )}

          {/* Email Invitations Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Authorized Email Links & Invites</h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Authorized Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Link Status</th>
                    <th className="py-3 px-4 text-right">Access Link Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {inv.name}
                        {inv.email === currentUser.email && (
                          <span className="ml-1.5 text-[10px] text-blue-600 font-bold">(You)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{inv.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{inv.department}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleInvitationStatus(inv.id)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            inv.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {inv.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(inv)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          title="Copy direct access URL"
                        >
                          {copiedLinkId === inv.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          Link
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyEmailTemplate(inv)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          title="Copy ready-to-send invitation email"
                        >
                          {copiedTemplateId === inv.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Mail className="w-3.5 h-3.5" />
                          )}
                          Email Text
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const u = users.find((x) => x.email.toLowerCase() === inv.email.toLowerCase()) || {
                              id: inv.id,
                              name: inv.name,
                              email: inv.email,
                              role: inv.role,
                              department: inv.department,
                              status: 'Active',
                              createdAt: inv.createdAt,
                            };
                            handleSwitchSessionUser(u);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          title="Log in as this user immediately"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Switch User
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteInvitation(inv.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title="Delete invitation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: NUMBER SERIES CONFIGURATION (1-600)
          ========================================================================= */}
      {activeTab === 'series' && (
        <div className="space-y-6 animate-in fade-in">
          {seriesSaveSuccess && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-xs font-semibold text-emerald-900 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Number series settings updated successfully! All next invoices and delivery notes will follow this sequence.</span>
            </div>
          )}

          <form onSubmit={handleSaveSeries} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* INVOICE NUMBER SERIES CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      INV
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Invoice Number Series</h3>
                      <p className="text-xs text-slate-500">Auto-increment sequence for official tax invoices</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                    Next: {formatSeriesNumber(seriesConfig.invoiceSeries.prefix, seriesConfig.invoiceSeries.currentNumber, seriesConfig.invoiceSeries.padding)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Prefix</label>
                    <input
                      type="text"
                      value={seriesConfig.invoiceSeries.prefix}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          invoiceSeries: { ...seriesConfig.invoiceSeries, prefix: e.target.value },
                        })
                      }
                      placeholder="e.g. INV-"
                      className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Series Start #</label>
                    <input
                      type="number"
                      min="1"
                      value={seriesConfig.invoiceSeries.startNumber}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          invoiceSeries: { ...seriesConfig.invoiceSeries, startNumber: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Series End #</label>
                    <input
                      type="number"
                      min="1"
                      value={seriesConfig.invoiceSeries.endNumber}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          invoiceSeries: { ...seriesConfig.invoiceSeries, endNumber: parseInt(e.target.value) || 600 },
                        })
                      }
                      className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Current Active #</label>
                    <input
                      type="number"
                      min={seriesConfig.invoiceSeries.startNumber}
                      max={seriesConfig.invoiceSeries.endNumber}
                      value={seriesConfig.invoiceSeries.currentNumber}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          invoiceSeries: { ...seriesConfig.invoiceSeries, currentNumber: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full text-xs font-mono font-bold text-blue-700 px-3 py-2 border border-blue-300 bg-blue-50/30 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Padding Digits</label>
                    <select
                      value={seriesConfig.invoiceSeries.padding}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          invoiceSeries: { ...seriesConfig.invoiceSeries, padding: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="0">No padding (e.g. 1)</option>
                      <option value="2">2 digits (e.g. 01)</option>
                      <option value="3">3 digits (e.g. 001)</option>
                      <option value="4">4 digits (e.g. 0001)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 w-full">
                      Remaining: <span className="font-bold text-slate-900">{Math.max(0, seriesConfig.invoiceSeries.endNumber - seriesConfig.invoiceSeries.currentNumber + 1)}</span>
                    </div>
                  </div>
                </div>

                {/* Presets */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleSetQuickRange('invoice', 1, 600, 'INV-')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-mono transition-colors cursor-pointer"
                  >
                    INV-001 to 600
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickRange('invoice', 1, 600, `INV-${new Date().getFullYear()}-`)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-mono transition-colors cursor-pointer"
                  >
                    INV-{new Date().getFullYear()}-001
                  </button>
                </div>
              </div>
            </div>

            {/* DELIVERY NOTE NUMBER SERIES CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      DN
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Delivery Note Number Series</h3>
                      <p className="text-xs text-slate-500">Auto-increment sequence for dispatch delivery notes</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
                    Next: {formatSeriesNumber(seriesConfig.deliverySeries.prefix, seriesConfig.deliverySeries.currentNumber, seriesConfig.deliverySeries.padding)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Prefix</label>
                    <input
                      type="text"
                      value={seriesConfig.deliverySeries.prefix}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          deliverySeries: { ...seriesConfig.deliverySeries, prefix: e.target.value },
                        })
                      }
                      placeholder="e.g. DN-"
                      className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Series Start #</label>
                    <input
                      type="number"
                      min="1"
                      value={seriesConfig.deliverySeries.startNumber}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          deliverySeries: { ...seriesConfig.deliverySeries, startNumber: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Series End #</label>
                    <input
                      type="number"
                      min="1"
                      value={seriesConfig.deliverySeries.endNumber}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          deliverySeries: { ...seriesConfig.deliverySeries, endNumber: parseInt(e.target.value) || 600 },
                        })
                      }
                      className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Current Active #</label>
                    <input
                      type="number"
                      min={seriesConfig.deliverySeries.startNumber}
                      max={seriesConfig.deliverySeries.endNumber}
                      value={seriesConfig.deliverySeries.currentNumber}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          deliverySeries: { ...seriesConfig.deliverySeries, currentNumber: parseInt(e.target.value) || 1 },
                        })
                      }
                      className="w-full text-xs font-mono font-bold text-indigo-700 px-3 py-2 border border-indigo-300 bg-indigo-50/30 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Padding Digits</label>
                    <select
                      value={seriesConfig.deliverySeries.padding}
                      onChange={(e) =>
                        setSeriesConfig({
                          ...seriesConfig,
                          deliverySeries: { ...seriesConfig.deliverySeries, padding: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="0">No padding (e.g. 1)</option>
                      <option value="2">2 digits (e.g. 01)</option>
                      <option value="3">3 digits (e.g. 001)</option>
                      <option value="4">4 digits (e.g. 0001)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 w-full">
                      Remaining: <span className="font-bold text-slate-900">{Math.max(0, seriesConfig.deliverySeries.endNumber - seriesConfig.deliverySeries.currentNumber + 1)}</span>
                    </div>
                  </div>
                </div>

                {/* Presets */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleSetQuickRange('delivery', 1, 600, 'DN-')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-mono transition-colors cursor-pointer"
                  >
                    DN-001 to 600
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickRange('delivery', 1, 600, `DN-${new Date().getFullYear()}-`)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-mono transition-colors cursor-pointer"
                  >
                    DN-{new Date().getFullYear()}-001
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="lg:col-span-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Save className="w-4 h-4" />
                Save Series Configuration
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
