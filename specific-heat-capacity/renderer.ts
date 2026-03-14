import { Application, Container, Graphics, Text } from "pixi.js";
import React from "react";
import { SimulationState, MATERIALS, MaterialType } from "./simulation";

export type RendererRefs = {
  materialTypeRef: React.RefObject<MaterialType>;
  massRef: React.RefObject<number>;
  electricSourceRef: React.RefObject<{
    voltage: number;
    current: number;
    power: number;
  }>;
  temperatureRef: React.RefObject<number>;
  timeRef: React.RefObject<number>;
  powerOnRef: React.RefObject<boolean>;
  onPowerToggle?: () => void; // Callback for power state change
};

export async function createRenderer(
  app: Application,
  sim: SimulationState,
  refs: RendererRefs
) {
  const stage = new Container();
  app.stage.addChild(stage);
  stage.sortableChildren = true;
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;

  // Detect mobile for scaling
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const isIpad =
    typeof window !== "undefined" &&
    window.innerWidth >= 768 &&
    window.innerWidth <= 1024;
  // Only scale down on mobile (60%), keep desktop at 100% (1.0)
  const scale = isMobile ? 0.6 : 1.0;
  stage.scale.set(scale);

  // Create visual layers
  const backgroundLayer = new Container();
  const beakerGfx = new Graphics();
  const materialGfx = new Graphics();
  const thermometerGfx = new Graphics();
  const powerSourceGfx = new Graphics();
  const immersionHeaterGfx = new Graphics();
  const wireGfx = new Graphics();
  const labelsLayer = new Container();

  stage.addChild(backgroundLayer);
  stage.addChild(wireGfx);
  stage.addChild(powerSourceGfx);
  stage.addChild(immersionHeaterGfx);
  stage.addChild(beakerGfx);
  stage.addChild(materialGfx);
  stage.addChild(thermometerGfx);
  stage.addChild(labelsLayer);



  const draw = (isPowerOn: boolean, isPaused: boolean) => {
    const rendererW = app.renderer.width;
    const rendererH = app.renderer.height;

    // Adjust positioning based on mobile/desktop
    const xOffset = isMobile ? rendererW / 2 - 250 : rendererW / 2 - 120;
    const yOffset = isMobile ? rendererH / 2 : rendererH / 2 + 30;
    stage.position.set(xOffset, yOffset);

    const materialType = refs.materialTypeRef.current;
    const mass = refs.massRef.current;
    //console.log("Mass in renderer draw:", mass);
    const temperature = refs.temperatureRef.current;
    const time = refs.timeRef.current;

    // Clear all graphics
    beakerGfx.clear();
    materialGfx.clear();
    thermometerGfx.clear();
    powerSourceGfx.clear();
    immersionHeaterGfx.clear();
    wireGfx.clear();
    labelsLayer.removeChildren();

    // Draw beaker (glass container with 3D effect)
    const beakerX = 0;
    const beakerY = -80;
    const beakerWidth = 140;
    const beakerHeight = 200;
    const rimHeight = 15;

    // Beaker body (outer glass)
    beakerGfx
      .roundRect(
        beakerX - beakerWidth / 2,
        beakerY,
        beakerWidth,
        beakerHeight,
        8
      )
      .stroke({ color: 0xcccccc, width: 3 });

    // Beaker inner wall (slight offset for 3D effect)
    beakerGfx
      .roundRect(
        beakerX - beakerWidth / 2 + 8,
        beakerY + 8,
        beakerWidth - 16,
        beakerHeight - 8,
        5
      )
      .stroke({ color: 0xaaaaaa, width: 2 });

    // Beaker rim (top lip)
    beakerGfx
      .roundRect(
        beakerX - beakerWidth / 2 - 5,
        beakerY - rimHeight,
        beakerWidth + 10,
        rimHeight,
        5
      )
      .fill({ color: 0xdddddd, alpha: 0.8 })
      .stroke({ color: 0xaaaaaa, width: 2 });

    // Spout
    beakerGfx
      .roundRect(beakerX + beakerWidth / 2 - 5, beakerY + 20, 15, 30, 8)
      .stroke({ color: 0xaaaaaa, width: 2 });

    // Draw material inside beaker
    if (materialType && mass > 0) {
      const material = MATERIALS[materialType];

      if (material.isLiquid) {
        // Calculate liquid level based on mass
        const maxLiquidHeight = beakerHeight - 40;
        const liquidHeight = Math.min(maxLiquidHeight, Math.max(20, mass * 35));
        const liquidY = beakerY + beakerHeight - liquidHeight - 8;

        // Liquid surface (ellipse for 3D effect)
        materialGfx
          .ellipse(beakerX, liquidY, (beakerWidth - 20) / 2, 8)
          .fill({ color: material.color, alpha: 0.9 });

        // Liquid body
        materialGfx
          .roundRect(
            beakerX - (beakerWidth - 20) / 2,
            liquidY,
            beakerWidth - 20,
            liquidHeight,
            3
          )
          .fill({ color: material.color, alpha: 0.8 });

        // Add heating bubbles if heating
        if (sim.isHeating && liquidHeight > 30 && !isPaused) {
          for (let i = 0; i < 8; i++) {
            const bubbleX =
              beakerX + (Math.random() - 0.5) * (beakerWidth - 40);
            const bubbleY = liquidY + 10 + Math.random() * (liquidHeight - 20);
            const bubbleSize = 1 + Math.random() * 3;
            materialGfx
              .circle(bubbleX, bubbleY, bubbleSize)
              .fill({ color: 0xffffff, alpha: 0.7 });
          }
        }

        // Water surface shimmer effect
        materialGfx
          .ellipse(beakerX, liquidY, (beakerWidth - 25) / 2, 6)
          .fill({ color: 0xffffff, alpha: 0.3 });
      } else {
        // Draw enhanced solid material with 3D effects and textures
        const maxSolidHeight = beakerHeight - 40;
        const solidHeight = Math.min(maxSolidHeight, Math.max(15, mass * 25));
        const solidY = beakerY + beakerHeight - solidHeight - 8;
        const solidWidth = beakerWidth - 30; // Leave some margin from beaker walls

        // Create different visual effects based on material type
        const baseColor = material.color;
        const darkerColor = Math.floor(baseColor * 0.7); // Darker shade for shadows
        const lighterColor = Math.min(
          0xffffff,
          Math.floor(baseColor * 1.3) + 0x333333
        ); // Lighter shade for highlights

        // Main solid body with 3D effect
        materialGfx
          .roundRect(
            beakerX - solidWidth / 2,
            solidY,
            solidWidth,
            solidHeight,
            5
          )
          .fill({ color: baseColor, alpha: 0.95 });

        // Top surface (3D effect) - lighter color for metal reflection
        materialGfx
          .roundRect(beakerX - solidWidth / 2 + 2, solidY, solidWidth - 4, 8, 3)
          .fill({ color: lighterColor, alpha: 0.8 });

        // Right side panel (3D depth effect)
        materialGfx
          .moveTo(beakerX + solidWidth / 2, solidY + 5)
          .lineTo(beakerX + solidWidth / 2 + 6, solidY - 2)
          .lineTo(beakerX + solidWidth / 2 + 6, solidY + solidHeight - 7)
          .lineTo(beakerX + solidWidth / 2, solidY + solidHeight)
          .fill({ color: darkerColor, alpha: 0.9 });

        // Front face outline for definition
        materialGfx
          .roundRect(
            beakerX - solidWidth / 2,
            solidY,
            solidWidth,
            solidHeight,
            5
          )
          .stroke({ color: darkerColor, width: 2, alpha: 0.8 });

        // Add material-specific textures/patterns
        if (materialType === "copper") {
          // Copper-specific effects: subtle grain pattern and metallic sheen
          for (let i = 0; i < 12; i++) {
            const grainX =
              beakerX - solidWidth / 2 + 5 + ((i % 4) * (solidWidth - 10)) / 4;
            const grainY =
              solidY + 5 + (Math.floor(i / 4) * (solidHeight - 10)) / 3;
            materialGfx
              .circle(
                grainX + Math.random() * 8 - 4,
                grainY + Math.random() * 8 - 4,
                1 + Math.random()
              )
              .fill({ color: lighterColor, alpha: 0.6 });
          }

          // Metallic reflection streak
          materialGfx
            .roundRect(
              beakerX - solidWidth / 2 + 8,
              solidY + 3,
              4,
              solidHeight - 6,
              2
            )
            .fill({ color: 0xffffff, alpha: 0.4 });
        } else if (materialType === "aluminum") {
          // Aluminum-specific effects: shiny, polished metal look with anodized finish

          // Brushed metal horizontal lines (more pronounced)
          for (let i = 0; i < solidHeight - 10; i += 2) {
            const lineAlpha = 0.4 + Math.sin(i * 0.3) * 0.2; // Varying opacity for realistic effect
            materialGfx
              .roundRect(
                beakerX - solidWidth / 2 + 4,
                solidY + 5 + i,
                solidWidth - 8,
                1,
                0.5
              )
              .fill({ color: 0xf8f8ff, alpha: lineAlpha });
          }

          // Bright anodized aluminum highlight
          materialGfx
            .roundRect(
              beakerX - solidWidth / 2 + 3,
              solidY + 2,
              solidWidth - 6,
              4,
              2
            )
            .fill({ color: 0xffffff, alpha: 0.8 });

          // Silver metallic sheen down the center
          materialGfx
            .roundRect(beakerX - 3, solidY + 8, 6, solidHeight - 16, 3)
            .fill({ color: 0xe6e6fa, alpha: 0.6 });

          // Side reflection
          materialGfx
            .roundRect(
              beakerX + solidWidth / 2 - 8,
              solidY + 5,
              3,
              solidHeight - 10,
              1.5
            )
            .fill({ color: 0xffffff, alpha: 0.5 });
        } else if (materialType === "iron") {
          // Iron-specific effects: industrial, robust metallic surface with subtle oxidation

          // Dark metallic base texture with grain pattern
          for (let i = 0; i < 15; i++) {
            const grainX =
              beakerX - solidWidth / 2 + 3 + ((i % 5) * (solidWidth - 6)) / 5;
            const grainY =
              solidY + 5 + (Math.floor(i / 5) * (solidHeight - 10)) / 3;
            materialGfx
              .circle(
                grainX + Math.random() * 4 - 2,
                grainY + Math.random() * 4 - 2,
                0.8 + Math.random() * 1.2
              )
              .fill({ color: 0x2f2f2f, alpha: 0.7 });
          }

          // Metallic highlights - less bright than aluminum but still reflective
          materialGfx
            .roundRect(
              beakerX - solidWidth / 2 + 5,
              solidY + 3,
              solidWidth - 10,
              3,
              1.5
            )
            .fill({ color: 0xc0c0c0, alpha: 0.6 });

          // Vertical metallic streak
          materialGfx
            .roundRect(beakerX - 2, solidY + 8, 4, solidHeight - 16, 2)
            .fill({ color: 0x8c8c8c, alpha: 0.5 });

          // Subtle rust spots (very minimal)
          for (let i = 0; i < 4; i++) {
            const rustX =
              beakerX - solidWidth / 2 + 8 + Math.random() * (solidWidth - 16);
            const rustY = solidY + 8 + Math.random() * (solidHeight - 16);
            materialGfx
              .circle(rustX, rustY, 0.8 + Math.random() * 1)
              .fill({ color: 0x8b4513, alpha: 0.3 });
          }

          // Strong metallic edge highlight
          materialGfx
            .roundRect(
              beakerX + solidWidth / 2 - 6,
              solidY + 4,
              2,
              solidHeight - 8,
              1
            )
            .fill({ color: 0xdcdcdc, alpha: 0.7 });
        }

        // Enhanced heating effects for solids
        if (sim.isHeating) {
          // Outer glow effect
          materialGfx
            .roundRect(
              beakerX - solidWidth / 2 - 4,
              solidY - 4,
              solidWidth + 8,
              solidHeight + 8,
              8
            )
            .stroke({ color: 0xff6666, width: 3, alpha: 0.6 });

          // Inner heating glow
          materialGfx
            .roundRect(
              beakerX - solidWidth / 2 - 1,
              solidY - 1,
              solidWidth + 2,
              solidHeight + 2,
              6
            )
            .stroke({ color: 0xff9999, width: 2, alpha: 0.8 });

          // Hot spots on the material surface
          for (let i = 0; i < 6; i++) {
            const hotSpotX =
              beakerX - solidWidth / 2 + 5 + Math.random() * (solidWidth - 10);
            const hotSpotY = solidY + 5 + Math.random() * (solidHeight - 10);
            materialGfx
              .circle(hotSpotX, hotSpotY, 2 + Math.random() * 3)
              .fill({ color: 0xff4444, alpha: 0.5 + Math.random() * 0.3 });
          }

          // Heat shimmer effect above the material
          for (let i = 0; i < 5; i++) {
            const shimmerX = beakerX + (Math.random() - 0.5) * solidWidth;
            const shimmerY = solidY - 5 - Math.random() * 15;
            materialGfx
              .circle(shimmerX, shimmerY, 0.5 + Math.random() * 1.5)
              .fill({ color: 0xffaa00, alpha: 0.4 + Math.random() * 0.4 });
          }
        }

        // Add subtle shadow beneath the solid for depth
        materialGfx
          .ellipse(beakerX, solidY + solidHeight + 2, solidWidth / 2 + 2, 4)
          .fill({ color: 0x000000, alpha: 0.2 });
      }
    }

    // Draw thermometer positioned to touch the material
    let materialTopY = beakerY + beakerHeight - 20; // Default position if no material

    if (materialType && mass > 0) {
      const material = MATERIALS[materialType];
      if (material.isLiquid) {
        const maxLiquidHeight = beakerHeight - 40;
        const liquidHeight = Math.min(maxLiquidHeight, Math.max(20, mass * 35));
        materialTopY = beakerY + beakerHeight - liquidHeight - 8;
      } else {
        const maxSolidHeight = beakerHeight - 40;
        const solidHeight = Math.min(maxSolidHeight, Math.max(15, mass * 25));
        materialTopY = beakerY + beakerHeight - solidHeight - 8;
      }
    }

    const thermX = beakerX + 25; // Position inside the beaker
    const thermY = materialTopY - 80; // Start above material
    const thermHeight = 100;
    const thermWidth = 6;

    // Thermometer glass tube
    thermometerGfx
      .roundRect(thermX - thermWidth / 2, thermY, thermWidth, thermHeight, 3)
      .fill({ color: 0xffffff, alpha: 0.8 })
      .stroke({ color: 0xcccccc, width: 1 });

    // Thermometer bulb at bottom
    thermometerGfx
      .circle(thermX, thermY + thermHeight + 5, 8)
      .fill({ color: 0xffffff, alpha: 0.8 })
      .stroke({ color: 0xcccccc, width: 1 });

    // Mercury/alcohol in thermometer
    const tempCelsius = temperature - 273.15;
    const tempFillHeight = Math.min(
      thermHeight - 10,
      Math.max(5, (tempCelsius / 100) * (thermHeight - 10))
    );
    const mercuryColor =
      tempCelsius > 60 ? 0xff3333 : tempCelsius > 30 ? 0xff6633 : 0xcc3333;

    // Mercury in bulb
    thermometerGfx
      .circle(thermX, thermY + thermHeight + 5, 6)
      .fill({ color: mercuryColor, alpha: 0.9 });

    // Mercury in tube
    if (tempFillHeight > 5) {
      thermometerGfx
        .roundRect(
          thermX - 2,
          thermY + thermHeight - tempFillHeight,
          4,
          tempFillHeight,
          2
        )
        .fill({ color: mercuryColor, alpha: 0.9 });
    }

    // Temperature scale markings
    for (let i = 0; i <= 10; i++) {
      const markY = thermY + (i * thermHeight) / 10;
      thermometerGfx
        .moveTo(thermX + thermWidth / 2, markY)
        .lineTo(thermX + thermWidth / 2 + 3, markY)
        .stroke({ color: 0x666666, width: 1 });
    }

    // Thermometer top cap
    thermometerGfx
      .roundRect(thermX - 4, thermY - 8, 8, 8, 4)
      .fill({ color: 0xcccccc });

    // Draw DC Power Source (positioned below beaker)
    // Mobile: position below-right of beaker, Desktop: position to the left
    const powerSourceX = isMobile ? beakerX + 170 : beakerX - 120; // Below-right on mobile (moved right), left on desktop
    const powerSourceY = isMobile
      ? beakerY + beakerHeight - 20
      : beakerY + beakerHeight + 80;
    const powerSourceWidth = 120;
    const powerSourceHeight = 80;
    //const isPowerOn = refs.powerOnRef?.current ?? false;

    // Power source main body (3D effect with better contrast)

    powerSourceGfx
      .roundRect(
        powerSourceX - powerSourceWidth / 2,
        powerSourceY,
        powerSourceWidth,
        powerSourceHeight,
        8
      )
      .fill({ color: 0x4a5568 }) // Changed to dark gray-blue for better contrast
      .stroke({ color: 0x718096, width: 2 });

    // Power source top highlight
    powerSourceGfx
      .roundRect(
        powerSourceX - powerSourceWidth / 2 + 5,
        powerSourceY + 5,
        powerSourceWidth - 10,
        15,
        5
      )
      .fill({ color: 0x6a7785, alpha: 0.8 });

    // Power source side panel for depth effect
    powerSourceGfx
      .moveTo(powerSourceX + powerSourceWidth / 2, powerSourceY)
      .lineTo(powerSourceX + powerSourceWidth / 2 + 8, powerSourceY - 8)
      .lineTo(
        powerSourceX + powerSourceWidth / 2 + 8,
        powerSourceY + powerSourceHeight - 8
      )
      .lineTo(
        powerSourceX + powerSourceWidth / 2,
        powerSourceY + powerSourceHeight
      )
      .fill({ color: 0x2d3748, alpha: 0.8 });

    // Power source bottom shadow
    powerSourceGfx
      .roundRect(
        powerSourceX - powerSourceWidth / 2 + 3,
        powerSourceY + powerSourceHeight - 5,
        powerSourceWidth - 6,
        8,
        4
      )
      .fill({ color: 0x2d3748, alpha: 0.6 });

    // DC label (adjusted for mobile/desktop)
    const dcText = new Text({
      text: "DC",
      style: {
        fill: 0xffffff,
        fontSize: isMobile ? 12 : 16,
        fontWeight: "bold",
        align: "center",
      },
    });
    dcText.anchor.set(0.5);
    dcText.position.set(
      isMobile ? powerSourceX - 25 : powerSourceX - 30,
      powerSourceY + 15
    );
    labelsLayer.addChild(dcText);

    // Voltage display (adjusted for mobile/desktop)
    const voltageText = new Text({
      text: `${refs.electricSourceRef.current?.voltage || 0}V`,
      style: {
        fill: isPowerOn ? 0x00ff00 : 0x666666,
        fontSize: isMobile ? 10 : 12,
        fontWeight: "bold",
        align: "center",
      },
    });
    voltageText.anchor.set(0.5);
    voltageText.position.set(
      isMobile ? powerSourceX : powerSourceX + 15,
      powerSourceY + 15
    );
    labelsLayer.addChild(voltageText);

    // Current display (adjusted for mobile/desktop)
    const currentText = new Text({
      text: `${refs.electricSourceRef.current?.current || 0}A`,
      style: {
        fill: isPowerOn ? 0x00ff00 : 0x666666,
        fontSize: isMobile ? 10 : 12,
        fontWeight: "bold",
        align: "center",
      },
    });
    currentText.anchor.set(0.5);
    currentText.position.set(
      isMobile ? powerSourceX : powerSourceX + 15,
      powerSourceY + 35
    );
    labelsLayer.addChild(currentText);

    // Power terminals (+ and -)
    const terminalRadius = 8;

    // Positive terminal
    powerSourceGfx
      .circle(
        powerSourceX + powerSourceWidth / 2 - 15,
        powerSourceY + 20,
        terminalRadius
      )
      .fill({ color: isPowerOn ? 0xff4444 : 0x888888 })
      .stroke({ color: 0x333333, width: 2 });

    // Negative terminal
    powerSourceGfx
      .circle(
        powerSourceX + powerSourceWidth / 2 - 15,
        powerSourceY + 50,
        terminalRadius
      )
      .fill({ color: isPowerOn ? 0x4444ff : 0x666666 })
      .stroke({ color: 0x333333, width: 2 });

    // Terminal labels
    const plusText = new Text({
      text: "+",
      style: {
        fill: 0xffffff,
        fontSize: 14,
        fontWeight: "bold",
        align: "center",
      },
    });
    plusText.anchor.set(0.5);
    plusText.position.set(
      powerSourceX + powerSourceWidth / 2 - 15,
      powerSourceY + 20
    );
    labelsLayer.addChild(plusText);

    const minusText = new Text({
      text: "−",
      style: {
        fill: 0xffffff,
        fontSize: 16,
        fontWeight: "bold",
        align: "center",
      },
    });
    minusText.anchor.set(0.5);
    minusText.position.set(
      powerSourceX + powerSourceWidth / 2 - 15,
      powerSourceY + 50
    );
    labelsLayer.addChild(minusText);

    // On/Off Button (improved design)
    // Mobile: position to the left of power source on mobile, Desktop: position to the left
    const buttonX = isMobile ? powerSourceX - 30 : powerSourceX - 25; // Left of PS on mobile, original on desktop
    const buttonY = powerSourceY + 40;
    const buttonRadius = 15;

    // Button base (recessed when off, raised when on)
    const buttonDepth = isPowerOn ? 2 : -2;

    // Button shadow/base
    powerSourceGfx
      .circle(buttonX, buttonY + 2, buttonRadius + 2)
      .fill({ color: 0x1a1a1a, alpha: 0.5 });

    // Button main body
    powerSourceGfx
      .circle(buttonX, buttonY + buttonDepth, buttonRadius)
      .fill({ color: isPowerOn ? 0x48bb78 : 0xf56565 }) // Green when on, red when off
      .stroke({ color: isPowerOn ? 0x38a169 : 0xe53e3e, width: 2 });

    // Button highlight ring
    powerSourceGfx
      .circle(buttonX, buttonY + buttonDepth, buttonRadius - 3)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.6 });

    // Button center highlight
    powerSourceGfx
      .circle(buttonX - 4, buttonY + buttonDepth - 4, 4)
      .fill({ color: 0xffffff, alpha: 0.4 });

    // Power symbol in the center of button
    const symbolSize = 6;
    if (isPowerOn) {
      // "I" symbol for ON
      powerSourceGfx
        .roundRect(
          buttonX - 1,
          buttonY + buttonDepth - symbolSize / 2,
          2,
          symbolSize,
          1
        )
        .fill({ color: 0xffffff, alpha: 0.9 });
    } else {
      // "O" symbol for OFF
      powerSourceGfx
        .circle(buttonX, buttonY + buttonDepth, symbolSize / 2)
        .stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
    }

    // Button state indicator text
    const buttonStateText = new Text({
      text: isPowerOn ? "ON" : "OFF",
      style: {
        fill: isPowerOn ? 0x48bb78 : 0xf56565,
        fontSize: 10,
        fontWeight: "bold",
        align: "center",
      },
    });
    buttonStateText.anchor.set(0.5);
    buttonStateText.position.set(buttonX, buttonY + buttonRadius + 20);

    // Make button interactive
    powerSourceGfx.eventMode = "static";
    powerSourceGfx.cursor = "pointer";

    // Button click area (larger than visual button for easier clicking)
    const buttonClickArea = new Graphics()
      .circle(buttonX, buttonY, buttonRadius + 5)
      .fill({ color: 0x000000, alpha: 0.01 }); // Nearly transparent

    buttonClickArea.eventMode = "static";
    buttonClickArea.cursor = "pointer";
    buttonClickArea.on("pointerdown", () => {
      // Toggle power state through callback if provided
      if (refs.onPowerToggle) {
        refs.onPowerToggle();
      } else {
        // Fallback: direct ref modification
        if (refs.powerOnRef?.current !== undefined) {
          const powerRef = refs.powerOnRef as React.MutableRefObject<boolean>;
          powerRef.current = !powerRef.current;
        }
      }
      // Trigger a redraw immediately
      setTimeout(() => draw(isPowerOn, isPaused), 0);
    });

    powerSourceGfx.addChild(buttonClickArea);

    // Draw Immersion Heater
    const heaterX = beakerX - 15; // Position inside beaker, slightly left
    const heaterTopY = beakerY + 10; // Start from top of beaker
    const heaterBottomY = materialTopY + 40; // Extend into material
    const heaterHeight = heaterBottomY - heaterTopY;

    // Heater handle/connector (above water level)
    immersionHeaterGfx
      .roundRect(heaterX - 8, heaterTopY - 30, 16, 30, 4)
      .fill({ color: 0x444444 })
      .stroke({ color: 0x666666, width: 1 });

    // Heater wire connections at top
    immersionHeaterGfx
      .circle(heaterX - 5, heaterTopY - 35, 3)
      .fill({ color: 0xccaa00 });
    immersionHeaterGfx
      .circle(heaterX + 5, heaterTopY - 35, 3)
      .fill({ color: 0xccaa00 });

    // Main heater rod
    immersionHeaterGfx
      .roundRect(heaterX - 4, heaterTopY, 8, heaterHeight, 2)
      .fill({ color: 0x333333 })
      .stroke({ color: 0x555555, width: 1 });

    // Heating element coils (spiral effect)
    if (heaterHeight > 20) {
      const coilStartY = heaterTopY + 10;
      const coilEndY = heaterBottomY - 10;
      const coilHeight = coilEndY - coilStartY;
      const coilTurns = Math.floor(coilHeight / 8);

      for (let i = 0; i < coilTurns; i++) {
        const y = coilStartY + i * 8;
        const glowColor = isPowerOn && sim.isHeating ? 0xff6600 : 0x666666;
        const glowAlpha = isPowerOn && sim.isHeating ? 0.9 : 0.6;

        // Coil windings
        immersionHeaterGfx
          .circle(heaterX - 6, y, 2)
          .fill({ color: glowColor, alpha: glowAlpha });
        immersionHeaterGfx
          .circle(heaterX + 6, y, 2)
          .fill({ color: glowColor, alpha: glowAlpha });

        // Connecting wire between coils
        immersionHeaterGfx
          .moveTo(heaterX - 6, y)
          .lineTo(heaterX + 6, y + 4)
          .stroke({ color: glowColor, width: 1, alpha: glowAlpha });
      }
    }

    // Heating glow effect when powered on
    if (isPowerOn && sim.isHeating && !isPaused) {
      immersionHeaterGfx
        .roundRect(heaterX - 10, heaterTopY + 10, 20, heaterHeight - 20, 6)
        .stroke({ color: 0xff6600, width: 3, alpha: 0.4 });

      // Add some heat shimmer particles
      for (let i = 0; i < 6; i++) {
        const shimmerX = heaterX + (Math.random() - 0.5) * 20;
        const shimmerY = heaterTopY + 15 + Math.random() * (heaterHeight - 30);
        immersionHeaterGfx
          .circle(shimmerX, shimmerY, 1 + Math.random() * 2)
          .fill({ color: 0xffaa00, alpha: 0.6 });
      }
    }

    // Draw connection wires from power source to immersion heater
    const positiveTerminalX = powerSourceX + powerSourceWidth / 2 - 15;
    const positiveTerminalY = powerSourceY + 20;
    const negativeTerminalX = powerSourceX + powerSourceWidth / 2 - 15;
    const negativeTerminalY = powerSourceY + 50;

    const heaterConnectionX1 = heaterX - 5;
    const heaterConnectionY1 = heaterTopY - 35;
    const heaterConnectionX2 = heaterX + 5;
    const heaterConnectionY2 = heaterTopY - 35;

    // Positive wire (red) - curved path
    const wireColor1 = isPowerOn ? 0xff4444 : 0x884444;
    wireGfx
      .moveTo(positiveTerminalX + terminalRadius, positiveTerminalY)
      .quadraticCurveTo(
        positiveTerminalX + 40,
        positiveTerminalY - 30,
        heaterConnectionX1,
        heaterConnectionY1
      )
      .stroke({ color: wireColor1, width: 3 });

    // Negative wire (blue/black) - curved path
    const wireColor2 = isPowerOn ? 0x4444ff : 0x444488;
    wireGfx
      .moveTo(negativeTerminalX + terminalRadius, negativeTerminalY)
      .quadraticCurveTo(
        negativeTerminalX + 45,
        negativeTerminalY - 40,
        heaterConnectionX2,
        heaterConnectionY2
      )
      .stroke({ color: wireColor2, width: 3 });

    // Wire insulation highlights
    {
      wireGfx
        .moveTo(positiveTerminalX + terminalRadius + 1, positiveTerminalY - 1)
        .quadraticCurveTo(
          positiveTerminalX + 41,
          positiveTerminalY - 31,
          heaterConnectionX1 + 1,
          heaterConnectionY1 - 1
        )
        .stroke({ color: 0xffffff, width: 1, alpha: 0.4 });

      wireGfx
        .moveTo(negativeTerminalX + terminalRadius + 1, negativeTerminalY - 1)
        .quadraticCurveTo(
          negativeTerminalX + 46,
          negativeTerminalY - 41,
          heaterConnectionX2 + 1,
          heaterConnectionY2 - 1
        )
        .stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
    }



    // // Add labels for equipment
    // const thermLabel = new Text({
    //   text: "Therm-\nometer",
    //   style: { fill: 0xffffff, fontSize: 11, align: 'center' }
    // });
    // thermLabel.anchor.set(0.5);
    // thermLabel.position.set(thermX + 30, thermY + 40);

    const materialLabel = new Text({
      text: materialType ? MATERIALS[materialType].name : "Material",
      style: { fill: 0xffffff, fontSize: 12, align: "center" },
    });
    materialLabel.anchor.set(0.5);
    materialLabel.position.set(beakerX, beakerY + beakerHeight + 30);

    // Power source label
    const powerLabel = new Text({
      text: "DC Power Source",
      style: { fill: 0xffffff, fontSize: 11, align: "center" },
    });
    powerLabel.anchor.set(0.5);
    powerLabel.position.set(
      powerSourceX,
      powerSourceY + powerSourceHeight + 15
    );

    // // Immersion heater label
    // const heaterLabel = new Text({
    //   text: "Immersion\nHeater",
    //   style: { fill: 0xffffff, fontSize: 10, align: 'center' }
    // });
    // heaterLabel.anchor.set(0.5);
    // heaterLabel.position.set(heaterX + 40, heaterTopY + 20);



    // Add new labels
    labelsLayer.addChild(materialLabel);
    labelsLayer.addChild(powerLabel);
    //labelsLayer.addChild(heaterLabel);
    labelsLayer.addChild(buttonStateText); // Add the button state text
  };

  const destroy = () => {
    stage.destroy({ children: true });
  };

  return { draw, destroy };
}
