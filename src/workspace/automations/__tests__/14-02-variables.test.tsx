/**
 * @vitest-environment jsdom
 *
 * Boards 14-02 (desktop) and 14-10 (phone), s14n3: Variables is the second
 * tab. Today's new-variable form, the list, and Delete asking first with the
 * variable's name; the types & scopes help beside it (a sheet on the phone).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { RULES } from '../../__fixtures__/rules';
import { READ_ONLY, nonGet, renderRules, settle } from './renderRules';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./socketMock')).socketMock(orig));

const VARS = '/overview/automations/variables';

describe('14-02-variables', () => {
  it('14-02-variables shows the board', async () => {
    renderRules(VARS);
    await screen.findByText('lowBatteryThreshold');
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'flag' } });
    fireEvent.click(screen.getByRole('button', { name: 'What are types & scopes?' }));
    expect(await screen.findByRole('complementary', { name: 'What are types & scopes?' })).toBeInTheDocument();
    expectBoard('14-02-variables', document.body);
  });

  it('14-10-variables shows the board', async () => {
    renderRules(VARS, { phone: true });
    await screen.findByText('lowBatteryThreshold');
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'flag' } });
    expectBoard('14-10-variables', document.body);
  });

  it('the help opens in a sheet on the phone', async () => {
    renderRules(VARS, { phone: true });
    await screen.findByText('lowBatteryThreshold');
    fireEvent.click(screen.getByRole('button', { name: 'Types & scopes?' }));
    expect(await screen.findByRole('dialog', { name: 'What are types & scopes?' })).toHaveTextContent('A boolean that clears itself');
  });

  it('Create sends today\'s request once, with today\'s name check', async () => {
    renderRules(VARS);
    await screen.findByText('lowBatteryThreshold');
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'bad name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create variable' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name must be a letters/digits/underscore identifier');
    expect(nonGet()).toEqual([]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'welcomedRecently' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'flag' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Scope' }), { target: { value: 'node' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Default value' }), { target: { value: 'false' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Flag auto-clear/ }), { target: { value: '86400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create variable' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create variable' }));
    await waitFor(() => expect(nonGet()).toEqual([{ method: 'POST', path: '/api/automations/variables', body: {
      name: 'welcomedRecently', type: 'flag', scope: 'node', readonly: false, config: { defaultValue: 'false', flagDurationSeconds: 86400 },
    } }]));
  });

  it('Delete asks first and names the variable; Cancel sends nothing', async () => {
    renderRules(VARS);
    const item = (await screen.findByText('welcomed')).closest('li') as HTMLElement;
    fireEvent.click(within(item).getByRole('button', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete variable “welcomed”?' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(nonGet()).toEqual([]);
    fireEvent.click(within(item).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(nonGet()).toEqual([{ method: 'DELETE', path: '/api/automations/variables/v2', body: undefined }]));
  });

  it('lists each variable\'s type, scope and default, and the rules that read it', async () => {
    renderRules(VARS);
    const item = (await screen.findByText('lowBatteryThreshold')).closest('li') as HTMLElement;
    expect(item).toHaveTextContent('integer · Global · constant');
    expect(item).toHaveTextContent('Default 20 · read by Low battery alert');
  });

  it('without automations:write the form and Delete are off', async () => {
    renderRules(VARS, { permissions: READ_ONLY });
    const item = (await screen.findByText('welcomed')).closest('li') as HTMLElement;
    expect(within(item).getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create variable' })).toBeDisabled();
  });

  it('"read by" matches the whole variable name: var.relay is not var.relayCount', async () => {
    const vars = [
      { id: 'a', name: 'relay', description: null, type: 'integer', scope: 'global', readonly: false, config: '{}' },
      { id: 'b', name: 'relayCount', description: null, type: 'integer', scope: 'global', readonly: false, config: '{}' },
    ];
    renderRules(VARS, { rules: [{ ...RULES[0], name: 'Counter', config: '{"p":"{{ var.relayCount }}"}' }], fixtures: { 'GET /api/automations/variables': () => vars } });
    const count = (await screen.findByText('relayCount')).closest('li') as HTMLElement;
    expect(count).toHaveTextContent('read by Counter');
    expect((screen.getByText('relay', { selector: 'span' })).closest('li')).not.toHaveTextContent('read by');
  });
});
