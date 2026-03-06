// =====================================================
// Interactive Guided Steps — Motion Explorer
// =====================================================

export type GuidedStep = {
  id: number;
  targetId: string | null; // data-guide-id of the element to highlight; null = observation/welcome step
  title: string;
  description: string;
  actionHint: string;
  emoji: string;
  isObservation: boolean; // if true, show a "Continue" button to advance; otherwise wait for the target click
  waitForCompletion?: boolean; // if true, don't advance until simulation completes
};

export const GUIDED_STEPS: GuidedStep[] = [
  // ── 0  Welcome ──
  {
    id: 0,
    targetId: null,
    title: "Welcome, Explorer! 🚀",
    description:
      "Welcome to the Motion Explorer! You'll investigate how mass and force affect acceleration — the heart of Newton's Second Law. Let's begin!",
    actionHint: "Click Continue to start your journey",
    emoji: "🚀",
    isObservation: false,
  },

  // ── 1  Switch to Investigate Effect of Mass ──
  {
    id: 1,
    targetId: "submode-investigate_mass",
    title: "Investigate Effect of Mass",
    description:
      "Let's start by investigating how the trolley's mass affects its acceleration. Click 'Investigate Effect of Mass' to begin.",
    actionHint: "Click 'Investigate Effect of Mass'",
    emoji: "⚖️",
    isObservation: false,
  },

  // ── 2  Start the simulation ──
  {
    id: 2,
    targetId: "start-btn",
    title: "Start the Experiment ▶️",
    description:
      "Press Start to release the trolley. The hanger mass will pull it along the track through the light gate.",
    actionHint: "Click 'Start'",
    emoji: "▶️",
    isObservation: false,
    waitForCompletion: true,
  },

  // ── 3  Change the trolley mass ──
  {
    id: 3,
    targetId: "trolley-mass-slider",
    title: "Change Trolley Mass",
    description:
      "Now let's add mass to the trolley. Drag the Trolley Mass slider to increase it.",
    actionHint: "Drag the Trolley Mass slider",
    emoji: "🏋️",
    isObservation: false,
  },

  // ── 4  Observation — mass vs acceleration ──
  {
    id: 4,
    targetId: null,
    title: "Observation 🔍",
    description:
      "Adding mass to the trolley makes the whole system heavier, so acceleration decreases. This is consistent with Newton's Second Law: F = ma. If F stays the same but m increases, then a must decrease!",
    actionHint: "Click Continue",
    emoji: "🔍",
    isObservation: false,
  },

  // ── 5  Collect Data ──
  {
    id: 5,
    targetId: "collect-btn",
    title: "Record Your Data 📋",
    description:
      "Great observation! Now record the current measurements in the data table. Click 'Collect Data' to save this reading.",
    actionHint: "Click 'Collect Data'",
    emoji: "📋",
    isObservation: false,
  },

  // ── 6  Reset ──
  {
    id: 6,
    targetId: "reset-btn",
    title: "Reset the Experiment 🔄",
    description: "Now let's reset and explore how force affects acceleration.",
    actionHint: "Click 'Reset'",
    emoji: "🔄",
    isObservation: false,
  },

  // ── 7  Switch to Investigate Effect of Force ──
  {
    id: 7,
    targetId: "submode-investigate_force",
    title: "Investigate Effect of Force",
    description:
      "Now let's investigate how changing the driving force (hanger weight) affects acceleration while keeping the total system mass constant.",
    actionHint: "Click 'Investigate Effect of Force'",
    emoji: "💪",
    isObservation: false,
  },

  // ── 8  Start again ──
  {
    id: 8,
    targetId: "start-btn",
    title: "Start the Experiment ▶️",
    description:
      "Press Start to run the experiment with the current force distribution.",
    actionHint: "Click 'Start'",
    emoji: "▶️",
    isObservation: false,
    waitForCompletion: true,
  },

  // ── 9  Transfer mass to hanger ──
  {
    id: 9,
    targetId: "transfer-to-hanger-btn",
    title: "Transfer Mass → Hanger",
    description:
      "Move some mass from the trolley to the hanger. This increases the driving force (hanging weight) while keeping total mass the same.",
    actionHint: "Click '→ To Hanger'",
    emoji: "⬇️",
    isObservation: false,
  },

  // ── 10  Observation — force vs acceleration ──
  {
    id: 10,
    targetId: null,
    title: "Observation 🔍",
    description:
      "When you transfer mass from the trolley to the hanger, the hanging weight (F = m·g) increases — so the net driving force goes up. Since total mass stays the same, a = F/m tells us acceleration must increase! Newton's Second Law in action.",
    actionHint: "Click Continue",
    emoji: "📈",
    isObservation: false,
  },

  // ── 11  Collect Data ──
  {
    id: 11,
    targetId: "collect-btn",
    title: "Record Your Data 📋",
    description:
      "Record this force experiment reading in the data table before moving on.",
    actionHint: "Click 'Collect Data'",
    emoji: "📋",
    isObservation: false,
  },

  // ── 12  Reset ──
  {
    id: 12,
    targetId: "reset-btn",
    title: "Reset 🔄",
    description: "Reset the experiment before exploring free mode.",
    actionHint: "Click 'Reset'",
    emoji: "🔄",
    isObservation: false,
  },

  // ── 13  Switch to Free Mode ──
  {
    id: 13,
    targetId: "submode-free",
    title: "Free Exploration Mode 🎮",
    description:
      "In Free Exploration mode, you can change anything you like — trolley mass, hanger mass, friction — and observe the results. Let's try it!",
    actionHint: "Click 'Free Exploration'",
    emoji: "🎮",
    isObservation: false,
  },

  // ── 14  Change trolley mass ──
  {
    id: 14,
    targetId: "trolley-mass-slider",
    title: "Set Trolley Mass",
    description: "Try setting a trolley mass of your choice.",
    actionHint: "Drag the Trolley Mass slider",
    emoji: "⚙️",
    isObservation: false,
  },

  // ── 15  Change hanger mass ──
  {
    id: 15,
    targetId: "hanger-mass-slider",
    title: "Set Hanger Mass",
    description:
      "Now adjust the hanger mass. A heavier hanger means a larger driving force.",
    actionHint: "Drag the Hanger Mass slider",
    emoji: "⚙️",
    isObservation: false,
  },

  // ── 16  Start ──
  {
    id: 16,
    targetId: "start-btn",
    title: "Run It! ▶️",
    description: "Let's see how your chosen masses behave!",
    actionHint: "Click 'Start'",
    emoji: "▶️",
    isObservation: false,
    waitForCompletion: true,
  },

  // ── 17  Enable friction ──
  {
    id: 17,
    targetId: "friction-toggle",
    title: "Enable Friction 🧊",
    description:
      "Now enable friction to see how it affects the motion. In real experiments, friction is always present!",
    actionHint: "Click 'Enable Friction'",
    emoji: "🧊",
    isObservation: false,
  },

  // ── 18  Observation — friction ──
  {
    id: 18,
    targetId: null,
    title: "Observation 🔍",
    description:
      "With friction enabled (μ = 0.2), the friction force opposes motion and reduces the net force on the system. Since F_net = F_driving − F_friction, the acceleration decreases. Again, Newton's Second Law: smaller net force → smaller acceleration!",
    actionHint: "Click Continue",
    emoji: "📉",
    isObservation: false,
  },

  // ── 19  Final reset & done ──
  {
    id: 19,
    targetId: "reset-btn",
    title: "All Done! 🎉",
    description:
      "Excellent work! You've explored how mass, force, and friction all affect acceleration through Newton's Second Law. Click Reset, then Exit to enter Play mode and experiment freely!",
    actionHint: "Click 'Reset' to finish",
    emoji: "🎉",
    isObservation: false,
  },
];
