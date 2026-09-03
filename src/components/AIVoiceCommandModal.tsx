import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Search, 
  X, 
  ArrowRight, 
  Volume2, 
  VolumeX, 
  FileSpreadsheet, 
  ReceiptText, 
  Truck, 
  GitCompare, 
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  CornerDownLeft,
  Loader2
} from 'lucide-react';
import { 
  PurchaseOrderGroup, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord, 
  MatchingItem 
} from '../types';
import { 
  SpeechRecognitionManager, 
  executeAICommand, 
  speakText, 
  stopSpeaking,
  AICommandResult 
} from '../utils/aiService';
import { ActiveTab } from './Header';

interface AIVoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  poGroups: PurchaseOrderGroup[];
  invoices: InvoiceRecord[];
  deliveryNotes: DeliveryNoteRecord[];
  payments: PaymentRecord[];
  matchingItems: MatchingItem[];
  onNavigateTab: (tab: ActiveTab, filterOrPo?: string) => void;
  onSelectPoForInvoice: (poNumber: string) => void;
  onApplyPoFilter?: (keyword: string, status?: string) => void;
}

export const AIVoiceCommandModal: React.FC<AIVoiceCommandModalProps> = ({
  isOpen,
  onClose,
  poGroups,
  invoices,
  deliveryNotes,
  payments,
  matchingItems,
  onNavigateTab,
  onSelectPoForInvoice,
  onApplyPoFilter,
}) => {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AICommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [micSupported, setMicSupported] = useState(true);

  const speechManagerRef = useRef<SpeechRecognitionManager | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize speech manager
  useEffect(() => {
    speechManagerRef.current = new SpeechRecognitionManager();
    setMicSupported(speechManagerRef.current.isSupported());

    return () => {
      speechManagerRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      speechManagerRef.current?.stop();
      setIsListening(false);
      stopSpeaking();
    }
  }, [isOpen]);

  const toggleListening = () => {
    if (isListening) {
      speechManagerRef.current?.stop();
      setIsListening(false);
    } else {
      setError(null);
      speechManagerRef.current?.start(
        (text, isFinal) => {
          setQuery(text);
          if (isFinal && text.trim().length > 2) {
            handleSearch(text);
          }
        },
        (err) => {
          setError(err);
          setIsListening(false);
        },
        (listening) => {
          setIsListening(listening);
        }
      );
    }
  };

  const handleSearch = async (searchQuery: string = query) => {
    const textToSearch = searchQuery.trim();
    if (!textToSearch) return;

    setIsLoading(true);
    setError(null);
    speechManagerRef.current?.stop();
    setIsListening(false);

    try {
      const response = await executeAICommand({
        query: textToSearch,
        poGroups,
        invoices,
        deliveryNotes,
        payments,
        matchingItems,
      });

      setResult(response);

      if (!isMuted && response.spokenAnswer) {
        speakText(response.spokenAnswer);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to process voice query');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = () => {
    if (!result) return;

    if (result.action?.type === 'OPEN_INVOICE_CREATOR' && result.action.targetPo) {
      onSelectPoForInvoice(result.action.targetPo);
      onNavigateTab('create_invoice');
      onClose();
    } else if (result.suggestedTab === 'matching_report') {
      const filter = result.action?.matchingFilter || result.statusFilter || 'ALL';
      onNavigateTab('matching_report', filter);
      onClose();
    } else if (result.suggestedTab === 'po_master') {
      if (onApplyPoFilter) {
        onApplyPoFilter(result.searchKeyword || '', result.statusFilter);
      }
      onNavigateTab('po_master');
      onClose();
    } else {
      onNavigateTab(result.suggestedTab);
      onClose();
    }
  };

  const handleQuickCommand = (sampleQuery: string) => {
    setQuery(sampleQuery);
    handleSearch(sampleQuery);
  };

  if (!isOpen) return null;

  // Filter matched POs for preview list
  const matchedPosList = result?.matchingPoNumbers && result.matchingPoNumbers.length > 0
    ? poGroups.filter((p) => result.matchingPoNumbers?.includes(p.poNumber))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-white">AI Voice & Semantic Search</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Gemini 3.7 Copilot
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Speak or type natural search commands across POs, Invoices, Receipts & Audit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const nextMute = !isMuted;
                setIsMuted(nextMute);
                if (nextMute) stopSpeaking();
              }}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                isMuted 
                  ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200' 
                  : 'bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30'
              }`}
              title={isMuted ? 'Voice narration muted' : 'Voice narration active'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Voice Input Box */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-950/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="relative flex items-center"
          >
            <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isListening ? 'Listening to your voice command...' : 'e.g. "Find POs for vendor Acme with balance > TZS 10,000,000"'}
              className={`w-full bg-slate-900 border text-slate-100 placeholder-slate-500 text-sm sm:text-base rounded-xl pl-12 pr-28 py-3.5 focus:outline-none transition-all ${
                isListening 
                  ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-950/20' 
                  : 'border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              }`}
            />

            <div className="absolute right-2.5 flex items-center gap-1.5">
              {/* Mic Toggle */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={!micSupported}
                className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  isListening
                    ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30 ring-2 ring-red-400'
                    : micSupported
                    ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                }`}
                title={isListening ? 'Stop listening' : micSupported ? 'Speak search command' : 'Mic not supported in this browser'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Submit search */}
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CornerDownLeft className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            </div>
          </form>

          {/* Listening Audio Wave Visualizer */}
          {isListening && (
            <div className="mt-3 flex items-center justify-between px-3 py-2 bg-blue-950/40 border border-blue-800/40 rounded-lg text-xs text-blue-300 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span>Listening actively... Speak now</span>
              </div>
              <div className="flex items-center gap-1 h-3">
                <span className="w-1 bg-blue-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-3"></span>
                <span className="w-1 bg-blue-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite_0.1s] h-4"></span>
                <span className="w-1 bg-blue-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.2s] h-2"></span>
                <span className="w-1 bg-blue-400 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.3s] h-5"></span>
                <span className="w-1 bg-blue-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.1s] h-3"></span>
              </div>
            </div>
          )}

          {/* Sample Prompts */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Suggested:</span>
            {[
              'Show partially invoiced POs',
              'Check unmatched items in audit report',
              'Find orders for contract C-2024',
              'Show highest remaining balance orders',
              'Summarize outstanding payment liabilities',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => handleQuickCommand(sample)}
                className="text-[11px] px-2.5 py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 rounded-full transition-colors cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Results & Action Section */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-200">Voice Command Issue</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              {/* Spoken Narrative Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/40 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-blue-300">AI Analysis & Spoken Response</span>
                        {result.highlightMetric && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {result.highlightMetric}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-100 font-medium mt-1 leading-relaxed">
                        {result.spokenAnswer}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => speakText(result.spokenAnswer)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition-colors shrink-0"
                    title="Replay Voice Response"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Direct Action Trigger */}
                <div className="mt-4 pt-3 border-t border-blue-900/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span>Target Destination:</span>
                    <span className="font-semibold text-slate-200 capitalize">
                      {result.suggestedTab.replace('_', ' ')}
                    </span>
                    {result.statusFilter && result.statusFilter !== 'ALL' && (
                      <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-blue-300 rounded border border-slate-700">
                        Filter: {result.statusFilter}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteAction}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <span>
                      {result.action?.type === 'OPEN_INVOICE_CREATOR' 
                        ? `Record Invoice for ${result.action.targetPo}`
                        : `Navigate to ${result.suggestedTab.replace('_', ' ')}`}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Matched POs Preview List */}
              {matchedPosList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 px-1">
                    <span>Matched Purchase Orders ({matchedPosList.length})</span>
                    <span className="text-[11px] text-slate-400 font-normal">Click any order to record invoice</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {matchedPosList.map((po) => (
                      <div
                        key={po.poNumber}
                        onClick={() => {
                          onSelectPoForInvoice(po.poNumber);
                          onNavigateTab('create_invoice');
                          onClose();
                        }}
                        className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-blue-400 group-hover:text-blue-300">
                              {po.poNumber}
                            </span>
                            <span className="text-xs text-slate-300 font-medium">
                              {po.customerName}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                                po.status === 'FULLY_INVOICED'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                  : po.status === 'PARTIALLY_INVOICED'
                                  ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                                  : 'bg-slate-700 text-slate-300 border-slate-600'
                              }`}
                            >
                              {po.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                            <span>Contract: <strong className="text-slate-300">{po.contract || 'N/A'}</strong></span>
                            <span>Destination: <strong className="text-slate-300">{po.destination || 'N/A'}</strong></span>
                            <span>Date: <strong className="text-slate-300">{po.date}</strong></span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs text-slate-400">Remaining Balance</div>
                          <div className="text-sm font-bold text-amber-400">
                            ${po.remainingValueAfterVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!result && !isLoading && (
            <div className="py-8 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-blue-400">
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Try Voice or Natural Search</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Click the blue microphone button to speak or type in any inquiry. The AI will interpret your intent, extract filters, highlight discrepancies, and navigate you directly.
                </p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-300">Analyzing enterprise dataset with Gemini AI...</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>Shortcut: <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono text-[10px]">Cmd+K</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono text-[10px]">Ctrl+K</kbd></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
