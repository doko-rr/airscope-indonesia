import { AppSidebar } from '@/components/layout/app-sidebar';
import { AtlasContextStrip } from '@/components/layout/atlas-context-strip';
import { OperationalHeader } from '@/components/layout/operational-header';
import { getStationOverview } from '@/lib/airscope-api';
import { formatObservationTime } from '@/lib/formatters';

export default async function AlertsPage() {
  const stations = await getStationOverview().catch(() => []);
  const latestObservation = stations[0]?.latest.observedAt;

  return (
    <main className="application-shell">
      <AppSidebar />
      <div className="application-content">
        <OperationalHeader
          latestObservation={
            latestObservation
              ? formatObservationTime(latestObservation)
              : 'Unavailable'
          }
        />
        <AtlasContextStrip />

        <section className="alerts-page-header">
          <div>
            <span>Operational triage</span>
            <h1>Alerts</h1>
            <p>
              Review active air-quality and telemetry conditions across the
              Bandung observation network.
            </p>
          </div>
          <strong>
            Stage 01
            <small>Route shell</small>
          </strong>
        </section>

        <section className="alerts-empty-state" aria-labelledby="alerts-title">
          <span>Alerts directory</span>
          <h2 id="alerts-title">Alert processing is ready for integration.</h2>
          <p>
            The route and application shell are now available. Sensor-derived
            advisory, delayed, stale, and offline records will be connected in
            the next stage.
          </p>
          <a href="/sensors">← Return to sensor directory</a>
        </section>
      </div>
    </main>
  );
}
