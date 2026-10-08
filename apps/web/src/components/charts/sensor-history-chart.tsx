'use client';

import { useEffect, useRef, useState } from 'react';
import type { ECharts, EChartsOption } from 'echarts';
import { getSensorHistory } from '@/lib/airscope-api';
import type { SensorHistoryPoint } from '@/types/sensor';

interface SensorHistoryChartProps {
  stationCode: string;
  stationName: string;
}

interface HistoryState {
  status: 'loading' | 'ready' | 'error';
  points: SensorHistoryPoint[];
  message?: string;
}

function formatChartTime(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatTooltipTime(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function SensorHistoryChart({
  stationCode,
  stationName,
}: SensorHistoryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const [history, setHistory] = useState<HistoryState>({
    status: 'loading',
    points: [],
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setHistory({ status: 'loading', points: [] });

    getSensorHistory(stationCode, 24, 60)
      .then((response) => {
        if (!active) return;
        setHistory({
          status: 'ready',
          points: response.data.measurements,
        });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
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
      controller.abort();
    };
  }, [stationCode]);

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
      const option: EChartsOption = {
        animationDuration: 350,
        color: ['#2d6a4f', '#4f5752'],
        grid: {
          left: 56,
          right: 24,
          top: 26,
          bottom: 42,
          containLabel: false,
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
            const first = entries[0];
            const index = Number(first?.dataIndex ?? 0);
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
            interval: 3,
            formatter: (value: string) => formatChartTime(value),
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
            lineStyle: {
              color: '#d8d4ca',
              width: 1,
            },
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
  }, [history]);

  return (
    <section className="history-panel history-chart-panel">
      <header>
        <div>
          <strong>24-hour particulate history</strong>
          <span>{stationCode}</span>
          <em>{stationName} · Hourly deterministic simulation</em>
        </div>
        <p>
          <i /> PM2.5 surface <span /> PM10 coarse
        </p>
      </header>

      <div className="history-chart-stage">
        {history.status === 'loading' ? (
          <div className="history-chart-state">
            <strong>Loading historical observations</strong>
            <p>Requesting the 24-hour deterministic series.</p>
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
          aria-label={`PM2.5 and PM10 history for ${stationName}`}
        />
      </div>

      <footer>
        <span>
          Source: <strong>AIRSIM-DETERMINISTIC-V1</strong>
        </span>
        <span>
          Interval: <strong>60 minutes · 25 points</strong>
        </span>
      </footer>
    </section>
  );
}
