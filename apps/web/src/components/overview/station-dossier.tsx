import type { StationWithMeasurement } from '@/types/sensor';
import { formatNumber } from '@/lib/formatters';

interface StationDossierProps {
  item: StationWithMeasurement;
}

export function StationDossier({ item }: StationDossierProps) {
  const { station, latest } = item;
  const m = latest.measurements;

  return (
    <aside className="station-dossier">
      <header className="dossier-header">
        <div>
          <strong>Node {station.code}</strong>
          <span>Primary station</span>
        </div>
        <b>Online</b>
        <h2>{station.name}</h2>
        <em>{station.profile.replaceAll('_', ' ')}</em>
        <p>
          Lat: {Math.abs(station.location.latitude).toFixed(4)}° S / Lon:{' '}
          {station.location.longitude.toFixed(4)}° E{' '}
          <span>Elev: {station.location.elevationM} m MSL</span>
        </p>
      </header>

      <div className="source-ribbon">
        <span>Simulated ground sensor data</span>
        <strong>Model: {latest.simulationModel}</strong>
      </div>

      <section className="particulate-grid">
        <MeasurementHero
          label="PM2.5 realtime"
          value={formatNumber(m.pm25UgM3)}
          unit="µg/m³"
        />
        <MeasurementHero
          label="PM10 realtime"
          value={formatNumber(m.pm10UgM3)}
          unit="µg/m³"
        />
      </section>
      <p className="regulatory-notice">
        Realtime five-minute simulation. Not a 24-hour regulatory average.
      </p>

      <section className="dossier-section">
        <header>
          <h3>Atmospheric gas measurements</h3>
          <span>5-min interval</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>Species</th>
              <th>Value</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            <GasRow
              label="CO (Carbon Monoxide)"
              value={formatNumber(m.coPpm, 2)}
              unit="ppm"
            />
            <GasRow
              label="CO₂ (Carbon Dioxide)"
              value={formatNumber(m.co2Ppm, 0)}
              unit="ppm"
            />
            <GasRow
              label="NO₂ (Nitrogen Dioxide)"
              value={formatNumber(m.no2Ppb)}
              unit="ppb"
            />
            <GasRow
              label="SO₂ (Sulfur Dioxide)"
              value={formatNumber(m.so2Ppb)}
              unit="ppb"
            />
            <GasRow
              label="O₃ (Ground Ozone)"
              value={formatNumber(m.o3Ppb)}
              unit="ppb"
            />
          </tbody>
        </table>
      </section>

      <section className="dossier-section">
        <header>
          <h3>Environmental measurements</h3>
        </header>
        <div className="three-column-matrix">
          <Metric
            label="Temperature"
            value={`${formatNumber(m.temperatureC)} °C`}
          />
          <Metric label="Humidity" value={`${formatNumber(m.humidityPct)} %`} />
          <Metric
            label="Pressure"
            value={`${formatNumber(m.pressureHpa)} hPa`}
          />
        </div>
      </section>

      <section className="dossier-section">
        <header>
          <h3>Device telemetry</h3>
          <span>
            Battery: {formatNumber(latest.device.batteryVoltage, 2)} V
          </span>
        </header>
        <div className="two-column-matrix">
          <Metric label="LTE signal" value={`${latest.device.rssiDbm} dBm`} />
          <Metric
            label="Battery"
            value={`${formatNumber(latest.device.batteryVoltage, 2)} V`}
          />
          <Metric label="Network" value={latest.device.network} />
          <Metric
            label="Sim quality"
            value={`${formatNumber(latest.quality.score)}%`}
            accent
          />
        </div>
      </section>

      <footer className="dossier-footer">
        <strong>
          Simulated ground sensor data // {latest.simulationModel}
        </strong>
        <p>
          Five-minute deterministic development simulation. Not a calibrated
          regulatory monitoring instrument.
        </p>
      </footer>
    </aside>
  );
}

function MeasurementHero({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <article>
      <header>
        {label}
        <span>Simulated</span>
      </header>
      <strong>{value}</strong>
      <small>{unit}</small>
      <p>Realtime 5m simulation</p>
    </article>
  );
}
function GasRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
      <td>{unit}</td>
    </tr>
  );
}
function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong className={accent ? 'accent' : undefined}>{value}</strong>
    </div>
  );
}
