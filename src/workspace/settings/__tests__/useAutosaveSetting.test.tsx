/**
 * @vitest-environment jsdom
 *
 * useAutosaveSetting (Task 5.8): one MeshMonitor setting saved as you go
 * through today's `POST /api/settings[?sourceId]` and its split (Node Display
 * keys to the source, the rest global). A change commits at once; a blur
 * field commits on commit() only. Writes for one key are serialized and only
 * the latest value is sent; a failure shows today's words and reverts.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { useAutosaveSetting, type AutosaveOptions } from '../useAutosaveSetting';
import { SOURCE_IDS } from '../../__fixtures__/athens';

const SRC = SOURCE_IDS.g2;

function Probe<T>({ k, opts }: { k: string; opts: AutosaveOptions<T> }) {
  const [value, set, status] = useAutosaveSetting<T>(k, opts);
  return (
    <div>
      <output data-testid="value">{String(value)}</output>
      <output data-testid="status">{status.saved ? 'saved' : status.error ?? ''}</output>
      <button type="button" onClick={() => set(opts.parse('77') as T)}>set77</button>
      <button type="button" onClick={() => set(opts.parse('88') as T)}>set88</button>
      <button type="button" onClick={() => set(opts.parse('99') as T)}>set99</button>
      <button type="button" onClick={() => status.commit()}>commit</button>
    </div>
  );
}

const num = (raw: string | undefined) => (raw === undefined ? 0 : Number(raw));
const posts = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([u, init]) => ({ url: String(u), body: JSON.parse(String(init?.body)) as Record<string, string> }));

type Fixtures = NonNullable<NonNullable<Parameters<typeof renderWorkspace>[1]>['fixtures']>;

/** A server that keeps what it is sent. */
function render(k: string, opts: AutosaveOptions<number>, fixtures: Fixtures = {}) {
  const stored: Record<string, string> = { maxNodeAgeHours: '24', packet_log_max_count: '1000' };
  return renderWorkspace(<Probe k={k} opts={opts} />, {
    route: `/source/${SRC}/settings/node-display`,
    fixtures: {
      'GET /api/settings': () => ({ ...stored }),
      'POST /api/settings': (_url, init) => {
        Object.assign(stored, JSON.parse(String(init?.body)));
        return { success: true };
      },
      ...fixtures,
    },
  });
}

describe('useAutosaveSetting', () => {
  it('reads the server value once, then a change saves a per-source key to ?sourceId=', async () => {
    render('maxNodeAgeHours', { sourceId: SRC, commit: 'change', parse: num });
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('24'));
    fireEvent.click(screen.getByText('set77'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('saved'));
    expect(posts()).toEqual([{ url: expect.stringContaining(`/api/settings?sourceId=${SRC}`), body: { maxNodeAgeHours: '77' } }]);
    expect(screen.getByTestId('value')).toHaveTextContent('77');
  });

  it('a global key goes to the unscoped POST, as SettingsTab splits it', async () => {
    render('packet_log_max_count', { sourceId: SRC, commit: 'change', parse: num });
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('1000'));
    fireEvent.click(screen.getByText('set77'));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(new URL(posts()[0].url, 'http://x').search).toBe('');
    expect(posts()[0].body).toEqual({ packet_log_max_count: '77' });
  });

  it('blur mode stages a value and sends nothing until commit()', async () => {
    render('maxNodeAgeHours', { sourceId: SRC, commit: 'blur', parse: num });
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('24'));
    fireEvent.click(screen.getByText('set77'));
    expect(screen.getByTestId('value')).toHaveTextContent('77');
    await act(async () => {});
    expect(posts()).toHaveLength(0);
    fireEvent.click(screen.getByText('commit'));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toEqual({ maxNodeAgeHours: '77' });
    // Committing the saved value again sends nothing.
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('saved'));
    fireEvent.click(screen.getByText('commit'));
    await act(async () => {});
    expect(posts()).toHaveLength(1);
  });

  it('serializes writes for one key and sends only the latest value after the one in flight', async () => {
    let release: () => void = () => {};
    const first = new Promise<void>((r) => (release = r));
    render('maxNodeAgeHours', { sourceId: SRC, commit: 'change', parse: num });
    // The first POST answers only when released.
    const served = vi.mocked(fetch).getMockImplementation()!;
    let n = 0;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (init?.method === 'POST' && ++n === 1) await first;
      return served(input, init);
    });
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('24'));
    fireEvent.click(screen.getByText('set77'));
    fireEvent.click(screen.getByText('set88'));
    fireEvent.click(screen.getByText('set99'));
    await act(async () => {});
    expect(posts().map((p) => p.body.maxNodeAgeHours)).toEqual(['77']);
    release();
    await waitFor(() => expect(posts().map((p) => p.body.maxNodeAgeHours)).toEqual(['77', '99']));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('saved'));
    expect(screen.getByTestId('value')).toHaveTextContent('99');
  });

  it('a failed write shows today\'s error and reverts to the server value, with no retry', async () => {
    render('maxNodeAgeHours', { sourceId: SRC, commit: 'change', parse: num }, {
      'POST /api/settings': () => new Response(JSON.stringify({ error: 'nope' }), { status: 400 }),
    });
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('24'));
    fireEvent.click(screen.getByText('set77'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Failed to save settings. Please try again.'));
    expect(screen.getByTestId('value')).toHaveTextContent('24');
    expect(posts()).toHaveLength(1);
  });
});
