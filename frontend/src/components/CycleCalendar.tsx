// CycleCalendar — visual calendar of past and future stacking cycle boundaries.
// Shows unlock dates for the current wallet's positions as highlights.

import React, { useMemo } from "react";
import {
  blockToCycleNumber,
  cycleStartBlock,
  cycleEndBlock,
  blocksToEstimatedDate,
  BLOCKS_PER_CYCLE,
  SECONDS_PER_BLOCK,
} from "@/lib/apy";

interface CycleEvent {
  cycleNumber:  number;
  startBlock:   number;
  endBlock:     number;
  startDate:    Date;
  endDate:      Date;
  isPast:       boolean;
  isCurrent:    boolean;
  isNext:       boolean;
  unlockBlocks: number[];  // user's unlock blocks in this cycle
}

interface CycleCalendarProps {
  currentBlock:       number;
  userUnlockBlocks?:  number[]; // user's unlock blocks across all pools
  visibleCycles?:     number;   // how many cycles to show (default 8)
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatBlockDate(block: number, currentBlock: number): string {
  const date = blocksToEstimatedDate(currentBlock, block);
  return formatShortDate(date);
}

export function CycleCalendar({
  currentBlock,
  userUnlockBlocks = [],
  visibleCycles = 8,
}: CycleCalendarProps) {
  const currentCycle = blockToCycleNumber(currentBlock);

  const cycles: CycleEvent[] = useMemo(() => {
    const half = Math.floor(visibleCycles / 2);
    const startCycle = Math.max(0, currentCycle - half);
    const endCycle   = startCycle + visibleCycles;

    return Array.from({ length: endCycle - startCycle }, (_, i) => {
      const cn       = startCycle + i;
      const start    = cycleStartBlock(cn);
      const end      = cycleEndBlock(cn);
      const isPast   = end < currentBlock;
      const isCurrent = cn === currentCycle;
      const isNext   = cn === currentCycle + 1;

      const cycleUnlocks = userUnlockBlocks.filter(
        (b) => b >= start && b <= end
      );

      // Estimate dates
      const startDate = blocksToEstimatedDate(currentBlock, start);
      const endDate   = blocksToEstimatedDate(currentBlock, end);

      return {
        cycleNumber:  cn,
        startBlock:   start,
        endBlock:     end,
        startDate,
        endDate,
        isPast,
        isCurrent,
        isNext,
        unlockBlocks: cycleUnlocks,
      };
    });
  }, [currentCycle, currentBlock, userUnlockBlocks, visibleCycles]);

  return (
    <section className="cycle-calendar" aria-label="Stacking cycle calendar">
      <h2 className="cycle-calendar__title">Cycle Calendar</h2>

      <div className="cycle-calendar__legend">
        <span className="cycle-calendar__legend-item cycle-calendar__legend-item--past">Past</span>
        <span className="cycle-calendar__legend-item cycle-calendar__legend-item--current">Current</span>
        <span className="cycle-calendar__legend-item cycle-calendar__legend-item--next">Next</span>
        {userUnlockBlocks.length > 0 && (
          <span className="cycle-calendar__legend-item cycle-calendar__legend-item--unlock">
            Your unlock
          </span>
        )}
      </div>

      <div className="cycle-calendar__grid">
        {cycles.map((c) => {
          const classes = [
            "cycle-cell",
            c.isPast    ? "cycle-cell--past"    : "",
            c.isCurrent ? "cycle-cell--current" : "",
            c.isNext    ? "cycle-cell--next"    : "",
            c.unlockBlocks.length > 0 ? "cycle-cell--has-unlock" : "",
          ].filter(Boolean).join(" ");

          return (
            <div
              key={c.cycleNumber}
              className={classes}
              role="listitem"
              aria-label={`Cycle ${c.cycleNumber}${c.isCurrent ? " (current)" : ""}${c.unlockBlocks.length > 0 ? " — unlock" : ""}`}
            >
              <div className="cycle-cell__header">
                <span className="cycle-cell__number">C{c.cycleNumber}</span>
                {c.isCurrent && <span className="cycle-cell__badge">Now</span>}
                {c.unlockBlocks.length > 0 && (
                  <span className="cycle-cell__unlock-badge">🔓</span>
                )}
              </div>
              <div className="cycle-cell__dates">
                <span className="cycle-cell__date">{formatShortDate(c.startDate)}</span>
                <span className="cycle-cell__date-sep">→</span>
                <span className="cycle-cell__date">{formatShortDate(c.endDate)}</span>
              </div>
              <div className="cycle-cell__blocks">
                <span className="cycle-cell__block">{c.startBlock.toLocaleString()}</span>
                <span className="cycle-cell__block-sep">–</span>
                <span className="cycle-cell__block">{c.endBlock.toLocaleString()}</span>
              </div>
              {c.unlockBlocks.length > 0 && (
                <div className="cycle-cell__unlocks">
                  {c.unlockBlocks.map((b) => (
                    <span key={b} className="cycle-cell__unlock">
                      Unlock: {formatBlockDate(b, currentBlock)} (block {b.toLocaleString()})
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="cycle-calendar__note">
        Block dates are estimated at ~{SECONDS_PER_BLOCK / 60} min/block ({BLOCKS_PER_CYCLE.toLocaleString()} blocks/cycle).
        Actual times may vary based on network activity.
      </p>
    </section>
  );
}
