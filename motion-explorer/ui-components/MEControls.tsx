"use client";

import React from "react";
import { CommonButton } from "@sim/components/common/button";
import { CommonCard } from "@sim/components/common/card";
import { PlayIcon, PauseIcon, ResetIcon } from "@sim/components/icons/button";
import type { SimMode, PlaySubMode } from "../simulation-logic/simulation";

interface ControlsProps {
  mode: SimMode;
  playSubMode: PlaySubMode;
  trolleyMass: number;
  hangerMass: number;
  frictionEnabled: boolean;
  isRunning: boolean;
  isPaused: boolean;
  hasCompleted: boolean;
  isMobile?: boolean;
  highlightId?: string | null;
  lockedTotalMass: number;
  transferAmount: number;

  onModeChange: (mode: SimMode) => void;
  onSubModeChange: (subMode: PlaySubMode) => void;
  onTrolleyMassChange: (mass: number) => void;
  onHangerMassChange: (mass: number) => void;
  onFrictionToggle: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onTransferToHanger: () => void;
  onTransferToTrolley: () => void;
  onTransferAmountChange: (amount: number) => void;
}

const MODE_LABELS: Record<SimMode, string> = {
  guided: "Guided",
  play: "Play",
  challenge: "Challenge",
};

const MODE_DESCRIPTIONS: Record<SimMode, string> = {
  guided: "Step-by-step walkthrough",
  play: "Free exploration",
  challenge: "Test your knowledge",
};

const SUB_MODE_LABELS: Record<PlaySubMode, string> = {
  free: "Free Exploration",
  investigate_force: "Investigate Effect of Force",
  investigate_mass: "Investigate Effect of Mass",
};

const GLOW_CLASS =
  "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_16px_rgba(34,211,238,0.5),0_0_32px_rgba(34,211,238,0.25)] animate-pulse";

function glowIf(
  highlightId: string | null | undefined,
  targetId: string,
): string {
  return highlightId === targetId ? GLOW_CLASS : "";
}

export default function MEControls({
  mode,
  playSubMode,
  trolleyMass,
  hangerMass,
  frictionEnabled,
  isRunning,
  isPaused,
  hasCompleted,
  isMobile,
  highlightId,
  lockedTotalMass,
  transferAmount,
  onModeChange,
  onSubModeChange,
  onTrolleyMassChange,
  onHangerMassChange,
  onFrictionToggle,
  onStart,
  onPause,
  onResume,
  onReset,
  onTransferToHanger,
  onTransferToTrolley,
  onTransferAmountChange,
}: ControlsProps) {
  const showFullControls = mode === "play" || mode === "guided";
  const isForceMode = playSubMode === "investigate_force";
  const isMassMode = playSubMode === "investigate_mass";

  return (
    <CommonCard
      variant="dark"
      radius="rounded-[16px]"
      className="p-4 w-full max-w-xs"
    >
      {/* Title */}
      <h2 className="text-base font-bold text-white text-center mb-3 tracking-wide">
        Controls
      </h2>

      <div className="flex flex-col gap-3">
        {/* Mode Selector */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Mode
          </div>
          <div className="flex gap-1.5">
            {(["guided", "play", "challenge"] as SimMode[]).map((m) => (
              <CommonButton
                key={m}
                variant={mode === m ? "filled" : "outlined"}
                className={`flex-1 text-xs px-2 py-1.5 justify-center ${
                  mode === m ? "" : "border-slate-600 text-slate-400"
                }`}
                onClick={() => onModeChange(m)}
                data-guide-id={`${m}-mode-btn`}
              >
                {MODE_LABELS[m]}
              </CommonButton>
            ))}
          </div>
          <div className="text-[10px] text-slate-500 mt-1.5 text-center">
            {MODE_DESCRIPTIONS[mode]}
          </div>
        </div>

        {/* Play Sub-mode Selector — visible in play and guided modes */}
        {showFullControls && (
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Experiment Mode
            </div>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  "free",
                  "investigate_force",
                  "investigate_mass",
                ] as PlaySubMode[]
              ).map((sm) => (
                <CommonButton
                  key={sm}
                  variant={playSubMode === sm ? "filled" : "outlined"}
                  className={`w-full text-xs px-2 py-1.5 justify-center transition-all duration-300 ${
                    playSubMode === sm ? "" : "border-slate-600 text-slate-400"
                  } ${glowIf(highlightId, `submode-${sm}`)}`}
                  onClick={() => onSubModeChange(sm)}
                  data-guide-id={`submode-${sm}`}
                >
                  {SUB_MODE_LABELS[sm]}
                </CommonButton>
              ))}
            </div>
          </div>
        )}

        {/* Trolley Mass Slider */}
        {showFullControls && (
          <div
            data-guide-id="trolley-mass-slider"
            className={`transition-all duration-300 rounded-lg p-0.5 ${glowIf(
              highlightId,
              "trolley-mass-slider",
            )} ${isForceMode ? "opacity-60 pointer-events-none" : ""}`}
          >
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Trolley Mass{" "}
              {isForceMode && (
                <span className="text-amber-400 text-[10px]">(locked)</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.1}
                max={2.0}
                step={0.05}
                value={trolleyMass}
                onChange={(e) =>
                  onTrolleyMassChange(parseFloat(e.target.value))
                }
                disabled={isForceMode || isRunning}
                className="flex-1 accent-[#3389AD] h-2"
              />
              <span className="text-sm font-bold text-amber-400 min-w-[56px] text-right">
                {trolleyMass.toFixed(2)} kg
              </span>
            </div>
          </div>
        )}

        {/* Hanger Mass Slider */}
        {showFullControls && (
          <div
            data-guide-id="hanger-mass-slider"
            className={`transition-all duration-300 rounded-lg p-0.5 ${glowIf(
              highlightId,
              "hanger-mass-slider",
            )} ${
              isMassMode || isForceMode ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Hanger Mass{" "}
              {(isMassMode || isForceMode) && (
                <span className="text-amber-400 text-[10px]">(locked)</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.01}
                max={0.5}
                step={0.01}
                value={hangerMass}
                onChange={(e) => onHangerMassChange(parseFloat(e.target.value))}
                disabled={isMassMode || isForceMode || isRunning}
                className="flex-1 accent-[#3389AD] h-2"
              />
              <span className="text-sm font-bold text-amber-400 min-w-[56px] text-right">
                {hangerMass.toFixed(2)} kg
              </span>
            </div>
          </div>
        )}

        {/* Mass Transfer Controls — visible in investigate_force mode */}
        {showFullControls && isForceMode && (
          <div className="rounded-lg border border-slate-600/60 p-3 bg-slate-800/30">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Transfer Mass{" "}
              <span className="text-[10px] text-slate-500 normal-case">
                (total: {lockedTotalMass.toFixed(2)} kg)
              </span>
            </div>

            {/* Info row */}
            <div className="flex justify-between text-[11px] mb-2">
              <span className="text-cyan-400">
                Trolley: {trolleyMass.toFixed(2)} kg
              </span>
              <span className="text-orange-400">
                Hanger: {hangerMass.toFixed(2)} kg
              </span>
            </div>

            {/* Amount input */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-slate-500">Amount (kg):</span>
              <input
                type="number"
                min={0.01}
                max={0.5}
                step={0.01}
                value={transferAmount}
                onChange={(e) =>
                  onTransferAmountChange(parseFloat(e.target.value) || 0.05)
                }
                disabled={isRunning}
                className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded-lg text-amber-400 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#3389AD] focus:border-transparent"
              />
            </div>

            {/* Transfer buttons */}
            <div className="flex gap-2">
              <CommonButton
                variant="outlined"
                className={`flex-1 text-xs justify-center border-cyan-600 text-cyan-400 hover:bg-cyan-900/20 ${glowIf(
                  highlightId,
                  "transfer-to-hanger-btn",
                )}`}
                onClick={onTransferToHanger}
                disabled={isRunning}
                data-guide-id="transfer-to-hanger-btn"
              >
                → To Hanger
              </CommonButton>
              <CommonButton
                variant="outlined"
                className={`flex-1 text-xs justify-center border-orange-600 text-orange-400 hover:bg-orange-900/20 ${glowIf(
                  highlightId,
                  "transfer-to-trolley-btn",
                )}`}
                onClick={onTransferToTrolley}
                disabled={isRunning}
                data-guide-id="transfer-to-trolley-btn"
              >
                ← To Trolley
              </CommonButton>
            </div>
          </div>
        )}

        {/* Friction Toggle */}
        {showFullControls && (
          <label
            data-guide-id="friction-toggle"
            className={`flex items-center gap-2 cursor-pointer select-none p-1.5 -mx-1.5 rounded-lg transition-all duration-300 ${glowIf(
              highlightId,
              "friction-toggle",
            )}`}
          >
            <input
              type="checkbox"
              checked={frictionEnabled}
              onChange={onFrictionToggle}
              disabled={isRunning}
              className="w-3.5 h-3.5 rounded accent-amber-400 cursor-pointer"
            />
            <span className="text-xs text-slate-300 font-medium">
              🧊 Enable Friction (μ = 0.2)
            </span>
          </label>
        )}

        {/* Playback Controls */}
        {showFullControls && (
          <div className="flex gap-2">
            {!isRunning || hasCompleted ? (
              <CommonButton
                onClick={onStart}
                variant="filled"
                className={`flex-1 justify-center border-transparent bg-green-600 hover:bg-green-700 text-white transition-all duration-300 ${glowIf(
                  highlightId,
                  "start-btn",
                )}`}
                text={hasCompleted ? "Run Again" : "Start"}
                icon={<PlayIcon size={16} />}
                data-guide-id="start-btn"
              />
            ) : isPaused ? (
              <CommonButton
                onClick={onResume}
                variant="filled"
                className="flex-1 justify-center border-transparent bg-green-600 hover:bg-green-700 text-white"
                text="Resume"
                icon={<PlayIcon size={16} />}
              />
            ) : (
              <CommonButton
                onClick={onPause}
                variant="filled"
                className="flex-1 justify-center border-transparent bg-amber-600 hover:bg-amber-700 text-white"
                text="Pause"
                icon={<PauseIcon size={16} />}
              />
            )}
            <CommonButton
              onClick={onReset}
              variant="filled"
              className={`flex-1 justify-center bg-slate-600 hover:bg-slate-700 border-transparent text-white transition-all duration-300 ${glowIf(
                highlightId,
                "reset-btn",
              )}`}
              text="Reset"
              icon={<ResetIcon size={16} />}
              data-guide-id="reset-btn"
            />
          </div>
        )}
      </div>
    </CommonCard>
  );
}
