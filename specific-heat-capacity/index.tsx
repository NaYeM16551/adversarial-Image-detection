"use client";
import BaseLab from "@sim/components/BaseLab";
import { Application } from "pixi.js";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createRenderer } from "./renderer";
import {
  createSimulation,
  destroySimulation,
  stepSimulation,
  resetSimulation,
  collectData,
  type SimulationState,
  type MaterialType,
  type ElectricSource,
  type DataRecord,
} from "./simulation";
import SpecificHeatControls from "./SpecificHeatControls";
import TimeTemperatureChart from "./timeTemperatureChart";

export default function SpecificHeatCapacityLab() {
  const pausedRef = useRef(false);
  const simulationRef = useRef<SimulationState | null>(null);
  const initializedRef = useRef(false);

  // Simulation parameters
  const materialTypeRef = useRef<MaterialType>("water");
  const massRef = useRef(1.0);
  const electricSourceRef = useRef<ElectricSource>({
    voltage: 12.0,
    current: 2.0,
    power: 24.0,
  });
  const temperatureRef = useRef(293.15);
  const timeRef = useRef(0);
  const powerOnRef = useRef(false);
  const dataRecordsRef = useRef<DataRecord[]>([]);

  // UI state
  const [controlsKey, setControlsKey] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, forceControlsUpdate] = useReducer((x: number) => x + 1, 0);

  // UI values as refs
  const uiMaterialTypeRef = useRef<MaterialType>("water");
  const uiMassRef = useRef(1.0);
  const uiVoltageRef = useRef(12.0);
  const uiCurrentRef = useRef(2.0);
  const uiIsPausedRef = useRef(false);
  const uiIsPowerOnRef = useRef(false);

  // Update refs
  const updateRefs = useCallback(() => {
    materialTypeRef.current = uiMaterialTypeRef.current;
    massRef.current = uiMassRef.current;
    electricSourceRef.current = {
      voltage: uiVoltageRef.current,
      current: uiCurrentRef.current,
      power: uiVoltageRef.current * uiCurrentRef.current,
    };
    pausedRef.current = uiIsPausedRef.current;
    powerOnRef.current = uiIsPowerOnRef.current;
  }, []);

  const handleTogglePower = useCallback(() => {
    uiIsPowerOnRef.current = !uiIsPowerOnRef.current;
    powerOnRef.current = uiIsPowerOnRef.current;
    setControlsKey((prev) => prev + 1);
    forceControlsUpdate();
  }, []);

  const handleCollectData = useCallback(() => {
    if (simulationRef.current) {
      const newRecord = collectData(simulationRef.current, {
        pausedRef,
        materialTypeRef,
        massRef,
        electricSourceRef,
        temperatureRef,
        timeRef,
        powerOnRef,
      });
      dataRecordsRef.current = [...dataRecordsRef.current, newRecord];
      return newRecord;
    }
    return null;
  }, []);

  // Responsive sizing
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    const updateSize = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1250);
    };
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateSize, 100);
    };
    updateSize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // Auto-pause initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initializedRef.current) {
        uiIsPausedRef.current = true;
        pausedRef.current = true;
        initializedRef.current = true;
        setControlsKey((prev) => prev + 1);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const onInit = useCallback(
    async (app: Application) => {
      try {
        updateRefs();
        const sim = createSimulation({
          pausedRef,
          materialTypeRef,
          massRef,
          electricSourceRef,
          temperatureRef,
          timeRef,
          powerOnRef,
        });
        simulationRef.current = sim;

        const renderer = await createRenderer(app, sim, {
          materialTypeRef,
          massRef,
          electricSourceRef,
          temperatureRef,
          timeRef,
          powerOnRef,
          onPowerToggle: handleTogglePower,
        });

        const update = (dtSeconds: number) => {
          updateRefs();
          if (!pausedRef.current) {
            stepSimulation(
              sim,
              {
                pausedRef,
                materialTypeRef,
                massRef,
                electricSourceRef,
                temperatureRef,
                timeRef,
                powerOnRef,
              },
              dtSeconds,
            );
          }
          renderer.draw(uiIsPowerOnRef.current, pausedRef.current);
        };

        const destroy = () => {
          renderer.destroy();
          destroySimulation(sim);
        };

        return { update, destroy };
      } catch (error) {
        console.error("Error initializing lab:", error);
        return { update: () => {}, destroy: () => {} };
      }
    },
    [updateRefs, handleTogglePower],
  );

  const handleMaterialChange = (newMaterial: MaterialType) => {
    uiMaterialTypeRef.current = newMaterial;
    materialTypeRef.current = newMaterial;
    handleReset();
  };

  const handleMassChange = (newMass: number) => {
    uiMassRef.current = newMass;
    massRef.current = newMass;
    handleReset();
  };

  const handleVoltageChange = (newVoltage: number) => {
    uiVoltageRef.current = newVoltage;
    electricSourceRef.current = {
      voltage: newVoltage,
      current: uiCurrentRef.current,
      power: newVoltage * uiCurrentRef.current,
    };
    handleReset();
  };

  const handleCurrentChange = (newCurrent: number) => {
    uiCurrentRef.current = newCurrent;
    electricSourceRef.current = {
      voltage: uiVoltageRef.current,
      current: newCurrent,
      power: uiVoltageRef.current * newCurrent,
    };
    handleReset();
  };

  const handleTogglePause = () => {
    uiIsPausedRef.current = !uiIsPausedRef.current;
    pausedRef.current = uiIsPausedRef.current;
    setControlsKey((prev) => prev + 1);
    forceControlsUpdate();
  };

  const handleActualReset = () => {
    if (simulationRef.current) {
      resetSimulation(simulationRef.current);
      temperatureRef.current = 293.15;
      timeRef.current = 0;
    }
    massRef.current = 1.0;
    uiMassRef.current = 1.0;
    materialTypeRef.current = "water";
    uiMaterialTypeRef.current = "water";
    uiVoltageRef.current = 12.0;
    uiCurrentRef.current = 2.0;
    temperatureRef.current = 293.15;
    pausedRef.current = true;
    uiIsPausedRef.current = true;
    powerOnRef.current = false;
    uiIsPowerOnRef.current = false;
    dataRecordsRef.current = [];

    electricSourceRef.current = {
      voltage: 12.0,
      current: 2.0,
      power: 24.0,
    };
    setControlsKey((prev) => prev + 1);
    forceControlsUpdate();
  };

  const handleReset = () => {
    if (simulationRef.current) {
      resetSimulation(simulationRef.current);
      temperatureRef.current = 293.15;
      timeRef.current = 0;
    }
    setControlsKey((prev) => prev + 1);
    forceControlsUpdate();
  };

  const rightPanelWidth = 320;
  const rightPanelInset = 16;
  const chartShift = (rightPanelWidth + rightPanelInset * 2) / 2;

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-black">
      <div className="relative flex-1" ref={containerRef}>
        <div className="absolute inset-0 z-0">
          <BaseLab
            onInit={onInit}
            pausedRef={pausedRef}
            className="h-full w-full bg-transparent"
            shouldPause={false}
          />
        </div>

        {/* Desktop/Tablet: Top-center chart */}
        {!isMobile && (
          <div
            className={`pointer-events-auto absolute top-4 left-1/2 z-20 w-full rounded-2xl border border-slate-700 bg-slate-900/40 p-4 shadow-xl backdrop-blur-md overflow-hidden ${
              isTablet ? "max-w-md" : "max-w-md sm:max-w-lg lg:max-w-xl"
            }`}
            style={{ transform: `translateX(calc(-50% - ${chartShift}px))` }}
          >
            <div className="h-56">
              <TimeTemperatureChart
                temperatureRef={temperatureRef}
                timeRef={timeRef}
              />
            </div>
          </div>
        )}

        {/* Desktop/Tablet: Right panel */}
        {!isMobile && (
          <div
            className="absolute z-20 flex flex-col gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600"
            style={{
              right: rightPanelInset,
              top: 16,
              bottom: 16,
              width: rightPanelWidth,
            }}
          >
            <div className="pointer-events-auto w-full">
              <SpecificHeatControls
                key={controlsKey}
                materialType={uiMaterialTypeRef.current}
                mass={uiMassRef.current}
                voltage={uiVoltageRef.current}
                current={uiCurrentRef.current}
                onMaterialChange={handleMaterialChange}
                onMassChange={handleMassChange}
                onVoltageChange={handleVoltageChange}
                onCurrentChange={handleCurrentChange}
                isPaused={uiIsPausedRef.current}
                onTogglePause={handleTogglePause}
                onReset={handleActualReset}
                isPowerOn={uiIsPowerOnRef.current}
                onTogglePower={handleTogglePower}
                isMobile={false}
                temperatureRef={temperatureRef}
                timeRef={timeRef}
                electricSourceRef={electricSourceRef}
                dataRecordsRef={dataRecordsRef}
                onCollectData={handleCollectData}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Bottom sheet */}
      {isMobile && (
        <div
          className="z-30 flex w-full flex-col gap-3 bg-gray-950/95 px-3 pt-3 text-white shadow-[0_-24px_48px_-28px_rgba(0,0,0,0.65)] backdrop-blur overflow-y-auto"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
            maxHeight: "45%",
          }}
        >
          <SpecificHeatControls
            key={controlsKey}
            materialType={uiMaterialTypeRef.current}
            mass={uiMassRef.current}
            voltage={uiVoltageRef.current}
            current={uiCurrentRef.current}
            onMaterialChange={handleMaterialChange}
            onMassChange={handleMassChange}
            onVoltageChange={handleVoltageChange}
            onCurrentChange={handleCurrentChange}
            isPaused={uiIsPausedRef.current}
            onTogglePause={handleTogglePause}
            onReset={handleActualReset}
            isPowerOn={uiIsPowerOnRef.current}
            onTogglePower={handleTogglePower}
            isMobile={true}
            temperatureRef={temperatureRef}
            timeRef={timeRef}
            electricSourceRef={electricSourceRef}
            dataRecordsRef={dataRecordsRef}
            onCollectData={handleCollectData}
          />
        </div>
      )}
    </div>
  );
}
