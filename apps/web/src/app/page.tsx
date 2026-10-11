import { AppSidebar } from '@/components/layout/app-sidebar';
import { AtlasContextStrip } from '@/components/layout/atlas-context-strip';
import { OperationalHeader } from '@/components/layout/operational-header';
import { CollapsibleNetworkSummary } from '@/components/overview/collapsible-network-summary';
import { OverviewWorkspace } from '@/components/overview/overview-workspace';
import { getStationOverview } from '@/lib/airscope-api';
import { formatObservationTime } from '@/lib/formatters';

export default async function Home() {
  try {
    const stations = await getStationOverview();
    const selected =
      stations.find(({ station }) => station.code === 'BDG-AQ-001') ??
      stations[0];

    return (
      <main className="application-shell">
        <AppSidebar />
        <div className="application-content">
          <OperationalHeader
            latestObservation={formatObservationTime(
              selected.latest.observedAt,
            )}
          />
          <AtlasContextStrip />
          <CollapsibleNetworkSummary stations={stations} />
          <OverviewWorkspace
            stations={stations}
            initialSelectedCode={selected.station.code}
          />
        </div>
      </main>
    );
  } catch {
    return (
      <main className="api-error">
        <section>
          <span>API unavailable</span>
          <h1>AirScope cannot reach the NestJS backend.</h1>
          <p>
            Start the backend at <code>http://localhost:4000</code> and refresh
            this page.
          </p>
        </section>
      </main>
    );
  }
}
