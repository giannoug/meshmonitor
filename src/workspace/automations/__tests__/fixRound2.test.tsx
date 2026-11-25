/**
 * @vitest-environment jsdom
 *
 * Task 8.3 fix round 2 (Ruling 8.3 IC): Import Script re-reads the shared
 * script list (the pickers see the new script); Export sends the chosen
 * paths once; Import/Export show as today's section shows them; the script
 * test's message gate and parameters; MatchCount's empty line; the distance
 * summary in the viewer's unit.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { athensFixture as A } from '../../__fixtures__/athens';
import { g2AutomationSettings } from '../../__fixtures__/automations';
import { AUTO, nonGet, renderAutomations, requests } from './renderAutomations';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const RESPONDER = `${AUTO}/auto-responder`;
const enabled = async (name: string | RegExp, scope: Pick<typeof screen, 'findByRole'> = screen) => {
  const button = await scope.findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
};
const script = (name: string) => ({ path: `/data/scripts/${name}`, filename: name, name, language: 'Python' });

describe('I4: Import Script and Export Scripts', () => {
  it('Import sends one request with today\'s headers, then the shared list is re-read and the pickers offer the new script', async () => {
    const list = [script('weather.py')];
    renderAutomations(RESPONDER, {
      fixtures: {
        'GET /api/scripts': () => ({ scripts: list }),
        'POST /api/scripts/import': (_u, init) => {
          list.push(script(String(new Headers(init?.headers).get('x-filename'))));
          return { success: true };
        },
      },
    });
    await screen.findByText('weather {location}');
    const reads = requests('GET', '/api/scripts');
    const input = screen.getByLabelText('Import Script', { selector: 'input' });
    fireEvent.change(input, { target: { files: [new File(['print(1)'], 'tide.py', { type: 'text/x-python' })] } });
    await waitFor(() => expect(requests('GET', '/api/scripts')).toBe(reads + 1));
    const imports = vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).endsWith('/api/scripts/import') && i?.method === 'POST');
    expect(imports).toHaveLength(1);
    const headers = new Headers(imports[0][1]?.headers);
    expect(headers.get('x-filename')).toBe('tide.py');
    expect(headers.get('content-type')).toBe('application/octet-stream');
    expect(nonGet()).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const sheet = await screen.findByRole('dialog', { name: 'weather {location}' });
    expect(within(sheet).getByRole('option', { name: 'tide.py' })).toBeInTheDocument();
  });

  it('Export asks first, then sends one request with the chosen paths', async () => {
    const created = vi.fn(() => 'blob:x');
    Object.assign(window.URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    renderAutomations(RESPONDER, {
      fixtures: {
        'GET /api/scripts': () => ({ scripts: [script('weather.py'), script('tide.py')] }),
        'POST /api/scripts/export': () => new Response('zip', { status: 200, headers: { 'content-type': 'application/zip' } }),
      },
    });
    fireEvent.click(await enabled('Export Scripts'));
    const sheet = await screen.findByRole('dialog', { name: 'Export Scripts' });
    expect(within(sheet).getByText('Export all 2 script(s) as a zip file?')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'tide.py' }));
    expect(within(sheet).getByText('Export 1 selected script(s) as a zip file?')).toBeInTheDocument();
    fireEvent.keyDown(sheet, { key: 'Enter' });
    expect(nonGet()).toHaveLength(0);
    fireEvent.click(await enabled('Export Scripts', within(sheet)));
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    const posts = vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).endsWith('/api/scripts/export') && i?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ scripts: ['/data/scripts/tide.py'] });
  });

  it('a non-admin who can open the page sees Import and Export, as in today\'s section', async () => {
    renderAutomations(RESPONDER, { permissions: { bySource: { 'src-g2': { automation: { read: true, write: true } } } } as never });
    await screen.findByText('weather {location}');
    expect(screen.getByRole('button', { name: 'Import Script' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Scripts' })).toBeInTheDocument();
  });
});

describe('IC minors', () => {
  it('Minor 3: the responder\'s script test waits for a message, and shows the matched pattern and extracted parameters', async () => {
    renderAutomations(RESPONDER, {
      fixtures: {
        'POST /api/scripts/test': () => ({
          success: true, stdout: 'ok', wouldSendMessages: [], executionTimeMs: 5, matchedPattern: 'weather {location}', extractedParams: { location: 'marousi' },
        }),
      },
    });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    const sheet = await screen.findByRole('dialog', { name: 'weather {location}' });
    expect(within(sheet).getByRole('button', { name: /Run Test/ })).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText('Test Message'), { target: { value: 'weather marousi' } });
    fireEvent.click(await enabled(/Run Test/, within(sheet)));
    expect(await within(sheet).findByText('PARAM_location')).toBeInTheDocument();
    expect(within(sheet).getByText('marousi')).toBeInTheDocument();
    expect(within(sheet).getByText('Extracted Parameters')).toBeInTheDocument();
  });

  it('Minor 4: no matching nodes shows today\'s line', async () => {
    renderAutomations(`${AUTO}/auto-traceroute`);
    fireEvent.click(await screen.findByRole('switch', { name: 'Limit to matching nodes' }));
    fireEvent.change(screen.getByLabelText('Name pattern (regular expression)'), { target: { value: 'zzz-nobody' } });
    expect(await screen.findByText('No nodes match current filters')).toBeInTheDocument();
  });

  it('Minor 5: the Delete by Distance summary reads in the viewer\'s unit', async () => {
    renderAutomations(AUTO, { fixtures: { 'GET /api/settings': () => ({ ...A.settings, ...g2AutomationSettings, distanceUnit: 'mi' }) } });
    await screen.findByText('Weather bot');
    fireEvent.click(screen.getByRole('button', { name: /^On/ }));
    expect(await screen.findByText('Nodes over 93 mi · every 24 h')).toBeInTheDocument();
  });
});
