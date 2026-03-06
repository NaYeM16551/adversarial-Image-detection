"use client";

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  createSimulation,
  stepSimulation,
  resetSimulation,
  fullReset,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  setTrolleyMass,
  setHangerMass,
  setFriction,
  setPlaySubMode,
  transferMass,
  collectMEData,
  createDefaultChallenges,
  // setInvestigateForceHangerMass,
  // recalculateForces,
  type SimulationState,
  type SimMode,
  type PlaySubMode,
  type MEDataRecord,
} from "../simulation-logic/simulation";
import { GUIDED_STEPS } from "../simulation-logic/guidedSteps";
import ApparatusSVG from "../graphics/ApparatusSVG";
import MEControls from "./MEControls";
import MEResultsPanel from "./MEResultsPanel";
import GuidedOverlay from "./GuidedOverlay";
import ChallengeOverlay from "./ChallengeOverlay";
import MEDataCollectionTable from "./MEDataCollectionTable";

/**
 * Motion Explorer - Main Component
 *
 * Architecture (follows state_transformation_sim pattern):
 * - Physics runs at 60Hz via fixed timestep (in animation loop)
 * - SVG rendering updates every frame via ref (no React re-render)
 * - Controls only re-render when user interacts
 * - Container/layout re-renders only on resize
 */
export default function MotionExplorerLab() {
  const simulationRef = useRef<SimulationState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const svgUpdateRef = useRef<(() => void) | null>(null);
  const prevHasCompletedRef = useRef<boolean>(false);
  const dataRecordsRef = useRef<MEDataRecord[]>([]);

  // Layout state
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchTablet, setIsTouchTablet] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Controls re-render trigger
  const [controlsVersion, forceControlsUpdate] = useReducer(
    (x: number) => x + 1,
    0,
  );

  // Mode state (needs React state for conditional rendering)
  const [mode, setMode] = useState<SimMode>("guided");
  const [playSubMode, setPlaySubModeState] = useState<PlaySubMode>("free");
  const [guidedStep, setGuidedStep] = useState(0);
  const [transferAmount, setTransferAmount] = useState(0.05);
  const [challengeIndex, setChallengeIndex] = useState(0);

  const currentGuidedStep = GUIDED_STEPS[guidedStep] ?? GUIDED_STEPS[0];
  const guidedHighlightId =
    mode === "guided" ? currentGuidedStep.targetId : null;

  const currentChallenge =
    simulationRef.current?.challenges?.[challengeIndex] ?? null;

  // Register SVG update function
  const registerSvgUpdate = useCallback((updateFn: () => void) => {
    svgUpdateRef.current = updateFn;
  }, []);

  // Initialize simulation
  useEffect(() => {
    const sim = createSimulation();
    simulationRef.current = sim;
    setIsReady(true);
  }, []);

  // Animation loop — fixed timestep physics + SVG update
  useEffect(() => {
    let accumulator = 0;
    const fixedDt = 1 / 60;
    let lastControlsUpdate = 0;
    const controlsUpdateInterval = 100;

    const animate = (time: number) => {
      if (!simulationRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const frameDt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;
      accumulator += frameDt;

      let physicsUpdated = false;
      while (accumulator >= fixedDt) {
        stepSimulation(simulationRef.current, fixedDt);
        accumulator -= fixedDt;
        physicsUpdated = true;
      }

      // Check if simulation auto-completed
      if (
        simulationRef.current.hasCompleted &&
        simulationRef.current.isRunning === false
      ) {
        // Force controls update to show "completed" state
        forceControlsUpdate();
      }

      // Always update SVG every frame — ensures mass stack, string etc.
      // update immediately when sliders are changed, even when sim is paused.
      if (svgUpdateRef.current) {
        svgUpdateRef.current();
      }

      if (time - lastControlsUpdate > controlsUpdateInterval) {
        forceControlsUpdate();
        lastControlsUpdate = time;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Auto-advance guided step when simulation completes
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    const checkCompletion = () => {
      if (
        mode === "guided" &&
        sim.hasCompleted &&
        !prevHasCompletedRef.current
      ) {
        // Simulation just completed — advance if current step has waitForCompletion
        const step = GUIDED_STEPS[guidedStep];
        if (step?.waitForCompletion) {
          if (guidedStep < GUIDED_STEPS.length - 1) {
            setGuidedStep((s) => s + 1);
          }
        }
      }
      prevHasCompletedRef.current = sim.hasCompleted;
    };

    // Check on every render
    checkCompletion();
  });

  // Responsive sizing (from state_transformation_sim)
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const updateSize = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      // Detect touch tablets (iPad, etc.) - touch devices >= 768px
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchTablet(isTouchDevice && w >= 768);
    };

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateSize, 100);
    };

    updateSize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // ── Handlers ──

  const handleModeChange = useCallback((newMode: SimMode) => {
    setMode(newMode);
    const sim = simulationRef.current;
    if (!sim) return;

    sim.mode = newMode;

    // Clear data collection table when switching modes
    dataRecordsRef.current = [];

    if (newMode === "guided") {
      setGuidedStep(0);
      fullReset(sim);
      forceControlsUpdate();
    }
    if (newMode === "play") {
      fullReset(sim);
      setPlaySubModeState("free");
      forceControlsUpdate();
    }
    if (newMode === "challenge") {
      fullReset(sim);
      // Regenerate challenges with fresh random values each time
      sim.challenges = createDefaultChallenges();
      sim.currentChallengeIndex = 0;
      sim.score = 0;
      setChallengeIndex(0);
      forceControlsUpdate();
    }
  }, []);

  const advanceGuidedIfTarget = useCallback(
    (targetId: string) => {
      if (mode !== "guided") return;
      const step = GUIDED_STEPS[guidedStep];
      if (step && step.targetId === targetId) {
        if (guidedStep < GUIDED_STEPS.length - 1) {
          setGuidedStep((s) => s + 1);
        } else {
          handleModeChange("play");
        }
      }
    },
    [mode, guidedStep, handleModeChange],
  );

  const handleSubModeChange = useCallback(
    (subMode: PlaySubMode) => {
      setPlaySubModeState(subMode);
      const sim = simulationRef.current;
      if (sim) {
        setPlaySubMode(sim, subMode);
        forceControlsUpdate();
      }
      advanceGuidedIfTarget(`submode-${subMode}`);
    },
    [advanceGuidedIfTarget],
  );

  const handleTrolleyMassChange = useCallback(
    (mass: number) => {
      const sim = simulationRef.current;
      if (sim) {
        setTrolleyMass(sim, mass);
        forceControlsUpdate();
      }
      advanceGuidedIfTarget("trolley-mass-slider");
    },
    [advanceGuidedIfTarget],
  );

  const handleHangerMassChange = useCallback(
    (mass: number) => {
      const sim = simulationRef.current;
      if (sim) {
        setHangerMass(sim, mass);
        forceControlsUpdate();
      }
      advanceGuidedIfTarget("hanger-mass-slider");
    },
    [advanceGuidedIfTarget],
  );

  const handleFrictionToggle = useCallback(() => {
    const sim = simulationRef.current;
    if (sim) {
      setFriction(sim, !sim.frictionEnabled);
      forceControlsUpdate();
    }
    advanceGuidedIfTarget("friction-toggle");
  }, [advanceGuidedIfTarget]);

  const handleStart = useCallback(() => {
    const sim = simulationRef.current;
    if (sim) {
      startSimulation(sim);
      forceControlsUpdate();
    }
    // Don't advance immediately if this step waits for simulation completion
    const step = GUIDED_STEPS[guidedStep];
    if (!(mode === "guided" && step?.waitForCompletion)) {
      advanceGuidedIfTarget("start-btn");
    }
  }, [advanceGuidedIfTarget, mode, guidedStep]);

  const handlePause = useCallback(() => {
    const sim = simulationRef.current;
    if (sim) {
      pauseSimulation(sim);
      forceControlsUpdate();
    }
  }, []);

  const handleResume = useCallback(() => {
    const sim = simulationRef.current;
    if (sim) {
      resumeSimulation(sim);
      forceControlsUpdate();
    }
  }, []);

  const handleReset = useCallback(() => {
    const sim = simulationRef.current;
    if (sim) {
      resetSimulation(sim);
      forceControlsUpdate();
    }
    // Clear data collection table
    dataRecordsRef.current = [];
    advanceGuidedIfTarget("reset-btn");
  }, [advanceGuidedIfTarget]);

  const handleTransferToHanger = useCallback(() => {
    const sim = simulationRef.current;
    if (sim) {
      transferMass(sim, transferAmount);
      forceControlsUpdate();
    }
    advanceGuidedIfTarget("transfer-to-hanger-btn");
  }, [transferAmount, advanceGuidedIfTarget]);

  const handleTransferToTrolley = useCallback(() => {
    const sim = simulationRef.current;
    if (sim) {
      transferMass(sim, -transferAmount);
      forceControlsUpdate();
    }
    advanceGuidedIfTarget("transfer-to-trolley-btn");
  }, [transferAmount, advanceGuidedIfTarget]);

  // Data collection handler
  const handleCollectData = useCallback((): MEDataRecord | null => {
    const sim = simulationRef.current;
    if (!sim) return null;

    const newRecord = collectMEData(sim);
    dataRecordsRef.current.push(newRecord);
    advanceGuidedIfTarget("collect-btn");

    return newRecord;
  }, [advanceGuidedIfTarget]);

  // Guided mode handlers
  const handleGuidedContinue = useCallback(() => {
    if (guidedStep < GUIDED_STEPS.length - 1) {
      setGuidedStep((s) => s + 1);
    } else {
      handleModeChange("play");
    }
  }, [guidedStep, handleModeChange]);

  const handleGuidedBack = useCallback(() => {
    setGuidedStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleGuidedExit = useCallback(() => {
    handleModeChange("play");
  }, [handleModeChange]);

  const handleChallengeExit = useCallback(() => {
    handleModeChange("play");
  }, [handleModeChange]);

  const handleChallengeNext = useCallback(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    // Mark current challenge as completed and increment score
    if (sim.challenges[challengeIndex]) {
      sim.challenges[challengeIndex].completed = true;
      sim.score += 1;
    }

    const nextIdx = challengeIndex + 1;
    if (nextIdx < sim.challenges.length) {
      sim.currentChallengeIndex = nextIdx;
      setChallengeIndex(nextIdx);
    } else {
      // All done
      handleModeChange("play");
    }
  }, [challengeIndex, handleModeChange]);

  const handleChallengeBack = useCallback(() => {
    if (challengeIndex > 0) {
      const prevIdx = challengeIndex - 1;
      setChallengeIndex(prevIdx);
      const sim = simulationRef.current;
      if (sim) sim.currentChallengeIndex = prevIdx;
    }
  }, [challengeIndex]);

  const sim = simulationRef.current;

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-black">
      <div className="relative flex-1" ref={containerRef}>
        {/* SVG Simulation */}
        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full max-w-[900px] max-h-[800px] p-4">
              <ApparatusSVG
                simulationRef={simulationRef}
                isMobile={isMobile || isTouchTablet}
                registerUpdate={registerSvgUpdate}
                hangerMass={sim?.hangerMass}
              />
            </div>
          </div>
        )}

        {/* Guided mode overlay - Desktop positioning */}
        {mode === "guided" && !isTouchTablet && (
          <GuidedOverlay
            step={currentGuidedStep}
            currentIndex={guidedStep}
            totalSteps={GUIDED_STEPS.length}
            onContinue={handleGuidedContinue}
            onBack={handleGuidedBack}
            onExit={handleGuidedExit}
          />
        )}

        {/* iPad: Guided overlay - Top Center */}
        {mode === "guided" && isTouchTablet && (
          <div
            className="absolute z-30 flex justify-center px-4"
            style={{ left: 0, right: 0, top: 16 }}
          >
            <div style={{ maxWidth: 500, width: "100%" }}>
              <GuidedOverlay
                step={currentGuidedStep}
                currentIndex={guidedStep}
                totalSteps={GUIDED_STEPS.length}
                onContinue={handleGuidedContinue}
                onBack={handleGuidedBack}
                onExit={handleGuidedExit}
                inline
              />
            </div>
          </div>
        )}

        {/* Desktop: Data Table - Top Left (hidden in challenge mode) */}
        {!isMobile && !isTouchTablet && isReady && mode !== "challenge" && (
          <div
            className="absolute z-20 flex flex-col gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600"
            style={{
              left: 16,
              top: 16,
              width: 340,
              maxHeight: "calc(100vh - 32px)",
            }}
          >
            <div className="pointer-events-auto">
              <MEDataCollectionTable
                dataRecordsRef={dataRecordsRef}
                onCollectData={handleCollectData}
                isMobile={false}
                highlightId={guidedHighlightId}
              />
            </div>
          </div>
        )}

        {/* Desktop: Controls + Results - Right Side */}
        {!isMobile && !isTouchTablet && isReady && (
          <div
            className="absolute z-20 flex flex-col gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600"
            style={{
              right: 16,
              top: 16,
              bottom: 16,
              width: 302,
            }}
          >
            <div className="pointer-events-auto">
              <MEControls
                mode={mode}
                playSubMode={playSubMode}
                trolleyMass={sim?.trolleyMass ?? 0.5}
                hangerMass={sim?.hangerMass ?? 0.1}
                frictionEnabled={sim?.frictionEnabled ?? false}
                isRunning={sim?.isRunning ?? false}
                isPaused={sim?.isPaused ?? true}
                hasCompleted={sim?.hasCompleted ?? false}
                highlightId={guidedHighlightId}
                lockedTotalMass={sim?.lockedTotalMass ?? 1.0}
                transferAmount={transferAmount}
                onModeChange={handleModeChange}
                onSubModeChange={handleSubModeChange}
                onTrolleyMassChange={handleTrolleyMassChange}
                onHangerMassChange={handleHangerMassChange}
                onFrictionToggle={handleFrictionToggle}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onReset={handleReset}
                onTransferToHanger={handleTransferToHanger}
                onTransferToTrolley={handleTransferToTrolley}
                onTransferAmountChange={setTransferAmount}
              />
            </div>

            {mode !== "challenge" && (
            <div className="pointer-events-auto">
              <MEResultsPanel
                simulationRef={simulationRef}
                _renderTrigger={controlsVersion}
              />
            </div>
            )}

            {/* Challenge overlay */}
            {mode === "challenge" && currentChallenge && (
              <div className="pointer-events-auto">
                <ChallengeOverlay
                  challenge={currentChallenge}
                  challengeIndex={challengeIndex}
                  totalChallenges={sim?.challenges.length ?? 7}
                  onNext={handleChallengeNext}
                  onBack={handleChallengeBack}
                  onExit={handleChallengeExit}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* iPad/Mobile: Controls Panel - Bottom Sheet */}
      {(isMobile || isTouchTablet) && isReady && (
        <div
          className="absolute z-20 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600"
          style={{
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: isTouchTablet ? "50%" : "45%",
            backgroundColor: "rgba(26, 26, 26, 0.95)",
            borderTop: "1px solid #3389AD40",
          }}
        >
          {/* iPad: Two-column layout */}
          {isTouchTablet ? (
            <div className="grid grid-cols-2 gap-4 p-4">
              {/* Left Column: Controls */}
              <div className="flex flex-col gap-3">
                <MEControls
                  mode={mode}
                  playSubMode={playSubMode}
                  trolleyMass={sim?.trolleyMass ?? 0.5}
                  hangerMass={sim?.hangerMass ?? 0.1}
                  frictionEnabled={sim?.frictionEnabled ?? false}
                  isRunning={sim?.isRunning ?? false}
                  isPaused={sim?.isPaused ?? true}
                  hasCompleted={sim?.hasCompleted ?? false}
                  isMobile={false}
                  highlightId={guidedHighlightId}
                  lockedTotalMass={sim?.lockedTotalMass ?? 1.0}
                  transferAmount={transferAmount}
                  onModeChange={handleModeChange}
                  onSubModeChange={handleSubModeChange}
                  onTrolleyMassChange={handleTrolleyMassChange}
                  onHangerMassChange={handleHangerMassChange}
                  onFrictionToggle={handleFrictionToggle}
                  onStart={handleStart}
                  onPause={handlePause}
                  onResume={handleResume}
                  onReset={handleReset}
                  onTransferToHanger={handleTransferToHanger}
                  onTransferToTrolley={handleTransferToTrolley}
                  onTransferAmountChange={setTransferAmount}
                />
              </div>

              {/* Right Column: Results or Challenge */}
              <div className="flex flex-col gap-3">
                {mode !== "challenge" ? (
                  <>
                    <MEResultsPanel
                      simulationRef={simulationRef}
                      isMobile={false}
                      _renderTrigger={controlsVersion}
                    />
                    <MEDataCollectionTable
                      dataRecordsRef={dataRecordsRef}
                      onCollectData={handleCollectData}
                      isMobile={false}
                      highlightId={guidedHighlightId}
                    />
                  </>
                ) : (
                  currentChallenge && (
                    <ChallengeOverlay
                      challenge={currentChallenge}
                      challengeIndex={challengeIndex}
                      totalChallenges={sim?.challenges.length ?? 7}
                      onNext={handleChallengeNext}
                      onBack={handleChallengeBack}
                      onExit={handleChallengeExit}
                    />
                  )
                )}
              </div>
            </div>
          ) : (
            /* Mobile: Single-column layout */
            <div className="flex flex-col gap-2 px-4 pb-4">
              <div className="pt-3">
                <MEControls
                  mode={mode}
                  playSubMode={playSubMode}
                  trolleyMass={sim?.trolleyMass ?? 0.5}
                  hangerMass={sim?.hangerMass ?? 0.1}
                  frictionEnabled={sim?.frictionEnabled ?? false}
                  isRunning={sim?.isRunning ?? false}
                  isPaused={sim?.isPaused ?? true}
                  hasCompleted={sim?.hasCompleted ?? false}
                  isMobile={true}
                  highlightId={guidedHighlightId}
                  lockedTotalMass={sim?.lockedTotalMass ?? 1.0}
                  transferAmount={transferAmount}
                  onModeChange={handleModeChange}
                  onSubModeChange={handleSubModeChange}
                  onTrolleyMassChange={handleTrolleyMassChange}
                  onHangerMassChange={handleHangerMassChange}
                  onFrictionToggle={handleFrictionToggle}
                  onStart={handleStart}
                  onPause={handlePause}
                  onResume={handleResume}
                  onReset={handleReset}
                  onTransferToHanger={handleTransferToHanger}
                  onTransferToTrolley={handleTransferToTrolley}
                  onTransferAmountChange={setTransferAmount}
                />
              </div>
              {mode !== "challenge" && (
                <>
                  <MEResultsPanel
                    simulationRef={simulationRef}
                    isMobile={true}
                    _renderTrigger={controlsVersion}
                  />
                  <MEDataCollectionTable
                    dataRecordsRef={dataRecordsRef}
                    onCollectData={handleCollectData}
                    isMobile={true}
                    highlightId={guidedHighlightId}
                  />
                </>
              )}
              {mode === "challenge" && currentChallenge && (
                <div className="pointer-events-auto pt-2">
                  <ChallengeOverlay
                    challenge={currentChallenge}
                    challengeIndex={challengeIndex}
                    totalChallenges={sim?.challenges.length ?? 7}
                    onNext={handleChallengeNext}
                    onBack={handleChallengeBack}
                    onExit={handleChallengeExit}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
