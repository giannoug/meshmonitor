/**
 * @vitest-environment jsdom
 *
 * Mesh impact (Task 8.4, CLAUDE.md checklist): opening and re-rendering every
 * rules page and tab sends no write; each write is counted where its control
 * is tested (14-01, 14-02, 14-03, m2-rule, m4-runs, 14-04).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { nonGet, renderRules, settle } from './renderRules';
import { fakeSocket } from './socketMock';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./socketMock')).socketMock(orig));

describe('rules pages send nothing on open or re-render', () => {
  it.each([
    ['/overview/automations', 'Weather bot'],
    ['/overview/automations/variables', 'lowBatteryThreshold'],
    ['/overview/automations/templates', 'Device Health'],
    ['/overview/automations/templates/mt-mc-bridge', 'Meshtastic channel'],
    ['/automations/e3', 'Add a limit'],
    ['/automations/e3/runs', 'Psychiko Base: “!wx”'],
    ['/automations/e7/trace', 'Trace started'],
    ['/automations/new', 'Add a step'],
  ])('%s', async (route, text) => {
    const view = renderRules(route);
    if (route.endsWith('/trace')) {
      await screen.findByText(/Stops by itself after 5 min/);
      fakeSocket.fire('automation-trace:started', { automationId: 'e7', expiresAt: Date.now() + 60_000 });
    }
    await screen.findAllByText(text);
    window.dispatchEvent(new Event('focus'));
    view.rerenderWorkspace();
    await settle(200);
    expect(nonGet()).toEqual([]);
  });

  it('on the phone too (rules list, a rule, its runs)', async () => {
    for (const [route, text] of [['/overview/automations', 'Weather bot'], ['/automations/e3', 'Add a limit'], ['/automations/e3/runs', 'Psychiko Base: “!wx”']]) {
      const view = renderRules(route, { phone: true });
      await screen.findAllByText(text);
      await settle(100);
      view.unmount();
    }
    expect(nonGet()).toEqual([]);
  });

  it('picking steps edits only the draft', async () => {
    renderRules('/automations/e3');
    fireEvent.click(await screen.findByRole('button', { name: 'Add a step' }));
    fireEvent.click(await screen.findByRole('button', { name: /Send a message/ }));
    await screen.findByRole('dialog', { name: 'Send a message' });
    await settle();
    expect(nonGet()).toEqual([]);
  });
});
