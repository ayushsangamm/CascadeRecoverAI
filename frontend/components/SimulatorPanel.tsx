"use client";

import { api, apiRoutes, type SimulationFailPayload } from "@/lib/api";
import {
  Zap,
  CreditCard,
  BarChart3,
  RefreshCw,
  Loader2,
  WifiOff,
  Wifi,
  Play,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SimulatorPanelProps {
  onAction?: () => void;
  isConnected: boolean;
}

const SOFT_FAIL_SCENARIOS = [
  { error_code: "NETWORK_TIMEOUT", error_description: "Request timed out after 30s — gateway unreachable" },
  { error_code: "GATEWAY_504", error_description: "504 Bad Gateway — upstream bank server timeout" },
  { error_code: "NETWORK_TIMEOUT", error_description: "SSL handshake timeout — TLS negotiation failed" },
];

const HARD_FAIL_SCENARIOS = [
  { error_code: "INSUFFICIENT_FUNDS", error_description: "Account balance ₹0 — insufficient funds" },
  { error_code: "CARD_EXPIRED", error_description: "Card expired 03/24 — renewal required" },
  { error_code: "AUTH_FAILED", error_description: "3D Secure authentication failed — OTP mismatch" },
  { error_code: "CARD_BLOCKED", error_description: "Card blocked by issuing bank" },
];

const DEMO_CUSTOMERS: Pick<SimulationFailPayload, "customer_name" | "customer_email" | "customer_phone">[] = [
  { customer_name: "Arjun Sharma", customer_email: "arjun@demo.com", customer_phone: "9876543210" },
  { customer_name: "Priya Nair", customer_email: "priya@demo.com", customer_phone: "9876543211" },
  { customer_name: "Rahul Gupta", customer_email: "rahul@demo.com", customer_phone: "9876543212" },
  { customer_name: "Sneha Reddy", customer_email: "sneha@demo.com", customer_phone: "9876543213" },
  { customer_name: "Vikram Patel", customer_email: "vikram@demo.com", customer_phone: "9876543214" },
];

type LoadingState = "soft" | "hard" | "batch" | "reset" | null;

export default function SimulatorPanel({ onAction, isConnected }: SimulatorPanelProps) {
  const [loading, setLoading] = useState<LoadingState>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const triggerSoftFail = async () => {
    setLoading("soft");
    setLastResult(null);
    try {
      const scenario = SOFT_FAIL_SCENARIOS[Math.floor(Math.random() * SOFT_FAIL_SCENARIOS.length)];
      const customer = DEMO_CUSTOMERS[Math.floor(Math.random() * DEMO_CUSTOMERS.length)];
      const amount = Math.floor(Math.random() * 9000) + 500;

      const payload: SimulationFailPayload = {
        ...scenario,
        ...customer,
        amount,
        currency: "INR",
      };
      const { data } = await api.post(apiRoutes.simulateFail, payload);
      setLastResult(`✅ Soft failure injected — Tx ${data.tx_id} (₹${amount})`);
      onAction?.();
    } catch (e) {
      setLastResult("❌ Failed to trigger — is backend running?");
    } finally {
      setLoading(null);
    }
  };

  const triggerHardFail = async () => {
    setLoading("hard");
    setLastResult(null);
    try {
      const scenario = HARD_FAIL_SCENARIOS[Math.floor(Math.random() * HARD_FAIL_SCENARIOS.length)];
      const customer = DEMO_CUSTOMERS[Math.floor(Math.random() * DEMO_CUSTOMERS.length)];
      const amount = Math.floor(Math.random() * 9000) + 500;

      const payload: SimulationFailPayload = {
        ...scenario,
        ...customer,
        amount,
        currency: "INR",
      };
      const { data } = await api.post(apiRoutes.simulateFail, payload);
      setLastResult(`✅ Hard failure injected — Tx ${data.tx_id} (₹${amount})`);
      onAction?.();
    } catch (e) {
      setLastResult("❌ Failed to trigger — is backend running?");
    } finally {
      setLoading(null);
    }
  };

  const triggerBatch = async () => {
    setLoading("batch");
    setLastResult(null);
    try {
      const { data } = await api.post(apiRoutes.simulateBatch);
      setLastResult(`✅ Batch of ${data.count} failures injected`);
      onAction?.();
    } catch (e) {
      setLastResult("❌ Failed to trigger batch — is backend running?");
    } finally {
      setLoading(null);
    }
  };

  const resetSystem = async () => {
    setLoading("reset");
    setLastResult(null);
    try {
      await api.delete(apiRoutes.reset);
      setLastResult("🔄 System reset — all data cleared");
      onAction?.();
    } catch (e) {
      setLastResult("❌ Reset failed — is backend running?");
    } finally {
      setLoading(null);
    }
  };

  const buttons = [
    {
      id: "soft",
      label: "Soft Failure",
      sublabel: "Network Timeout",
      icon: <Wifi className="w-4 h-4" />,
      onClick: triggerSoftFail,
      color: "from-amber-500 to-orange-600",
      border: "border-amber-600/40",
      glow: "hover:shadow-amber-500/20",
      bg: "bg-amber-950/30",
    },
    {
      id: "hard",
      label: "Hard Failure",
      sublabel: "Card Decline",
      icon: <CreditCard className="w-4 h-4" />,
      onClick: triggerHardFail,
      color: "from-rose-500 to-red-700",
      border: "border-rose-600/40",
      glow: "hover:shadow-rose-500/20",
      bg: "bg-rose-950/30",
    },
    {
      id: "batch",
      label: "Batch Sim (10×)",
      sublabel: "Mixed scenarios",
      icon: <BarChart3 className="w-4 h-4" />,
      onClick: triggerBatch,
      color: "from-violet-500 to-purple-700",
      border: "border-violet-600/40",
      glow: "hover:shadow-violet-500/20",
      bg: "bg-violet-950/30",
    },
    {
      id: "reset",
      label: "Reset System",
      sublabel: "Clear all data",
      icon: <RefreshCw className="w-4 h-4" />,
      onClick: resetSystem,
      color: "from-slate-500 to-slate-700",
      border: "border-slate-600/40",
      glow: "hover:shadow-slate-500/20",
      bg: "bg-slate-800/30",
    },
  ];

  return (
    <div className="rounded-2xl border border-[#223046] bg-[#151D2A] p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-violet-950/40 border border-violet-700/30">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Simulation Lab</h2>
            <p className="text-slate-500 text-xs">Inject payment failures</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${isConnected ? "text-emerald-400 bg-emerald-950/30 border-emerald-700/40" : "text-rose-400 bg-rose-950/30 border-rose-700/40"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
          {isConnected ? "Live" : "Disconnected"}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {buttons.map((btn) => (
          <motion.button
            key={btn.id}
            onClick={btn.onClick}
            disabled={loading !== null}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`relative group flex flex-col items-center gap-2 p-4 rounded-xl border ${btn.border} ${btn.bg} transition-all duration-200 hover:shadow-xl ${btn.glow} disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${btn.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            <div className={`p-2 rounded-lg bg-gradient-to-br ${btn.color} shadow-lg`}>
              {loading === btn.id ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <span className="text-white">{btn.icon}</span>
              )}
            </div>
            <div className="text-center">
              <p className="text-white text-xs font-bold">{btn.label}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">{btn.sublabel}</p>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-4 px-4 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-300 text-xs font-mono"
          >
            {lastResult}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
