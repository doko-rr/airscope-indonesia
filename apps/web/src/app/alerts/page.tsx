import { Suspense } from 'react';
import { AlertsDirectory } from '@/components/alerts/alerts-directory';
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
              Prioritized air-quality and telemetry conditions derived from the
              current Bandung observation network snapshot.
            </p>
          </div>
          <strong>
            Stage 03
            <small>Filter controls</small>
          </strong>
        </section>

        <Suspense
          fallback={
            <div className="alerts-loading">Loading alert controls…</div>
          }
        >
          <AlertsDirectory stations={stations} generatedAtMs={Date.now()} />
        </Suspense>
      </div>
    </main>
  );
}
