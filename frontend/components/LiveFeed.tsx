"use client";

import { Transaction, SSEEvent } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Brain,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  AlertOctagon,
  Radio,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface LiveFeedProps {
  transactions: Transaction[];
  liveEvents: SSEEvent[];
}

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  FAILED: {
    label: "Failed",
    color: "text-rose-400",
    bg: "bg-rose-950/40 border-rose-700/40",
    icon: <XCircle className="w-3 h-3" />,
  },
  RETRY_SCHEDULED: {
    label: "Retrying...",
    color: "text-amber-400",
    bg: "bg-amber-950/40 border-amber-700/40",
    icon: <RefreshCw className="w-3 h-3 animate-spin" />,
  },
  LINK_SENT: {
    label: "Link Sent",
    color: "text-sky-400",
    bg: "bg-sky-950/40 border-sky-700/40",
    icon: <Mail className="w-3 h-3" />,
  },
  RECOVERED: {
    label: "Recovered",
    color: "text-emerald-400",
    bg: "bg-emerald-950/40 border-emerald-700/40",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  PERMANENTLY_FAILED: {
    label: "Terminated",
    color: "text-slate-500",
    bg: "bg-slate-800/40 border-slate-700/40",
    icon: <AlertOctagon className="w-3 h-3" />,
  },
};

const actionConfig: Record<string, { label: string; color: string }> = {
  SMART_RETRY: { label: "Smart Retry", color: "text-amber-400" },
  ALTERNATE_PAYMENT_LINK: { label: "Alt. Link", color: "text-sky-400" },
  TERMINATE: { label: "Terminate", color: "text-slate-500" },
};

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.FAILED;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default function LiveFeed({ transactions, liveEvents }: LiveFeedProps) {
  return (
    <div className="rounded-2xl border border-[#223046] bg-[#151D2A] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#223046]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-700/30">
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Live Recovery Pipeline</h2>
            <p className="text-slate-500 text-xs">Real-time AI intervention feed</p>
          </div>
        </div>
        <span className="text-slate-500 text-xs font-mono">
          {transactions.length} transactions
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-slate-800/50 mb-4">
              <Radio className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-500 font-medium">No transactions yet</p>
            <p className="text-slate-600 text-sm mt-1">
              Use the Simulation Lab above to inject payment failures
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#223046]">
                {["Time", "Tx ID", "Customer", "Amount", "Error Code", "AI Decision", "Action", "Status"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {transactions.map((tx, i) => {
                  const action = actionConfig[tx.ai_action ?? ""] ?? { label: "Diagnosing...", color: "text-slate-400" };
                  const isNew = i === 0;

                  return (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0, backgroundColor: "rgba(16, 185, 129, 0.1)" }}
                      animate={{ opacity: 1, backgroundColor: "transparent" }}
                      transition={{ duration: 0.8 }}
                      className="border-b border-[#1a2535] hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono whitespace-nowrap">
                        {formatTime(tx.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded">
                          {tx.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white text-xs font-medium">{tx.customer_name}</p>
                          <p className="text-slate-500 text-[10px]">{tx.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-bold text-sm whitespace-nowrap">
                        ₹{tx.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-rose-950/30 border border-rose-800/30 text-rose-400 text-[10px] font-mono font-semibold px-2 py-0.5 rounded">
                          {tx.error_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-2">
                          {tx.ai_reasoning ?? (
                            <span className="text-slate-600 italic">AI analyzing...</span>
                          )}
                        </p>
                        {tx.decline_type && (
                          <span className={`text-[9px] font-semibold mt-0.5 block ${tx.decline_type === "SOFT_DECLINE" ? "text-amber-500" : "text-rose-500"}`}>
                            {tx.decline_type === "SOFT_DECLINE" ? "⚡ Soft" : "🛑 Hard"} decline
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <span className={`text-xs font-bold ${action.color}`}>{action.label}</span>
                          {tx.ai_action === "ALTERNATE_PAYMENT_LINK" && tx.payment_link && (
                            <Link
                              href={`/pay/${tx.id}`}
                              className="flex items-center gap-1 text-[10px] text-sky-500 hover:text-sky-400 mt-0.5 group-hover:underline"
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> Pay link
                            </Link>
                          )}
                          {tx.ai_action === "SMART_RETRY" && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-500 mt-0.5">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Auto-Retrying (Cooldown)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={tx.status} />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
