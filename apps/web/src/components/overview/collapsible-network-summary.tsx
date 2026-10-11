'use client';

import { useMemo, useState } from 'react';
import { NetworkSummary } from '@/components/overview/network-summary';
import type { StationWithMeasurement } from '@/types/sensor';

interface CollapsibleNetworkSummaryProps {
  stations: StationWithMeasurement[];
}

function formatValue(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function CollapsibleNetworkSummary({
  stations,
}: CollapsibleNetworkSummaryProps) {
  const [collapsed, setCollapsed] = useState(false);

  const tickerItems = useMemo(() => {
    const reporting = stations.filter(
      ({ station }) => station.status !== 'OFFLINE',
    ).length;
    const advisory = stations.filter(
      ({ station }) => station.status === 'WARNING',
    ).length;
    const meanPm25 =
      stations.reduce(
        (sum, { latest }) => sum + latest.measurements.pm25UgM3,
        0,
      ) / Math.max(stations.length, 1);
    const highest = [...stations].sort(
      (first, second) =>
        second.latest.measurements.pm25UgM3 -
        first.latest.measurements.pm25UgM3,
    )[0];

    return [
      `Reporting ${reporting}/${stations.length}`,
      `Mean PM2.5 ${formatValue(meanPm25)} µg/m³`,
      highest
        ? `Highest ${highest.station.name} ${formatValue(highest.latest.measurements.pm25UgM3)} µg/m³`
        : 'Highest station unavailable',
      `Advisories ${String(advisory).padStart(2, '0')}`,
      'Satellite not connected',
    ];
  }, [stations]);

  const tickerSequence = useMemo(
    () => Array.from({ length: 4 }, () => tickerItems).flat(),
    [tickerItems],
  );

  return (
    <section
      className={
        collapsed ? 'collapsible-summary is-collapsed' : 'collapsible-summary'
      }
      aria-label="Network summary"
    >
      {!collapsed ? (
        <button
          type="button"
          className="summary-toggle summary-toggle-hide"
          aria-expanded="true"
          aria-controls="network-summary-content"
          onClick={() => setCollapsed(true)}
        >
          <span>Hide summary</span>
          <b aria-hidden="true">⌃</b>
        </button>
      ) : null}

      <div id="network-summary-content" hidden={collapsed}>
        <NetworkSummary stations={stations} />
      </div>

      {collapsed ? (
        <div className="summary-compact-bar">
          <div className="summary-compact-label">
            <span className="summary-ticker-signal" aria-hidden="true" />
            Network brief
          </div>

          <div className="summary-ticker-viewport" aria-live="polite">
            <div className="summary-ticker-track">
              {[0, 1].map((groupIndex) => (
                <div
                  key={groupIndex}
                  className="summary-ticker-group"
                  aria-hidden={groupIndex === 1}
                >
                  {tickerSequence.map((item, itemIndex) => (
                    <span key={`${groupIndex}-${itemIndex}-${item}`}>
                      {item}
                      <i aria-hidden="true">◆</i>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="summary-toggle summary-toggle-show"
            aria-expanded="false"
            aria-controls="network-summary-content"
            onClick={() => setCollapsed(false)}
          >
            <span>Show summary</span>
            <b aria-hidden="true">⌄</b>
          </button>
        </div>
      ) : null}
    </section>
  );
}
