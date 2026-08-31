import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

export const apiRoutes = {
  simulateFail: "/simulate/fail",
  simulateBatch: "/simulate/batch",
  transactions: "/transactions",
  metrics: "/metrics",
  events: `${API_BASE}/api/events`,
  mockCapture: (txId: string) => `/pay/mock-capture/${txId}`,
  transaction: (txId: string) => `/transaction/${txId}`,
  reset: "/reset",
};

export type TransactionStatus =
  | "FAILED"
  | "RETRY_SCHEDULED"
  | "LINK_SENT"
  | "RECOVERED"
  | "PERMANENTLY_FAILED";

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  error_code: string;
  error_description: string;
  status: TransactionStatus;
  attempts_count: number;
  decline_type: string | null;
  ai_reasoning: string | null;
  ai_action: string | null;
  customer_message: string | null;
  payment_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface Metrics {
  total_at_risk_gmv: number;
  recovered_gmv: number;
  total_gmv: number;
  recovery_rate_pct: number;
  active_cases: number;
  total_transactions: number;
  permanently_failed: number;
  link_sent: number;
  retry_scheduled: number;
}

export interface SSEEvent {
  type:
    | "CONNECTED"
    | "HEARTBEAT"
    | "FAILURE_INGESTED"
    | "AI_DIAGNOSIS"
    | "RETRY_SCHEDULED"
    | "LINK_SENT"
    | "PAYMENT_CAPTURED"
    | "STATUS_UPDATE"
    | "SYSTEM_RESET";
  tx_id?: string;
  customer_name?: string;
  amount?: number;
  error_code?: string;
  decline_type?: string;
  action?: string;
  reasoning?: string;
  status?: string;
  payment_link?: string;
  email_sent?: boolean;
  message?: string;
  timestamp?: string;
}
