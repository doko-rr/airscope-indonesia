import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvent, stations } from '@/test/event-fixtures';
import { AlertsDirectory } from './alerts-directory';

const routerReplace = vi.fn();

let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: routerReplace,
  }),
  usePathname: () => '/alerts',
  useSearchParams: () => currentSearchParams,
}));

const generatedAtMs = new Date('2026-10-15T11:00:00.000Z').getTime();

function renderDirectory() {
  return render(
    <AlertsDirectory
      stations={stations}
      events={[createEvent()]}
      generatedAtMs={generatedAtMs}
    />,
  );
}

describe('Alerts search debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    routerReplace.mockReset();
    currentSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('filters locally before updating the URL', async () => {
    renderDirectory();

    const search = screen.getByPlaceholderText(
      'Station, type, severity, profile',
    );

    expect(screen.getByText('Station offline')).toBeInTheDocument();

    fireEvent.change(search, {
      target: {
        value: 'not-found',
      },
    });

    expect(screen.queryByText('Station offline')).not.toBeInTheDocument();

    expect(
      screen.getByText('No alerts match the current filters.'),
    ).toBeInTheDocument();

    expect(routerReplace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });

    expect(routerReplace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(routerReplace).toHaveBeenCalledTimes(1);
    expect(routerReplace).toHaveBeenCalledWith('/alerts?q=not-found', {
      scroll: false,
    });
  });

  it('cancels the previous search timeout', async () => {
    renderDirectory();

    const search = screen.getByPlaceholderText(
      'Station, type, severity, profile',
    );

    fireEvent.change(search, {
      target: {
        value: 'station',
      },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    fireEvent.change(search, {
      target: {
        value: 'station offline',
      },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });

    expect(routerReplace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(routerReplace).toHaveBeenCalledTimes(1);
    expect(routerReplace).toHaveBeenCalledWith('/alerts?q=station+offline', {
      scroll: false,
    });
  });

  it('initializes the input from the URL query', () => {
    currentSearchParams = new URLSearchParams('q=episode+1');

    renderDirectory();

    expect(
      screen.getByPlaceholderText('Station, type, severity, profile'),
    ).toHaveValue('episode 1');

    expect(screen.getByText('Station offline')).toBeInTheDocument();

    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('clears the input and URL filters', () => {
    currentSearchParams = new URLSearchParams('q=offline&severity=critical');

    renderDirectory();

    const search = screen.getByPlaceholderText(
      'Station, type, severity, profile',
    );

    expect(search).toHaveValue('offline');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Clear filters ×',
      }),
    );

    expect(search).toHaveValue('');

    expect(routerReplace).toHaveBeenCalledWith('/alerts', {
      scroll: false,
    });
  });
});
