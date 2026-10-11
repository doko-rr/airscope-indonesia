'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AirQualityMap } from '@/components/map/air-quality-map';
import { SensorHistoryChart } from '@/components/charts/sensor-history-chart';
import { StationDossier } from '@/components/overview/station-dossier';
import { StationLedger } from '@/components/overview/station-ledger';
import type { StationWithMeasurement } from '@/types/sensor';

interface OverviewWorkspaceProps {
  stations: StationWithMeasurement[];
  initialSelectedCode?: string;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const REFRESH_SETTLE_MS = 800;

function getMillisecondsUntilNextBucket(): number {
  const remainder = Date.now() % REFRESH_INTERVAL_MS;
  return remainder === 0
    ? REFRESH_INTERVAL_MS
    : REFRESH_INTERVAL_MS - remainder;
}

function getSecondsUntilNextBucket(): number {
  return Math.max(0, Math.ceil(getMillisecondsUntilNextBucket() / 1000));
}

function formatCountdown(totalSeconds: number | null): string {
  if (totalSeconds === null) return '--:--';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function OverviewWorkspace({
  stations,
  initialSelectedCode = 'BDG-AQ-001',
}: OverviewWorkspaceProps) {
  const router = useRouter();
  const [selectedCode, setSelectedCode] = useState(initialSelectedCode);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);

  const selectedStation = useMemo(
    () =>
      stations.find(({ station }) => station.code === selectedCode) ??
      stations[0],
    [selectedCode, stations],
  );

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    setRefreshRevision((revision) => revision + 1);
    router.refresh();
    setSecondsRemaining(getSecondsUntilNextBucket());

    window.setTimeout(() => {
      setIsRefreshing(false);
    }, REFRESH_SETTLE_MS);
  }, [router]);

  useEffect(() => {
    // Date.now() is intentionally evaluated only after hydration.
    setSecondsRemaining(getSecondsUntilNextBucket());

    const countdownTimer = window.setInterval(() => {
      setSecondsRemaining(getSecondsUntilNextBucket());
    }, 1000);

    const delayUntilBoundary = getMillisecondsUntilNextBucket() + 250;
    let recurringTimer: number | undefined;

    const firstRefreshTimer = window.setTimeout(() => {
      refreshData();
      recurringTimer = window.setInterval(refreshData, REFRESH_INTERVAL_MS);
    }, delayUntilBoundary);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(firstRefreshTimer);
      if (recurringTimer !== undefined) {
        window.clearInterval(recurringTimer);
      }
    };
  }, [refreshData]);

  if (!selectedStation) return null;

  return (
    <>
      <section className="refresh-strip" aria-live="polite">
        <div>
          <span className="refresh-indicator" aria-hidden="true" />
          <strong>Ground network synchronization</strong>
          <span>Five-minute deterministic observation bucket</span>
        </div>

        <div className="refresh-actions">
          <span>
            Next refresh <strong>{formatCountdown(secondsRemaining)}</strong>
          </span>
          <button type="button" onClick={refreshData} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-column dashboard-column-map">
          <AirQualityMap
            stations={stations}
            selectedCode={selectedStation.station.code}
            onSelectStation={setSelectedCode}
          />

          <SensorHistoryChart
            stationCode={selectedStation.station.code}
            stationName={selectedStation.station.name}
            refreshRevision={refreshRevision}
          />

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
    </>
  );
}
