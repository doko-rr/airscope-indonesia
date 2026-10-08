'use client';

import type { KeyboardEvent } from 'react';
import { formatNumber, formatObservationTime } from '@/lib/formatters';
import type { StationWithMeasurement } from '@/types/sensor';

interface StationLedgerProps {
  stations: StationWithMeasurement[];
  selectedCode: string;
  onSelectStation: (code: string) => void;
}

export function StationLedger({
  stations,
  selectedCode,
  onSelectStation,
}: StationLedgerProps) {
  const selectWithKeyboard = (
    event: KeyboardEvent<HTMLTableRowElement>,
    code: string,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectStation(code);
    }
  };

  return (
    <section className="station-ledger">
      <header>
        <strong>Table 2.4 — Terrestrial station ledger</strong>
        <span>{stations.length} reporting units</span>
        <b>Interval: 5 min</b>
      </header>

      <div className="ledger-scroll">
        <table>
          <thead>
            <tr>
              <th>Station</th>
              <th>Profile</th>
              <th>Status</th>
              <th>PM2.5</th>
              <th>Temperature</th>
              <th>Humidity</th>
              <th>Signal</th>
              <th>Last observation</th>
            </tr>
          </thead>
          <tbody>
            {stations.map(({ station, latest }) => {
              const selected = station.code === selectedCode;
              const advisory = station.status === 'WARNING';
              const className = selected
                ? 'is-selected'
                : advisory
                  ? 'is-advisory'
                  : undefined;

              return (
                <tr
                  key={station.code}
                  className={className}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelectStation(station.code)}
                  onKeyDown={(event) => selectWithKeyboard(event, station.code)}
                >
                  <td>
                    <strong>{station.code}</strong>
                    <span>{station.name}</span>
                  </td>
                  <td>{station.profile.replaceAll('_', ' ')}</td>
                  <td>
                    <b>
                      {station.status === 'WARNING'
                        ? 'Advisory'
                        : station.status}
                    </b>
                  </td>
                  <td>{formatNumber(latest.measurements.pm25UgM3)} µg/m³</td>
                  <td>{formatNumber(latest.measurements.temperatureC)} °C</td>
                  <td>{formatNumber(latest.measurements.humidityPct)}%</td>
                  <td>{latest.device.rssiDbm} dBm</td>
                  <td>{formatObservationTime(latest.observedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer>
        Select a station row or map marker to update the observation dossier.
        Simulated telemetry under AIRSIM-DETERMINISTIC-V1.
      </footer>
    </section>
  );
}
