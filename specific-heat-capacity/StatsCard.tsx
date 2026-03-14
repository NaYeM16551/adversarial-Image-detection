"use client";

import { CommonCard } from "@sim/components/common/card";
import { Thermometer, Clock, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { ElectricSource } from "./simulation";

interface StatsCardProps {
    temperatureRef: React.MutableRefObject<number>;
    timeRef: React.MutableRefObject<number>;
    electricSourceRef: React.MutableRefObject<ElectricSource>;
    activeRef: React.MutableRefObject<boolean>; // To control update loop
    isMobile?: boolean;
}

export default function StatsCard({
    temperatureRef,
    timeRef,
    electricSourceRef,
    activeRef,
    isMobile = false,
}: StatsCardProps) {
    const [values, setValues] = useState({
        temperature: 293.15,
        time: 0,
        energy: 0
    });

    useEffect(() => {
        let animationFrameId: number;

        const update = () => {
            // Calculate total energy = power * time
            // This is an approximation. Ideally total energy should be tracked in simulation state if power varies.
            // But for this UI display, power * time is what's usually expected if power is constant-ish or just current instantaneous.
            // Actually, let's just calc it here:
            const t = timeRef.current;
            const power = electricSourceRef.current.power;
            // If power changed over time this would be wrong, but for simple display:
            const energy = power * t;

            setValues({
                temperature: temperatureRef.current,
                time: t,
                energy: energy
            });

            if (!activeRef.current) {
                // Even if paused, we might want to update once to show current state, then stop?
                // But simulation loop handles logic. Here we just read refs.
                // We throttle UI updates to 10fps or so? Or just RAF.
                // Let's use setInterval for UI to avoid 60fps React renders for text.
            }
        };

        // Update at 30fps is enough for text
        const interval = setInterval(update, 33);

        return () => clearInterval(interval);
    }, [temperatureRef, timeRef, electricSourceRef, activeRef]);

    return (
        <CommonCard
            className={`bg-gray-900/80 backdrop-blur-sm border-gray-800 pointer-events-auto ${isMobile ? "w-full" : "w-64"}`}
            contentClassName="p-3 py-0"
        >
            <div className="flex flex-col gap-4">
                {/* Temperature */}
                <div className="flex items-center gap-3">
                    <Thermometer className="h-5 w-5 text-orange-500" />
                    <div className="flex gap-1 items-baseline">
                        <span className="text-sm text-gray-300 font-medium">Temperature:</span>
                        <span className="text-sm font-bold text-white">
                            {(values.temperature - 273.15).toFixed(1)}°C
                        </span>
                    </div>
                </div>

                {/* Time */}
                <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div className="flex gap-1 items-baseline">
                        <span className="text-sm text-gray-300 font-medium">Time:</span>
                        <span className="text-sm font-bold text-white">
                            {values.time.toFixed(1)}s
                        </span>
                    </div>
                </div>

                {/* Energy */}
                <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <div className="flex gap-1 items-baseline">
                        <span className="text-sm text-gray-300 font-medium">Energy:</span>
                        <span className="text-sm font-bold text-white">
                            {values.energy.toFixed(0)}J
                        </span>
                    </div>
                </div>
            </div>
        </CommonCard>
    );
}
