/**
 * @vitest-environment jsdom
 *
 * Boards 14-01 (desktop) and 14-09 (phone), s14n0/s14n1/s14n3: Overview ›
 * Automations lists every engine rule with its device tags, trigger chip,
 * schedule-window chip, Sends line and "No limit set"; Enabled, Runs, Trace
 * and ⋯ (Edit, Export, Duplicate, Delete). The device chips filter the list.
 * Duplicate asks for a name in a sheet; Delete is a plain ConfirmSheet with
 * today's words (Ruling D9d).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { READ_ONLY, nonGet, renderRules, settle } from './renderRules';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./socketMock')).socketMock(orig));

const row = async (name: string) => (await within(await screen.findByRole('list', { name: 'Automations' })).findByText(name)).closest('li') as HTMLElement;

describe('14-01-overview-automations', () => {
  it('14-01-overview-automations shows the board', async () => {
    renderRules();
    const weather = await row('Weather bot');
    fireEvent.click(within(weather).getByRole('button', { name: 'Actions for Weather bot' }));
    await screen.findByRole('menuitem', { name: /Duplicate/ });
    expectBoard('14-01-overview-automations', document.body);
  });

  it('14-09-overview-automations shows the board', async () => {
    renderRules('/overview/automations', { phone: true });
    const weather = await row('Weather bot');
    fireEvent.click(within(weather).getByRole('button', { name: 'Actions for Weather bot' }));
    fireEvent.click(within(weather).getByRole('button', { name: /Delete/ }));
    await screen.findByRole('dialog', { name: 'Delete automation “Weather bot”?' });
    expectBoard('14-09-overview-automations', document.body);
  });

  it('reads "No limit set" literally: a rule with neither a cooldown nor a rate limit (s14n1)', async () => {
    renderRules();
    expect(within(await row('Weather bot')).getByText('No limit set')).toBeInTheDocument();
    expect(within(await row('Net check-in')).getByText('No limit set')).toBeInTheDocument();
    expect(within(await row('Welcome new nodes')).queryByText('No limit set')).toBeNull();
    expect(within(await row('MT_to_MC_Bridge')).queryByText('No limit set')).toBeNull();
  });

  it('shows each rule\'s trigger, window and Sends line from its saved graph', async () => {
    renderRules();
    const net = await row('Net check-in');
    expect(within(net).getByText('Schedule')).toBeInTheDocument();
    expect(within(net).getByText(/^Until /)).toBeInTheDocument();
    expect(net).toHaveTextContent('Sends 1 message in #LongFast + 1 message in #Public on schedule */30 * * * *');
    expect(await row('Low battery alert')).toHaveTextContent('Sends nothing on the mesh');
    expect(await row('MT_to_MC_Bridge')).toHaveTextContent('at most 20 per 60 s');
  });

  it('the device chips filter the list; a rule with no source filter covers every device', async () => {
    renderRules();
    await row('Weather bot');
    fireEvent.click(screen.getByRole('button', { name: /Heltec MeshCore/ }));
    expect(screen.queryByText('Weather bot')).toBeNull();
    expect(screen.getByText('Welcome new nodes')).toBeInTheDocument();
    expect(screen.getByText('MC_to_MT_Bridge')).toBeInTheDocument();
  });

  it('never names a device the viewer cannot read (two-source rule)', async () => {
    renderRules('/overview/automations', { permissions: READ_ONLY });
    const low = await row('Low battery alert');
    expect(within(low).getByTitle('Station G2')).toBeInTheDocument();
    expect(within(low).queryByTitle('Heltec MeshCore')).toBeNull();
    expect(screen.queryByRole('button', { name: /Heltec MeshCore/ })).toBeNull();
  });

  it('Delete asks first with today\'s words and names what goes; Cancel sends nothing, Delete sends one request', async () => {
    renderRules();
    fireEvent.click(within(await row('Weather bot')).getByRole('button', { name: 'Actions for Weather bot' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete automation “Weather bot”?' });
    expect(sheet).toHaveTextContent('Its runs and their traces');
    expect(sheet).toHaveTextContent('Turn it off instead to keep its history.');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(nonGet()).toEqual([]);
    fireEvent.click(within(await row('Weather bot')).getByRole('button', { name: 'Actions for Weather bot' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(nonGet()).toEqual([{ method: 'DELETE', path: '/api/automations/e3', body: undefined }]));
  });

  it('Duplicate asks for a name in a sheet (today\'s suggestion), sends one request and opens the copy', async () => {
    renderRules();
    fireEvent.click(within(await row('Weather bot')).getByRole('button', { name: 'Actions for Weather bot' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Duplicate/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Duplicate Weather bot' });
    const input = within(sheet).getByRole('textbox', { name: 'Name for the duplicate' });
    expect(input).toHaveValue('Weather bot (copy)');
    fireEvent.change(input, { target: { value: '  ' } });
    expect(within(sheet).getByRole('button', { name: 'Duplicate' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Weather bot 2' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Duplicate' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Duplicate' }));
    await waitFor(() => expect(nonGet()).toEqual([{ method: 'POST', path: '/api/automations/e3/duplicate', body: { name: 'Weather bot 2' } }]));
  });

  it('the Enabled switch sends today\'s request once per press and waits for the re-read', async () => {
    renderRules();
    const sw = within(await row('Weather bot')).getByRole('switch', { name: 'Weather bot' });
    fireEvent.click(sw);
    fireEvent.click(sw);
    await waitFor(() => expect(nonGet()).toEqual([{ method: 'POST', path: '/api/automations/e3/disable', body: undefined }]));
  });

  it('without automations:write the switch and changes are off; Runs and Trace stay', async () => {
    renderRules('/overview/automations', { permissions: READ_ONLY });
    const weather = await row('Weather bot');
    expect(within(weather).getByRole('switch', { name: 'Weather bot' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /New automation/ })).toBeNull();
    expect(within(weather).getByRole('link', { name: 'Runs' })).toHaveAttribute('href', '/automations/e3/runs');
    fireEvent.click(within(weather).getByRole('button', { name: 'Actions for Weather bot' }));
    expect(await screen.findByRole('menuitem', { name: /Duplicate/ })).toBeDisabled();
  });

  it('Export copies today\'s export JSON to the clipboard (a read)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderRules();
    fireEvent.click(within(await row('Weather bot')).getByRole('button', { name: 'Actions for Weather bot' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Export/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(JSON.parse(writeText.mock.calls[0][0]).name).toBe('Weather bot');
    expect(nonGet()).toEqual([]);
  });
});
