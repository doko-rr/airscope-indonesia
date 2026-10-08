import type { StationWithMeasurement } from '@/types/sensor';

interface MapPlaceholderProps {
  stations: StationWithMeasurement[];
  selectedCode: string;
}

export function MapPlaceholder({
  stations,
  selectedCode,
}: MapPlaceholderProps) {
  return (
    <section className="map-panel" aria-label="Air quality map placeholder">
      <div className="map-toolbar">
        <strong>Ground stations: enabled</strong>
        <span>Admin boundaries: enabled</span>
        <span>Terrain context: enabled</span>
        <span className="disabled">Satellite: not connected</span>
        <span className="disabled">Wind layer: no data source</span>
      </div>

      <div className="map-canvas">
        <div className="map-grid" aria-hidden="true" />
        <div className="terrain-line terrain-one" aria-hidden="true" />
        <div className="terrain-line terrain-two" aria-hidden="true" />
        <div className="river-line" aria-hidden="true" />

        {stations.map(({ station }, index) => {
          const positions = [
            ['50%', '58%'],
            ['55%', '37%'],
            ['84%', '67%'],
            ['16%', '55%'],
            ['57%', '17%'],
            ['62%', '74%'],
          ];
          const [left, top] = positions[index] ?? ['50%', '50%'];
          const selected = station.code === selectedCode;
          const advisory = station.status === 'WARNING';
          return (
            <div
              className={`station-marker ${selected ? 'is-selected' : ''} ${advisory ? 'is-advisory' : ''}`}
              style={{ left, top }}
              key={station.code}
            >
              <i aria-hidden="true" />
              <span>
                {station.code} // {station.name}
              </span>
              <small>
                {advisory ? 'Advisory' : 'Online'} ·{' '}
                {station.profile.replaceAll('_', ' ')}
              </small>
            </div>
          );
        })}

        <div className="map-caption map-caption-north">
          Bandung Basin Observation Network
        </div>
        <div className="map-caption map-caption-south">
          Ground observation development layer
        </div>

        <div className="map-legend">
          <strong>Ground station status</strong>
          <span>
            <i className="legend-healthy" /> Healthy
          </span>
          <span>
            <i className="legend-advisory" /> Advisory
          </span>
          <span>
            <i className="legend-selected" /> Selected
          </span>
          <span>
            <i className="legend-offline" /> Offline
          </span>
        </div>
      </div>

      <footer className="map-metadata">
        <span>
          Model: <strong>AIRSIM-DETERMINISTIC-V1</strong>
        </span>
        <span>
          Projection: <strong>UTM Zone 48S / WGS84</strong>
        </span>
        <span>
          Sampling cadence: <strong>5 minutes</strong>
        </span>
        <button disabled>Export GeoJSON · Coming soon</button>
        <button>Re-center Asia Afrika</button>
      </footer>
    </section>
  );
}
