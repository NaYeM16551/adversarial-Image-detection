import { Body, Bodies, Composite, Engine, World } from 'matter-js';

export type MaterialType = 'water' | 'copper' | 'aluminum' | 'iron' | 'mercury';

export type Material = {
  type: MaterialType;
  name: string;
  specificHeat: number; // J/(kg·K) - specific heat capacity
  density: number; // kg/m³
  color: number; // hex color for visualization
  isLiquid: boolean;
};

export const MATERIALS: Record<MaterialType, Material> = {
  water: {
    type: 'water',
    name: 'Water',
    specificHeat: 4186, // J/(kg·K)
    density: 1000, // kg/m³
    color: 0x4FC3F7,
    isLiquid: true,
  },
  copper: {
    type: 'copper',
    name: 'Copper',
    specificHeat: 385, // J/(kg·K)
    density: 8960, // kg/m³
    color: 0xD4AF37,
    isLiquid: false,
  },
  aluminum: {
    type: 'aluminum',
    name: 'Aluminum',
    specificHeat: 900, // J/(kg·K)
    density: 2700, // kg/m³
    color: 0xC0C0C0,
    isLiquid: false,
  },
  iron: {
    type: 'iron',
    name: 'Iron',
    specificHeat: 449, // J/(kg·K)
    density: 7870, // kg/m³
    color: 0x696969,
    isLiquid: false,
  },
  mercury: {
    type: 'mercury',
    name: 'Mercury',
    specificHeat: 140, // J/(kg·K)
    density: 13534, // kg/m³
    color: 0xC0C0C0,
    isLiquid: true,
  },
};

export type ElectricSource = {
  voltage: number; // V (volts)
  current: number; // A (amperes)
  power: number; // W (watts) = voltage * current
};

export type SimulationParamsRefs = {
  pausedRef: React.RefObject<boolean>;
  materialTypeRef: React.RefObject<MaterialType>;
  massRef: React.RefObject<number>; // kg
  electricSourceRef: React.RefObject<ElectricSource>;
  temperatureRef: React.RefObject<number>; // K (Kelvin)
  timeRef: React.RefObject<number>; // seconds
  powerOnRef: React.RefObject<boolean>; // Power source on/off state
};

export type DataRecord = {
  mass: number; // kg
  energyReceived: number; // J (joules)
  temperatureRise: number; // K (temperature difference from initial)
  specificHeatCapacity: number; // J/(kg·K)
  timestamp: number; // when this data was collected
};

export type SimulationState = {
  engine: Engine;
  world: World;
  beaker: Body;
  material: Body | null;
  heatingElement: Body;
  initialTemperature: number; // K
  currentTemperature: number; // K
  elapsedTime: number; // seconds
  energyAdded: number; // J (joules)
  isHeating: boolean;
  timeSpentHeating: number; // seconds
  collectedData: DataRecord[]; // Array to store collected data records
};

export function createSimulation(
  params: SimulationParamsRefs
): SimulationState {
  const engine = Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
  const world = engine.world;

  // Create beaker (transparent container)
  const beaker = Bodies.rectangle(0, 0, 200, 300, {
    isStatic: true,
    render: {
      fillStyle: 'transparent',
      strokeStyle: '#ffffff',
      lineWidth: 3,
    },
  });

  // Create heating element (at bottom of beaker)
  const heatingElement = Bodies.rectangle(0, 120, 180, 20, {
    isStatic: true,
    render: {
      fillStyle: '#ff4444',
    },
  });

  // Create material body (will be updated based on material type)
  let material: Body | null = null;
  const materialType = params.materialTypeRef.current;
  if (materialType) {
    const mat = MATERIALS[materialType];
    if (mat.isLiquid) {
      // Liquid fills the beaker
      material = Bodies.rectangle(0, 0, 180, 250, {
        isStatic: true,
        render: {
          fillStyle: `#${mat.color.toString(16)}`,
        },
      });
    } else {
      // Solid is a smaller block
      material = Bodies.rectangle(0, -50, 80, 80, {
        isStatic: true,
        render: {
          fillStyle: `#${mat.color.toString(16)}`,
        },
      });
    }
  }

  if (material) {
    Composite.add(world, material);
  }
  Composite.add(world, [beaker, heatingElement]);

  const initialTemp = 293.15; // 20°C in Kelvin

  return {
    engine,
    world,
    beaker,
    material,
    heatingElement,
    initialTemperature: initialTemp,
    currentTemperature: initialTemp,
    elapsedTime: 0,
    energyAdded: 0,
    isHeating: false,
    timeSpentHeating: 0,
    collectedData: [], // Initialize empty data collection array
  };
}

export function stepSimulation(
  state: SimulationState,
  refs: SimulationParamsRefs,
  dt: number
) {
  const materialType = refs.materialTypeRef.current;
  const mass = refs.massRef.current; // kg
  const electricSource = refs.electricSourceRef.current;
  const isPowerOn = refs.powerOnRef.current ?? false;
  
  if (!materialType || !mass || mass <= 0) return;

  
  
   const material = MATERIALS[materialType];
  
  // Calculate power from electric source (only if power is on)
  const power = isPowerOn ? electricSource.voltage * electricSource.current : 0; // W (watts)

 
  
  // TODO: Add your physics calculations here
  // =======================================
  
  // // // Calculate energy added in this time step
   const energyStep = power * dt; // J (joules)
   state.energyAdded += energyStep;
   state.elapsedTime += dt;

  if(power>0)
  {
    state.timeSpentHeating+=dt;
    state.isHeating=true;
  }
  
  
  // const totalEnergyAdded = state.energyAdded;
   const temperatureRise = energyStep / (mass * material.specificHeat);
   //console.log("Energy Step:", energyStep, "Temperature Rise:", temperatureRise);
  
   state.currentTemperature = state.currentTemperature + temperatureRise;
  
  // Update refs for UI display
  refs.temperatureRef.current = state.currentTemperature;
  refs.timeRef.current = state.elapsedTime;
 // refs.energyRef.current = state.energyAdded;
   
  
  
}

export function destroySimulation(state: SimulationState) {
  Composite.clear(state.engine.world, false, true);
}

export function resetSimulation(state: SimulationState): void {
  // TODO: Reset your physics calculations here
  // =========================================
  
  // Reset temperature to initial value
  state.currentTemperature = state.initialTemperature;
  
  // Reset time and energy tracking
  state.elapsedTime = 0;
  // state.energyAdded = 0;
  state.timeSpentHeating = 0;
  state.energyAdded = 0;
  
  
  // Reset heating state
  state.isHeating = false;
  
  // Clear collected data
  state.collectedData = [];
}

export function collectData(
  state: SimulationState,
  refs: SimulationParamsRefs
): DataRecord {
  const mass = refs.massRef.current || 0;
  const energyReceived = state.energyAdded;
  const temperatureRise = state.currentTemperature - state.initialTemperature;
  
  // Calculate specific heat capacity using the formula: C = E / (ΔT × m)
  // Where: C = specific heat capacity, E = energy added, ΔT = temperature rise, m = mass
  const specificHeatCapacity = temperatureRise > 0 && mass > 0 
    ? energyReceived / (temperatureRise * mass)
    : 0;

   console.log("Collecting Data - Mass:", mass, "Energy Received:", energyReceived, "Temperature Rise:", temperatureRise, "Specific Heat Capacity:", specificHeatCapacity); 
  
  const dataRecord: DataRecord = {
    mass: mass,
    energyReceived: energyReceived,
    temperatureRise: temperatureRise,
    specificHeatCapacity: specificHeatCapacity,
    timestamp: refs.timeRef.current || 0,
  };
  
  // Add the record to the simulation's collected data array
  state.collectedData.push(dataRecord);
  
  return dataRecord;
}