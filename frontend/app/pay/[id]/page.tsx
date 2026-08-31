"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, apiRoutes } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Zap,
  CheckCircle2,
  CreditCard,
  Smartphone,
  ArrowLeft,
  Loader2,
  Lock,
  AlertTriangle,
  Clock,
} from "lucide-react";

interface TxData {
  id: string;
  amount: number;
  currency: string;
  customer_name: string;
  customer_email: string;
  error_code: string;
  error_description: string;
  status: string;
  decline_type: string | null;
  ai_reasoning: string | null;
  customer_message: string | null;
}

type PaymentMethod = "upi" | "card" | "netbanking";
type PayState = "idle" | "processing" | "success" | "error" | "already_done";

export default function MockCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const txId = params.id as string;

  const [tx, setTx] = useState<TxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [payState, setPayState] = useState<PayState>("idle");
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [upiId, setUpiId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  useEffect(() => {
    const fetchTx = async () => {
      try {
        const { data } = await api.get(apiRoutes.transaction(txId));
        setTx(data);
        if (data.status === "RECOVERED") {
          setPayState("already_done");
        }
      } catch (e) {
        console.error("Failed to load transaction:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTx();
  }, [txId]);

  const handlePay = async () => {
    setPayState("processing");
    try {
      // Simulate processing time
      await new Promise((r) => setTimeout(r, 1800));
      const { data } = await api.post(apiRoutes.mockCapture(txId));
      if (data.status === "recovered" || data.status === "already_recovered") {
        setPayState("success");
      }
    } catch (e) {
      setPayState("error");
    }
  };

  const formatCard = (v: string) =>
    v
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(\d{4})/g, "$1 ")
      .trim();

  const formatExpiry = (v: string) => {
    const cleaned = v.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return cleaned;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h1 className="text-white text-xl font-bold">Transaction Not Found</h1>
        <p className="text-slate-500">Transaction {txId} does not exist.</p>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Success State */}
        <AnimatePresence>
          {payState === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 flex items-center justify-center bg-[#0B0F17]/95 backdrop-blur-sm z-50"
            >
              <div className="text-center p-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="mx-auto w-24 h-24 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-full flex items-center justify-center mb-6"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </motion.div>
                <h2 className="text-3xl font-black text-white mb-2">Payment Successful!</h2>
                <p className="text-emerald-400 text-xl font-bold mb-1">
                  ₹{tx.amount.toLocaleString("en-IN")} Recovered
                </p>
                <p className="text-slate-500 text-sm mb-8">
                  GMV recovery confirmed · Tx {txId}
                </p>
                <button
                  onClick={() => router.push("/")}
                  className="flex items-center gap-2 mx-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card */}
        <div className="rounded-3xl border border-[#223046] bg-[#151D2A] overflow-hidden shadow-2xl">
          {/* Razorpay-style header */}
          <div className="bg-gradient-to-r from-[#0B1628] to-[#0F1E35] px-6 py-5 border-b border-[#223046]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-lg tracking-tight">CascadeRecover</p>
                  <p className="text-slate-500 text-xs">Secure Payment Gateway</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold bg-emerald-950/40 border border-emerald-700/30 px-2.5 py-1.5 rounded-full">
                <Lock className="w-3 h-3" />
                256-bit SSL
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Invoice */}
            <div className="bg-[#0B1628] rounded-2xl border border-[#1E3A5F] p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
                    Payment for
                  </p>
                  <p className="text-white font-bold text-base">{tx.customer_name}</p>
                  <p className="text-slate-500 text-xs">{tx.customer_email}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Ref</p>
                  <p className="text-slate-300 font-mono text-xs font-bold">{tx.id}</p>
                </div>
              </div>
              <div className="border-t border-[#223046] pt-3 flex items-center justify-between">
                <span className="text-slate-400 text-sm">Total Amount</span>
                <span className="text-emerald-400 text-3xl font-black">
                  ₹{tx.amount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* AI Recovery Message */}
            {tx.customer_message && payState === "idle" && (
              <div className="flex gap-3 bg-amber-950/20 border border-amber-700/30 rounded-xl p-4">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-200 text-xs leading-relaxed">{tx.customer_message}</p>
              </div>
            )}

            {/* Already recovered */}
            {payState === "already_done" && (
              <div className="flex gap-3 bg-emerald-950/20 border border-emerald-700/30 rounded-xl p-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-emerald-300 text-sm font-medium">
                  This payment has already been completed successfully!
                </p>
              </div>
            )}

            {payState !== "already_done" && (
              <>
                {/* Payment Method Tabs */}
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                    Select Payment Method
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: "upi", label: "UPI", icon: <Smartphone className="w-4 h-4" /> },
                        { id: "card", label: "Card", icon: <CreditCard className="w-4 h-4" /> },
                        { id: "netbanking", label: "Net Banking", icon: <Shield className="w-4 h-4" /> },
                      ] as { id: PaymentMethod; label: string; icon: React.ReactNode }[]
                    ).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 text-xs font-semibold ${
                          method === m.id
                            ? "bg-emerald-950/40 border-emerald-600/60 text-emerald-400"
                            : "bg-slate-800/30 border-slate-700/40 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {m.icon}
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI Input */}
                {method === "upi" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                      UPI ID
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="yourname@upi"
                      className="w-full bg-[#0B1628] border border-[#223046] focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none transition-colors"
                    />
                    <p className="text-slate-600 text-xs mt-1.5">
                      Try: testuser@okaxis · demo@ybl · user@paytm
                    </p>
                  </motion.div>
                )}

                {/* Card Input */}
                {method === "card" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Card Number
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCard(e.target.value))}
                        placeholder="4111 1111 1111 1111"
                        className="w-full bg-[#0B1628] border border-[#223046] focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                          Expiry
                        </label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                          placeholder="MM/YY"
                          className="w-full bg-[#0B1628] border border-[#223046] focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                          CVV
                        </label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.slice(0, 3))}
                          placeholder="•••"
                          className="w-full bg-[#0B1628] border border-[#223046] focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none font-mono"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Net Banking */}
                {method === "netbanking" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                      Select Bank
                    </label>
                    <select className="w-full bg-[#0B1628] border border-[#223046] focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white text-sm outline-none">
                      <option value="">Choose your bank...</option>
                      <option>HDFC Bank</option>
                      <option>ICICI Bank</option>
                      <option>State Bank of India</option>
                      <option>Axis Bank</option>
                      <option>Kotak Mahindra Bank</option>
                      <option>Yes Bank</option>
                    </select>
                  </motion.div>
                )}

                {/* Pay Button */}
                <motion.button
                  onClick={handlePay}
                  disabled={payState === "processing"}
                  whileHover={{ scale: payState === "processing" ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 rounded-xl font-black text-base bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-xl shadow-emerald-500/20 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {payState === "processing" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Complete Payment · ₹{tx.amount.toLocaleString("en-IN")}
                    </>
                  )}
                </motion.button>

                {payState === "error" && (
                  <p className="text-rose-400 text-center text-sm font-medium">
                    Payment failed. Please try again.
                  </p>
                )}
              </>
            )}

            {/* Trust signals */}
            <div className="flex items-center justify-center gap-4 text-slate-600 text-[10px] pt-1">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3" /> Encrypted
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" /> PCI DSS
              </span>
              <span>·</span>
              <span>Mock Gateway · No real charges</span>
            </div>
          </div>
        </div>

        {/* Back link */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 mx-auto mt-5 text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </motion.div>
    </div>
  );
}
