/**
 * @vitest-environment jsdom
 *
 * Boards m2 (desktop), n2 and n3 (phone), s14n2/s14n4: a rule opens as step
 * cards (WHEN → IF → THEN, LIMITS, Add a step, Finally…) with Rule / Runs /
 * Live trace tabs. Test is today's dry run; Run now sits in the header and
 * asks first with today's words. The When… picker lists today's triggers.
 * Edits stay in a draft that the dock's Save sends once.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { BRANCHED_RULE, RULES } from '../../__fixtures__/rules';
import { READ_ONLY, nonGet, renderRules, settle } from './renderRules';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./socketMock')).socketMock(orig));

const WEATHER = '/automations/e3';
const enabled = async (name: string) => {
  const b = await screen.findByRole('button', { name });
  await waitFor(() => expect(b).toBeEnabled());
  return b;
};
const loaded = () => screen.findByRole('button', { name: /^WHEN: A message arrives in #Local/ });

describe('m2-rule', () => {
  it('m2-rule shows the board', async () => {
    renderRules(WEATHER);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));
    const test = await screen.findByRole('region', { name: 'Test run' });
    fireEvent.change(within(test).getByRole('textbox', { name: 'Sample message' }), { target: { value: '!wx athens' } });
    fireEvent.click(within(test).getByRole('button', { name: 'Run test' }));
    await within(test).findByRole('button', { name: 'Run again' });
    expectBoard('m2-rule', document.body);
  });

  it('n2-rule shows the board', async () => {
    renderRules(WEATHER, { phone: true });
    await loaded();
    expectBoard('n2-rule', document.body);
  });

  it('n3-when shows the board', async () => {
    renderRules(WEATHER, { phone: true });
    fireEvent.click(await loaded());
    fireEvent.click(await screen.findByRole('button', { name: 'Change step' }));
    await screen.findByRole('dialog', { name: 'When…' });
    // One sheet at a time (D9c): the step sheet gave way to the picker.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expectBoard('n3-when', document.body);
  });

  it('draws each step from the saved graph, and LIMITS reads "no limit" literally', async () => {
    renderRules(WEATHER);
    await loaded();
    expect(screen.getByRole('button', { name: 'IF: Source is one of: Station G2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'IF: Message text starts with !wx' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'THEN: Run weather.py with {{ trigger.text }}' })).toBeInTheDocument();
    expect(screen.getByText('No rate limit or cooldown. Every matching event gets an answer, and a reply loop can flood the channel.')).toBeInTheDocument();
  });

  it('Add a limit opens the trigger\'s own Cooldown field and picks no value', async () => {
    renderRules(WEATHER);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Add a limit' }));
    const sheet = await screen.findByRole('dialog', { name: 'A message is received' });
    expect(within(sheet).getByText('Cooldown (seconds)')).toBeInTheDocument();
    await settle();
    expect(nonGet()).toEqual([]);
    expect(screen.queryByRole('region', { name: /save/i })).toBeNull();
  });

  it('a rename saves the saved graph untouched (GR): one PUT, config as stored', async () => {
    renderRules(WEATHER);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'More for Weather bot' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Name and description' }));
    const sheet = await screen.findByRole('dialog', { name: 'Name and description' });
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Name' }), { target: { value: 'Weather bot v2' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    const dock = await screen.findByRole('region', { name: /save/i });
    expect(dock).toHaveTextContent('Saving does not fire the rule; its cooldown, rate limit and schedule carry over');
    const save = within(dock).getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(nonGet()).toHaveLength(1));
    expect(nonGet()[0]).toEqual({ method: 'PUT', path: '/api/automations/e3', body: { name: 'Weather bot v2', description: RULES[2].description, config: JSON.parse(RULES[2].config) } });
  });

  it('a step edit compiles the draft and saves it once', async () => {
    renderRules(WEATHER);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'IF: Message text starts with !wx' }));
    const sheet = await screen.findByRole('dialog', { name: 'Text comparison' });
    const value = within(sheet).getByDisplayValue('!wx');
    fireEvent.change(value, { target: { value: '!weather' } });
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(await screen.findByRole('button', { name: 'IF: Message text starts with !weather' })).toBeInTheDocument();
    fireEvent.click(within(await screen.findByRole('region', { name: /save/i })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nonGet()).toHaveLength(1));
    const body = nonGet()[0].body as { config: { nodes: Array<{ type: string; params: Record<string, unknown> }> } };
    expect(body.config.nodes.find((n) => n.type === 'condition.string')?.params.value).toBe('!weather');
  });

  it('a graph the steps cannot draw opens as JSON, and a rename keeps every key (GR)', async () => {
    renderRules('/automations/x1', { rules: [...RULES, BRANCHED_RULE] });
    expect(await screen.findByText(/This rule has a shape the steps do not draw/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More for Branched rule' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Name and description' }));
    const sheet = await screen.findByRole('dialog', { name: 'Name and description' });
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Description' }), { target: { value: 'Still JSON' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    fireEvent.click(within(await screen.findByRole('region', { name: /save/i })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(nonGet()).toHaveLength(1));
    expect((nonGet()[0].body as { config: unknown }).config).toEqual(JSON.parse(BRANCHED_RULE.config));
  });

  it('Test sends today\'s dry run once per press and shows what it would send', async () => {
    renderRules(WEATHER);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));
    const test = await screen.findByRole('region', { name: 'Test run' });
    fireEvent.change(within(test).getByRole('textbox', { name: 'Sample message' }), { target: { value: '!wx athens' } });
    fireEvent.click(within(test).getByRole('button', { name: 'Run test' }));
    fireEvent.click(within(test).getByRole('button', { name: 'Run test' }));
    await within(test).findByText('Athens 18 °C, wind 12 km/h NW, clear');
    expect(nonGet()).toHaveLength(1);
    expect(nonGet()[0]).toMatchObject({ method: 'POST', path: '/api/automations/test', body: { event: { kind: 'message', text: '!wx athens' } } });
  });

  it('Run now asks first with today\'s words, lists what the saved rule would send per device, and sends once', async () => {
    renderRules('/automations/e7');
    fireEvent.click(await screen.findByRole('button', { name: 'Run now' }));
    const sheet = await screen.findByRole('dialog', { name: 'Run this automation now?' });
    expect(sheet).toHaveTextContent('This is NOT a dry run.');
    expect(sheet).toHaveTextContent('It still respects the rule’s cooldown and rate limits, and does not change its schedule.');
    expect(within(sheet).getAllByText('Net check-in is open on this channel until noon.')).toHaveLength(2);
    expect(within(sheet).getByTitle('Station G2')).toBeInTheDocument();
    expect(within(sheet).getByTitle('Heltec MeshCore')).toBeInTheDocument();
    expect(sheet).toHaveTextContent('Sends now through 2 devices, once each');
    fireEvent.keyDown(sheet, { key: 'Enter' });
    await settle();
    expect(nonGet()).toEqual([]);
    const run = within(sheet).getByRole('button', { name: 'Run now' });
    fireEvent.click(run);
    fireEvent.click(run);
    expect(await screen.findByText('Fired: completed (2 actions dispatched).')).toBeInTheDocument();
    expect(nonGet()).toEqual([{ method: 'POST', path: '/api/automations/e7/run-now', body: undefined }]);
  });

  it('without automations:write Run now and the switch are off', async () => {
    renderRules(WEATHER, { permissions: READ_ONLY });
    await loaded();
    expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Weather bot on' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Add a step' })).toBeNull();
  });

  it('without automations:write Test is off', async () => {
    renderRules(WEATHER, { permissions: READ_ONLY });
    await loaded();
    expect(screen.getByRole('button', { name: 'Test' })).toBeDisabled();
  });

  it('phone: a clean draft offers Test once, in the dock and not in the menu', async () => {
    renderRules(WEATHER, { phone: true });
    await loaded();
    expect(screen.getByRole('button', { name: 'Test' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'More for Weather bot' }));
    await screen.findByRole('menuitem', { name: 'Run now' });
    expect(screen.queryByRole('menuitem', { name: 'Test' })).toBeNull();
  });

  it('Export on the Runs tab writes the runs that are shown', async () => {
    let blob: Blob | undefined;
    const create = vi.spyOn(URL, 'createObjectURL' as never).mockImplementation(((b: Blob) => { blob = b; return 'blob:x'; }) as never);
    const revoke = vi.spyOn(URL, 'revokeObjectURL' as never).mockImplementation((() => {}) as never);
    try {
      renderRules(`${WEATHER}/runs`);
      const all = await screen.findAllByRole('button', { name: /^(Sent|Skipped|Failed)/ });
      const count = (b: HTMLElement) => Number(b.textContent?.match(/\d+/)?.[0]);
      const total = all.reduce((n, b) => n + count(b), 0);
      const chip = all.find((b) => count(b) > 0 && count(b) < total);
      expect(chip, 'fixture needs a status chip below the total').toBeDefined();
      fireEvent.click(chip!);
      fireEvent.click(await enabled('Export'));
      const shown = JSON.parse(await blob!.text()) as unknown[];
      expect(shown.length).toBe(count(chip!));
    } finally {
      create.mockRestore();
      revoke.mockRestore();
    }
  });

  it('a new rule saves with today\'s POST and opens it', async () => {
    renderRules('/automations/new');
    const name = await screen.findByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Ping responder' } });
    fireEvent.click(within(await screen.findByRole('region', { name: /save/i })).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(nonGet()).toHaveLength(1));
    expect(nonGet()[0]).toMatchObject({ method: 'POST', path: '/api/automations', body: { name: 'Ping responder', enabled: false, config: { version: 1 } } });
  });

  it('an unknown rule says so', async () => {
    renderRules('/automations/nope');
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });

  it('phone: with unsaved changes, ⋯ still offers Add a step and Test (I1)', async () => {
    renderRules(WEATHER, { phone: true });
    fireEvent.click(await screen.findByRole('button', { name: 'IF: Message text starts with !wx' }));
    const step = await screen.findByRole('dialog', { name: 'Text comparison' });
    fireEvent.change(within(step).getByDisplayValue('!wx'), { target: { value: '!weather' } });
    fireEvent.keyDown(step, { key: 'Escape' });
    // The dock holds the change; the bottom "+ Step / Test" row has given way to it.
    await screen.findByRole('region', { name: /save/i });
    expect(screen.queryByRole('button', { name: 'Step' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More for Weather bot' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Add a step' }));
    const picker = await screen.findByRole('dialog', { name: 'Add a step' });
    fireEvent.click(within(picker).getByRole('button', { name: /^Always \(no filtering\)/ }));
    const added = await screen.findByRole('dialog', { name: 'Always (no filtering)' });
    fireEvent.keyDown(added, { key: 'Escape' });
    expect(await screen.findByRole('button', { name: /^IF: Always \(no filtering\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More for Weather bot' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Test' }));
    const test = await screen.findByRole('dialog', { name: 'Test run' });
    fireEvent.change(within(test).getByRole('textbox', { name: 'Sample message' }), { target: { value: '!weather athens' } });
    fireEvent.click(within(test).getByRole('button', { name: 'Run test' }));
    await waitFor(() => expect(nonGet()).toHaveLength(1));
    // The dry run tests the unsaved draft: the edited condition and the added step.
    const body = nonGet()[0].body as { config: { nodes: Array<{ type: string; params: Record<string, unknown> }> } };
    expect(nonGet()[0].path).toBe('/api/automations/test');
    expect(body.config.nodes.find((n) => n.type === 'condition.string')?.params.value).toBe('!weather');
    expect(body.config.nodes.some((n) => n.type === 'condition.always')).toBe(true);
  });

  it('phone: a new rule gets a condition from ⋯ › Add a step (I1)', async () => {
    renderRules('/automations/new', { phone: true });
    await screen.findByRole('textbox', { name: 'Name' });
    fireEvent.click(screen.getByRole('button', { name: 'More for New automation' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Add a step' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Add a step' })).getByRole('button', { name: /^Text comparison/ }));
    fireEvent.keyDown(await screen.findByRole('dialog', { name: 'Text comparison' }), { key: 'Escape' });
    expect(await screen.findByRole('button', { name: /^IF: / })).toBeInTheDocument();
    expect(nonGet()).toEqual([]);
  });

  it('Tokens replaces the step sheet; Escape closes only Tokens and brings the step back with its draft (I2, s14n4)', async () => {
    renderRules(WEATHER);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'IF: Message text starts with !wx' }));
    const step = await screen.findByRole('dialog', { name: 'Text comparison' });
    fireEvent.change(within(step).getByDisplayValue('!wx'), { target: { value: '!weather' } });
    fireEvent.click(within(step).getByRole('button', { name: 'Tokens' }));
    const tokens = await screen.findByRole('dialog', { name: 'Tokens' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(tokens).toHaveTextContent('{{ var.NAME }}');
    expect(tokens).toHaveTextContent('{{ trigger.senderLabel }}');
    expect(tokens).toHaveTextContent('{{ steps.wx.output }}');
    expect(tokens).toHaveTextContent('lowBatteryThreshold');
    fireEvent.keyDown(tokens, { key: 'Escape' });
    const back = await screen.findByRole('dialog', { name: 'Text comparison' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(back).getByDisplayValue('!weather')).toBeInTheDocument();
    await settle();
    expect(nonGet()).toEqual([]);
  });

  it('Tokens from the Test run (desktop panel and phone sheet) keeps the test inputs (I2)', async () => {
    renderRules(WEATHER);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));
    let test = await screen.findByRole('region', { name: 'Test run' });
    fireEvent.change(within(test).getByRole('textbox', { name: 'Sample message' }), { target: { value: '!wx kifisia' } });
    fireEvent.click(within(test).getByRole('button', { name: 'Tokens' }));
    fireEvent.keyDown(await screen.findByRole('dialog', { name: 'Tokens' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    test = screen.getByRole('region', { name: 'Test run' });
    expect(within(test).getByRole('textbox', { name: 'Sample message' })).toHaveValue('!wx kifisia');
  });

  it('phone: Tokens replaces the test sheet and Escape brings it back with its inputs (I2)', async () => {
    renderRules(WEATHER, { phone: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Test' }));
    const sheet = await screen.findByRole('dialog', { name: 'Test run' });
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Sample message' }), { target: { value: '!wx kifisia' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Tokens' }));
    const tokens = await screen.findByRole('dialog', { name: 'Tokens' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.keyDown(tokens, { key: 'Escape' });
    const back = await screen.findByRole('dialog', { name: 'Test run' });
    expect(within(back).getByRole('textbox', { name: 'Sample message' })).toHaveValue('!wx kifisia');
  });
});
