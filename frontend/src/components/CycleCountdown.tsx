// CycleCountdown — real-time countdown to the end of the current stacking cycle.
// Updates every second using a client-side timer; syncs with block data from props.

import React, { useState, useEffect } from "react";
import { SECONDS_PER_BLOCK } from "@/lib/apy";

interface CycleCountdownProps {
  blocksUntilCycleEnd: number;
  cycleNumber:         number;
  cycleEndBlock:       number;
  currentBlock:        number;
}

interface TimeLeft {
  days:    number;
  hours:   number;
  minutes: number;
  seconds: number;
  total:   number; // total seconds remaining
}

function computeTimeLeft(secondsRemaining: number): TimeLeft {
  const total   = Math.max(0, secondsRemaining);
  const days    = Math.floor(total / 86400);
  const hours   = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, total };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function CycleCountdown({
  blocksUntilCycleEnd,
  cycleNumber,
  cycleEndBlock,
  currentBlock,
}: CycleCountdownProps) {
  const initialSeconds = blocksUntilCycleEnd * SECONDS_PER_BLOCK;
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(computeTimeLeft(initialSeconds));

  // Tick every second
  useEffect(() => {
    setTimeLeft(computeTimeLeft(blocksUntilCycleEnd * SECONDS_PER_BLOCK));
  }, [blocksUntilCycleEnd]);

  useEffect(() => {
    if (timeLeft.total <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => computeTimeLeft(Math.max(0, prev.total - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft.total]);

  const progressPercent = Math.max(
    0,
    Math.min(100, ((2100 - blocksUntilCycleEnd) / 2100) * 100)
  );

  return (
    <div className="cycle-countdown">
      <div className="cycle-countdown__header">
        <span className="cycle-countdown__label">Cycle {cycleNumber}</span>
        <span className="cycle-countdown__block">
          Block {currentBlock.toLocaleString()} / {cycleEndBlock.toLocaleString()}
        </span>
      </div>

      <div className="cycle-countdown__timer" aria-live="polite" aria-label="Time until cycle end">
        <div className="cycle-countdown__unit">
          <span className="cycle-countdown__value">{pad(timeLeft.days)}</span>
          <span className="cycle-countdown__label-unit">days</span>
        </div>
        <span className="cycle-countdown__sep">:</span>
        <div className="cycle-countdown__unit">
          <span className="cycle-countdown__value">{pad(timeLeft.hours)}</span>
          <span className="cycle-countdown__label-unit">hrs</span>
        </div>
        <span className="cycle-countdown__sep">:</span>
        <div className="cycle-countdown__unit">
          <span className="cycle-countdown__value">{pad(timeLeft.minutes)}</span>
          <span className="cycle-countdown__label-unit">min</span>
        </div>
        <span className="cycle-countdown__sep">:</span>
        <div className="cycle-countdown__unit">
          <span className="cycle-countdown__value">{pad(timeLeft.seconds)}</span>
          <span className="cycle-countdown__label-unit">sec</span>
        </div>
      </div>

      <div className="cycle-countdown__progress-bar" role="progressbar"
        aria-valuenow={Math.floor(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Cycle ${progressPercent.toFixed(0)}% complete`}
      >
        <div
          className="cycle-countdown__progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="cycle-countdown__blocks-left">
        {blocksUntilCycleEnd.toLocaleString()} blocks remaining
      </p>

      {timeLeft.total === 0 && (
        <p className="cycle-countdown__ended">Cycle ending — next cycle loading…</p>
      )}
    </div>
  );
}
