/**
 * AI Voice Search & Automated Report Generation Service
 */

import { PurchaseOrderGroup, InvoiceRecord, DeliveryNoteRecord, PaymentRecord, MatchingItem } from '../types';

export interface AICommandResult {
  spokenAnswer: string;
  intent: 'SEARCH_PO' | 'FILTER_STATUS' | 'NAVIGATE_TAB' | 'CREATE_INVOICE' | 'AUDIT_CHECK' | 'SUMMARY_METRICS' | 'GENERAL_QA';
  suggestedTab: 'dashboard' | 'po_master' | 'create_invoice' | 'invoices_db' | 'delivery_notes' | 'matching_report' | 'payments' | 'settings' | 'ledger';
  searchKeyword?: string;
  statusFilter?: string;
  matchingPoNumbers?: string[];
  highlightMetric?: string;
  action?: {
    type: 'NONE' | 'OPEN_INVOICE_CREATOR' | 'FILTER_MATCHING' | 'APPLY_SEARCH';
    targetPo?: string;
    matchingFilter?: 'ALL' | 'UNMATCHED' | 'UNDELIVERED' | 'MATCHED';
  };
}

export interface AIReportMetric {
  label: string;
  value: string;
  changeOrStatus?: string;
  sentiment: 'positive' | 'warning' | 'neutral' | 'danger';
}

export interface AIReportRisk {
  category: string;
  title: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  affectedPOs?: string[];
}

export interface AIReportData {
  title: string;
  subtitle: string;
  generatedAt: string;
  reportType: string;
  executiveSummary: string;
  keyMetrics: AIReportMetric[];
  findingsAndRisks: AIReportRisk[];
  tabularBreakdown: {
    sectionTitle: string;
    headers: string[];
    rows: (string | number)[][];
  };
  strategicRecommendations: string[];
  fullMarkdown: string;
}

/**
 * Execute AI Natural Language / Voice Command query
 */
export async function executeAICommand(params: {
  query: string;
  poGroups: PurchaseOrderGroup[];
  invoices: InvoiceRecord[];
  deliveryNotes: DeliveryNoteRecord[];
  payments: PaymentRecord[];
  matchingItems: MatchingItem[];
}): Promise<AICommandResult> {
  const res = await fetch('/api/ai/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details || err.error || 'Failed to process AI command');
  }

  return res.json();
}

/**
 * Generate AI Automated Report
 */
export async function generateAIReport(params: {
  reportType: 'EXECUTIVE_AUDIT' | 'AP_FINANCIAL_AGING' | 'LOGISTICS_FULFILLMENT' | 'LIFECYCLE_RISK' | 'CUSTOM';
  customPrompt?: string;
  summaryMetrics: Record<string, any>;
  poData: PurchaseOrderGroup[];
  invoicesData: InvoiceRecord[];
  deliveryNotesData: DeliveryNoteRecord[];
  paymentsData: PaymentRecord[];
  matchingData: MatchingItem[];
}): Promise<AIReportData> {
  const res = await fetch('/api/ai/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details || err.error || 'Failed to generate AI report');
  }

  return res.json();
}

/**
 * Speech Recognition Hook / Utility wrapper
 */
export class SpeechRecognitionManager {
  private recognition: any = null;
  private isListening: boolean = false;
  private onResultCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onStateChangeCallback: ((listening: boolean) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          this.isListening = true;
          this.onStateChangeCallback?.(true);
        };

        this.recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const currentText = finalTranscript || interimTranscript;
          const isFinal = Boolean(finalTranscript);
          this.onResultCallback?.(currentText, isFinal);
        };

        this.recognition.onerror = (event: any) => {
          console.warn('Speech recognition event error:', event.error);
          this.isListening = false;
          this.onStateChangeCallback?.(false);
          let userMessage = 'Microphone error or permission denied.';
          if (event.error === 'no-speech') {
            userMessage = 'No speech detected. Please try speaking again.';
          } else if (event.error === 'not-allowed') {
            userMessage = 'Microphone permission was denied. Please allow microphone access.';
          }
          this.onErrorCallback?.(userMessage);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          this.onStateChangeCallback?.(false);
        };
      }
    }
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  public start(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: string) => void,
    onStateChange?: (listening: boolean) => void
  ) {
    if (!this.recognition) {
      onError?.('Speech recognition is not supported in this browser environment. You can type commands directly.');
      return;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onStateChangeCallback = onStateChange || null;

    try {
      this.recognition.start();
    } catch (e) {
      // Recognition may already be started
      try {
        this.recognition.stop();
        setTimeout(() => this.recognition.start(), 100);
      } catch (err) {
        console.warn('Failed to restart speech recognition', err);
      }
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Error stopping speech recognition:', e);
      }
    }
    this.isListening = false;
    this.onStateChangeCallback?.(false);
  }
}

/**
 * Optional Text-to-Speech playback
 */
export function speakText(text: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Stop prior speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
