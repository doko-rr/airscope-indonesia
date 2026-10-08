'use client';

import 'leaflet/dist/leaflet.css';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import type { StationWithMeasurement } from '@/types/sensor';

interface AirQualityMapProps {
  stations: StationWithMeasurement[];
  selectedCode: string;
  onSelectStation: (code: string) => void;
}

const BANDUNG_CENTER: [number, number] = [-6.9175, 107.6191];

export function AirQualityMap({
  stations,
  selectedCode,
  onSelectStation,
}: AirQualityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: BANDUNG_CENTER,
        zoom: 11,
        minZoom: 8,
        maxZoom: 18,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);
      L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

      const protocol = 'https:';
      const tileHost = '//tile.openstreetmap.org';
      L.tileLayer(`${protocol}${tileHost}/{z}/{x}/{y}.png`, {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
        className: 'airscope-raster-tiles',
      }).addTo(map);

      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(containerRef.current);
      window.setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void import('leaflet').then((L) => {
      const map = mapRef.current;
      if (cancelled || !map) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = stations.map(({ station, latest }) => {
        const selected = station.code === selectedCode;
        const advisory = station.status === 'WARNING';
        const classNames = [
          'leaflet-station-marker',
          selected ? 'is-selected' : '',
          advisory ? 'is-advisory' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const markerTitle =
          selected || advisory
            ? `${station.code} // ${station.name}`
            : station.name;
        const markerDetail =
          selected || advisory
            ? `${advisory ? 'ADVISORY' : 'ONLINE'} · PM2.5 ${latest.measurements.pm25UgM3.toFixed(1)} µg/m³`
            : `${latest.measurements.pm25UgM3.toFixed(1)} µg/m³`;

        const icon = L.divIcon({
          className: 'airscope-div-icon',
          html: `
            <button class="${classNames}" type="button" aria-label="${station.code}, ${station.name}">
              <span class="marker-core" aria-hidden="true"></span>
              <span class="marker-label">
                <strong>${markerTitle}</strong>
                <small>${markerDetail}</small>
              </span>
            </button>
          `,
          iconSize: selected ? [30, 30] : [18, 18],
          iconAnchor: selected ? [15, 15] : [9, 9],
        });

        const marker = L.marker(
          [station.location.latitude, station.location.longitude],
          { icon },
        )
          .addTo(map)
          .bindPopup(
            `<div class="popup-content">
              <strong>${station.code} // ${station.name}</strong>
              <span>${station.profile.replaceAll('_', ' ')}</span>
              <dl>
                <div><dt>PM2.5</dt><dd>${latest.measurements.pm25UgM3.toFixed(1)} µg/m³</dd></div>
                <div><dt>Temp</dt><dd>${latest.measurements.temperatureC.toFixed(1)} °C</dd></div>
                <div><dt>Signal</dt><dd>${latest.device.rssiDbm} dBm</dd></div>
              </dl>
            </div>`,
            { className: 'airscope-popup', closeButton: false },
          );

        marker.on('click', () => {
          onSelectStation(station.code);
          map.flyTo(
            [station.location.latitude, station.location.longitude],
            13,
            { duration: 0.8 },
          );
        });

        return marker;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [onSelectStation, selectedCode, stations]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = stations.find(
      ({ station }) => station.code === selectedCode,
    );
    if (!map || !selected) return;

    map.flyTo(
      [selected.station.location.latitude, selected.station.location.longitude],
      Math.max(map.getZoom(), 12),
      { duration: 0.65 },
    );
  }, [selectedCode, stations]);

  const recenter = () => {
    const map = mapRef.current;
    const selected = stations.find(
      ({ station }) => station.code === selectedCode,
    );
    if (!map || !selected) return;

    map.flyTo(
      [selected.station.location.latitude, selected.station.location.longitude],
      12,
      { duration: 0.8 },
    );
  };

  return (
    <section className="map-panel" aria-label="Interactive air-quality map">
      <div className="map-toolbar">
        <strong>Ground stations: enabled</strong>
        <span>OpenStreetMap raster: enabled</span>
        <span className="disabled">Satellite: not connected</span>
        <span className="disabled">Wind layer: no data source</span>
      </div>

      <div className="maplibre-stage leaflet-stage">
        <div
          ref={containerRef}
          className="maplibre-container leaflet-container"
        />
        <div className="map-frame-label map-frame-title">
          Bandung Basin Observation Network
        </div>
        <div className="map-legend maplibre-legend">
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
          Source: <strong>OpenStreetMap</strong>
        </span>
        <span>
          Datum: <strong>WGS84</strong>
        </span>
        <span>
          Sampling cadence: <strong>5 minutes</strong>
        </span>
        <button disabled>Export GeoJSON · Coming soon</button>
        <button type="button" onClick={recenter}>
          Re-center Asia Afrika
        </button>
      </footer>
    </section>
  );
}
