import {
  connectAsync,
} from 'mqtt';
import {
  randomUUID,
} from 'node:crypto';

function parsePositiveInteger(
  value,
  fallback,
  name,
) {
  const parsed = Number(
    value ?? fallback,
  );

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    throw new Error(
      `${name} must be a positive integer.`,
    );
  }

  return parsed;
}

function normalizeStationCode(value) {
  const stationCode = (
    value ?? 'BDG-AQ-001'
  )
    .trim()
    .toUpperCase();

  if (
    !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(
      stationCode,
    )
  ) {
    throw new Error(
      'SIMULATOR_STATION_CODE is invalid.',
    );
  }

  return stationCode;
}

function round(value, digits = 1) {
  const multiplier = 10 ** digits;

  return (
    Math.round(value * multiplier) /
    multiplier
  );
}

function createPayload(
  stationCode,
  sequence,
) {
  const variation =
    Math.sin(sequence / 3);

  return {
    schemaVersion: 1,
    messageId: randomUUID(),
    stationCode,
    observedAt:
      new Date().toISOString(),
    measurements: {
      pm25UgM3: round(
        35 + variation * 8,
      ),
      pm10UgM3: round(
        52 + variation * 11,
      ),
      coPpm: round(
        0.8 + variation * 0.15,
        2,
      ),
      co2Ppm: Math.round(
        520 + variation * 35,
      ),
      no2Ppb: round(
        30 + variation * 7,
      ),
      so2Ppb: round(
        6 + variation * 1.5,
      ),
      o3Ppb: round(
        20 - variation * 3,
      ),
      temperatureC: round(
        27 + variation * 1.2,
      ),
      humidityPct: round(
        72 - variation * 4,
      ),
      pressureHpa: round(
        941 + variation * 1.5,
      ),
    },
    device: {
      status: 'ONLINE',
      batteryVoltage: round(
        4.1 - sequence * 0.001,
        3,
      ),
      rssiDbm: Math.round(
        -65 + variation * 4,
      ),
      network: 'SIMULATOR',
      firmware: 'simulator-1.0.0',
    },
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function main() {
  const brokerUrl =
    process.env.MQTT_URL ??
    'mqtt://localhost:1883';

  const stationCode =
    normalizeStationCode(
      process.env.SIMULATOR_STATION_CODE,
    );

  const topicPrefix = (
    process.env.MQTT_TOPIC_PREFIX ??
    'airscope/v1'
  ).replace(/^\/+|\/+$/g, '');

  const messageCount =
    parsePositiveInteger(
      process.env.SIMULATOR_MESSAGE_COUNT,
      10,
      'SIMULATOR_MESSAGE_COUNT',
    );

  const intervalMs =
    parsePositiveInteger(
      process.env.SIMULATOR_INTERVAL_MS,
      5_000,
      'SIMULATOR_INTERVAL_MS',
    );

  const clientId =
    process.env.SIMULATOR_CLIENT_ID ??
    `airscope-simulator-${randomUUID()}`;

  const topic = [
    topicPrefix,
    'stations',
    stationCode,
    'telemetry',
  ].join('/');

  console.log(
    JSON.stringify({
      event:
        'telemetry_simulator_starting',
      brokerUrl,
      clientId,
      stationCode,
      topic,
      messageCount,
      intervalMs,
    }),
  );

  const client = await connectAsync(
    brokerUrl,
    {
      clientId,
      clean: true,
      connectTimeout: 10_000,
      reconnectPeriod: 1_000,
    },
  );

  try {
    for (
      let sequence = 1;
      sequence <= messageCount;
      sequence += 1
    ) {
      const payload =
        createPayload(
          stationCode,
          sequence,
        );

      await client.publishAsync(
        topic,
        JSON.stringify(payload),
        {
          qos: 1,
          retain: false,
        },
      );

      console.log(
        JSON.stringify({
          event:
            'telemetry_simulator_published',
          sequence,
          topic,
          messageId:
            payload.messageId,
          observedAt:
            payload.observedAt,
        }),
      );

      if (sequence < messageCount) {
        await delay(intervalMs);
      }
    }
  } finally {
    await client.endAsync();
  }

  console.log(
    JSON.stringify({
      event:
        'telemetry_simulator_completed',
      published: messageCount,
      topic,
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      event:
        'telemetry_simulator_failed',
      message:
        error instanceof Error
          ? error.message
          : String(error),
    }),
  );

  process.exitCode = 1;
});
