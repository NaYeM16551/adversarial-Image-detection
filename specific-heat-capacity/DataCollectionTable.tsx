"use client";

import { useEffect, useState } from "react";
import { DataRecord } from "./simulation";
import { CommonButton } from "@sim/components/common/button";

interface DataCollectionTableProps {
  dataRecordsRef: React.RefObject<DataRecord[]>;
  onCollectData: () => DataRecord | null;
  isPaused: boolean;
  isPowerOn: boolean;
  isMobile?: boolean;
}

export default function DataCollectionTable({
  dataRecordsRef,
  onCollectData,
  isPaused,
  isPowerOn,
  isMobile,
}: DataCollectionTableProps) {
  const [localDataRecords, setLocalDataRecords] = useState<DataRecord[]>([]);
  const [updateKey, setUpdateKey] = useState(0);

  // Function to handle data collection and update local state
  const handleCollectData = () => {
    const newRecord = onCollectData();
    if (newRecord && dataRecordsRef.current) {
      setLocalDataRecords([...dataRecordsRef.current]);
      setUpdateKey((prev) => prev + 1); // Force re-render
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

  const isDisabled = isPaused || !isPowerOn;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <div className="text-[10px] text-gray-400">
          {localDataRecords.length} record
          {localDataRecords.length !== 1 ? "s" : ""}
        </div>
        <CommonButton
          onClick={handleCollectData}
          disabled={isDisabled}
          variant="filled"
          className={`h-6 text-[10px] ${
            isDisabled
              ? "bg-gray-700 text-gray-400"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
          text="Collect Data"
        />
      </div>

      {localDataRecords.length === 0 ? (
        <div className="text-center text-gray-500 py-4 text-[10px]">
          No data collected yet.
        </div>
      ) : (
        <div className="overflow-auto max-h-48 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          <table className="w-full text-[10px] text-left">
            <thead className="text-gray-400 font-medium border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="pb-1 pr-2 pl-1 font-medium border-r border-gray-800/70">
                  Time (s)
                </th>
                <th className="pb-1 pr-2 pl-2 font-medium border-r border-gray-800/70">
                  Mass (kg)
                </th>
                <th className="pb-1 pr-2 pl-2 font-medium border-r border-gray-800/70">
                  Energy (J)
                </th>
                <th className="pb-1 pr-2 pl-2 font-medium">Temp Rise</th>
              </tr>
            </thead>
            <tbody className="text-gray-300 divide-y divide-gray-800/50">
              {localDataRecords.map((record, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-colors">
                  <td className="py-1 px-1 border-r border-gray-800/70">
                    {record.timestamp !== undefined
                      ? record.timestamp.toFixed(2)
                      : "-"}
                  </td>
                  <td className="py-1 pl-2 border-r border-gray-800/70">
                    {record.mass.toFixed(2)}
                  </td>
                  <td className="py-1 pl-2 border-r border-gray-800/70">
                    {record.energyReceived.toFixed(2)}
                  </td>
                  <td className="py-1 pl-2">
                    {record.temperatureRise.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
