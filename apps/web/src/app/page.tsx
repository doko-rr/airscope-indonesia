import { AppSidebar } from '@/components/layout/app-sidebar';
import { AtlasContextStrip } from '@/components/layout/atlas-context-strip';
import { OperationalHeader } from '@/components/layout/operational-header';
import { MapPlaceholder } from '@/components/map/map-placeholder';
import { HistoryPlaceholder } from '@/components/overview/history-placeholder';
import { NetworkSummary } from '@/components/overview/network-summary';
import { StationDossier } from '@/components/overview/station-dossier';
import { StationLedger } from '@/components/overview/station-ledger';
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
          <NetworkSummary stations={stations} />
          <div className="workspace-grid">
            <MapPlaceholder
              stations={stations}
              selectedCode={selected.station.code}
            />
            <StationDossier item={selected} />
          </div>
          <div className="lower-grid">
            <HistoryPlaceholder />
            <StationLedger stations={stations} />
          </div>
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
