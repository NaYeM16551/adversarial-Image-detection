"use client";

import React from "react";
import { SimulationState } from "../simulation-logic/simulation";

interface ApparatusSVGProps {
  simulationRef: React.RefObject<SimulationState | null>;
  isMobile: boolean;
  registerUpdate: (fn: () => void) => void;
  hangerMass?: number;
}

// ── Geometry constants (SVG user units) ──
const SVG_W = 900;
const SVG_H = 1000; // Increased from 480 to accommodate hanger descent (~512px max)

// Bench / Track
const BENCH_X = 50;
const BENCH_Y = 270;
const BENCH_W = 650;
const BENCH_H = 22;
const BENCH_DEPTH = 55;
const BENCH_SURFACE_Y = BENCH_Y;

// Track mapping: simulation metres → SVG x
const TRACK_START_X = BENCH_X + 50;
const TRACK_END_X = BENCH_X + BENCH_W - 15;
const SIM_TRACK_LENGTH = 1.2;

// Trolley — more polished "dynamics trolley" look
const TROLLEY_W = 100;
const TROLLEY_H = 36;
const WHEEL_R = 7;
const TROLLEY_Y = BENCH_SURFACE_Y - WHEEL_R * 2 - TROLLEY_H;

// Card flag — WIDER to show face-on (like a piece of cardboard)
const CARD_W = 40; // visible width of the card
const CARD_THICKNESS = 3; // thin edge
const CARD_H = 45;
const CARD_SLOT_H = 14;
const CARD_SLOT_W = 28;
const CARD_SLOT_Y_OFFSET = 15;

// Light gate
const LIGHT_GATE_W = 50; // wider arch to let card pass
const LIGHT_GATE_H = 65;
const LIGHT_GATE_SIM_POS = 0.8;

// Pulley
const PULLEY_R = 16;
const PULLEY_X = TRACK_END_X;
const PULLEY_Y = BENCH_SURFACE_Y - 14;

// Hanger & masses
const HANGER_Y_START = PULLEY_Y + PULLEY_R + 12;
const HANGER_W = 5;
const HANGER_H = 28;
const MASS_W = 30;
const MASS_H = 10;
const MASS_GAP = 2;

// Starting line
const START_LINE_X = TRACK_START_X;

function simPosToSvgX(simPos: number): number {
  const t = simPos / SIM_TRACK_LENGTH;
  return TRACK_START_X + t * (TRACK_END_X - TRACK_START_X);
}

export default function ApparatusSVG({
  simulationRef,
  isMobile,
  registerUpdate,
}: ApparatusSVGProps) {
  const trolleyGroupRef = React.useRef<SVGGElement>(null);
  const stringRef = React.useRef<SVGPathElement>(null);
  const lightGateIndicatorRef = React.useRef<SVGCircleElement>(null);
  const massGroupRef = React.useRef<SVGGElement>(null);
  const hangerGroupRef = React.useRef<SVGGElement>(null);

  const sim = simulationRef.current;
  const initialTrolleyX = sim
    ? simPosToSvgX(sim.trolleyPosition)
    : TRACK_START_X;
  const lightGateX = simPosToSvgX(LIGHT_GATE_SIM_POS);

  // Build mass stack elements imperatively so they update dynamically
  function rebuildMasses(hangerMass: number): void {
    const g = massGroupRef.current;
    if (!g) return;
    const count = Math.max(1, Math.min(13, Math.round(hangerMass/0.04)));
    console.log("hangerMass", hangerMass);
    console.log("count", count);
    const cx = PULLEY_X + PULLEY_R;

    // Remove all existing mass children
    while (g.firstChild) g.removeChild(g.firstChild);

    // SVG namespace
    const ns = "http://www.w3.org/2000/svg";

    for (let i = 0; i < count; i++) {
      const my = HANGER_Y_START + HANGER_H + i * (MASS_H + MASS_GAP);

      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(cx - MASS_W / 2));
      rect.setAttribute("y", String(my));
      rect.setAttribute("width", String(MASS_W));
      rect.setAttribute("height", String(MASS_H));
      rect.setAttribute("fill", "url(#me-mass)");
      rect.setAttribute("stroke", "#3d4f5f");
      rect.setAttribute("stroke-width", "1");
      rect.setAttribute("rx", "2");
      g.appendChild(rect);

      // Center slot stripe
      const slot = document.createElementNS(ns, "rect");
      slot.setAttribute("x", String(cx - 2));
      slot.setAttribute("y", String(my));
      slot.setAttribute("width", "4");
      slot.setAttribute("height", String(MASS_H));
      slot.setAttribute("fill", "#4a5e6e");
      slot.setAttribute("rx", "1");
      g.appendChild(slot);
    }
  }

  // Register direct-DOM update function (bypasses React for 60fps)
  React.useEffect(() => {
    // Build initial masses on mount
    const initSim = simulationRef.current;
    if (initSim) rebuildMasses(initSim.hangerMass);

    let lastMassCount = -1;

    registerUpdate(() => {
      const sim = simulationRef.current;
      if (!sim) return;

      const trolleyX = simPosToSvgX(sim.trolleyPosition);

      // Move trolley group
      if (trolleyGroupRef.current) {
        trolleyGroupRef.current.setAttribute(
          "transform",
          `translate(${trolleyX}, 0)`,
        );
      }

      // Move hanger group downward by same distance trolley moved forward
      // (constant string length in pulley system)
      if (hangerGroupRef.current) {
        const pixelsPerMetre = (TRACK_END_X - TRACK_START_X) / SIM_TRACK_LENGTH;
        const hangerDescentPx = sim.trolleyPosition * pixelsPerMetre;
        hangerGroupRef.current.setAttribute(
          "transform",
          `translate(0, ${hangerDescentPx})`,
        );
      }

      // Update string path
      if (stringRef.current) {
        const trolleyFrontX = trolleyX + TROLLEY_W;
        const stringY = TROLLEY_Y + TROLLEY_H * 0.45;
        const pixelsPerMetre = (TRACK_END_X - TRACK_START_X) / SIM_TRACK_LENGTH;
        const hangerDescentPx = sim.trolleyPosition * pixelsPerMetre;
        const d = buildStringPath(trolleyFrontX, stringY, hangerDescentPx);
        stringRef.current.setAttribute("d", d);
      }

      // Light gate indicator
      if (lightGateIndicatorRef.current) {
        const on = sim.lightGateTriggered;
        lightGateIndicatorRef.current.setAttribute(
          "fill",
          on ? "#22c55e" : "#ef4444",
        );
        lightGateIndicatorRef.current.setAttribute("r", on ? "3.5" : "2.5");
      }

      // Rebuild mass stack only when count changes
      const newCount = Math.max(1, Math.min(13, Math.round(sim.hangerMass / 0.04)));
      if (newCount !== lastMassCount) {
        lastMassCount = newCount;
        rebuildMasses(sim?.hangerMass);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerUpdate, simulationRef]);

  function buildStringPath(frontX: number, stringY: number, hangerDescentPx: number = 0): string {
    return [
      `M ${frontX} ${stringY}`,
      `L ${PULLEY_X} ${stringY}`,
      `A ${PULLEY_R} ${PULLEY_R} 0 0 1 ${PULLEY_X + PULLEY_R} ${PULLEY_Y}`,
      `L ${PULLEY_X + PULLEY_R} ${HANGER_Y_START - 4 + hangerDescentPx}`,
    ].join(" ");
  }

  const stringInitPath = buildStringPath(
    initialTrolleyX + TROLLEY_W,
    TROLLEY_Y + TROLLEY_H * 0.45,
  );

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: "100%", maxHeight: "100%" }}
    >
      <defs>
        {/* Bench wood grain */}
        <linearGradient id="me-bench-top" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#d4a76a" />
          <stop offset="30%" stopColor="#c9a060" />
          <stop offset="70%" stopColor="#d4a76a" />
          <stop offset="100%" stopColor="#c49a5c" />
        </linearGradient>
        <linearGradient id="me-bench-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8894d" />
          <stop offset="50%" stopColor="#a57e42" />
          <stop offset="100%" stopColor="#8a6835" />
        </linearGradient>
        {/* Trolley body */}
        <linearGradient id="me-trolley" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a9bb5" />
          <stop offset="40%" stopColor="#6889a0" />
          <stop offset="100%" stopColor="#56778b" />
        </linearGradient>
        {/* Masses */}
        <linearGradient id="me-mass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a8a99" />
          <stop offset="100%" stopColor="#576470" />
        </linearGradient>
        {/* Card */}
        <linearGradient id="me-card" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="#fffdf7" />
          <stop offset="25%" stopColor="#f8f2e4" />
          <stop offset="75%" stopColor="#ede3ce" />
          <stop offset="100%" stopColor="#ddd0b5" />
        </linearGradient>
        <linearGradient id="me-card-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9b896" />
          <stop offset="100%" stopColor="#a89570" />
        </linearGradient>
        <filter
          id="me-card-shadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="1.5"
            dy="2"
            stdDeviation="2"
            floodColor="#0f172a"
            floodOpacity="0.25"
          />
        </filter>
      </defs>

      {/* ═══════════════ BENCH / TRACK ═══════════════ */}
      <g id="bench">
        {/* Front face of bench (depth / perspective) */}
        <path
          d={`M ${BENCH_X} ${BENCH_Y + BENCH_H}
              L ${BENCH_X + 8} ${BENCH_Y + BENCH_H + BENCH_DEPTH}
              L ${BENCH_X + BENCH_W + 8} ${BENCH_Y + BENCH_H + BENCH_DEPTH}
              L ${BENCH_X + BENCH_W} ${BENCH_Y + BENCH_H}
              Z`}
          fill="url(#me-bench-front)"
          stroke="#7a6030"
          strokeWidth={1.2}
        />
        {/* Side edge */}
        <path
          d={`M ${BENCH_X + BENCH_W} ${BENCH_Y}
              L ${BENCH_X + BENCH_W + 8} ${BENCH_Y + 8}
              L ${BENCH_X + BENCH_W + 8} ${BENCH_Y + BENCH_H + BENCH_DEPTH}
              L ${BENCH_X + BENCH_W} ${BENCH_Y + BENCH_H}
              Z`}
          fill="#9a7a45"
          stroke="#7a6030"
          strokeWidth={1}
        />
        {/* Top surface */}
        <rect
          x={BENCH_X}
          y={BENCH_Y}
          width={BENCH_W}
          height={BENCH_H}
          fill="url(#me-bench-top)"
          stroke="#9a7340"
          strokeWidth={1.5}
          rx={1}
        />
        {/* Track rails (grooves on top) */}
        <line
          x1={BENCH_X + 20}
          y1={BENCH_Y + 6}
          x2={BENCH_X + BENCH_W - 20}
          y2={BENCH_Y + 6}
          stroke="#b5924e"
          strokeWidth={1.2}
          opacity={0.5}
        />
        <line
          x1={BENCH_X + 20}
          y1={BENCH_Y + BENCH_H - 6}
          x2={BENCH_X + BENCH_W - 20}
          y2={BENCH_Y + BENCH_H - 6}
          stroke="#b5924e"
          strokeWidth={1.2}
          opacity={0.5}
        />
        {/* Wood grain texture lines */}
        {[0.15, 0.35, 0.55, 0.75, 0.9].map((t, i) => (
          <line
            key={i}
            x1={BENCH_X + BENCH_W * t}
            y1={BENCH_Y + 2}
            x2={BENCH_X + BENCH_W * t}
            y2={BENCH_Y + BENCH_H - 2}
            stroke="#c4a05c"
            strokeWidth={0.5}
            opacity={0.3}
          />
        ))}
      </g>

      {/* ═══════════════ STARTING LINE ═══════════════ */}
      <g id="starting-line">
        <line
          x1={START_LINE_X}
          y1={BENCH_Y - 3}
          x2={START_LINE_X}
          y2={BENCH_Y + BENCH_H + 3}
          stroke="#dc2626"
          strokeWidth={2.5}
          strokeDasharray="5 3"
        />
        {/* Small triangle marker */}
        <polygon
          points={`${START_LINE_X - 5},${BENCH_Y - 6} ${START_LINE_X + 5},${BENCH_Y - 6} ${START_LINE_X},${BENCH_Y - 1}`}
          fill="#dc2626"
        />
      </g>

      {/* ═══════════════ LIGHT GATE ═══════════════ */}
      <g id="light-gate">
        {/* Support base clamp (clips onto bench) */}
        <rect
          x={lightGateX - 8}
          y={BENCH_Y - 3}
          width={16}
          height={BENCH_H + 6}
          fill="#3d4f5f"
          stroke="#2d3b47"
          strokeWidth={1}
          rx={2}
        />
        {/* Left upright arm */}
        <rect
          x={lightGateX - LIGHT_GATE_W / 2}
          y={BENCH_SURFACE_Y - LIGHT_GATE_H}
          width={8}
          height={LIGHT_GATE_H}
          fill="#1a5c30"
          stroke="#14532d"
          strokeWidth={1.2}
          rx={1.5}
        />
        {/* Right upright arm */}
        <rect
          x={lightGateX + LIGHT_GATE_W / 2 - 8}
          y={BENCH_SURFACE_Y - LIGHT_GATE_H}
          width={8}
          height={LIGHT_GATE_H}
          fill="#1a5c30"
          stroke="#14532d"
          strokeWidth={1.2}
          rx={1.5}
        />
        {/* Top crossbar */}
        <rect
          x={lightGateX - LIGHT_GATE_W / 2}
          y={BENCH_SURFACE_Y - LIGHT_GATE_H}
          width={LIGHT_GATE_W}
          height={10}
          fill="#22763a"
          stroke="#14532d"
          strokeWidth={1.2}
          rx={3}
        />
        {/* Sensor housing at top */}
        <rect
          x={lightGateX - 12}
          y={BENCH_SURFACE_Y - LIGHT_GATE_H - 6}
          width={24}
          height={8}
          fill="#2d3b47"
          stroke="#1e293b"
          strokeWidth={1}
          rx={2}
        />
        {/* IR emitter (left) */}
        <circle
          cx={lightGateX - LIGHT_GATE_W / 2 + 4}
          cy={BENCH_SURFACE_Y - LIGHT_GATE_H + 28}
          r={2.5}
          fill="#ef4444"
          opacity={0.8}
        />
        {/* IR receiver (right) — changes color on trigger */}
        <circle
          ref={lightGateIndicatorRef}
          cx={lightGateX + LIGHT_GATE_W / 2 - 4}
          cy={BENCH_SURFACE_Y - LIGHT_GATE_H + 28}
          r={2.5}
          fill="#ef4444"
          opacity={0.8}
        />

      </g>

      {/* ═══════════════ PULLEY ═══════════════ */}
      <g id="pulley">
        {/* Mounting bracket (L-shaped) */}
        <path
          d={`M ${PULLEY_X - 8} ${BENCH_Y}
              L ${PULLEY_X - 8} ${PULLEY_Y - PULLEY_R - 8}
              L ${PULLEY_X + PULLEY_R + 12} ${PULLEY_Y - PULLEY_R - 8}
              L ${PULLEY_X + PULLEY_R + 12} ${PULLEY_Y - PULLEY_R}
              L ${PULLEY_X} ${PULLEY_Y - PULLEY_R}
              L ${PULLEY_X} ${BENCH_Y}
              Z`}
          fill="#4a5568"
          stroke="#2d3748"
          strokeWidth={1.5}
        />
        {/* Wheel outer ring */}
        <circle
          cx={PULLEY_X + PULLEY_R}
          cy={PULLEY_Y}
          r={PULLEY_R}
          fill="#718096"
          stroke="#2d3748"
          strokeWidth={2.5}
        />
        {/* Groove */}
        <circle
          cx={PULLEY_X + PULLEY_R}
          cy={PULLEY_Y}
          r={PULLEY_R - 4}
          fill="none"
          stroke="#4a5568"
          strokeWidth={1.5}
        />
        {/* Axle */}
        <circle
          cx={PULLEY_X + PULLEY_R}
          cy={PULLEY_Y}
          r={4.5}
          fill="#a0aec0"
          stroke="#4a5568"
          strokeWidth={1.5}
        />
        {/* Axle center dot */}
        <circle cx={PULLEY_X + PULLEY_R} cy={PULLEY_Y} r={1.5} fill="#2d3748" />
      </g>

      {/* ═══════════════ STRING ═══════════════ */}
      <path
        ref={stringRef}
        id="string"
        d={stringInitPath}
        fill="none"
        stroke="#1a1a2e"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* ═══════════════ HANGER & MASSES ═══════════════ */}
      <g id="hanger" ref={hangerGroupRef}>
        {/* Hanger rod */}
        <rect
          x={PULLEY_X + PULLEY_R - HANGER_W / 2}
          y={HANGER_Y_START}
          width={HANGER_W}
          height={HANGER_H}
          fill="#4a5568"
          stroke="#2d3748"
          strokeWidth={1}
          rx={1}
        />
        {/* Hook */}
        <path
          d={`M ${PULLEY_X + PULLEY_R} ${HANGER_Y_START}
              C ${PULLEY_X + PULLEY_R - 8} ${HANGER_Y_START - 4},
                ${PULLEY_X + PULLEY_R - 8} ${HANGER_Y_START - 12},
                ${PULLEY_X + PULLEY_R} ${HANGER_Y_START - 14}`}
          fill="none"
          stroke="#4a5568"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Stacked masses — populated imperatively via rebuildMasses() */}
        <g id="masses" ref={massGroupRef} />
      </g>

      {/* ═══════════════ TROLLEY (animated group) ═══════════════ */}
      <g
        ref={trolleyGroupRef}
        id="trolley"
        transform={`translate(${initialTrolleyX}, 0)`}
      >
        {/* Trolley body — rounded, clean lab-trolley shape */}
        <rect
          id="trolley-body"
          x={0}
          y={TROLLEY_Y}
          width={TROLLEY_W}
          height={TROLLEY_H}
          fill="url(#me-trolley)"
          stroke="#3d5a70"
          strokeWidth={1.8}
          rx={5}
        />
        {/* Top highlight strip */}
        <rect
          x={3}
          y={TROLLEY_Y + 2}
          width={TROLLEY_W - 6}
          height={4}
          fill="rgba(255,255,255,0.18)"
          rx={2}
        />
        {/* Trolley top edge / lip */}
        <rect
          x={0}
          y={TROLLEY_Y}
          width={TROLLEY_W}
          height={3}
          fill="#8aa8be"
          rx={2}
        />
        {/* Mounting holes (decorative) */}
        <circle
          cx={10}
          cy={TROLLEY_Y + TROLLEY_H / 2}
          r={2}
          fill="#3d5a70"
          opacity={0.5}
        />
        <circle
          cx={TROLLEY_W - 10}
          cy={TROLLEY_Y + TROLLEY_H / 2}
          r={2}
          fill="#3d5a70"
          opacity={0.5}
        />

        {/* ── WHEELS ── */}
        <g id="trolley-wheels">
          {[14, 28, TROLLEY_W - 28, TROLLEY_W - 14].map((wx, i) => (
            <g key={i}>
              <circle
                cx={wx}
                cy={TROLLEY_Y + TROLLEY_H + WHEEL_R}
                r={WHEEL_R}
                fill="#3a4f60"
                stroke="#283845"
                strokeWidth={1.5}
              />
              <circle
                cx={wx}
                cy={TROLLEY_Y + TROLLEY_H + WHEEL_R}
                r={2.5}
                fill="#6b8a9e"
              />
            </g>
          ))}
        </g>

        {/* ═══════════════ CARD FLAG — wider, face-on view ═══════════════ */}
        <g id="card-flag" filter="url(#me-card-shadow)">
          {/* Card body — rectangular piece of card shown face-on */}
          <rect
            x={TROLLEY_W / 2 - CARD_W / 2}
            y={TROLLEY_Y - CARD_H}
            width={CARD_W}
            height={CARD_H}
            fill="url(#me-card)"
            stroke="url(#me-card-edge)"
            strokeWidth={1.4}
            rx={2}
          />
          {/* Subtle horizontal fibre lines */}
          {[0.2, 0.45, 0.7, 0.88].map((t, i) => (
            <line
              key={`fibre-${i}`}
              x1={TROLLEY_W / 2 - CARD_W / 2 + 3}
              y1={TROLLEY_Y - CARD_H + CARD_H * t}
              x2={TROLLEY_W / 2 + CARD_W / 2 - 3}
              y2={TROLLEY_Y - CARD_H + CARD_H * t}
              stroke="#c9bb9e"
              strokeWidth={0.4}
              opacity={0.35}
            />
          ))}
          {/* Top highlight edge */}
          <rect
            x={TROLLEY_W / 2 - CARD_W / 2 + 1}
            y={TROLLEY_Y - CARD_H + 1}
            width={CARD_W - 2}
            height={2.5}
            fill="rgba(255,255,255,0.45)"
            rx={1}
          />
          {/* Rectangular slot / gap cut in the middle of the card */}
          <rect
            x={TROLLEY_W / 2 - CARD_SLOT_W / 2}
            y={TROLLEY_Y - CARD_H + CARD_SLOT_Y_OFFSET}
            width={CARD_SLOT_W}
            height={CARD_SLOT_H}
            fill="#0f172a"
            stroke="#3d4f5f"
            strokeWidth={0.9}
            rx={1.5}
          />
          {/* Slot inner bevel highlight */}
          <rect
            x={TROLLEY_W / 2 - CARD_SLOT_W / 2 + 1}
            y={TROLLEY_Y - CARD_H + CARD_SLOT_Y_OFFSET + 1}
            width={CARD_SLOT_W - 2}
            height={1.5}
            fill="rgba(255,255,255,0.08)"
            rx={0.5}
          />
          {/* Left edge depth line */}
          <line
            x1={TROLLEY_W / 2 - CARD_W / 2 + 1.5}
            y1={TROLLEY_Y - CARD_H + 3}
            x2={TROLLEY_W / 2 - CARD_W / 2 + 1.5}
            y2={TROLLEY_Y - 3}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={0.7}
          />
          {/* Card shadow on trolley */}
          <rect
            x={TROLLEY_W / 2 - CARD_W / 2}
            y={TROLLEY_Y - 2}
            width={CARD_W}
            height={2}
            fill="rgba(0,0,0,0.18)"
            rx={0.5}
          />
          {/* Mounting clip at base — polished */}
          <rect
            x={TROLLEY_W / 2 - 7}
            y={TROLLEY_Y - 5}
            width={14}
            height={7}
            fill="#5a7a8f"
            stroke="#3d5a70"
            strokeWidth={1}
            rx={2}
          />
          {/* Clip highlight */}
          <rect
            x={TROLLEY_W / 2 - 5}
            y={TROLLEY_Y - 4}
            width={10}
            height={2}
            fill="rgba(255,255,255,0.18)"
            rx={1}
          />
        </g>

        {/* String attachment hook (front of trolley) */}
        <g>
          <rect
            x={TROLLEY_W - 4}
            y={TROLLEY_Y + TROLLEY_H * 0.35}
            width={8}
            height={8}
            fill="#3d5a70"
            stroke="#283845"
            strokeWidth={1}
            rx={1}
          />
          <circle
            cx={TROLLEY_W + 2}
            cy={TROLLEY_Y + TROLLEY_H * 0.45}
            r={2}
            fill="#283845"
          />
        </g>
      </g>

      {/* ═══════════════ LABELS (only piece of card and light gate) ═══════════════ */}
      <g
        id="labels"
        fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
        fontSize={11}
      >
        {/* piece of card label */}
        <g>
          <line
            x1={initialTrolleyX + TROLLEY_W / 2 + CARD_W / 2 + 3}
            y1={TROLLEY_Y - CARD_H / 2}
            x2={initialTrolleyX + TROLLEY_W / 2 + CARD_W / 2 + 50}
            y2={TROLLEY_Y - CARD_H / 2 - 18}
            stroke="#94a3b8"
            strokeWidth={0.8}
          />
          <circle
            cx={initialTrolleyX + TROLLEY_W / 2 + CARD_W / 2 + 3}
            cy={TROLLEY_Y - CARD_H / 2}
            r={1.5}
            fill="#94a3b8"
          />
          <text
            x={initialTrolleyX + TROLLEY_W / 2 + CARD_W / 2 + 52}
            y={TROLLEY_Y - CARD_H / 2 - 14}
            fill="#cbd5e1"
            fontSize={11}
            fontWeight={500}
          >
            piece of card
          </text>
        </g>

        {/* light gate label */}
        <g>
          <line
            x1={lightGateX}
            y1={BENCH_SURFACE_Y - LIGHT_GATE_H - 8}
            x2={lightGateX + 35}
            y2={BENCH_SURFACE_Y - LIGHT_GATE_H - 38}
            stroke="#94a3b8"
            strokeWidth={0.8}
          />
          <circle
            cx={lightGateX}
            cy={BENCH_SURFACE_Y - LIGHT_GATE_H - 8}
            r={1.5}
            fill="#94a3b8"
          />
          <text
            x={lightGateX + 38}
            y={BENCH_SURFACE_Y - LIGHT_GATE_H - 40}
            fill="#a3e635"
            fontSize={11}
            fontWeight={600}
          >
            light gate
          </text>
        </g>
      </g>
    </svg>
  );
}
