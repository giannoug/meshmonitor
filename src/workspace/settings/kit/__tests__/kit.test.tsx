/**
 * @vitest-environment jsdom
 *
 * The settings row kit (Task 5.2), which Tasks 5.3–5.9 build categories on:
 * rows register with the field registry (Task 5.4's search), every control
 * takes readOnly, selects open a sheet on phone, numbers step on phone and
 * report to NumberInputScope, and AdvancedCard remembers itself per category.
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../../test/renderWorkspace';
import { prefsFixture } from '../../../__fixtures__/prefsFixture';
import { NumberInputScope } from '../../../../components/common/NumberInputScope';
import { useNumberInputScope } from '../../../../components/common/numberInputScopeContext';
import SettingGroup from '../SettingGroup';
import SettingRow from '../SettingRow';
import SettingToggle from '../SettingToggle';
import SettingSelect from '../SettingSelect';
import SettingNumber from '../SettingNumber';
import SettingText from '../SettingText';
import AdvancedCard from '../AdvancedCard';
import { SettingsCategoryContext, useFieldRegistry } from '../useFieldRegistry';

function inCategory(ui: React.ReactNode, { readOnly = false, categoryId = 'lora' } = {}) {
  return <SettingsCategoryContext.Provider value={{ categoryId, readOnly }}>{ui}</SettingsCategoryContext.Provider>;
}

function Registry() {
  const fields = useFieldRegistry();
  return <output data-testid="registry">{JSON.stringify(fields)}</output>;
}
const registry = () => JSON.parse(screen.getByTestId('registry').textContent ?? '[]') as unknown[];

const OPTIONS = [
  { value: '0', label: 'Long Fast' },
  { value: '1', label: 'Long Slow' },
];

function Form({ readOnly }: { readOnly?: boolean }) {
  const [on, setOn] = useState(false);
  const [preset, setPreset] = useState('0');
  const [hops, setHops] = useState(3);
  const [name, setName] = useState('G2');
  return (
    <SettingGroup title="Radio">
      <SettingRow id="lora.tx" label="Transmit" help="Turn the radio's transmitter on" keywords={['tx']}>
        <SettingToggle checked={on} onChange={setOn} readOnly={readOnly} />
      </SettingRow>
      <SettingRow id="lora.preset" label="Modem preset">
        <SettingSelect value={preset} options={OPTIONS} onChange={setPreset} readOnly={readOnly} />
      </SettingRow>
      <SettingRow id="lora.hops" label="Hop limit">
        <SettingNumber value={hops} min={1} max={7} onChange={setHops} readOnly={readOnly} />
      </SettingRow>
      <SettingRow id="owner.short" label="Short name">
        <SettingText value={name} onChange={setName} readOnly={readOnly} />
      </SettingRow>
    </SettingGroup>
  );
}

const render = (ui: React.ReactNode, opts: RenderWorkspaceOptions = {}) => renderWorkspace(<>{ui}</>, { route: '/source/src-g2/settings/lora', ...opts });

describe('SettingRow and the field registry', () => {
  it('registers each row with its category on mount and drops it on unmount', () => {
    function Toggle() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShown(false)}>hide</button>
          {shown && inCategory(<Form />)}
        </>
      );
    }
    render(<><Registry /><Toggle /></>);
    expect(registry()).toEqual(expect.arrayContaining([
      { id: 'lora.tx', label: 'Transmit', keywords: ['tx'], categoryId: 'lora' },
      { id: 'lora.hops', label: 'Hop limit', keywords: [], categoryId: 'lora' },
    ]));
    expect(registry()).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'hide' }));
    expect(registry()).toEqual([]);
  });

  it('labels its control and shows the help', () => {
    render(inCategory(<Form />));
    expect(screen.getByRole('switch', { name: 'Transmit' })).toBeInTheDocument();
    expect(screen.getByText("Turn the radio's transmitter on")).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Modem preset' })).toHaveValue('0');
    expect(screen.getByRole('spinbutton', { name: 'Hop limit' })).toHaveValue(3);
    expect(screen.getByRole('textbox', { name: 'Short name' })).toHaveValue('G2');
    expect(screen.getByRole('group', { name: 'Radio' })).toBeInTheDocument();
  });
});

describe('readOnly', () => {
  it.each([
    ['the prop', { readOnly: true }, false],
    ['the category', {}, true],
  ])('every control renders disabled from %s', (_, props, categoryReadOnly) => {
    render(inCategory(<Form {...props} />, { readOnly: categoryReadOnly }));
    expect(screen.getByRole('switch', { name: 'Transmit' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Modem preset' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Hop limit' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Short name' })).toBeDisabled();
  });

  it('on phone too (the select button and the stepper)', () => {
    render(inCategory(<Form readOnly />), { phone: true });
    expect(screen.getByRole('button', { name: /Modem preset/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeDisabled();
  });
});

describe('controls', () => {
  it('a toggle flips', () => {
    render(inCategory(<Form />));
    const sw = screen.getByRole('switch', { name: 'Transmit' });
    fireEvent.click(sw);
    expect(sw).toBeChecked();
  });

  it('a toggle flips on Space', async () => {
    render(inCategory(<Form />));
    const sw = screen.getByRole('switch', { name: 'Transmit' });
    sw.focus();
    await userEvent.keyboard(' ');
    expect(sw).toBeChecked();
    await userEvent.keyboard(' ');
    expect(sw).not.toBeChecked();
  });

  it('desktop: the select is a native select', () => {
    render(inCategory(<Form />));
    fireEvent.change(screen.getByRole('combobox', { name: 'Modem preset' }), { target: { value: '1' } });
    expect(screen.getByRole('combobox', { name: 'Modem preset' })).toHaveValue('1');
  });

  it('phone: the select opens a bottom sheet titled with the row, and a pick closes it', () => {
    render(inCategory(<Form />), { phone: true });
    const button = screen.getByRole('button', { name: /Modem preset/ });
    expect(button).toHaveTextContent('Long Fast');
    fireEvent.click(button);
    const sheet = screen.getByRole('dialog', { name: 'Modem preset' });
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Long Slow' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveTextContent('Long Slow');
  });

  it('phone: the number steps within its range', () => {
    render(inCategory(<Form />), { phone: true });
    const field = screen.getByRole('spinbutton', { name: 'Hop limit' });
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(field).toHaveValue(7);
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(field).toHaveValue(6);
  });

  it('phone: a fractional step lands on the step, not on a float error', () => {
    function Fraction() {
      const [v, setV] = useState(0.1);
      return (
        <SettingRow id="t.adc" label="ADC multiplier">
          <SettingNumber value={v} min={0} max={10} step={0.1} onChange={setV} />
        </SettingRow>
      );
    }
    render(inCategory(<Fraction />), { phone: true });
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(screen.getByRole('spinbutton', { name: 'ADC multiplier' })).toHaveValue(0.3);
  });

  it('an out-of-range number marks the enclosing NumberInputScope invalid', () => {
    function Scoped() {
      const scope = useNumberInputScope();
      return (
        <NumberInputScope scope={scope}>
          <Form />
          <output data-testid="invalid">{String(scope.invalid)}</output>
        </NumberInputScope>
      );
    }
    render(inCategory(<Scoped />));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Hop limit' }), { target: { value: '9' } });
    expect(screen.getByTestId('invalid')).toHaveTextContent('true');
  });
});

describe('AdvancedCard', () => {
  it('outside a category writes no pref (it would be saved under a key with no category)', async () => {
    const p = prefsFixture({});
    render(<AdvancedCard><p>Deep rows</p></AdvancedCard>, { fixtures: p.fixtures });
    const head = await screen.findByRole('button', { name: 'Advanced' });
    // The auth status lands after the first paint; a click before it would write nothing for the wrong reason.
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    await act(async () => { fireEvent.click(head); });
    expect(screen.getByText('Deep rows')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 100));
    expect(p.puts).toEqual([]);
  });

  it('starts closed, and opening it saves workspace.settings.advanced.<category>', async () => {
    const p = prefsFixture({});
    render(inCategory(<AdvancedCard><p>Deep rows</p></AdvancedCard>), { fixtures: p.fixtures });
    const head = await screen.findByRole('button', { name: 'Advanced' });
    expect(head).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Deep rows')).toBeNull();
    await act(async () => { fireEvent.click(head); });
    expect(screen.getByText('Deep rows')).toBeInTheDocument();
    await waitFor(() => expect(p.puts).toEqual([['workspace.settings.advanced.lora', true]]));
  });

  it('opens from the saved preference', async () => {
    const p = prefsFixture({ 'workspace.settings.advanced.lora': true });
    render(inCategory(<AdvancedCard><p>Deep rows</p></AdvancedCard>), { fixtures: p.fixtures });
    expect(await screen.findByText('Deep rows')).toBeInTheDocument();
  });

  it('sends nothing to the server for a viewer who cannot save preferences (anonymous)', async () => {
    const onPut = vi.fn(() => new Response('{}', { status: 403 }));
    render(inCategory(<AdvancedCard><p>Deep rows</p></AdvancedCard>), { anonymous: true, fixtures: { 'PUT /api/user/preferences/:key': onPut } });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Advanced' })); });
    expect(screen.getByText('Deep rows')).toBeInTheDocument();
    expect(onPut).not.toHaveBeenCalled();
  });
});
