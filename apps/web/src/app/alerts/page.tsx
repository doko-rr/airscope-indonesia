import { Suspense } from 'react';
import { AlertsDirectory } from '@/components/alerts/alerts-directory';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AtlasContextStrip } from '@/components/layout/atlas-context-strip';
import { OperationalHeader } from '@/components/layout/operational-header';
import { getEvents, getStationOverview } from '@/lib/airscope-api';
import { formatObservationTime } from '@/lib/formatters';

export default async function AlertsPage() {
  const [stations, eventsResponse] = await Promise.all([
    getStationOverview().catch(() => []),
    getEvents().catch(() => ({
      data: [],
      metadata: {
        count: 0,
        source: 'PERSISTED_DERIVED_SIMULATION' as const,
        severityOrder: ['CRITICAL', 'WARNING', 'CAUTION', 'INFO'] as const,
      },
    })),
  ]);

  const latestObservation = stations[0]?.latest.observedAt;
  const events = eventsResponse.data;

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
          <AlertsDirectory
            stations={stations}
            events={events}
            generatedAtMs={Date.now()}
          />
        </Suspense>
      </div>
    </main>
  );
}
