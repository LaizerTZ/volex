import React, { useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  ReceiptText, 
  Database, 
  Scale, 
  PlusCircle,
  FileCheck2,
  Truck,
  GitCompare, 
  CreditCard, 
  Settings, 
  Download, 
  Cloud, 
  User, 
  Shield,
  Mic,
  Sparkles,
  FileText
} from 'lucide-react';
import { AppUser, GoogleSheetsConfig } from '../types';

export type ActiveTab = 
  | 'dashboard' 
  | 'po_master' 
  | 'create_invoice' 
  | 'invoices_db' 
  | 'delivery_notes' 
  | 'matching_report' 
  | 'payments' 
  | 'settings' 
  | 'ledger';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  totalPOsCount: number;
  totalInvoicesCount: number;
  totalDNsCount?: number;
  onOpenNewInvoice: () => void;
  onOpenMasterExport?: () => void;
  onOpenVoiceSearch?: () => void;
  onOpenAutoReport?: () => void;
  sheetsConfig?: GoogleSheetsConfig;
  currentUser?: AppUser;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalPOsCount,
  totalInvoicesCount,
  totalDNsCount = 0,
  onOpenNewInvoice,
  onOpenMasterExport,
  onOpenVoiceSearch,
  onOpenAutoReport,
  sheetsConfig,
  currentUser,
}) => {
  // Global shortcut (Cmd+K / Ctrl+K) to trigger voice search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenVoiceSearch?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenVoiceSearch]);

  const navItems: { id: ActiveTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'po_master', label: 'PO Master Data', icon: FileSpreadsheet, badge: totalPOsCount },
    { id: 'create_invoice', label: 'Record Invoice', icon: ReceiptText },
    { id: 'invoices_db', label: 'Invoiced PO Database', icon: Database, badge: totalInvoicesCount },
    { id: 'delivery_notes', label: 'Delivery Notes', icon: Truck, badge: totalDNsCount },
    { id: 'matching_report', label: 'Matching & Audit', icon: GitCompare },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'settings', label: 'Settings & Cloud DB', icon: Settings },
    { id: 'ledger', label: 'PO Tracking Ledger', icon: Scale },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">FAMOLA Excel Ninja</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Enterprise
                </span>
                {sheetsConfig?.isConnected && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hidden md:inline-flex items-center gap-1">
                    <Cloud className="w-3 h-3 text-emerald-400" />
                    Sheets Sync
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                PO Tracker, Google Sheets Database, 3-Way Reconciliation & Full Disaster Recovery
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* AI Voice Search CTA Button */}
            {onOpenVoiceSearch && (
              <button
                type="button"
                onClick={onOpenVoiceSearch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-300 bg-blue-950/70 hover:bg-blue-900/80 active:bg-blue-800 border border-blue-700/60 rounded-lg transition-all shadow-sm cursor-pointer group"
                title="AI Voice Command & Search (Cmd+K)"
              >
                <div className="relative">
                  <Mic className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                  </span>
                </div>
                <span className="hidden sm:inline">Voice Search</span>
                <kbd className="hidden lg:inline-block px-1 py-0.2 text-[9px] font-mono bg-blue-900/90 text-blue-200 rounded border border-blue-600/40">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* AI Auto Report Trigger */}
            {onOpenAutoReport && (
              <button
                type="button"
                onClick={onOpenAutoReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-200 bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-700/60 rounded-lg transition-all shadow-sm cursor-pointer"
                title="AI Automated Executive, Financial & Audit Reports"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline">Auto Report</span>
              </button>
            )}

            {onOpenMasterExport && (
              <button
                type="button"
                onClick={onOpenMasterExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Export All Details & Data Suites"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden lg:inline">Export All</span>
              </button>
            )}

            <button
              onClick={onOpenNewInvoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Invoice</span>
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="hidden xl:flex items-center gap-2 pl-2 pr-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 cursor-pointer"
                title={`Signed in as ${currentUser.name} (${currentUser.role})`}
              >
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                  {currentUser.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="font-semibold text-slate-200 max-w-[90px] truncate">{currentUser.name}</span>
                <span className="text-[10px] text-slate-400">({currentUser.role.split(' ')[0]})</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 sm:space-x-3 border-t border-slate-800/80 pt-1 overflow-x-auto pb-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 py-2.5 px-3 sm:px-3.5 rounded-t-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-blue-500 text-blue-400 bg-slate-800/60 shadow-inner'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1 text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
