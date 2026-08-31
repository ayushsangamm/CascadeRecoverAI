"use client";

import { Metrics } from "@/lib/api";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface GMVChartProps {
  metrics: Metrics | null;
  transactions: Array<{ amount: number; status: string; created_at: string }>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0B1628] border border-[#223046] rounded-xl p-3 shadow-xl">
        <p className="text-slate-400 text-xs mb-2">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-sm font-bold" style={{ color: entry.color }}>
            {entry.name}: ₹{Number(entry.value).toLocaleString("en-IN")}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function GMVChart({ metrics, transactions }: GMVChartProps) {
  // Build a time-series from transactions
  const buildTimeSeries = () => {
    if (!transactions.length) {
      return [
        { time: "Now", atRisk: 0, recovered: 0 },
      ];
    }

    // Group by approximate time buckets
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let runningRisk = 0;
    let runningRecovered = 0;
    const series = sorted.map((tx, i) => {
      if (tx.status === "RECOVERED") {
        runningRecovered += tx.amount;
      } else {
        runningRisk += tx.amount;
      }
      return {
        time: `T+${i + 1}`,
        atRisk: Math.round(runningRisk),
        recovered: Math.round(runningRecovered),
      };
    });

    return series.slice(-20); // Last 20 data points
  };

  const buildStatusData = () => {
    const m = metrics;
    if (!m) return [];
    return [
      { name: "At Risk", value: m.total_at_risk_gmv, fill: "#F59E0B" },
      { name: "Recovered", value: m.recovered_gmv, fill: "#10B981" },
      { name: "Active", value: m.active_cases * 1000, fill: "#8B5CF6" },
    ];
  };

  const timeSeries = buildTimeSeries();
  const statusData = buildStatusData();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Area Chart */}
      <div className="rounded-2xl border border-[#223046] bg-[#151D2A] p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-700/30">
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">GMV Recovery Timeline</h3>
            <p className="text-slate-500 text-xs">At-risk vs. recovered over time</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={timeSeries} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorRecovered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis
              dataKey="time"
              tick={{ fill: "#475569", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(v) => (
                <span style={{ color: "#94A3B8", fontSize: 11 }}>{v}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="atRisk"
              name="At Risk"
              stroke="#F59E0B"
              strokeWidth={2}
              fill="url(#colorRisk)"
            />
            <Area
              type="monotone"
              dataKey="recovered"
              name="Recovered"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#colorRecovered)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart — Status breakdown */}
      <div className="rounded-2xl border border-[#223046] bg-[#151D2A] p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-700/30">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">GMV Breakdown</h3>
            <p className="text-slate-500 text-xs">At Risk · Recovered · Active (×₹1k)</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={statusData}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#475569", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="GMV" radius={[6, 6, 0, 0]} fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary stats below chart */}
        {metrics && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "At Risk", value: `₹${metrics.total_at_risk_gmv.toLocaleString("en-IN")}`, color: "text-amber-400" },
              { label: "Recovered", value: `₹${metrics.recovered_gmv.toLocaleString("en-IN")}`, color: "text-emerald-400" },
              { label: "Rate", value: `${metrics.recovery_rate_pct.toFixed(1)}%`, color: "text-sky-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={`font-black text-lg ${color}`}>{value}</p>
                <p className="text-slate-600 text-[10px] uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
