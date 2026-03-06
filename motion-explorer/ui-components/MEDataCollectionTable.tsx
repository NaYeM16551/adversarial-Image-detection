"use client";

import { useEffect, useState } from "react";
import { MEDataRecord } from "../simulation-logic/simulation";
import { CommonButton } from "@sim/components/common/button";
import { CommonCard } from "@sim/components/common/card";
import { PlusIcon } from "@sim/components/icons/button";

interface MEDataCollectionTableProps {
  dataRecordsRef: React.RefObject<MEDataRecord[]>;
  onCollectData: () => MEDataRecord | null;
  isMobile?: boolean;
  highlightId?: string | null;
}

export default function MEDataCollectionTable({
  dataRecordsRef,
  onCollectData,
  isMobile,
  highlightId,
}: MEDataCollectionTableProps) {
  const [localDataRecords, setLocalDataRecords] = useState<MEDataRecord[]>([]);
  const [updateKey, setUpdateKey] = useState(0);

  // Handle data collection and update local state
  const handleCollectData = () => {
    const newRecord = onCollectData();
    if (newRecord && dataRecordsRef.current) {
      setLocalDataRecords([...dataRecordsRef.current]);
      setUpdateKey((prev) => prev + 1);
    }
  };

  // Sync with ref data when component mounts or ref changes
  useEffect(() => {
    if (dataRecordsRef.current) {
      setLocalDataRecords([...dataRecordsRef.current]);
    }
  }, [dataRecordsRef, updateKey]);

  // Check for data reset (when ref is cleared)
  useEffect(() => {
    const checkForReset = () => {
      if (
        dataRecordsRef.current &&
        dataRecordsRef.current.length === 0 &&
        localDataRecords.length > 0
      ) {
        setLocalDataRecords([]);
      }
    };

    const interval = setInterval(checkForReset, 100);
    return () => clearInterval(interval);
  }, [localDataRecords.length, dataRecordsRef]);

  return (
    <CommonCard
      variant="darker"
      title={
        <div className="flex w-full items-center justify-between">
          <span>{isMobile ? "Data" : "Data Collection"}</span>
        </div>
      }
      titleClassName={`font-semibold text-white w-full ${isMobile ? "text-xs" : "text-sm"}`}
      className={`pointer-events-auto w-full backdrop-blur-md ${
        isMobile ? "p-2 text-xs" : "p-3"
      }`}
    >
      <CommonButton
        onClick={handleCollectData}
        variant="filled"
        className={`justify-center bg-blue-600 hover:bg-blue-700 border-transparent text-white transition-all duration-300 ${
          isMobile ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
        } ${
          highlightId === "collect-btn"
            ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_16px_rgba(34,211,238,0.5),0_0_32px_rgba(34,211,238,0.25)] animate-pulse"
            : ""
        }`}
        text={isMobile ? "Collect" : "Collect Data"}
        icon={<PlusIcon size={isMobile ? 12 : 14} />}
        data-guide-id="collect-btn"
      />

      {localDataRecords.length === 0 ? (
        <div
          className={`text-center text-slate-400 py-2 ${
            isMobile ? "text-xs" : "py-4 text-xs"
          }`}
        >
          {isMobile
            ? "No data. Click to collect."
            : 'No data collected yet. Click "Collect Data" to record measurements.'}
        </div>
      ) : (
        <div className={`overflow-x-auto ${isMobile ? "max-h-32" : ""}`}>
          <table className={`w-full ${isMobile ? "text-xs" : "text-xs"}`}>
            <thead>
              <tr className="border-b border-slate-700">
                <th
                  className={`text-center font-medium text-slate-400 border-r border-slate-700 ${
                    isMobile ? "pb-1 px-0.5" : "pb-2 px-1.5"
                  }`}
                >
                  {isMobile ? "M_t (kg)" : "Trolley Mass (kg)"}
                </th>
                <th
                  className={`text-center font-medium text-slate-400 border-r border-slate-700 ${
                    isMobile ? "pb-1 px-0.5" : "pb-2 px-1.5"
                  }`}
                >
                  {isMobile ? "M_h (kg)" : "Hanger Mass (kg)"}
                </th>
                <th
                  className={`text-center font-medium text-slate-400 border-r border-slate-700 ${
                    isMobile ? "pb-1 px-0.5" : "pb-2 px-1.5"
                  }`}
                >
                  {isMobile ? "a (m/s²)" : "Acceleration (m/s²)"}
                </th>
                <th
                  className={`text-center font-medium text-slate-400 ${
                    isMobile ? "pb-1 px-0.5" : "pb-2 px-1.5"
                  }`}
                >
                  {isMobile ? "T (N)" : "Tension (N)"}
                </th>
              </tr>
            </thead>
            <tbody>
              {localDataRecords.map((record, index) => (
                <tr
                  key={`${record.timestamp}-${index}`}
                  className="border-b border-slate-800 hover:bg-slate-800/50"
                >
                  <td
                    className={`text-center text-slate-300 border-r border-slate-700 ${
                      isMobile ? "py-1 px-0.5" : "py-1.5 px-1.5"
                    }`}
                  >
                    {record.trolleyMass.toFixed(2)}
                  </td>
                  <td
                    className={`text-center text-slate-300 border-r border-slate-700 ${
                      isMobile ? "py-1 px-0.5" : "py-1.5 px-1.5"
                    }`}
                  >
                    {record.hangerMass.toFixed(2)}
                  </td>
                  <td
                    className={`text-center text-slate-300 border-r border-slate-700 ${
                      isMobile ? "py-1 px-0.5" : "py-1.5 px-1.5"
                    }`}
                  >
                    {record.acceleration.toFixed(2)}
                  </td>
                  <td
                    className={`text-center text-slate-300 ${
                      isMobile ? "py-1 px-0.5" : "py-1.5 px-1.5"
                    }`}
                  >
                    {record.tension.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {localDataRecords.length > 0 && (
        <div
          className={`text-slate-500 ${
            isMobile ? "text-xs mt-1" : "mt-2 text-xs"
          }`}
        >
          {localDataRecords.length} record
          {localDataRecords.length !== 1 ? "s" : ""}
        </div>
      )}
    </CommonCard>
  );
}
