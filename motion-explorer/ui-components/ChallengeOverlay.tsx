"use client";

import React, { useState } from "react";
import {
  ChallengeTask,
  calcAcceleration,
  calcTension,
} from "../simulation-logic/simulation";

interface ChallengeOverlayProps {
  challenge: ChallengeTask;
  challengeIndex: number;
  totalChallenges: number;
  onNext: () => void;
  onBack: () => void;
  onExit: () => void;
}

export default function ChallengeOverlay({
  challenge,
  challengeIndex,
  totalChallenges,
  onNext,
  onBack,
  onExit,
}: ChallengeOverlayProps) {
  // ── Input state ──
  const [accelInput, setAccelInput] = useState("");
  const [tensionInput, setTensionInput] = useState("");
  const [massInput, setMassInput] = useState("");
  const [mcqSelected, setMcqSelected] = useState<number | null>(null);

  // ── Feedback state ──
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isHint, setIsHint] = useState(false);

  // Reset inputs when challenge changes
  React.useEffect(() => {
    setAccelInput("");
    setTensionInput("");
    setMassInput("");
    setMcqSelected(null);
    setSubmitted(false);
    setIsCorrect(false);
    setFeedback("");
    setIsHint(false);
  }, [challenge.id]);

  const handleTryAgain = () => {
    setSubmitted(false);
    setIsCorrect(false);
    setFeedback("");
    setIsHint(false);
    setAccelInput("");
    setTensionInput("");
    setMassInput("");
    setMcqSelected(null);
  };

  const progress = ((challengeIndex + 1) / totalChallenges) * 100;

  // ── Submit logic — live calculation, no hardcoded answers ──
  const handleSubmit = () => {
    if (challenge.challengeType === "calc_acceleration_tension") {
      const userA = parseFloat(accelInput);
      const userT = parseFloat(tensionInput);
      if (isNaN(userA) || isNaN(userT)) {
        setFeedback("Please enter valid numbers for both fields.");
        setSubmitted(true);
        setIsCorrect(false);
        return;
      }
      const correctA = calcAcceleration(
        challenge.trolleyMass!,
        challenge.hangerMass!,
        challenge.frictionEnabled ?? false,
      );
      const correctT = calcTension(
        challenge.trolleyMass!,
        challenge.hangerMass!,
        challenge.frictionEnabled ?? false,
      );
      const aOk = Math.abs(userA - correctA) <= challenge.tolerance;
      const tOk = Math.abs(userT - correctT) <= challenge.tolerance;

      if (aOk && tOk) {
        setIsCorrect(true);
        setIsHint(false);
        setFeedback(
          `Correct! a = ${correctA.toFixed(2)} m/s², T = ${correctT.toFixed(2)} N`,
        );
      } else {
        setIsCorrect(false);
        setIsHint(true);
        setFeedback(
          `Hint: Net force = m_hanger × g. Total mass = m_trolley + m_hanger.\na = F_net / m_total\nTension: T = m_trolley × a (on frictionless track)`,
        );
      }
      setSubmitted(true);
    } else if (challenge.challengeType === "find_hanger_mass") {
      const userM = parseFloat(massInput);
      if (isNaN(userM) || userM <= 0) {
        setFeedback("Please enter a valid positive mass.");
        setSubmitted(true);
        setIsCorrect(false);
        return;
      }
      const diff = Math.abs(userM - challenge.hangerMass!);
      if (diff <= challenge.tolerance) {
        const correctA = calcAcceleration(
          challenge.trolleyMass!,
          challenge.hangerMass!,
          false,
        );
        setIsCorrect(true);
        setIsHint(false);
        setFeedback(
          `Correct! m_hanger = ${challenge.hangerMass!.toFixed(2)} kg gives a = ${correctA.toFixed(2)} m/s²`,
        );
      } else {
        setIsCorrect(false);
        setIsHint(true);
        setFeedback(
          `Hint: From F = ma, the net force is m_hanger × g.\nSo a = (m_hanger × g) / (m_trolley + m_hanger).\nRearrange to solve for m_hanger.`,
        );
      }
      setSubmitted(true);
    } else if (challenge.challengeType === "find_trolley_mass") {
      const userM = parseFloat(massInput);
      if (isNaN(userM) || userM <= 0) {
        setFeedback("Please enter a valid positive mass.");
        setSubmitted(true);
        setIsCorrect(false);
        return;
      }
      const diff = Math.abs(userM - challenge.trolleyMass!);
      if (diff <= challenge.tolerance) {
        const correctA = calcAcceleration(
          challenge.trolleyMass!,
          challenge.hangerMass!,
          false,
        );
        setIsCorrect(true);
        setIsHint(false);
        setFeedback(
          `Correct! m_trolley = ${challenge.trolleyMass!.toFixed(2)} kg gives a = ${correctA.toFixed(2)} m/s²`,
        );
      } else {
        setIsCorrect(false);
        setIsHint(true);
        setFeedback(
          `Hint: a = (m_hanger × g) / (m_trolley + m_hanger).\nRearrange: m_trolley = (m_hanger × g / a) − m_hanger`,
        );
      }
      setSubmitted(true);
    } else if (challenge.challengeType === "mcq") {
      if (mcqSelected === null) {
        setFeedback("Please select an option.");
        setSubmitted(true);
        setIsCorrect(false);
        return;
      }
      if (mcqSelected === challenge.mcqCorrectIndex) {
        setIsCorrect(true);
        setIsHint(false);
        setFeedback(challenge.mcqExplanation ?? "Correct!");
      } else {
        setIsCorrect(false);
        setIsHint(true);
        setFeedback(challenge.mcqHint ?? "That's not quite right. Try again!");
      }
      setSubmitted(true);
    }
  };

  return (
    <>
      <style jsx>{`
        @keyframes ch-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        @keyframes ch-pulse {
          0%,
          100% {
            box-shadow:
              0 0 8px rgba(251, 191, 36, 0.2),
              0 0 16px rgba(251, 191, 36, 0.1);
          }
          50% {
            box-shadow:
              0 0 16px rgba(251, 191, 36, 0.4),
              0 0 32px rgba(251, 191, 36, 0.15);
          }
        }
        @keyframes ch-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-4px);
          }
          75% {
            transform: translateX(4px);
          }
        }
        .ch-card {
          animation: ch-pulse 3s ease-in-out infinite;
        }
        .ch-shimmer-bar {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(251, 191, 36, 0.4) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: ch-shimmer 2s ease-in-out infinite;
        }
        .ch-shake {
          animation: ch-shake 0.4s ease-in-out;
        }
        .ch-input {
          background: #1e293b;
          border: 1.5px solid #475569;
          border-radius: 10px;
          padding: 8px 12px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: monospace;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }
        .ch-input:focus {
          border-color: #fbbf24;
        }
        .ch-input-correct {
          border-color: #22c55e !important;
        }
        .ch-input-wrong {
          border-color: #ef4444 !important;
        }
      `}</style>

      <div className="w-full max-w-sm">
        <div className="ch-card w-full rounded-2xl border border-amber-600/40 bg-gradient-to-br from-slate-900/98 via-slate-800/98 to-slate-900/98 p-5 backdrop-blur-xl relative overflow-hidden">
          {/* Progress bar */}
          <div className="relative h-1.5 rounded-full bg-slate-700/80 mb-4 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
            <div className="ch-shimmer-bar absolute inset-0 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl select-none">🏆</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-amber-400/70 uppercase tracking-[0.14em] font-semibold">
                Challenge {challengeIndex + 1} of {totalChallenges}
              </div>
              <h3 className="text-base font-bold text-white leading-tight">
                {challenge.title}
              </h3>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-line">
            {challenge.description}
          </p>

          {/* Data Table (optional) */}
          {challenge.dataTable && (
            <div className="mb-4 overflow-x-auto rounded-xl border border-slate-700/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/80">
                    {challenge.dataTable.headers.map((h, i) => (
                      <th
                        key={i}
                        className="px-4 py-2 text-center font-semibold text-amber-400 text-xs uppercase tracking-wider border-b border-slate-700/60"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {challenge.dataTable.rows.map((row, ri) => (
                    <tr
                      key={ri}
                      className={`${ri % 2 === 0 ? "bg-slate-800/30" : "bg-slate-800/10"} border-b border-slate-800/40 last:border-b-0`}
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="px-4 py-1.5 text-center text-slate-200 font-mono text-sm"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── TYPE: calc_acceleration_tension ── */}
          {challenge.challengeType === "calc_acceleration_tension" && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">
                  Acceleration (m/s²)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className={`ch-input ${submitted ? (isCorrect ? "ch-input-correct" : "ch-input-wrong") : ""}`}
                  placeholder="a"
                  value={accelInput}
                  onChange={(e) => setAccelInput(e.target.value)}
                  disabled={submitted && isCorrect}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">
                  Tension (N)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className={`ch-input ${submitted ? (isCorrect ? "ch-input-correct" : "ch-input-wrong") : ""}`}
                  placeholder="T"
                  value={tensionInput}
                  onChange={(e) => setTensionInput(e.target.value)}
                  disabled={submitted && isCorrect}
                />
              </div>
            </div>
          )}

          {/* ── TYPE: find_hanger_mass / find_trolley_mass ── */}
          {(challenge.challengeType === "find_hanger_mass" ||
            challenge.challengeType === "find_trolley_mass") && (
            <div className="mb-4">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">
                {challenge.challengeType === "find_hanger_mass"
                  ? "Hanger Mass (kg)"
                  : "Trolley Mass (kg)"}
              </label>
              <input
                type="number"
                step="0.01"
                className={`ch-input ${submitted ? (isCorrect ? "ch-input-correct" : "ch-input-wrong") : ""}`}
                placeholder="Enter mass"
                value={massInput}
                onChange={(e) => setMassInput(e.target.value)}
                disabled={submitted && isCorrect}
              />
            </div>
          )}

          {/* ── TYPE: MCQ ── */}
          {challenge.challengeType === "mcq" && (
            <div className="grid grid-cols-1 gap-2 mb-4">
              {challenge.mcqOptions?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => !submitted && setMcqSelected(i)}
                  disabled={submitted && isCorrect}
                  className={`text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    mcqSelected === i
                      ? submitted
                        ? i === challenge.mcqCorrectIndex
                          ? "border-green-500 bg-green-900/30 text-green-300"
                          : "border-red-500 bg-red-900/20 text-red-300 ch-shake"
                        : "border-amber-500 bg-amber-900/20 text-amber-300"
                      : submitted && i === challenge.mcqCorrectIndex
                        ? "border-green-500/50 bg-green-900/10 text-green-400"
                        : "border-slate-600/60 bg-slate-800/40 text-slate-300 hover:bg-slate-700/40 hover:border-slate-500"
                  }`}
                >
                  <span className="text-slate-500 mr-2">{i + 1})</span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Feedback */}
          {submitted && feedback && (
            <div
              className={`text-sm mb-3 p-2.5 rounded-xl whitespace-pre-line leading-relaxed ${
                isCorrect
                  ? "bg-green-900/20 text-green-400 border border-green-700/30 font-medium"
                  : isHint
                    ? "bg-amber-900/15 text-amber-300 border border-amber-700/30"
                    : "bg-red-900/15 text-red-400 border border-red-700/30 font-medium"
              }`}
            >
              {feedback}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {challengeIndex > 0 && !submitted && (
              <button
                onClick={onBack}
                className="px-3 py-2 rounded-xl text-xs font-medium text-slate-300 border border-slate-600 hover:bg-slate-700/50 hover:text-white transition-all duration-200"
              >
                ← Back
              </button>
            )}
            <button
              onClick={onExit}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 border border-slate-600/60 hover:bg-slate-700/50 hover:text-white transition-all duration-200"
            >
              Exit
            </button>
            <div className="flex-1" />

            {/* Try Again — shown when submitted but wrong */}
            {submitted && !isCorrect && (
              <button
                onClick={handleTryAgain}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-slate-600 hover:bg-slate-500 border border-slate-500 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Try Again
              </button>
            )}

            {/* Submit — shown when not yet submitted */}
            {!submitted && (
              <button
                onClick={handleSubmit}
                className="px-5 py-2 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:opacity-90 shadow-md shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Submit
              </button>
            )}

            {/* Next — shown when answered correctly */}
            {submitted && isCorrect && (
              <button
                onClick={onNext}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:opacity-90 shadow-md shadow-green-500/25 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {challengeIndex < totalChallenges - 1
                  ? "Next Challenge →"
                  : "Finish! 🎉"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
