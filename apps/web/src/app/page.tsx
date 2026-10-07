import { getStationOverview } from "@/lib/airscope-api";
import type {
  SensorStatus,
  StationWithMeasurement,
} from "@/types/sensor";

function statusClass(status: SensorStatus): string {
  const styles: Record<SensorStatus, string> = {
    ONLINE: "bg-emerald-500",
    WARNING: "bg-amber-500",
    OFFLINE: "bg-zinc-400",
    MAINTENANCE: "bg-sky-500",
  };

  return styles[status];
}

function formatNumber(value: number, decimals = 1): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function calculateSummary(stations: StationWithMeasurement[]) {
  const onlineStations = stations.filter(
    ({ station }) => station.status === "ONLINE",
  ).length;

  const averagePm25 =
    stations.reduce(
      (total, item) =>
        total + item.latest.measurements.pm25UgM3,
      0,
    ) / stations.length;

  const highestStation = [...stations].sort(
    (first, second) =>
      second.latest.measurements.pm25UgM3 -
      first.latest.measurements.pm25UgM3,
  )[0];

  return {
    onlineStations,
    averagePm25,
    highestStation,
  };
}

export default async function Home() {
  let stations: StationWithMeasurement[];

  try {
    stations = await getStationOverview();
  } catch {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3f1eb] px-6 text-[#20231f]">
        <section className="max-w-xl border-l-2 border-red-700 pl-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-700">
            API unavailable
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            AirScope tidak dapat menghubungi backend.
          </h1>

          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Pastikan NestJS berjalan pada
            {" "}
            <code className="font-mono text-zinc-900">
              http://localhost:4000
            </code>
            .
          </p>
        </section>
      </main>
    );
  }

  const summary = calculateSummary(stations);

  return (
    <main className="min-h-screen bg-[#f3f1eb] text-[#20231f]">
      <header className="border-b border-black/15 px-6 py-5 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#56705c]">
              Environmental observation system
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] lg:text-4xl">
              AirScope Indonesia
            </h1>
          </div>

          <div className="hidden text-right font-mono text-xs leading-5 text-zinc-500 sm:block">
            <p>Bandung, Jawa Barat</p>
            <p>Ground observation network</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10">
        <section className="border-b border-black/15 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="border border-amber-700/30 bg-amber-50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-800">
              Simulated ground sensor data
            </span>

            <span className="font-mono text-[11px] text-zinc-500">
              AIRSIM-DETERMINISTIC-V1
            </span>
          </div>

          <div className="mt-8 grid gap-px border-y border-black/15 bg-black/15 md:grid-cols-3">
            <article className="bg-[#f3f1eb] py-6 md:pr-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Active stations
              </p>

              <p className="mt-3 text-5xl font-medium tracking-[-0.06em]">
                {summary.onlineStations}
                <span className="ml-2 text-xl text-zinc-400">
                  / {stations.length}
                </span>
              </p>
            </article>

            <article className="bg-[#f3f1eb] py-6 md:px-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Network average PM2.5
              </p>

              <p className="mt-3 text-5xl font-medium tracking-[-0.06em]">
                {formatNumber(summary.averagePm25)}
                <span className="ml-2 text-base tracking-normal text-zinc-500">
                  µg/m³
                </span>
              </p>
            </article>

            <article className="bg-[#f3f1eb] py-6 md:pl-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Highest PM2.5 station
              </p>

              <p className="mt-3 text-2xl font-medium tracking-[-0.03em]">
                {summary.highestStation.station.name}
              </p>

              <p className="mt-1 font-mono text-xs text-zinc-500">
                {formatNumber(
                  summary.highestStation.latest.measurements.pm25UgM3,
                )}{" "}
                µg/m³
              </p>
            </article>
          </div>
        </section>

        <section className="py-8">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Ground network
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Sensor stations
              </h2>
            </div>

            <p className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:block">
              Updated in five-minute intervals
            </p>
          </div>

          <div className="border-t border-black/20">
            {stations.map(({ station, latest }) => (
              <article
                key={station.code}
                className="grid gap-5 border-b border-black/15 py-6 transition-colors hover:bg-white/40 md:grid-cols-[1.4fr_0.8fr_1fr_1fr]"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full ${statusClass(station.status)}`}
                    />

                    <span className="font-mono text-[11px] tracking-[0.1em] text-zinc-500">
                      {station.code}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-medium tracking-[-0.03em]">
                    {station.name}
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    {station.city} · {station.profile.replaceAll("_", " ")}
                  </p>
                </div>

                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    PM2.5
                  </p>

                  <p className="mt-2 text-3xl tracking-[-0.05em]">
                    {formatNumber(latest.measurements.pm25UgM3)}
                  </p>

                  <p className="font-mono text-[10px] text-zinc-500">
                    µg/m³
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                      Temperature
                    </p>

                    <p className="mt-2 text-lg">
                      {formatNumber(
                        latest.measurements.temperatureC,
                      )}{" "}
                      °C
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                      Humidity
                    </p>

                    <p className="mt-2 text-lg">
                      {formatNumber(
                        latest.measurements.humidityPct,
                      )}%
                    </p>
                  </div>
                </div>

                <div className="md:text-right">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    Signal and quality
                  </p>

                  <p className="mt-2 text-sm">
                    {latest.device.rssiDbm} dBm ·{" "}
                    {formatNumber(latest.quality.score)}%
                  </p>

                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#56705c]">
                    {latest.quality.label}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
