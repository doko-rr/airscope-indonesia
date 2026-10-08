import type { StationWithMeasurement } from '@/types/sensor';
import { formatNumber } from '@/lib/formatters';

interface NetworkSummaryProps {
  stations: StationWithMeasurement[];
}

export function NetworkSummary({ stations }: NetworkSummaryProps) {
  const reporting = stations.length;
  const advisories = stations.filter(
    ({ station }) => station.status === 'WARNING',
  );
  const meanPm25 =
    stations.reduce((sum, item) => sum + item.latest.measurements.pm25UgM3, 0) /
    reporting;
  const highest = stations.reduce((current, item) =>
    item.latest.measurements.pm25UgM3 > current.latest.measurements.pm25UgM3
      ? item
      : current,
  );

  return (
    <section className="network-summary" aria-label="Network summary">
      <SummaryItem
        index="01"
        label="Reporting stations"
        value={`${reporting} / 6`}
        note={`${advisories.length} station in advisory state`}
        accent="green"
      />
      <SummaryItem
        index="02"
        label="Network mean PM2.5"
        value={formatNumber(meanPm25)}
        unit="µg/m³"
        note="Basin sensor average"
      />
      <SummaryItem
        index="03"
        label="Highest PM2.5 station"
        value={formatNumber(highest.latest.measurements.pm25UgM3)}
        unit="µg/m³"
        note={`${highest.station.code} · ${highest.station.name}`}
        accent="ochre"
      />
      <SummaryItem
        index="04"
        label="Open advisories"
        value={String(advisories.length).padStart(2, '0')}
        unit="station"
        note={advisories[0]?.station.name ?? 'None'}
        accent="ochre"
      />
      <SummaryItem
        index="05"
        label="Satellite layer"
        value="Not connected"
        note="Sentinel-5P integration planned"
        muted
      />
    </section>
  );
}

interface SummaryItemProps {
  index: string;
  label: string;
  value: string;
  unit?: string;
  note: string;
  accent?: 'green' | 'ochre';
  muted?: boolean;
}

function SummaryItem({
  index,
  label,
  value,
  unit,
  note,
  accent,
  muted,
}: SummaryItemProps) {
  return (
    <article
      className={`summary-cell ${accent ? `is-${accent}` : ''} ${muted ? 'is-muted' : ''}`}
    >
      <header>
        <span>{index}.</span>
        <strong>{label}</strong>
      </header>
      <div className="summary-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      <footer>{note}</footer>
    </article>
  );
}
