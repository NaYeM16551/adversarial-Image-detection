"use client";

import React from "react";
import { CommonCard } from "@sim/components/common/card";
import type { SimulationState } from "../simulation-logic/simulation";

interface ResultsPanelProps {
  simulationRef: React.RefObject<SimulationState | null>;
  isMobile?: boolean;
  _renderTrigger?: number;
}

export default function MEResultsPanel({
  simulationRef,
  isMobile,
  _renderTrigger,
}: ResultsPanelProps) {
  const sim = simulationRef.current;
  if (!sim) return null;

  const {
    acceleration,
    tension,
    netForce,
    hangingWeight,
    frictionForce,
    trolleyVelocity,
    velocityAtGate,
    cardPassTime,
    hasCompleted,
    elapsedTime,
    trolleyMass,
    hangerMass,
    frictionEnabled,
  } = sim;

  return (
    <CommonCard
      variant="dark"
      radius="rounded-[16px]"
      className="p-4 w-full max-w-xs"
    >
      <h2 className="text-base font-bold text-white text-center mb-3 tracking-wide">
        📊 Results
      </h2>

      <div className="flex flex-col gap-2">
        {/* Forces */}
        <div className="rounded-lg bg-slate-800/50 p-2.5">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Forces
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-400">Hanging Weight:</span>
            <span className="font-mono text-orange-400 text-right">
              {hangingWeight.toFixed(3)} N
            </span>
            {frictionEnabled && (
              <>
                <span className="text-slate-400">Friction Force:</span>
                <span className="font-mono text-red-400 text-right">
                  {frictionForce.toFixed(3)} N
                </span>
              </>
            )}
            <span className="text-slate-400">Net Force:</span>
            <span className="font-mono text-green-400 text-right">
              {netForce.toFixed(3)} N
            </span>
            <span className="text-slate-400">Tension:</span>
            <span className="font-mono text-cyan-400 text-right">
              {tension.toFixed(3)} N
            </span>
          </div>
        </div>

        {/* Acceleration */}
        <div className="rounded-lg bg-slate-800/50 p-2.5">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Motion
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-400">Acceleration:</span>
            <span className="font-mono text-amber-400 text-right font-bold">
              {acceleration.toFixed(3)} m/s²
            </span>
            <span className="text-slate-400">Current Velocity:</span>
            <span className="font-mono text-blue-400 text-right">
              {trolleyVelocity.toFixed(3)} m/s
            </span>
            <span className="text-slate-400">Total Mass:</span>
            <span className="font-mono text-slate-300 text-right">
              {(trolleyMass + hangerMass).toFixed(3)} kg
            </span>
          </div>
        </div>

        {/* Light Gate Data */}
        <div className="rounded-lg bg-slate-800/50 p-2.5">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Light Gate
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-400">Card Pass Time:</span>
            <span className="font-mono text-purple-400 text-right">
              {cardPassTime > 0
                ? `${(cardPassTime * 1000).toFixed(1)} ms`
                : "—"}
            </span>
            <span className="text-slate-400">Velocity @ Gate:</span>
            <span className="font-mono text-emerald-400 text-right">
              {velocityAtGate > 0
                ? `${velocityAtGate.toFixed(3)} m/s`
                : "—"}
            </span>
          </div>
        </div>

        {/* Status */}
        {/* <div className="text-center">
          {hasCompleted ? (
            <span className="text-xs text-green-400 font-medium">
              ✅ Experiment Complete — Elapsed: {elapsedTime.toFixed(2)}s
            </span>
          ) : sim.isRunning ? (
            <span className="text-xs text-amber-400 font-medium animate-pulse">
              ⏱️ Running... {elapsedTime.toFixed(2)}s
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              Press Start to begin experiment
            </span>
          )}
        </div> */}
      </div>
    </CommonCard>
  );
}
