export function formatNumber(value: number, decimals = 1): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatObservationTime(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatRelativeDuration(
  from: string,
  to = new Date().toISOString(),
): string {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    return 'Unknown duration';
  }

  const totalMinutes = Math.max(0, Math.floor((toTime - fromTime) / 60_000));

  if (totalMinutes < 1) {
    return 'Less than 1 min';
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours < 24) {
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatEpisodeDuration(
  event: {
    occurredAt: string;
    clearedAt: string | null;
  },
  referenceDate = new Date(),
): string {
  return formatRelativeDuration(
    event.occurredAt,
    event.clearedAt ?? referenceDate.toISOString(),
  );
}
