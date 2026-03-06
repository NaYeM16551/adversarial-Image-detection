// =====================================================
// Motion Explorer – Simulation Core (Newton's 2nd Law)
// =====================================================

// ---------- Types ----------

export type PlaySubMode = "free" | "investigate_force" | "investigate_mass";

export type SimMode = "guided" | "play" | "challenge";

export interface SimulationState {
  mode: SimMode;
  playSubMode: PlaySubMode;

  // Masses (kg)
  trolleyMass: number;
  hangerMass: number;

  // Friction
  frictionEnabled: boolean;
  frictionCoefficient: number; // μ = 0.2 when enabled

  // Kinematics
  trolleyPosition: number; // m (along the track, 0 = starting line)
  trolleyVelocity: number; // m/s
  trolleyPrevPosition: number; // for Verlet integration
  acceleration: number; // m/s² (computed)

  // Forces
  tension: number; // N
  netForce: number; // N
  hangingWeight: number; // N (m_hanger * g)
  frictionForce: number; // N

  // Track & apparatus geometry (metres)
  trackLength: number;
  startingLinePos: number;
  lightGatePos: number;
  cardWidth: number; // width of the card flag for timing

  // Timing / light gate
  lightGateTriggered: boolean;
  lightGateEntryTime: number; // s
  lightGateExitTime: number; // s
  cardPassTime: number; // s (time for card to pass through gate)
  velocityAtGate: number; // m/s (v = cardWidth / cardPassTime)

  // Simulation control
  isRunning: boolean;
  isPaused: boolean;
  elapsedTime: number; // s (total simulation time)
  hasCompleted: boolean; // true when trolley has passed the light gate and stopped

  // Locked mass for "investigate_force" mode
  lockedTotalMass: number; // kg (default 1.0)

  // Challenge mode (placeholder)
  challenges: ChallengeTask[];
  currentChallengeIndex: number;
  score: number;

  // Guided mode
  guidedStep: number;
  guidedTotalSteps: number;
}

export type MEChallengeType =
  | "calc_acceleration_tension"
  | "find_hanger_mass"
  | "find_trolley_mass"
  | "mcq";

export interface ChallengeTask {
  id: number;
  challengeType: MEChallengeType;
  title: string;
  description: string;
  completed: boolean;
  // Numerical question params (randomized)
  trolleyMass?: number;
  hangerMass?: number;
  frictionEnabled?: boolean;
  // MCQ params
  mcqOptions?: string[];
  mcqCorrectIndex?: number;
  mcqExplanation?: string;
  mcqHint?: string;
  // Optional data table (headers + rows) shown above the question
  dataTable?: { headers: string[]; rows: string[][] };
  // Tolerance for numerical answers
  tolerance: number;
}

// ---------- Physics helpers (for challenge verification) ----------

const G_CONST = 9.81;

export function calcAcceleration(
  trolleyMass: number,
  hangerMass: number,
  frictionEnabled: boolean,
  frictionCoeff = 0.2,
): number {
  const totalMass = trolleyMass + hangerMass;
  const hangingWeight = hangerMass * G_CONST;
  const frictionForce = frictionEnabled
    ? frictionCoeff * trolleyMass * G_CONST
    : 0;
  const netForce = hangingWeight - frictionForce;
  return Math.max(0, netForce / totalMass);
}

export function calcTension(
  trolleyMass: number,
  hangerMass: number,
  frictionEnabled: boolean,
  frictionCoeff = 0.2,
): number {
  const a = calcAcceleration(trolleyMass, hangerMass, frictionEnabled, frictionCoeff);
  return trolleyMass * a + (frictionEnabled ? frictionCoeff * trolleyMass * G_CONST : 0);
}

// ---------- Randomisation helpers ----------

function randInRange(min: number, max: number, step: number): number {
  const steps = Math.round((max - min) / step);
  return min + Math.round(Math.random() * steps) * step;
}

// ---------- Challenge factory ----------

export function createDefaultChallenges(): ChallengeTask[] {
  // Q1 — Calculate acceleration and tension (random masses)
  const q1TrolleyMass = randInRange(0.3, 1.5, 0.1);
  const q1HangerMass = randInRange(0.05, 0.4, 0.05);

  // Q2 — Find hanger mass (given trolley mass, acceleration)
  const q2TrolleyMass = randInRange(0.3, 1.2, 0.1);
  const q2HangerMass = randInRange(0.05, 0.3, 0.05);

  // Q3 — Find trolley mass (given hanger mass, acceleration)
  const q3TrolleyMass = randInRange(0.3, 1.2, 0.1);
  const q3HangerMass = randInRange(0.05, 0.3, 0.05);

  const q2Accel = calcAcceleration(q2TrolleyMass, q2HangerMass, false);
  const q3Accel = calcAcceleration(q3TrolleyMass, q3HangerMass, false);

  return [
    // Q1: Calculate acceleration and tension
    {
      id: 1,
      challengeType: "calc_acceleration_tension",
      title: "Calculate Acceleration & Tension",
      description: `A trolley of mass ${q1TrolleyMass.toFixed(1)} kg is on a frictionless track. A hanger of mass ${q1HangerMass.toFixed(2)} kg is attached via a string over a pulley.\n\nCalculate the acceleration of the system and the tension in the string.\n(Use g = 9.81 m/s²)`,
      trolleyMass: q1TrolleyMass,
      hangerMass: q1HangerMass,
      frictionEnabled: false,
      tolerance: 0.05,
      completed: false,
    },

    // Q2: Find hanger mass
    {
      id: 2,
      challengeType: "find_hanger_mass",
      title: "Find the Hanger Mass",
      description: `A trolley of mass ${q2TrolleyMass.toFixed(1)} kg accelerates at ${q2Accel.toFixed(2)} m/s² on a frictionless track.\n\nWhat is the mass of the hanger?\n(Use g = 9.81 m/s²)`,
      trolleyMass: q2TrolleyMass,
      hangerMass: q2HangerMass,
      frictionEnabled: false,
      tolerance: 0.02,
      completed: false,
    },

    // Q3: Find trolley mass
    {
      id: 3,
      challengeType: "find_trolley_mass",
      title: "Find the Trolley Mass",
      description: `A hanger of mass ${q3HangerMass.toFixed(2)} kg produces an acceleration of ${q3Accel.toFixed(2)} m/s² on a frictionless track.\n\nWhat is the mass of the trolley?\n(Use g = 9.81 m/s²)`,
      trolleyMass: q3TrolleyMass,
      hangerMass: q3HangerMass,
      frictionEnabled: false,
      tolerance: 0.05,
      completed: false,
    },

    // Q4: MCQ — Force-acceleration relationship (data table)
    {
      id: 4,
      challengeType: "mcq",
      title: "Force & Acceleration Relationship",
      description: `A student recorded the following data:\n\nWhat relationship exists between force and acceleration?`,
      dataTable: {
        headers: ["Force (N)", "Acceleration (m/s²)"],
        rows: [
          ["0.2", "0.8"],
          ["0.4", "1.6"],
          ["0.6", "2.4"],
        ],
      },
      mcqOptions: [
        "Acceleration is directly proportional to force",
        "Acceleration is inversely proportional to force",
        "There is no relationship between force and acceleration",
      ],
      mcqCorrectIndex: 0,
      mcqExplanation:
        "Correct! When force doubles, acceleration doubles. This is Newton's Second Law: F = ma. With constant mass, acceleration is directly proportional to force.",
      mcqHint:
        "Look at the data: when force doubles from 0.2 to 0.4, what happens to acceleration?",
      tolerance: 0,
      completed: false,
    },

    // Q5: MCQ — Best graph for force vs acceleration
    {
      id: 5,
      challengeType: "mcq",
      title: "Force vs. Acceleration Graph",
      description:
        "Which graph best represents the relationship between force and acceleration (at constant mass)?",
      mcqOptions: [
        "A straight line through the origin",
        "A horizontal line",
        "A downward curve",
      ],
      mcqCorrectIndex: 0,
      mcqExplanation:
        "Correct! Since F = ma (with constant m), the graph of acceleration against force is a straight line through the origin with gradient 1/m.",
      mcqHint:
        "If acceleration is directly proportional to force, what shape does the graph have?",
      tolerance: 0,
      completed: false,
    },

    // Q6: MCQ — Why total mass must be constant
    {
      id: 6,
      challengeType: "mcq",
      title: "Constant Mass — Why?",
      description:
        "Why must the total mass remain constant when investigating the effect of force on acceleration?",
      mcqOptions: [
        "To ensure that any change in acceleration is caused only by the change in force",
        "Because the experiment doesn't work otherwise",
        "To make the trolley move faster",
      ],
      mcqCorrectIndex: 0,
      mcqExplanation:
        "Correct! This is the principle of a fair test — we only change one variable (force) at a time and keep everything else constant, so we can be sure any change in acceleration is due to the changed force alone.",
      mcqHint:
        "Think about fair testing: if you change two variables at once, can you tell which one caused the effect?",
      tolerance: 0,
      completed: false,
    },

    // Q7: MCQ — Why not add mass to hook during mass investigation
    {
      id: 7,
      challengeType: "mcq",
      title: "Mass Investigation — The Hook",
      description:
        "Why must masses NOT be added to the hook (hanger) during the mass investigation?",
      mcqOptions: [
        "Because adding mass to the hook would also change the driving force",
        "Because the hook cannot hold extra mass",
        "Because the string would break",
      ],
      mcqCorrectIndex: 0,
      mcqExplanation:
        "Correct! The driving force comes from the weight of the hanger (F = m_hanger × g). Adding mass to the hanger increases the force, which means you'd be changing TWO variables — mass and force — making the experiment unfair.",
      mcqHint:
        "What provides the driving force in this experiment? What happens to that force if you add mass to the hanger?",
      tolerance: 0,
      completed: false,
    },
  ];
}

// ---------- Constants ----------

const G = 9.81; // m/s²
const DEFAULT_TROLLEY_MASS = 0.5; // kg
const DEFAULT_HANGER_MASS = 0.1; // kg
const DEFAULT_FRICTION_COEFF = 0.2;
const LOCKED_TOTAL_MASS = 1.0; // kg for investigate_force mode
const TRACK_LENGTH = 1.2; // m
const STARTING_LINE_POS = 0.0; // m
const LIGHT_GATE_POS = 0.8; // m
const CARD_WIDTH = 0.05; // m (5 cm card)
const TIME_SCALE = 0.25; // slow down simulation to ~1/8 real-time for student-friendly viewing
const STOP_POSITION = LIGHT_GATE_POS + 0.25; // m — stop 12cm past light gate; tweak this to adjust where trolley halts

// ---------- Factory ----------

export function createSimulation(): SimulationState {
  const trolleyMass = DEFAULT_TROLLEY_MASS;
  const hangerMass = DEFAULT_HANGER_MASS;

  const state: SimulationState = {
    mode: "guided",
    playSubMode: "free",

    trolleyMass,
    hangerMass,

    frictionEnabled: false,
    frictionCoefficient: DEFAULT_FRICTION_COEFF,

    trolleyPosition: 0,
    trolleyVelocity: 0,
    trolleyPrevPosition: 0,
    acceleration: 0,

    tension: 0,
    netForce: 0,
    hangingWeight: 0,
    frictionForce: 0,

    trackLength: TRACK_LENGTH,
    startingLinePos: STARTING_LINE_POS,
    lightGatePos: LIGHT_GATE_POS,
    cardWidth: CARD_WIDTH,

    lightGateTriggered: false,
    lightGateEntryTime: 0,
    lightGateExitTime: 0,
    cardPassTime: 0,
    velocityAtGate: 0,

    isRunning: false,
    isPaused: true,
    elapsedTime: 0,
    hasCompleted: false,

    lockedTotalMass: LOCKED_TOTAL_MASS,

    challenges: createDefaultChallenges(),
    currentChallengeIndex: 0,
    score: 0,

    guidedStep: 0,
    guidedTotalSteps: 12,
  };

  recalculateForces(state);
  return state;
}

// ---------- Physics ----------

export function recalculateForces(sim: SimulationState): void {
  const mT = sim.trolleyMass;
  const mH = sim.hangerMass;
  const totalMass = mT + mH;

  sim.hangingWeight = mH * G;

  // Friction force (only on trolley on the horizontal track)
  sim.frictionForce = sim.frictionEnabled
    ? sim.frictionCoefficient * mT * G
    : 0;

  // Net force on the system: driving force (hanging weight) minus friction
  sim.netForce = sim.hangingWeight - sim.frictionForce;

  // Prevent negative net force from pulling trolley backwards
  if (sim.netForce < 0) sim.netForce = 0;

  // Acceleration (F = ma for the entire system)
  sim.acceleration = totalMass > 0 ? sim.netForce / totalMass : 0;

  // Tension in the string: T = m_hanger * (g - a)
  sim.tension = mH * (G - sim.acceleration);
  if (sim.tension < 0) sim.tension = 0;
}

/**
 * Step the simulation forward using Störmer–Verlet integration.
 * x(t+dt) = 2*x(t) - x(t-dt) + a*dt²
 * v(t) ≈ (x(t+dt) - x(t-dt)) / (2*dt)
 */
export function stepSimulation(sim: SimulationState, dt: number): void {
  if (sim.isPaused || !sim.isRunning || sim.hasCompleted) return;
  if (dt <= 0) return;

  // Apply time scale to slow down the simulation for better student viewing
  const scaledDt = dt * TIME_SCALE;
  sim.elapsedTime += scaledDt;

  // Recalculate forces each step
  recalculateForces(sim);

  const a = sim.acceleration;

  // Verlet integration (using scaled time step)
  const currentPos = sim.trolleyPosition;
  const prevPos = sim.trolleyPrevPosition;
  const newPos = 2 * currentPos - prevPos + a * scaledDt * scaledDt;
  const newVel = (newPos - prevPos) / (2 * scaledDt);

  sim.trolleyPrevPosition = currentPos;
  sim.trolleyPosition = newPos;
  sim.trolleyVelocity = Math.max(0, newVel);

  // --- Light gate detection ---
  const trolleyFrontEdge = sim.trolleyPosition;
  const cardTrailingEdge = trolleyFrontEdge - sim.cardWidth;

  // Card entering the light gate
  if (!sim.lightGateTriggered && trolleyFrontEdge >= sim.lightGatePos) {
    sim.lightGateTriggered = true;
    sim.lightGateEntryTime = sim.elapsedTime;
  }

  // Card exited the light gate (trailing edge passed through)
  if (
    sim.lightGateTriggered &&
    sim.lightGateExitTime === 0 &&
    cardTrailingEdge >= sim.lightGatePos
  ) {
    sim.lightGateExitTime = sim.elapsedTime;
    sim.cardPassTime = sim.lightGateExitTime - sim.lightGateEntryTime;
    sim.velocityAtGate =
      sim.cardPassTime > 0 ? sim.cardWidth / sim.cardPassTime : 0;
  }

  // Stop trolley just past the light gate (not at the pulley/end of ramp)
  if (sim.trolleyPosition >= STOP_POSITION) {
    sim.isRunning = false;
    sim.hasCompleted = true;
    sim.trolleyPosition = STOP_POSITION;
    sim.trolleyVelocity = 0;
  }
}

// ---------- Simulation lifecycle ----------

export function startSimulation(sim: SimulationState): void {
  if (sim.hasCompleted) {
    // Reset position but keep masses
    sim.trolleyPosition = 0;
    sim.trolleyPrevPosition = 0;
    sim.trolleyVelocity = 0;
    sim.elapsedTime = 0;
    sim.lightGateTriggered = false;
    sim.lightGateEntryTime = 0;
    sim.lightGateExitTime = 0;
    sim.cardPassTime = 0;
    sim.velocityAtGate = 0;
    sim.hasCompleted = false;
  }
  sim.isRunning = true;
  sim.isPaused = false;
  recalculateForces(sim);
}

export function pauseSimulation(sim: SimulationState): void {
  sim.isPaused = true;
}

export function resumeSimulation(sim: SimulationState): void {
  sim.isPaused = false;
}

export function resetSimulation(sim: SimulationState): void {
  sim.trolleyPosition = 0;
  sim.trolleyPrevPosition = 0;
  sim.trolleyVelocity = 0;
  sim.acceleration = 0;
  sim.elapsedTime = 0;
  sim.isRunning = false;
  sim.isPaused = true;
  sim.hasCompleted = false;

  sim.lightGateTriggered = false;
  sim.lightGateEntryTime = 0;
  sim.lightGateExitTime = 0;
  sim.cardPassTime = 0;
  sim.velocityAtGate = 0;

  recalculateForces(sim);
}

export function fullReset(sim: SimulationState): void {
  sim.trolleyMass = DEFAULT_TROLLEY_MASS;
  sim.hangerMass = DEFAULT_HANGER_MASS;
  sim.frictionEnabled = false;
  sim.playSubMode = "free";
  resetSimulation(sim);
}

// ---------- Mass management ----------

export function setTrolleyMass(sim: SimulationState, mass: number): void {
  sim.trolleyMass = Math.max(0.05, Math.min(2.0, mass));
  recalculateForces(sim);
}

export function setHangerMass(sim: SimulationState, mass: number): void {
  sim.hangerMass = Math.max(0.01, Math.min(1.0, mass));
  recalculateForces(sim);
}

/**
 * Transfer mass between trolley and hanger (for investigate_force mode).
 * Positive amount = trolley → hanger, Negative amount = hanger → trolley.
 * Total mass remains locked at lockedTotalMass.
 */
export function transferMass(sim: SimulationState, amount: number): void {
  const newHangerMass = sim.hangerMass + amount;
  const newTrolleyMass = sim.lockedTotalMass - newHangerMass;

  // Enforce minimums
  if (newHangerMass < 0.01 || newTrolleyMass < 0.05) return;

  sim.hangerMass = newHangerMass;
  sim.trolleyMass = newTrolleyMass;
  recalculateForces(sim);
}

/**
 * Set masses for investigate_force mode (total = lockedTotalMass).
 */
export function setInvestigateForceHangerMass(
  sim: SimulationState,
  hangerMass: number,
): void {
  const clamped = Math.max(
    0.01,
    Math.min(sim.lockedTotalMass - 0.05, hangerMass),
  );
  sim.hangerMass = clamped;
  sim.trolleyMass = sim.lockedTotalMass - clamped;
  recalculateForces(sim);
}

export function setFriction(sim: SimulationState, enabled: boolean): void {
  sim.frictionEnabled = enabled;
  recalculateForces(sim);
}

export function setPlaySubMode(
  sim: SimulationState,
  subMode: PlaySubMode,
): void {
  sim.playSubMode = subMode;

  if (subMode === "investigate_force") {
    // Lock total mass and redistribute
    const total = sim.lockedTotalMass;
    sim.trolleyMass = total - sim.hangerMass;
    if (sim.trolleyMass < 0.05) {
      sim.trolleyMass = 0.05;
      sim.hangerMass = total - 0.05;
    }
  }

  resetSimulation(sim);
}

// ---------- Data Collection ----------

export type MEDataRecord = {
  trolleyMass: number; // kg
  hangerMass: number; // kg
  acceleration: number; // m/s²
  tension: number; // N (string tension)
  timestamp: number; // Date.now()
};

/**
 * Collect current simulation data for the data table.
 */
export function collectMEData(sim: SimulationState): MEDataRecord {
  return {
    trolleyMass: sim.trolleyMass,
    hangerMass: sim.hangerMass,
    acceleration: sim.acceleration,
    tension: sim.tension,
    timestamp: Date.now(),
  };
}

export function destroySimulation(): void {
  // Cleanup if needed
}
