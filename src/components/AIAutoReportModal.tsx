import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  FileText, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  X, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  TrendingUp, 
  Clock, 
  Truck, 
  ReceiptText, 
  CreditCard,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  PurchaseOrderGroup, 
  InvoiceRecord, 
  DeliveryNoteRecord, 
  PaymentRecord, 
  MatchingItem, 
  DashboardMetrics 
} from '../types';
import { generateAIReport, AIReportData } from '../utils/aiService';

interface AIAutoReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  poGroups: PurchaseOrderGroup[];
  invoices: InvoiceRecord[];
  deliveryNotes: DeliveryNoteRecord[];
  payments: PaymentRecord[];
  matchingItems: MatchingItem[];
  metrics: DashboardMetrics;
}

type ReportTypePreset = 'EXECUTIVE_AUDIT' | 'AP_FINANCIAL_AGING' | 'LOGISTICS_FULFILLMENT' | 'LIFECYCLE_RISK' | 'CUSTOM';

export const AIAutoReportModal: React.FC<AIAutoReportModalProps> = ({
  isOpen,
  onClose,
  poGroups,
  invoices,
  deliveryNotes,
  payments,
  matchingItems,
  metrics,
}) => {
  const [selectedType, setSelectedType] = useState<ReportTypePreset>('EXECUTIVE_AUDIT');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<AIReportData | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const presets: { id: ReportTypePreset; label: string; desc: string; icon: React.ElementType }[] = [
    {
      id: 'EXECUTIVE_AUDIT',
      label: '3-Way Reconciliation Audit',
      desc: 'PO vs Delivery vs Invoices matching, variance analysis, overbilling & risk detection',
      icon: ShieldCheck,
    },
    {
      id: 'AP_FINANCIAL_AGING',
      label: 'Accounts Payable & Cashflow',
      desc: 'Committed PO funds, invoiced liabilities, settled payments, and pending cash disbursements',
      icon: CreditCard,
    },
    {
      id: 'LOGISTICS_FULFILLMENT',
      label: 'Logistics & Delivery Receipts',
      desc: 'Goods receipt fulfillment rates, undelivered PO backlog, carrier & destination metrics',
      icon: Truck,
    },
    {
      id: 'LIFECYCLE_RISK',
      label: 'PO Lifecycle & Risk Health',
      desc: 'Stalled orders, high-remaining commitments, contract completion & aging assessment',
      icon: TrendingUp,
    },
    {
      id: 'CUSTOM',
      label: 'Custom Management Query',
      desc: 'Provide your own analytical prompt or department-specific questions to Gemini AI',
      icon: Sparkles,
    },
  ];

  const handleGenerate = async (typeToUse = selectedType) => {
    setIsGenerating(true);
    setCopied(false);
    setCopiedEmail(false);

    try {
      const generated = await generateAIReport({
        reportType: typeToUse,
        customPrompt: typeToUse === 'CUSTOM' ? customPrompt : undefined,
        summaryMetrics: metrics,
        poData: poGroups,
        invoicesData: invoices,
        deliveryNotesData: deliveryNotes,
        paymentsData: payments,
        matchingData: matchingItems,
      });

      setReport(generated);
    } catch (err) {
      console.error('Failed to generate report:', err);
      alert('Failed to generate AI report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate initial report when modal opens if none exists
  useEffect(() => {
    if (isOpen && !report && !isGenerating) {
      handleGenerate('EXECUTIVE_AUDIT');
    }
  }, [isOpen]);

  const handleCopyMarkdown = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.fullMarkdown || report.executiveSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCopyEmailBrief = () => {
    if (!report) return;
    const emailText = `EXECUTIVE REPORT: ${report.title}
Generated: ${new Date(report.generatedAt).toLocaleString()}
Scope: ${poGroups.length} Purchase Orders | Total Value: TZS ${(metrics.totalPoValue || 0).toLocaleString()}

EXECUTIVE SUMMARY:
${report.executiveSummary}

KEY METRICS:
${report.keyMetrics.map((m) => `• ${m.label}: ${m.value} (${m.changeOrStatus || ''})`).join('\n')}

STRATEGIC RECOMMENDATIONS:
${report.strategicRecommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Generated via FAMOLA Excel Ninja AI Copilot`;

    navigator.clipboard.writeText(emailText);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!report) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive Summary & Metrics
    const summaryRows = [
      ['REPORT TITLE', report.title],
      ['SUBTITLE', report.subtitle],
      ['GENERATED AT', new Date(report.generatedAt).toLocaleString()],
      ['REPORT TYPE', report.reportType],
      [],
      ['EXECUTIVE SUMMARY'],
      [report.executiveSummary],
      [],
      ['KEY PERFORMANCE & RISK METRICS'],
      ['Metric', 'Value', 'Status / Detail', 'Sentiment'],
      ...report.keyMetrics.map((m) => [m.label, m.value, m.changeOrStatus || '', m.sentiment]),
      [],
      ['STRATEGIC RECOMMENDATIONS'],
      ...report.strategicRecommendations.map((r, i) => [`${i + 1}`, r]),
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive_Summary');

    // Sheet 2: Findings & Risk Items
    if (report.findingsAndRisks && report.findingsAndRisks.length > 0) {
      const riskRows = [
        ['Category', 'Severity', 'Finding Title', 'Detailed Description', 'Affected Purchase Orders'],
        ...report.findingsAndRisks.map((f) => [
          f.category,
          f.severity,
          f.title,
          f.description,
          f.affectedPOs ? f.affectedPOs.join(', ') : 'All',
        ]),
      ];
      const wsRisks = XLSX.utils.aoa_to_sheet(riskRows);
      XLSX.utils.book_append_sheet(wb, wsRisks, 'Audit_Findings_Risks');
    }

    // Sheet 3: Tabular Breakdown
    if (report.tabularBreakdown && report.tabularBreakdown.headers) {
      const tableRows = [
        report.tabularBreakdown.headers,
        ...report.tabularBreakdown.rows,
      ];
      const wsTable = XLSX.utils.aoa_to_sheet(tableRows);
      XLSX.utils.book_append_sheet(wb, wsTable, 'Data_Breakdown');
    }

    const filename = `AI_Report_${report.reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">AI Automated Report Generator</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Instant Executive Insights
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated 3-Way Reconciliation, AP Cashflow, and Logistics Audit powered by Gemini AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preset Selector Ribbon */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {presets.map((preset) => {
              const Icon = preset.icon;
              const isSelected = selectedType === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedType(preset.id);
                    if (preset.id !== 'CUSTOM') {
                      handleGenerate(preset.id);
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/40'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span className="font-semibold text-xs truncate">{preset.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                    {preset.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Custom Prompt Box when Custom is selected */}
          {selectedType === 'CUSTOM' && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Enter custom analysis query (e.g. 'Analyze top 5 suppliers by delivery delay risk and contract value')..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => handleGenerate('CUSTOM')}
                disabled={isGenerating || !customPrompt.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate</span>
              </button>
            </div>
          )}
        </div>

        {/* Report Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isGenerating && (
            <div className="py-20 text-center text-slate-400 space-y-4">
              <RefreshCw className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  Synthesizing Enterprise Intelligence with Gemini 3.7...
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Reconciling PO lines, delivery receipts, invoices, and cash settlements
                </p>
              </div>
            </div>
          )}

          {!isGenerating && report && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Report Header Title Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 border border-blue-800/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {report.reportType.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(report.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white mt-1.5">{report.title}</h2>
                    <p className="text-xs text-slate-300 mt-0.5">{report.subtitle}</p>
                  </div>

                  {/* Actions (Export, Print, Copy) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Export report as multi-tab Excel spreadsheet"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Excel (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Print or Save as PDF"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-400" />
                      <span>Print / PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyEmailBrief}
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Copy executive brief for email or Slack"
                    >
                      {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedEmail ? 'Copied Brief!' : 'Copy Brief'}</span>
                    </button>
                  </div>
                </div>

                {/* Executive Summary Text */}
                <div className="mt-4 pt-4 border-t border-blue-900/30">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1.5">
                    Executive Summary
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                    {report.executiveSummary}
                  </p>
                </div>
              </div>

              {/* Key Metric Highlights Cards */}
              {report.keyMetrics && report.keyMetrics.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {report.keyMetrics.map((metric, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between"
                    >
                      <span className="text-[11px] text-slate-400 font-medium truncate">{metric.label}</span>
                      <div className="mt-1">
                        <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                          {metric.value}
                        </span>
                        {metric.changeOrStatus && (
                          <div
                            className={`text-[10px] font-semibold mt-0.5 truncate ${
                              metric.sentiment === 'positive'
                                ? 'text-emerald-400'
                                : metric.sentiment === 'danger'
                                ? 'text-red-400'
                                : metric.sentiment === 'warning'
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {metric.changeOrStatus}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Findings & Risk Observations */}
              {report.findingsAndRisks && report.findingsAndRisks.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Audit Findings & Risk Observations</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.findingsAndRisks.map((finding, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border flex flex-col justify-between ${
                          finding.severity === 'HIGH'
                            ? 'bg-red-950/30 border-red-800/50 text-red-200'
                            : finding.severity === 'MEDIUM'
                            ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                            : finding.severity === 'LOW'
                            ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                            : 'bg-slate-800/50 border-slate-700 text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              {finding.category}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                                finding.severity === 'HIGH'
                                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                  : finding.severity === 'MEDIUM'
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              }`}
                            >
                              {finding.severity}
                            </span>
                          </div>
                          <h5 className="font-bold text-sm text-white mt-1.5">{finding.title}</h5>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            {finding.description}
                          </p>
                        </div>

                        {finding.affectedPOs && finding.affectedPOs.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                            <span className="font-semibold">Affected Orders:</span>
                            {finding.affectedPOs.map((po) => (
                              <span key={po} className="px-1.5 py-0.2 bg-slate-800 text-blue-300 rounded border border-slate-700 font-mono text-[10px]">
                                {po}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabular Data Breakdown */}
              {report.tabularBreakdown && report.tabularBreakdown.headers && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>{report.tabularBreakdown.sectionTitle || 'Operational Breakdown Table'}</span>
                  </h4>

                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60 shadow-inner">
                    <table className="w-full text-left text-xs text-slate-300 border-collapse">
                      <thead className="bg-slate-800/80 text-slate-200 border-b border-slate-700 font-semibold">
                        <tr>
                          {report.tabularBreakdown.headers.map((h, i) => (
                            <th key={i} className="px-3.5 py-2.5 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {report.tabularBreakdown.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3.5 py-2.5 whitespace-nowrap">
                                {String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Strategic Action Items */}
              {report.strategicRecommendations && report.strategicRecommendations.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>Prioritized Management Action Items</span>
                  </h4>
                  <ul className="space-y-2">
                    {report.strategicRecommendations.map((rec, i) => (
                      <li key={i} className="text-xs sm:text-sm text-slate-200 flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="hover:text-slate-200 flex items-center gap-1 font-medium cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Markdown!' : 'Copy Full Markdown'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={isGenerating}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
