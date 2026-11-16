/**
 * The settings categories (Task 5.2). The extra test of the brief: every
 * section a power user finds today (`configurationNavItems` and
 * `settingsNavItems(mode: 'source')`) maps to exactly one category, so nothing
 * is lost (spec §2).
 */
import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configurationNavItems, settingsNavItems } from '../../../components/search/configSections';
import {
  CATEGORIES,
  SECTION_TO_CATEGORY,
  categoryById,
  categoryIndex,
  readOnlyFor,
  moduleAvailable,
  resolveSettingsPath,
  visibleCategories,
  type GateCtx,
} from '../categories';
import { g2DeviceConfig } from '../../__fixtures__/deviceConfig';

const keyOnly = ((key: string) => key) as unknown as TFunction;
const en = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../../public/locales/en.json'), 'utf8'),
) as Record<string, string>;

/** Every source-mode section, with every gate open, on each device type the frame serves. */
const todaySections = [
  ...configurationNavItems(keyOnly, { showFirmware: true }),
  ...['meshtastic_tcp', 'mqtt_broker', 'mqtt_bridge'].flatMap((sourceType) =>
    settingsNavItems(keyOnly, {
      mode: 'source',
      isAdmin: true,
      canWriteSettings: true,
      sourceType,
      canReadSources: true,
      canReadConfiguration: true,
    }),
  ),
].map((i) => i.id);

const ctx = (over: Partial<GateCtx> = {}): GateCtx => ({
  sourceId: 's1',
  sourceType: 'meshtastic_tcp',
  isAdmin: true,
  isAuthenticated: true,
  firmwareOtaEnabled: true,
  hasPermission: () => true,
  ...over,
});

describe('categories', () => {
  it('every configurationNavItems and settingsNavItems(source) id maps to exactly one CategoryDef', () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of new Set(todaySections)) {
      const target = SECTION_TO_CATEGORY[section];
      expect(target, section).toBeDefined();
      expect(CATEGORIES.filter((c) => c.id === target), section).toHaveLength(1);
    }
  });

  it('every category holds at least one of today\'s sections (no empty page)', () => {
    const held = new Set(Object.values(SECTION_TO_CATEGORY));
    // The remote-only pages hold Admin Commands' sections, which these catalogues do not list (Task 5.9).
    expect(CATEGORIES.filter((c) => !held.has(c.id) && c.remote !== 'only').map((c) => c.id)).toEqual([]);
    expect(CATEGORIES.filter((c) => c.remote === 'only').map((c) => c.id)).toEqual(['node-management', 'remote-console']);
  });

  it('every label has an English string', () => {
    expect(CATEGORIES.filter((c) => !en[c.labelKey]).map((c) => c.labelKey)).toEqual([]);
  });

  it('a radio sees On the radio and In MeshMonitor; a broker only In MeshMonitor; a bridge also its setup and coverage', () => {
    const radio = visibleCategories(ctx()).map((c) => c.id);
    expect(radio.slice(0, 4)).toEqual(['identity', 'lora', 'channels', 'security']);
    expect(radio).toContain('maintenance/firmware');
    expect(radio).not.toContain('mqtt-bridge');
    expect(radio).not.toContain('coverage-recording');
    const broker = visibleCategories(ctx({ sourceType: 'mqtt_broker' })).map((c) => c.id);
    expect(broker).toEqual(['node-display', 'telemetry', 'notifications', 'packet-monitor', 'data', 'coverage-recording']);
    const bridge = visibleCategories(ctx({ sourceType: 'mqtt_bridge' })).map((c) => c.id);
    expect(bridge[0]).toBe('mqtt-bridge');
    expect(bridge).toContain('coverage-recording');
  });

  it('follows today\'s gates', () => {
    // Firmware: an admin, on an install with OTA on.
    expect(visibleCategories(ctx({ firmwareOtaEnabled: false })).map((c) => c.id)).not.toContain('maintenance/firmware');
    expect(visibleCategories(ctx({ isAdmin: false })).map((c) => c.id)).not.toContain('maintenance/firmware');
    // configuration:read only: the radio, PKI DMs (today in Configuration for them), Notifications (signed in).
    const configOnly = visibleCategories(ctx({ hasPermission: (r) => r === 'configuration' })).map((c) => c.id);
    expect(configOnly).toContain('lora');
    expect(configOnly.filter((id) => CATEGORIES.find((c) => c.id === id)!.scope !== 'radio')).toEqual(['notifications', 'pki-dm']);
    // A bridge viewer with sources:read only keeps the bridge setup.
    expect(visibleCategories(ctx({ sourceType: 'mqtt_bridge', isAuthenticated: false, hasPermission: (r) => r === 'sources' })).map((c) => c.id)).toEqual(['mqtt-bridge']);
    // The per-source check is asked for this source.
    const asked: unknown[] = [];
    visibleCategories(ctx({ hasPermission: (r, a, o) => { asked.push([r, a, o]); return false; } }));
    expect(asked).toContainEqual(['configuration', 'read', { sourceId: 's1' }]);
  });

  it.each([
    ['', {}],
    ['lora', { categoryId: 'lora' }],
    ['modules/mqtt', { categoryId: 'modules/mqtt' }],
    ['channels/2', { categoryId: 'channels', sub: '2' }],
    ['device', { group: 'device' }],
    ['modules', { group: 'modules' }],
    ['nope', { sub: 'nope' }],
  ])('/settings/%s resolves', (rest, want) => {
    expect(resolveSettingsPath(rest)).toMatchObject({ sub: '', ...want });
  });

  it('module availability reads today\'s gates and fails open', () => {
    const s = g2DeviceConfig.supportedModules;
    expect(moduleAvailable('modules/audio', s)).toBe(false);
    expect(moduleAvailable('modules/tak', s)).toBe(false);
    expect(moduleAvailable('modules/mqtt', s)).toBe(true);
    expect(moduleAvailable('modules/neighbor', s)).toBe(true);
    expect(moduleAvailable('modules/statusmessage', { ...s, statusmessage: false })).toBe(false);
    expect(moduleAvailable('modules/audio', null)).toBe(true);
  });

  describe('View only follows the grant each category saves with', () => {
    const only = (...grants: string[]) => ((r: string, a: string) => grants.includes(`${r}:${a}`)) as GateCtx['hasPermission'];
    const ro = (id: string, ...grants: string[]) => readOnlyFor(categoryById(id), only(...grants), 's1');

    it('radio categories and group indexes: configuration:write', () => {
      expect(ro('lora', 'settings:write')).toBe(true);
      expect(ro('lora', 'configuration:write')).toBe(false);
      expect(readOnlyFor(undefined, only('configuration:write'), 's1')).toBe(false);
    });

    it('pki-dm saves with configuration:write, not settings:write', () => {
      expect(ro('pki-dm', 'settings:write')).toBe(true);
      expect(ro('pki-dm', 'configuration:write')).toBe(false);
    });

    it('the bridge setup uses the sources grant', () => {
      expect(ro('mqtt-bridge', 'settings:write', 'configuration:write')).toBe(true);
      expect(ro('mqtt-bridge', 'sources:write')).toBe(false);
    });

    it('notifications are the viewer\'s own, never View only', () => {
      expect(ro('notifications')).toBe(false);
    });

    it('other MeshMonitor categories: settings:write', () => {
      expect(ro('node-display', 'configuration:write')).toBe(true);
      expect(ro('node-display', 'settings:write')).toBe(false);
    });
  });

  it('categoryIndex lists every category with today\'s keywords', () => {
    const index = categoryIndex();
    expect(index.map((e) => e.id)).toEqual(CATEGORIES.map((c) => c.id));
    expect(index.find((e) => e.id === 'lora')?.keywords).toContain('region');
    expect(index.find((e) => e.id === 'data')?.keywords).toEqual(expect.arrayContaining(['layout', 'purge']));
  });
});
