'use client';

import { useMemo, useState } from 'react';
import { AirQualityMap } from '@/components/map/air-quality-map';
import { HistoryPlaceholder } from '@/components/overview/history-placeholder';
import { StationDossier } from '@/components/overview/station-dossier';
import { StationLedger } from '@/components/overview/station-ledger';
import type { StationWithMeasurement } from '@/types/sensor';

interface OverviewWorkspaceProps {
  stations: StationWithMeasurement[];
  initialSelectedCode?: string;
}

export function OverviewWorkspace({
  stations,
  initialSelectedCode = 'BDG-AQ-001',
}: OverviewWorkspaceProps) {
  const [selectedCode, setSelectedCode] = useState(initialSelectedCode);

  const selectedStation = useMemo(
    () =>
      stations.find(({ station }) => station.code === selectedCode) ??
      stations[0],
    [selectedCode, stations],
  );

  if (!selectedStation) return null;

  return (
    <div className="dashboard-columns">
      <div className="dashboard-column dashboard-column-map">
        <AirQualityMap
          stations={stations}
          selectedCode={selectedStation.station.code}
          onSelectStation={setSelectedCode}
        />

        <HistoryPlaceholder />

        <StationLedger
          stations={stations}
          selectedCode={selectedStation.station.code}
          onSelectStation={setSelectedCode}
        />
      </div>

      <div className="dashboard-column dashboard-column-observation">
        <StationDossier item={selectedStation} />
      </div>
    </div>
  );
}
