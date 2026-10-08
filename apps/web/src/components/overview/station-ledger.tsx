import type { StationWithMeasurement } from '@/types/sensor';
import { formatNumber, formatObservationTime } from '@/lib/formatters';

interface StationLedgerProps {
  stations: StationWithMeasurement[];
}

export function StationLedger({ stations }: StationLedgerProps) {
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
            {stations.map(({ station, latest }) => (
              <tr
                key={station.code}
                className={
                  station.status === 'WARNING' ? 'is-advisory' : undefined
                }
              >
                <td>
                  <strong>{station.code}</strong>
                  <span>{station.name}</span>
                </td>
                <td>{station.profile.replaceAll('_', ' ')}</td>
                <td>
                  <b>
                    {station.status === 'WARNING' ? 'Advisory' : station.status}
                  </b>
                </td>
                <td>{formatNumber(latest.measurements.pm25UgM3)} µg/m³</td>
                <td>{formatNumber(latest.measurements.temperatureC)} °C</td>
                <td>{formatNumber(latest.measurements.humidityPct)}%</td>
                <td>{latest.device.rssiDbm} dBm</td>
                <td>{formatObservationTime(latest.observedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer>
        Values supplied dynamically by the AirScope REST API. Simulated
        telemetry under AIRSIM-DETERMINISTIC-V1.
      </footer>
    </section>
  );
}
