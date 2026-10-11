'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ECharts, EChartsOption } from 'echarts';
import { getSensorHistory } from '@/lib/airscope-api';
import type { SensorHistoryPoint } from '@/types/sensor';

type RangeKey = '6H' | '12H' | '24H' | '7D';

interface RangeOption {
  label: RangeKey;
  hours: number;
  interval: 5 | 15 | 30 | 60;
  description: string;
}

interface SensorHistoryChartProps {
  stationCode: string;
  stationName: string;
  refreshRevision?: number;
}

interface HistoryState {
  status: 'loading' | 'ready' | 'error';
  points: SensorHistoryPoint[];
  message?: string;
}

interface PollutantStatistics {
  minimum: number;
  average: number;
  maximum: number;
}

const RANGE_OPTIONS: RangeOption[] = [
  { label: '6H', hours: 6, interval: 15, description: '15-minute interval' },
  { label: '12H', hours: 12, interval: 30, description: '30-minute interval' },
  { label: '24H', hours: 24, interval: 60, description: 'Hourly interval' },
  { label: '7D', hours: 168, interval: 60, description: 'Hourly interval' },
];

function calculateStatistics(values: number[]): PollutantStatistics {
  if (values.length === 0) {
    return { minimum: 0, average: 0, maximum: 0 };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    minimum: Math.min(...values),
    average: total / values.length,
    maximum: Math.max(...values),
  };
}

function formatChartTime(value: string, range: RangeKey): string {
  const options: Intl.DateTimeFormatOptions =
    range === '7D'
      ? {
          timeZone: 'Asia/Jakarta',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
        }
      : {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
        };

  return new Intl.DateTimeFormat('id-ID', options).format(new Date(value));
}

function formatTooltipTime(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function StatisticValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="history-stat-value">
      <span>{label}</span>
      <strong>{value.toFixed(1)}</strong>
      <small>µg/m³</small>
    </div>
  );
}

export function SensorHistoryChart({
  stationCode,
  stationName,
  refreshRevision = 0,
}: SensorHistoryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeKey>('24H');
  const [history, setHistory] = useState<HistoryState>({
    status: 'loading',
    points: [],
  });

  const activeRange =
    RANGE_OPTIONS.find((option) => option.label === selectedRange) ??
    RANGE_OPTIONS[2];

  const statistics = useMemo(() => {
    const pm25 = calculateStatistics(
      history.points.map((point) => point.pm25UgM3),
    );
    const pm10 = calculateStatistics(
      history.points.map((point) => point.pm10UgM3),
    );

    return { pm25, pm10 };
  }, [history.points]);

  useEffect(() => {
    let active = true;

    setHistory({ status: 'loading', points: [] });

    getSensorHistory(stationCode, activeRange.hours, activeRange.interval)
      .then((response) => {
        if (!active) return;
        setHistory({
          status: 'ready',
          points: response.data.measurements,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHistory({
          status: 'error',
          points: [],
          message:
            error instanceof Error
              ? error.message
              : 'Historical observations could not be loaded.',
        });
      });

    return () => {
      active = false;
    };
  }, [activeRange.hours, activeRange.interval, refreshRevision, stationCode]);

  useEffect(() => {
    if (
      history.status !== 'ready' ||
      history.points.length === 0 ||
      !containerRef.current
    ) {
      return;
    }

    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    void import('echarts').then((echarts) => {
      if (disposed || !containerRef.current) return;

      chartRef.current?.dispose();
      const chart = echarts.init(containerRef.current, undefined, {
        renderer: 'svg',
      });
      chartRef.current = chart;

      const timestamps = history.points.map((point) => point.observedAt);
      const labelInterval =
        selectedRange === '7D'
          ? Math.max(0, Math.floor(timestamps.length / 7) - 1)
          : Math.max(0, Math.floor(timestamps.length / 6) - 1);

      const option: EChartsOption = {
        animationDuration: 320,
        color: ['#2d6a4f', '#4f5752'],
        grid: {
          left: 58,
          right: 24,
          top: 26,
          bottom: 46,
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#f7f6f2',
          borderColor: '#1a1d20',
          borderWidth: 1,
          textStyle: {
            color: '#1a1d20',
            fontFamily: 'monospace',
            fontSize: 11,
          },
          formatter: (params) => {
            const entries = Array.isArray(params) ? params : [params];
            const index = Number(entries[0]?.dataIndex ?? 0);
            const point = history.points[index];
            if (!point) return '';

            return [
              `<strong>${formatTooltipTime(point.observedAt)} WIB</strong>`,
              `PM2.5&nbsp;&nbsp; ${point.pm25UgM3.toFixed(1)} µg/m³`,
              `PM10&nbsp;&nbsp;&nbsp; ${point.pm10UgM3.toFixed(1)} µg/m³`,
            ].join('<br/>');
          },
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: timestamps,
          axisLine: { lineStyle: { color: '#9a9f9b' } },
          axisTick: { show: false },
          axisLabel: {
            color: '#707973',
            fontFamily: 'monospace',
            fontSize: 10,
            interval: labelInterval,
            hideOverlap: true,
            formatter: (value: string) => formatChartTime(value, selectedRange),
          },
        },
        yAxis: {
          type: 'value',
          name: 'µg/m³',
          nameTextStyle: {
            color: '#707973',
            fontFamily: 'monospace',
            fontSize: 10,
          },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#707973',
            fontFamily: 'monospace',
            fontSize: 10,
          },
          splitLine: {
            lineStyle: { color: '#d8d4ca', width: 1 },
          },
        },
        series: [
          {
            name: 'PM2.5',
            type: 'line',
            data: history.points.map((point) => point.pm25UgM3),
            showSymbol: false,
            smooth: false,
            lineStyle: { color: '#2d6a4f', width: 2 },
            emphasis: { focus: 'series' },
          },
          {
            name: 'PM10',
            type: 'line',
            data: history.points.map((point) => point.pm10UgM3),
            showSymbol: false,
            smooth: false,
            lineStyle: {
              color: '#4f5752',
              width: 1.5,
              type: 'dashed',
            },
            emphasis: { focus: 'series' },
          },
        ],
      };

      chart.setOption(option);
      resizeObserver = new ResizeObserver(() => chart.resize());
      resizeObserver.observe(containerRef.current);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [history, selectedRange]);

  return (
    <section className="history-panel history-chart-panel">
      <header className="history-chart-header">
        <div>
          <strong>Particulate history</strong>
          <span>{stationCode}</span>
          <em>{stationName} · Deterministic simulation</em>
        </div>

        <div
          className="history-range-control"
          role="group"
          aria-label="History time range"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={
                selectedRange === option.label ? 'is-active' : undefined
              }
              aria-pressed={selectedRange === option.label}
              onClick={() => setSelectedRange(option.label)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="history-statistics" aria-label="Particulate statistics">
        <article className="history-stat-group is-pm25">
          <header>
            <span className="history-stat-swatch" />
            <strong>PM2.5</strong>
            <small>Fine particulate</small>
          </header>
          <div className="history-stat-values">
            <StatisticValue label="Minimum" value={statistics.pm25.minimum} />
            <StatisticValue label="Average" value={statistics.pm25.average} />
            <StatisticValue label="Maximum" value={statistics.pm25.maximum} />
          </div>
        </article>

        <article className="history-stat-group is-pm10">
          <header>
            <span className="history-stat-swatch" />
            <strong>PM10</strong>
            <small>Coarse particulate</small>
          </header>
          <div className="history-stat-values">
            <StatisticValue label="Minimum" value={statistics.pm10.minimum} />
            <StatisticValue label="Average" value={statistics.pm10.average} />
            <StatisticValue label="Maximum" value={statistics.pm10.maximum} />
          </div>
        </article>
      </div>

      <div className="history-chart-stage">
        {history.status === 'loading' ? (
          <div className="history-chart-state">
            <strong>Loading historical observations</strong>
            <p>
              Requesting {selectedRange} series · {activeRange.description}.
            </p>
          </div>
        ) : null}

        {history.status === 'error' ? (
          <div className="history-chart-state is-error">
            <strong>History endpoint unavailable</strong>
            <p>{history.message}</p>
          </div>
        ) : null}

        <div
          ref={containerRef}
          className={
            history.status === 'ready'
              ? 'history-chart-canvas is-visible'
              : 'history-chart-canvas'
          }
          role="img"
          aria-label={`PM2.5 and PM10 ${selectedRange} history for ${stationName}`}
        />
      </div>

      <footer>
        <span>
          Range: <strong>{selectedRange}</strong> · {activeRange.description}
        </span>
        <span>
          Points: <strong>{history.points.length || '—'}</strong>
        </span>
        <span>
          Source: <strong>AIRSIM-DETERMINISTIC-V1</strong>
        </span>
      </footer>
    </section>
  );
}
