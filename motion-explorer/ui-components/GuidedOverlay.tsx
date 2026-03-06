"use client";

import React from "react";
import { GuidedStep } from "../simulation-logic/guidedSteps";

interface GuidedOverlayProps {
  step: GuidedStep;
  currentIndex: number;
  totalSteps: number;
  onContinue: () => void;
  onBack: () => void;
  onExit: () => void;
  /** Render inline (no absolute positioning) — used for iPad top-center layout */
  inline?: boolean;
}

export default function GuidedOverlay({
  step,
  currentIndex,
  totalSteps,
  onContinue,
  onBack,
  onExit,
  inline,
}: GuidedOverlayProps) {
  const progress = ((currentIndex + 1) / totalSteps) * 100;
  const canGoBack = currentIndex > 0;

  return (
    <>
      {/* Inline keyframes */}
      <style jsx>{`
        @keyframes guided-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        @keyframes guided-float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes guided-pulse-glow {
          0%,
          100% {
            box-shadow:
              0 0 8px rgba(99, 179, 237, 0.25),
              0 0 16px rgba(99, 179, 237, 0.1);
          }
          50% {
            box-shadow:
              0 0 16px rgba(99, 179, 237, 0.5),
              0 0 32px rgba(99, 179, 237, 0.2);
          }
        }
        @keyframes guided-sparkle {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .guided-card {
          animation: guided-pulse-glow 3s ease-in-out infinite;
        }
        .guided-emoji {
          animation: guided-float 2.5s ease-in-out infinite;
        }
        .guided-shimmer-bar {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(99, 179, 237, 0.4) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: guided-shimmer 2s ease-in-out infinite;
        }
        .guided-continue-btn::after {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #3b82f6,
            #8b5cf6,
            #06b6d4,
            #3b82f6
          );
          background-size: 300% 100%;
          animation: guided-shimmer 3s linear infinite;
          z-index: -1;
          opacity: 0.5;
        }
      `}</style>

      {/* ── UNIFIED CARD LAYOUT — used for all steps ── */}
      <div
        className={
          inline
            ? "z-50 w-full"
            : "absolute inset-x-0 bottom-0 z-50 flex justify-center pb-6 px-4 pointer-events-none"
        }
      >
        <div className="guided-card pointer-events-auto w-full max-w-lg rounded-2xl border border-slate-600/60 bg-gradient-to-br from-slate-900/97 via-slate-800/97 to-slate-900/97 p-5 backdrop-blur-xl relative overflow-hidden">
          {/* Sparkle decorations */}
          <div
            className="absolute top-3 right-6 text-xs"
            style={{
              animation: "guided-sparkle 2s ease-in-out infinite",
            }}
          >
            ✨
          </div>
          <div
            className="absolute top-8 right-14 text-[10px]"
            style={{
              animation: "guided-sparkle 2.5s ease-in-out infinite 0.5s",
            }}
          >
            ✦
          </div>
          <div
            className="absolute bottom-12 right-8 text-xs"
            style={{
              animation: "guided-sparkle 3s ease-in-out infinite 1s",
            }}
          >
            ⭐
          </div>

          {/* Progress bar */}
          <div className="relative h-1.5 rounded-full bg-slate-700/80 mb-4 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
            <div className="guided-shimmer-bar absolute inset-0 rounded-full" />
          </div>

          {/* Step counter + Emoji */}
          <div className="flex items-start gap-4 mb-3">
            <div className="guided-emoji text-4xl flex-shrink-0 select-none">
              {step.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-cyan-400/80 uppercase tracking-[0.15em] font-semibold mb-1">
                Step {currentIndex + 1} of {totalSteps}
              </div>
              <h3 className="text-lg font-bold text-white leading-tight mb-1">
                {step.title}
              </h3>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-300 leading-relaxed mb-3 whitespace-pre-line">
            {step.description}
          </p>

          {/* Action hint — only for non-observational steps */}
          {!step.isObservation && step.title != "Observation 🔍" && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-amber-400 text-xs">👉</span>
              <span className="text-xs text-amber-300/90 font-medium italic">
                {step.actionHint}
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {currentIndex === 0 ? (
              <>
                <button
                  onClick={onExit}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 border border-slate-600/60 hover:bg-slate-700/50 hover:text-white transition-all duration-200"
                >
                  Exit Tutorial
                </button>
                <div className="flex-1" />
                <button
                  onClick={onContinue}
                  className="guided-continue-btn relative overflow-hidden px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-purple-600 hover:opacity-90 shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Let&apos;s Go! →
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onBack}
                  disabled={!canGoBack}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${
                    canGoBack
                      ? "text-slate-300 border-slate-600 hover:bg-slate-700/50 hover:text-white"
                      : "text-slate-600 border-slate-700/40 cursor-not-allowed"
                  }`}
                >
                  ← Back
                </button>
                <button
                  onClick={onExit}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 border border-slate-600/60 hover:bg-slate-700/50 hover:text-white transition-all duration-200"
                >
                  Exit Tutorial
                </button>
                <div className="flex-1" />
                {step.title === "Observation 🔍" ? (
                  // Observational step: Show Continue button
                  <button
                    onClick={onContinue}
                    className="guided-continue-btn relative overflow-hidden px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-purple-600 hover:opacity-90 shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    Continue →
                  </button>
                ) : (
                  // Action step: Show hint to click glowing button
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700/40 border border-slate-600/40">
                    <div
                      className="w-2 h-2 rounded-full bg-cyan-400"
                      style={{
                        animation: "guided-sparkle 1.5s ease-in-out infinite",
                      }}
                    />
                    <span className="text-[11px] text-slate-400">
                      Click the glowing button
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
