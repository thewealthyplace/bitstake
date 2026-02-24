// APYChart — 52-cycle historical APY line chart built with Recharts.
// Compares bitstake APY vs a flat solo-stacking reference line.

import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PoolHistoryResponse, CycleRecord } from "@/types/api";

interface APYChartProps {
  history:    PoolHistoryResponse | null;
  isLoading:  boolean;
  error:      string | null;
}

type WindowOption = "13" | "26" | "52";

interface ChartDataPoint {
  cycle:       number;
  apy:         number;
  soloTarget:  number;
  btcPrice:    number;
  stxPrice:    number;
}

const SOLO_TARGET_APY = 7.0; // approximate solo stacking APY (display reference)

function toChartData(records: CycleRecord[]): ChartDataPoint[] {
  return records.map((r) => ({
    cycle:      r.cycleNumber,
    apy:        Number(r.apyPercent.toFixed(2)),
    soloTarget: SOLO_TARGET_APY,
    btcPrice:   r.btcPriceUsd,
    stxPrice:   r.stxPriceUsd,
  }));
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="apy-tooltip">
      <p className="apy-tooltip__cycle">Cycle {label}</p>
      {payload.map((p) => (
        <p key={p.name} className="apy-tooltip__line" style={{ color: p.color }}>
          {p.name}: <strong>{p.value.toFixed(2)}%</strong>
        </p>
      ))}
    </div>
  );
}

export function APYChart({ history, isLoading, error }: APYChartProps) {
  const [window, setWindow] = useState<WindowOption>("52");

  if (isLoading) {
    return (
      <div className="apy-chart apy-chart--loading">
        <div className="skeleton skeleton--chart" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="apy-chart apy-chart--error">
        <p>Failed to load APY history: {error}</p>
      </div>
    );
  }

  if (!history) return null;

  const sliceCount = parseInt(window, 10);
  const sliced     = history.cycles.slice(-sliceCount);
  const data       = toChartData(sliced);

  const avgApy = history.averageApyPercent;
  const maxApy = history.maxApyPercent;

  return (
    <section className="apy-chart" aria-label="Historical APY chart">
      <div className="apy-chart__header">
        <h2 className="apy-chart__title">Historical APY</h2>
        <div className="apy-chart__controls">
          <div className="apy-chart__window-selector" role="group" aria-label="Time window">
            {(["13", "26", "52"] as WindowOption[]).map((opt) => (
              <button
                key={opt}
                className={`apy-chart__window-btn ${window === opt ? "apy-chart__window-btn--active" : ""}`}
                onClick={() => setWindow(opt)}
                aria-pressed={window === opt}
              >
                {opt === "52" ? "1yr" : opt === "26" ? "6mo" : "3mo"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="apy-chart__summary">
        <span>Avg: <strong>{avgApy.toFixed(2)}%</strong></span>
        <span>High: <strong>{maxApy.toFixed(2)}%</strong></span>
        <span>Low: <strong>{history.minApyPercent.toFixed(2)}%</strong></span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
          <XAxis
            dataKey="cycle"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            label={{ value: "Cycle", position: "insideBottom", offset: -2, fontSize: 12, fill: "#6b7280" }}
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) =>
              value === "apy" ? "bitstake APY" : "Solo stacking reference"
            }
          />
          <ReferenceLine
            y={avgApy}
            stroke="#6366f1"
            strokeDasharray="4 4"
            label={{ value: `Avg ${avgApy.toFixed(1)}%`, fill: "#6366f1", fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="apy"
            stroke="#f7931a"
            strokeWidth={2}
            dot={sliceCount <= 26}
            activeDot={{ r: 5 }}
            name="apy"
          />
          <Line
            type="monotone"
            dataKey="soloTarget"
            stroke="#4b5563"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="soloTarget"
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="apy-chart__disclaimer">
        APY = (BTC yield USD / STX staked USD) × 26 cycles/yr.
        Past performance does not guarantee future returns.
        Solo stacking reference is indicative only.
      </p>
    </section>
  );
}
