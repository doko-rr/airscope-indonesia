export function HistoryPlaceholder() {
  return (
    <section className="history-panel">
      <header>
        <div>
          <strong>24-hour history</strong>
          <span>Time-series cadence</span>
          <em>Bandung Basin Observation Network</em>
        </div>
        <p>
          <i /> PM2.5 Surface <span /> PM10 Coarse
        </p>
      </header>
      <div className="history-canvas">
        <div>
          <strong>Historical endpoint not connected</strong>
          <p>
            Time-series measurements will appear after sensor history is
            enabled.
          </p>
        </div>
      </div>
      <footer>
        <span>
          History status: <strong>Not connected</strong>
        </span>
        <span>
          Data buffer: <strong>Awaiting history endpoint</strong>
        </span>
      </footer>
    </section>
  );
}
