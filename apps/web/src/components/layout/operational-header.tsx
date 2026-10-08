interface OperationalHeaderProps {
  latestObservation: string;
}

export function OperationalHeader({
  latestObservation,
}: OperationalHeaderProps) {
  return (
    <header className="operational-header">
      <section>
        <strong>AirScope Indonesia</strong>
        <span>Ground and satellite air-quality observation platform</span>
      </section>
      <section>
        <strong>Bandung, Jawa Barat</strong>
        <span>107.6071 E, 6.9218 S · Alt 768 m MSL</span>
      </section>
      <section>
        <span>Ground network</span>
        <strong>6 / 6 reporting</strong>
      </section>
      <section className="header-time">
        <span>Last observation</span>
        <strong>{latestObservation} · Interval: 5 min</strong>
      </section>
      <span className="obs-badge">OBS</span>
    </header>
  );
}
