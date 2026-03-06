"use client";

import dynamic from "next/dynamic";

const MotionExplorerLab = dynamic(
  () => import("@sim/app/labs/motion-explorer/ui-components"),
  { ssr: false },
);

export default function Page() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <MotionExplorerLab />
    </div>
  );
}
