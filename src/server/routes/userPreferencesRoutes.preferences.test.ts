import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import userPreferencesRoutes from './userPreferencesRoutes.js';
import adminRoutes from './adminRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import configRoutes from './configRoutes.js';
import { createRouteTestApp, type RouteTestHarness } from '../test-helpers/routeTestApp.js';

vi.mock('../sourceManagerRegistry.js', () => ({
  sourceManagerRegistry: { getManager: vi.fn().mockReturnValue(null), getAllManagers: vi.fn().mockReturnValue([]) },
}));

describe('user preferences API', () => {
  let h: RouteTestHarness;
  beforeEach(async () => {
    h = await createRouteTestApp({
      mount: app => {
        app.use('/api/user', userPreferencesRoutes);
        app.use('/api/admin', adminRoutes);
        app.use('/api/settings', settingsRoutes);
        app.use('/api/config', configRoutes);
      },
    });
    for (const u of [h.admin, h.limited]) {
      await h.db.deleteUserPreferenceAsync(u.id, 'layout');
    }
    await h.db.settings.setSetting('defaultLayout', 'classic');
  });
  afterEach(() => h.cleanup());

  it('anonymous GET returns empty preferences', async () => {
    const res = await (await h.loginAs(null)).get('/api/user/preferences');
    expect(res.body).toEqual({ success: true, data: { preferences: {} } });
  });

  it('anonymous PUT is 403 ANONYMOUS_USER', async () => {
    const res = await (await h.loginAs(null)).put('/api/user/preferences/layout').send({ value: 'workspace' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ANONYMOUS_USER');
  });

  it('stores and returns a layout preference, per user', async () => {
    const a = await h.loginAs(h.limited);
    expect((await a.put('/api/user/preferences/layout').send({ value: 'workspace' })).body).toEqual({ success: true });
    expect((await a.get('/api/user/preferences')).body.data.preferences).toEqual({ layout: 'workspace' });
    const other = await h.loginAs(h.admin);
    expect((await other.get('/api/user/preferences')).body.data.preferences).toEqual({});
    await a.delete('/api/user/preferences/layout').expect(200);
    expect((await a.get('/api/user/preferences')).body.data.preferences).toEqual({});
  });

  it('rejects bad value, bad key and oversize value', async () => {
    const a = await h.loginAs(h.limited);
    const bad = await a.put('/api/user/preferences/layout').send({ value: 'grid' });
    expect([bad.status, bad.body.code]).toEqual([400, 'INVALID_PREFERENCE_VALUE']);
    const key = await a.put('/api/user/preferences/foo').send({ value: 1 });
    expect([key.status, key.body.code]).toEqual([400, 'INVALID_PREFERENCE_KEY']);
    const big = await a.put('/api/user/preferences/settings.pins').send({ value: 'x'.repeat(70 * 1024) });
    expect([big.status, big.body.code]).toEqual([413, 'PREFERENCE_TOO_LARGE']);
    // cap is exactly 65,536 JSON bytes (2 quotes + 65,534 chars)
    const edge = await a.put('/api/user/preferences/settings.pins').send({ value: 'x'.repeat(65534) });
    expect(edge.status).toBe(200);
    const over = await a.put('/api/user/preferences/settings.pins').send({ value: 'x'.repeat(65535) });
    expect([over.status, over.body.code]).toEqual([413, 'PREFERENCE_TOO_LARGE']);
  });

  it('layout-usage is admin only and honours defaultLayout', async () => {
    expect((await (await h.loginAs(h.limited)).get('/api/admin/layout-usage')).status).toBe(403);
    const now = Date.now();
    await h.db.auth.updateUser(h.admin.id, { lastLoginAt: now });
    await h.db.auth.updateUser(h.limited.id, { lastLoginAt: now });
    const admin = await h.loginAs(h.admin);
    const base = (await admin.get('/api/admin/layout-usage')).body.data;
    expect(base.windowDays).toBe(30);
    await h.db.setUserPreferenceAsync(h.limited.id, 'layout', 'workspace');
    const withPref = (await admin.get('/api/admin/layout-usage')).body.data;
    expect(withPref.workspace).toBe(base.workspace + 1);
    expect(withPref.classic).toBe(base.classic - 1);
    await h.db.settings.setSetting('defaultLayout', 'workspace');
    const dflt = (await admin.get('/api/admin/layout-usage')).body.data;
    expect(dflt.classic).toBe(0);
    expect(dflt.workspace + dflt.classic).toBe(withPref.workspace + withPref.classic);
  });

  it('layout-usage excludes deactivated users and logins older than 30 days', async () => {
    const admin = await h.loginAs(h.admin);
    const now = Date.now();
    await h.db.auth.updateUser(h.admin.id, { lastLoginAt: now });
    await h.db.auth.updateUser(h.limited.id, { lastLoginAt: now });
    const total = async () => {
      const d = (await admin.get('/api/admin/layout-usage')).body.data;
      return d.classic + d.workspace;
    };
    const base = await total();
    await h.db.auth.updateUser(h.limited.id, { lastLoginAt: now - 31 * 86_400_000 });
    expect(await total()).toBe(base - 1);
    await h.db.auth.updateUser(h.limited.id, { lastLoginAt: now, isActive: false });
    expect(await total()).toBe(base - 1);
    await h.db.auth.updateUser(h.limited.id, { isActive: true });
  });

  it('GET /api/config includes workspacePreview', async () => {
    const res = await (await h.loginAs(null)).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.workspacePreview).toBe(false);
  });

  it('settings POST rejects a non-boolean offerWorkspaceBanner', async () => {
    const admin = await h.loginAs(h.admin);
    const res = await admin.post('/api/settings').send({ offerWorkspaceBanner: 'yes' });
    expect([res.status, res.body.code]).toEqual([400, 'INVALID_BOOLEAN_SETTING']);
    await admin.post('/api/settings').send({ offerWorkspaceBanner: 'true' }).expect(200);
  });

  it('settings POST rejects an invalid defaultLayout', async () => {
    const admin = await h.loginAs(h.admin);
    const res = await admin.post('/api/settings').send({ defaultLayout: 'grid' });
    expect([res.status, res.body.code]).toEqual([400, 'INVALID_SETTING_VALUE']);
    await admin.post('/api/settings').send({ defaultLayout: 'workspace' }).expect(200);
  });
});
