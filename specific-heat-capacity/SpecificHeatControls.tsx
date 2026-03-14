"use client";

import React, { useEffect, useState } from "react";
import {
  MaterialType,
  MATERIALS,
  type ElectricSource,
  type DataRecord,
} from "./simulation";
import { CommonButton } from "@sim/components/common/button";
import {
  PowerIcon,
  PlayIcon,
  PauseIcon,
  ResetIcon,
} from "@sim/components/icons/button";
import { Panel } from "./components/UI_components";
import DataCollectionTable from "./DataCollectionTable";
import { Thermometer, Clock, Zap } from "lucide-react";

interface ControlsProps {
  materialType: MaterialType;
  mass: number;
  voltage: number;
  current: number;
  onMaterialChange: (material: MaterialType) => void;
  onMassChange: (mass: number) => void;
  onVoltageChange: (voltage: number) => void;
  onCurrentChange: (current: number) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  isPowerOn: boolean;
  onTogglePower: () => void;
  isMobile?: boolean;
  // Live values
  temperatureRef: React.RefObject<number>;
  timeRef: React.RefObject<number>;
  electricSourceRef: React.RefObject<ElectricSource>;
  // Data collection
  dataRecordsRef: React.RefObject<DataRecord[]>;
  onCollectData: () => DataRecord | null;
}

export default function SpecificHeatControls({
  materialType,
  mass,
  voltage,
  current,
  onMaterialChange,
  onMassChange,
  onVoltageChange,
  onCurrentChange,
  isPaused,
  onTogglePause,
  onReset,
  isPowerOn,
  onTogglePower,
  isMobile,
  temperatureRef,
  timeRef,
  electricSourceRef,
  dataRecordsRef,
  onCollectData,
}: ControlsProps) {
  const power = voltage * current;
  const material = MATERIALS[materialType];

  const [liveValues, setLiveValues] = useState({
    temperature: 20,
    time: 0,
    energy: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const t = timeRef.current || 0;
      const p = electricSourceRef.current?.power || 0;
      setLiveValues({
        temperature: (temperatureRef.current || 293.15) - 273.15,
        time: t,
        energy: p * t,
      });
    }, 100);
    return () => clearInterval(interval);
  }, [temperatureRef, timeRef, electricSourceRef]);

  return (
    <div className="w-full flex flex-col gap-3">
      {/* 1) Heat Energy Controls */}
      <Panel title="Heat Energy Controls">
        <div className="space-y-4">

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-300">
              Material Type
            </label>
            <select
              value={materialType}
              onChange={(e) => onMaterialChange(e.target.value as MaterialType)}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Object.values(MATERIALS).map((mat) => (
                <option key={mat.type} value={mat.type}>
                  {mat.name} {mat.isLiquid ? "(Liquid)" : "(Solid)"}
                </option>
              ))}
            </select>
          </div>
          {/* Mass */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs font-medium text-white">Mass</label>
            </div>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={mass}
              onChange={(e) => onMassChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0.1 kg</span>
              <span className="text-white font-medium">
                {mass.toFixed(2)} kg
              </span>
              <span>5.0 kg</span>
            </div>
          </div>

          {/* Voltage */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs font-medium text-white">Voltage</label>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              step="0.5"
              value={voltage}
              onChange={(e) => onVoltageChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>1 V</span>
              <span className="text-white font-medium">
                {voltage.toFixed(1)} V
              </span>
              <span>24 V</span>
            </div>
          </div>

          {/* Current */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs font-medium text-white">Current</label>
            </div>
            <input
              type="range"
              min="0.1"
              max="10.0"
              step="0.1"
              value={current}
              onChange={(e) => onCurrentChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0.1 A</span>
              <span className="text-white font-medium">
                {current.toFixed(2)} A
              </span>
              <span>10.0 A</span>
            </div>
          </div>

          {/* Power output */}
          <div className="rounded-lg bg-black/40 border border-gray-800 p-3">
            <div className="text-xs font-medium text-gray-400 mb-1">
              Power Output
            </div>
            <div className="text-lg font-bold text-white mb-0.5">
              {power.toFixed(1)} W
            </div>
            <div className="text-[10px] text-gray-600 font-mono">
              P = V × I = {voltage.toFixed(1)}V × {current.toFixed(2)}A
            </div>
          </div>
        </div>
      </Panel>

      {/* 2) Live Values */}
      <Panel title="Live Values">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-orange-400 shrink-0" />
            <span className="text-gray-300">Temperature:</span>
            <span className="text-white font-bold ml-auto">
              {liveValues.temperature.toFixed(1)}°C
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-gray-300">Time:</span>
            <span className="text-white font-bold ml-auto">
              {liveValues.time.toFixed(1)} s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400 shrink-0" />
            <span className="text-gray-300">Energy (Q):</span>
            <span className="text-yellow-400 font-bold ml-auto">
              {liveValues.energy.toFixed(0)} J
            </span>
          </div>
        </div>
      </Panel>

      {/* 3) Data Collection Table */}
      <Panel title="Data Collection Table">
        <div className="w-full overflow-hidden">
          <DataCollectionTable
            dataRecordsRef={dataRecordsRef}
            onCollectData={onCollectData}
            isPaused={isPaused}
            isPowerOn={isPowerOn}
            isMobile={isMobile}
          />
        </div>
      </Panel>

      {/* 4) Simulation controls (unnamed panel) */}
      <Panel>
        <div className="flex flex-col gap-2">
          <CommonButton
            onClick={onTogglePower}
            variant="outlined"
            className={`w-full justify-center border-gray-700 hover:bg-gray-800 ${
              isPowerOn
                ? "text-green-400 border-green-900/50 bg-green-900/10"
                : "text-gray-300"
            }`}
            text={isPowerOn ? "Power ON" : "Power OFF"}
            icon={<PowerIcon className={isPowerOn ? "text-green-400" : ""} />}
          />
          <CommonButton
            onClick={onTogglePause}
            variant="filled"
            className="w-full justify-center bg-sky-600 hover:bg-sky-500 text-white"
            text={isPaused ? "Start" : "Pause"}
            icon={
              isPaused ? (
                <PlayIcon className="fill-current" />
              ) : (
                <PauseIcon className="fill-current" />
              )
            }
          />
          <CommonButton
            onClick={onReset}
            variant="outlined"
            className="w-full justify-center border-gray-700 text-gray-300 hover:bg-gray-800"
            text="Reset"
            icon={<ResetIcon />}
          />
        </div>
      </Panel>

      {/* 5) Material Properties */}
      <Panel title="Material Properties">
        <div className="space-y-3">
          <div className="rounded-lg bg-black/40 border border-gray-800 p-3">
            <div className="flex flex-col gap-1.5 text-[11px] text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Specific Heat:</span>
                <span className="font-medium">
                  {material.specificHeat} J/(kg·K)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Density:</span>
                <span className="font-medium">{material.density} kg/m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">State:</span>
                <span className="font-medium">
                  {material.isLiquid ? "Liquid" : "Solid"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
