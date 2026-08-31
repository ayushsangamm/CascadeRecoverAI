"use client";

import { Metrics } from "@/lib/api";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Activity,
  IndianRupee,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

interface MetricsCardsProps {
  metrics: Metrics | null;
}

function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const start = displayed;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span>
      {prefix}
      {displayed.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
      {suffix}
    </span>
  );
}

interface CardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: React.ReactNode;
  accent: string;
  bg: string;
  border: string;
  subtext?: string;
  pulse?: boolean;
}

function MetricCard({
  title,
  value,
  prefix,
  suffix,
  decimals,
  icon,
  accent,
  bg,
  border,
  subtext,
  pulse,
}: CardProps) {
  return (
    <div
      className={`relative rounded-2xl border ${border} ${bg} p-6 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group`}
    >
      {/* Glow effect */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl ${accent} blur-xl`}
        style={{ zIndex: 0 }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`p-2.5 rounded-xl ${bg} border ${border} shadow-lg`}
          >
            {icon}
          </div>
          {pulse && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          )}
        </div>

        <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase mb-1">
          {title}
        </p>
        <p className={`text-3xl font-black ${accent} tracking-tight`}>
          <AnimatedCounter
            value={value}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals ?? 0}
          />
        </p>
        {subtext && (
          <p className="text-slate-500 text-xs mt-1.5 font-medium">{subtext}</p>
        )}
      </div>
    </div>
  );
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const m = metrics ?? {
    total_at_risk_gmv: 0,
    recovered_gmv: 0,
    total_gmv: 0,
    recovery_rate_pct: 0,
    active_cases: 0,
    total_transactions: 0,
    permanently_failed: 0,
    link_sent: 0,
    retry_scheduled: 0,
  };

  const cards: CardProps[] = [
    {
      title: "Total GMV At Risk",
      value: m.total_at_risk_gmv,
      prefix: "₹",
      decimals: 0,
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      accent: "text-amber-400",
      bg: "bg-amber-950/20",
      border: "border-amber-800/30",
      subtext: `${m.total_transactions} total transactions`,
    },
    {
      title: "Recovered GMV",
      value: m.recovered_gmv,
      prefix: "₹",
      decimals: 0,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      accent: "text-emerald-400",
      bg: "bg-emerald-950/20",
      border: "border-emerald-800/30",
      subtext: "Successfully captured revenue",
      pulse: m.recovered_gmv > 0,
    },
    {
      title: "Recovery Rate",
      value: m.recovery_rate_pct,
      suffix: "%",
      decimals: 1,
      icon: <TrendingUp className="w-5 h-5 text-sky-400" />,
      accent: "text-sky-400",
      bg: "bg-sky-950/20",
      border: "border-sky-800/30",
      subtext:
        m.recovery_rate_pct >= 50
          ? "🚀 Above target"
          : "Improving with AI interventions",
    },
    {
      title: "Active Interventions",
      value: m.active_cases,
      icon: <Activity className="w-5 h-5 text-violet-400" />,
      accent: "text-violet-400",
      bg: "bg-violet-950/20",
      border: "border-violet-800/30",
      subtext: `${m.link_sent} links sent · ${m.retry_scheduled} retrying`,
      pulse: m.active_cases > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <MetricCard key={card.title} {...card} />
      ))}
    </div>
  );
}
