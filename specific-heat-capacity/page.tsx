"use client";

import dynamic from "next/dynamic";

const SpecificHeatCapacityLab = dynamic(
  () => import("@sim/app/labs/specific-heat-capacity"),
  {
    ssr: false,
  }
);

export default function Page() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <SpecificHeatCapacityLab />
    </div>
  );
}
