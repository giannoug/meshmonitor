/**
 * @vitest-environment jsdom
 *
 * Task 5.6 fix round 1: the row helper's select honours a caller's onChange
 * for text values too (M1); an unknown module binds to no save section (M2);
 * the pins card's phone rows reach 52 px and its conflict tone stays scoped (M3, M4).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWorkspace } from '../../../test/renderWorkspace';
import type { DeviceConfigState } from '../../../../hooks/deviceConfig/useDeviceConfigState';
import type { DeviceConfigSaves } from '../../../../hooks/deviceConfig/useDeviceConfigSaves';
import { DeviceConfigContext } from '../../sharedDeviceConfig';
import { RadioSaveQueueContext, type RadioSaveQueue } from '../../useRadioSaveQueue';
import { SettingsCategoryContext } from '../../kit/useFieldRegistry';
import ModuleCategory from '../ModuleCategory';
import { useRows } from '../rows';

function inConfig(ui: ReactNode, state: Partial<DeviceConfigState>, categoryId: string, queue: RadioSaveQueue | null = null) {
  const config = { state: { loading: false, ...state } as DeviceConfigState, saves: {} as DeviceConfigSaves };
  return renderWorkspace(
    <DeviceConfigContext.Provider value={config}>
      <RadioSaveQueueContext.Provider value={queue}>
        <SettingsCategoryContext.Provider value={{ categoryId, readOnly: false }}>{ui}</SettingsCategoryContext.Provider>
      </RadioSaveQueueContext.Provider>
    </DeviceConfigContext.Provider>,
    { route: '/source/src-g2/settings/device/device' },
  );
}

describe('rows: select', () => {
  it('a text value goes to the caller\'s onChange when one is given', () => {
    const setTzdef = vi.fn();
    const picked = vi.fn();
    function Probe() {
      const r = useRows('device', 'device');
      return r && r.select('tzdef', 'device_config.timezone', [{ value: '', label: 'None' }, { value: 'UTC0', label: 'UTC' }], { onChange: picked });
    }
    inConfig(<Probe />, { tzdef: '', setTzdef }, 'device/device');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'UTC0' } });
    expect(picked).toHaveBeenCalledWith('UTC0');
    expect(setTzdef).not.toHaveBeenCalled();
  });
});

describe('ModuleCategory', () => {
  it('an unknown module renders nothing and reads no section\'s baseline', () => {
    const baseline = vi.fn();
    const queue = { queue: [], baseline } as unknown as RadioSaveQueue;
    const { container } = inConfig(<ModuleCategory sourceId="src-g2" target={{ kind: 'local' }} readOnly={false} />, {}, 'modules/nope', queue);
    expect(container.querySelector('[data-setting-id]')).toBeNull();
    expect(baseline).not.toHaveBeenCalled();
  });
});

describe('PinsInUseCard styles', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../PinsInUseCard.module.css'), 'utf8');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.trim()).filter(Boolean);

  it('phone rows reach 52 px through the cells\' height (table cells ignore min-height)', () => {
    const phone = rules.find((r) => r.startsWith('.card[data-phone] .table tbody th'));
    expect(phone).toMatch(/\bheight:\s*52px/);
    expect(phone).not.toMatch(/min-height/);
  });

  it('every selector is scoped by a module class', () => {
    const selectors = rules.flatMap((r) => r.split('{')[0].split(',').map((x) => x.trim()));
    expect(selectors.filter((sel) => !sel.startsWith('.'))).toEqual([]);
  });
});
