"use client";

import { useEffect, useState, useCallback } from "react";
import { api, apiRoutes, Transaction, Metrics, SSEEvent } from "@/lib/api";
import MetricsCards from "@/components/MetricsCards";
import SimulatorPanel from "@/components/SimulatorPanel";
import LiveFeed from "@/components/LiveFeed";
import GMVChart from "@/components/GMVChart";
import { motion } from "framer-motion";
import { Zap, Brain, RefreshCw } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [liveEvents, setLiveEvents] = useState<SSEEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [txRes, metricsRes] = await Promise.all([
        api.get(apiRoutes.transactions),
        api.get(apiRoutes.metrics),
      ]);
      setTransactions(txRes.data);
      setMetrics(metricsRes.data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Failed to fetch data:", e);
    }
  }, []);

  // SSE connection
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      es = new EventSource(`${API_URL}/api/events`);

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);

          if (data.type === "HEARTBEAT" || data.type === "CONNECTED") return;

          setLiveEvents((prev) => [data, ...prev].slice(0, 50));

          // Refresh data on meaningful events
          const refreshEvents = [
            "FAILURE_INGESTED",
            "AI_DIAGNOSIS",
            "RETRY_SCHEDULED",
            "LINK_SENT",
            "PAYMENT_CAPTURED",
            "STATUS_UPDATE",
            "SYSTEM_RESET",
          ];
          if (refreshEvents.includes(data.type)) {
            fetchData();
          }
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es?.close();
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();
    fetchData();

    return () => {
      es?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#0B0F17] bg-grid">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-2xl" />
              <div className="relative p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                <span className="gradient-text">CascadeRecover</span>
                <span className="text-white ml-2">AI</span>
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-0.5">
                Autonomous Revenue Recovery ·{" "}
                <span className="text-emerald-500 font-semibold">
                  Razorpay Buildathon 2024
                </span>{" "}
                · Track 3
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-slate-600 text-xs hidden sm:block">
                Last sync: {lastRefresh.toLocaleTimeString("en-IN")}
              </span>
            )}
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 rounded-lg transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40">
              <Brain className="w-4 h-4 text-violet-400" />
              <span className="text-slate-400 text-xs font-medium">
                Gemini 1.5 Flash
              </span>
            </div>
          </div>
        </motion.header>

        {/* Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6"
        >
          <MetricsCards metrics={metrics} />
        </motion.div>

        {/* Simulator Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6"
        >
          <SimulatorPanel onAction={fetchData} isConnected={isConnected} />
        </motion.div>

        {/* GMV Charts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-6"
        >
          <GMVChart metrics={metrics} transactions={transactions} />
        </motion.div>

        {/* Live Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <LiveFeed transactions={transactions} liveEvents={liveEvents} />
        </motion.div>

        {/* Footer */}
        <footer className="mt-10 text-center text-slate-600 text-xs space-y-1 pb-8">
          <p className="font-semibold">
            CascadeRecover AI — Built for Razorpay AI Buildathon 2024 · Track 3: AI Revenue Recovery
          </p>
          <p>Powered by Google Gemini 1.5 Flash · FastAPI · Next.js 14 · Resend</p>
        </footer>
      </div>
    </div>
  );
}
