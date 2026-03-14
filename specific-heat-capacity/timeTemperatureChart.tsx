"use client";

import type { ChartData, ChartOptions } from "chart.js";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
);

interface ChartDataPoint {
  time: number;
  temperature: number;
}

export default function TimeTemperatureChart({
  temperatureRef,
  timeRef,
}: {
  temperatureRef: React.RefObject<number>;
  timeRef: React.RefObject<number>;
}): JSX.Element {
  const [dataPoints, setDataPoints] = useState<ChartDataPoint[]>([]);
  const [currentValues, setCurrentValues] = useState({
    temperature: 20,
    time: 0,
  });
  const rafRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef(0);

  const downsampleData = (points: ChartDataPoint[]): ChartDataPoint[] => {
    if (points.length <= 300) return points;

    const result: ChartDataPoint[] = [];
    const totalPoints = points.length;

    result.push(points[0]);

    const recentPoints = 100;
    const middlePoints = totalPoints - recentPoints - 1;

    if (middlePoints > 0) {
      const downsampleRatio = Math.max(2, Math.floor(middlePoints / 100));
      for (let i = 1; i < totalPoints - recentPoints; i += downsampleRatio) {
        result.push(points[i]);
      }
    }

    const recentStartIndex = Math.max(1, totalPoints - recentPoints);
    for (let i = recentStartIndex; i < totalPoints; i++) {
      result.push(points[i]);
    }

    return result;
  };

  useEffect(() => {
    const tick = () => {
      const currentTime = timeRef.current || 0;
      const currentTemp = temperatureRef.current || 293.15;
      const tempInCelsius = currentTemp - 273.15;

      setCurrentValues({
        temperature: tempInCelsius,
        time: currentTime,
      });

      if (currentTime - lastUpdateTimeRef.current >= 0.1) {
        setDataPoints((prev) => {
          const newDataPoints = [
            ...prev,
            {
              time: currentTime,
              temperature: tempInCelsius,
            },
          ];
          return downsampleData(newDataPoints);
        });
        lastUpdateTimeRef.current = currentTime;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [temperatureRef, timeRef]);

  useEffect(() => {
    if (currentValues.time === 0 && dataPoints.length > 0) {
      const tempInCelsius = (temperatureRef.current || 293.15) - 273.15;
      setDataPoints([{ time: 0, temperature: tempInCelsius }]);
      lastUpdateTimeRef.current = 0;
    }
  }, [currentValues.time, dataPoints.length, temperatureRef]);

  useEffect(() => {
    if (dataPoints.length === 0 && currentValues.time === 0) {
      const tempInCelsius = (temperatureRef.current || 293.15) - 273.15;
      setDataPoints([{ time: 0, temperature: tempInCelsius }]);
      lastUpdateTimeRef.current = 0;
    }
  }, [dataPoints.length, currentValues.time, temperatureRef]);

  const getYAxisRange = () => {
    if (dataPoints.length === 0) {
      return {
        min: currentValues.temperature - 10,
        max: currentValues.temperature + 10,
      };
    }

    const allTemps = [
      ...dataPoints.map((p) => p.temperature),
      currentValues.temperature,
    ];
    const minTemp = Math.min(...allTemps);
    const maxTemp = Math.max(...allTemps);
    const range = maxTemp - minTemp;
    const padding = Math.max(range * 0.1, 5);

    return {
      min: minTemp - padding,
      max: maxTemp + padding,
    };
  };

  const yAxisRange = getYAxisRange();

  const data: ChartData<"line"> = {
    datasets: [
      {
        label: "Temperature (°C)",
        data: dataPoints.map((point) => ({
          x: point.time,
          y: point.temperature,
        })),
        borderColor: "rgba(251, 113, 133, 0.95)",
        backgroundColor: "rgba(251, 113, 133, 0.08)",
        borderWidth: 1.5,
        fill: true,
        tension: 0.22,
        pointRadius: 1.5,
        pointHoverRadius: 3,
        pointBorderWidth: 1,
        pointBackgroundColor: "rgba(254, 205, 211, 0.95)",
        pointBorderColor: "rgba(225, 29, 72, 0.95)",
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#94a3b8",
          font: { size: 12 },
        },
      },
      title: {
        display: true,
        text: "Temperature vs Time",
        color: "#f8fafc",
        font: { size: 14, weight: "bold" },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        titleColor: "#f8fafc",
        bodyColor: "#94a3b8",
        bodyFont: { size: 12 },
        titleFont: { size: 12 },
        callbacks: {
          label: (context) => {
            return `Temperature: ${Number(context.parsed.y).toFixed(1)}°C`;
          },
          title: (context) => {
            return `Time: ${Number(context[0].parsed.x).toFixed(1)}s`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        position: "bottom",
        title: {
          display: true,
          text: "Time (seconds)",
          color: "#94a3b8",
          font: { size: 11 },
        },
        ticks: {
          color: "#64748b",
          maxTicksLimit: 10,
          callback: function (value) {
            const timeValue = Number(value);
            if (timeValue < 60) {
              return timeValue.toFixed(0) + "s";
            } else if (timeValue < 3600) {
              return (
                Math.floor(timeValue / 60) +
                "m " +
                (timeValue % 60).toFixed(0) +
                "s"
              );
            } else {
              return Math.floor(timeValue / 3600) + "h";
            }
          },
        },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
        offset: false,
        min: 0,
      },
      y: {
        title: {
          display: true,
          text: "Temperature (°C)",
          color: "#94a3b8",
          font: { size: 11 },
        },
        ticks: {
          color: "#64748b",
          callback: function (value) {
            return Number(value).toFixed(0) + "°C";
          },
        },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
        min: yAxisRange.min,
        max: yAxisRange.max,
      },
    },
    animation: {
      duration: 0,
    },
  };

  return (
    <div className="h-full w-full">
      <Line options={options} data={data} />
    </div>
  );
}
