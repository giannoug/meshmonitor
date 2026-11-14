/**
 * Tests for useMeshtasticNodeActions — App's and useSourceView's node
 * request/toggle handlers moved into a hook (#6365 Task 2.2). Each test pins
 * the endpoint, method and body sent before the move.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DeviceInfo } from '../types/device';
import {
  favoritePendingKey,
  pendingFavoriteRequests,
  pendingIgnoredRequests,
  pendingHideFromMapRequests,
} from '../utils/pendingToggles';

const mockUseSource = vi.fn();
const mockUseData = vi.fn();
const mockUseUI = vi.fn();
const mockUseToast = vi.fn();
const mockUseNodes = vi.fn();
const mockSetNodeFieldInCache = vi.fn();
const mockInvalidate = vi.fn();
const mockApiPost = vi.fn();
const mockCsrfFetch = vi.fn();

vi.mock('../contexts/SourceContext', () => ({ useSource: () => mockUseSource() }));
vi.mock('../contexts/DataContext', () => ({ useData: () => mockUseData() }));
vi.mock('../contexts/UIContext', () => ({ useUI: () => mockUseUI() }));
vi.mock('../components/ToastContainer', () => ({ useToast: () => mockUseToast() }));
vi.mock('./useServerData', () => ({
  useNodes: () => mockUseNodes(),
  setNodeFieldInCache: (...args: unknown[]) => mockSetNodeFieldInCache(...args),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { AuthContext: createContext({ authStatus: { user: { id: 9 } } }) };
});
vi.mock('../services/api', () => ({ default: { post: (...args: unknown[]) => mockApiPost(...args) } }));

import { useMeshtasticNodeActions } from './useMeshtasticNodeActions';

const BASE = 'http://localhost:3001';
const NODE: DeviceInfo = {
  nodeNum: 0x12345678,
  user: { id: '!12345678', longName: 'Node A', shortName: 'NDA' },
  isFavorite: false,
  favoriteLocked: false,
  isIgnored: false,
  hideFromMap: false,
} as DeviceInfo;

function ok(json: unknown = {}) {
  return { ok: true, status: 200, json: async () => json };
}

function setup(json: unknown = {}) {
  const authFetch = vi.fn().mockResolvedValue(ok(json));
  const refetchPoll = vi.fn();
  const hook = renderHook(() => useMeshtasticNodeActions({ baseUrl: BASE, authFetch, refetchPoll, csrfFetch: mockCsrfFetch }));
  return { authFetch, refetchPoll, result: hook.result };
}

function call(authFetch: ReturnType<typeof vi.fn>, i = 0) {
  const [url, init] = authFetch.mock.calls[i];
  return { url, method: init?.method, body: init?.body ? JSON.parse(init.body as string) : undefined };
}

describe('useMeshtasticNodeActions', () => {
  let showToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const key = favoritePendingKey('src-1', NODE.nodeNum);
    pendingFavoriteRequests.delete(key);
    pendingIgnoredRequests.delete(key);
    pendingHideFromMapRequests.delete(key);
    showToast = vi.fn();
    mockUseSource.mockReturnValue({ sourceId: 'src-1', sourceName: 'Test', sourceType: 'meshtastic_tcp' });
    mockUseData.mockReturnValue({ connectionStatus: 'connected', currentNodeId: '!0000abcd' });
    mockUseUI.mockReturnValue({ setTracerouteLoading: vi.fn() });
    mockUseToast.mockReturnValue({ showToast });
    mockUseNodes.mockReturnValue({ nodes: [NODE] });
  });

  it('traceroute POSTs /api/traceroute with destination, sourceId and channel', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.traceroute(0x12345678, 3);
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/traceroute`,
      method: 'POST',
      body: { destination: 0x12345678, sourceId: 'src-1', channel: 3 },
    });
  });

  it('exchangeNodeInfo POSTs /api/nodeinfo/request and sets the loading key', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.exchangeNodeInfo(0x12345678, 1);
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/nodeinfo/request`,
      method: 'POST',
      body: { destination: 0x12345678, sourceId: 'src-1', channel: 1 },
    });
    expect(result.current.loading.nodeInfo).toBe('!12345678');
  });

  it('exchangePosition POSTs /api/position/request without channel when none is given', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.exchangePosition(0x12345678);
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/position/request`,
      method: 'POST',
      body: { destination: 0x12345678, sourceId: 'src-1' },
    });
  });

  it('requestTelemetry POSTs /api/telemetry/request with the type (no channel, as today)', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.requestTelemetry(0x12345678, 'environment', 2);
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/telemetry/request`,
      method: 'POST',
      body: { destination: 0x12345678, telemetryType: 'environment', sourceId: 'src-1' },
    });
  });

  it('requestNeighborInfo POSTs /api/neighborinfo/request', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.requestNeighborInfo(0x12345678);
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/neighborinfo/request`,
      method: 'POST',
      body: { destination: 0x12345678, sourceId: 'src-1' },
    });
  });

  it('node requests are no-ops when not connected', async () => {
    mockUseData.mockReturnValue({ connectionStatus: 'disconnected', currentNodeId: '!0000abcd' });
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.traceroute(1);
      await result.current.exchangePosition(1);
      await result.current.exchangeNodeInfo(1);
      await result.current.requestNeighborInfo(1);
      await result.current.requestTelemetry(1, 'device');
    });
    expect(authFetch).not.toHaveBeenCalled();
  });

  it('scanForAdmin POSTs /api/nodes/:nodeNum/scan-remote-admin?sourceId= with no body, via csrfFetch as MessagesTab does', async () => {
    mockCsrfFetch.mockResolvedValue(ok({ hasRemoteAdmin: true, metadata: { firmwareVersion: '2.7' } }));
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.scanForAdmin(0x12345678);
    });
    expect(authFetch).not.toHaveBeenCalled();
    expect(call(mockCsrfFetch)).toEqual({
      url: `${BASE}/api/nodes/${0x12345678}/scan-remote-admin?sourceId=src-1`,
      method: 'POST',
      body: undefined,
    });
    expect(showToast).toHaveBeenCalledWith('messages.scan_admin_success', 'success');
  });

  it('toggleFavorite POSTs /api/nodes/:id/favorite with device sync', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.toggleFavorite(NODE);
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/nodes/!12345678/favorite`,
      method: 'POST',
      body: { isFavorite: true, syncToDevice: true, sourceId: 'src-1' },
    });
  });

  it('toggleFavoriteLock POSTs /api/nodes/:id/favorite-lock', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.toggleFavoriteLock(NODE);
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/nodes/!12345678/favorite-lock`,
      method: 'POST',
      body: { locked: true, sourceId: 'src-1' },
    });
  });

  it('toggleIgnored POSTs /api/nodes/:id/ignored with device sync', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.toggleIgnored(NODE);
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/nodes/!12345678/ignored`,
      method: 'POST',
      body: { isIgnored: true, syncToDevice: true, sourceId: 'src-1' },
    });
    expect(mockSetNodeFieldInCache).toHaveBeenCalledWith(expect.anything(), 'src-1', 0x12345678, { isIgnored: true });
  });

  it('toggleHideFromMap POSTs /api/nodes/:id/hide-from-map for all sources', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.toggleHideFromMap(NODE);
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/nodes/!12345678/hide-from-map`,
      method: 'POST',
      body: { hideFromMap: true, sourceId: 'src-1', allSources: true },
    });
  });

  it('markAircraft POSTs /api/aircraft/mark with the mode, as the Actions menu does', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const { result } = setup();
    await act(async () => {
      await result.current.markAircraft(7, 'not', false);
      await result.current.markAircraft(7, 'aircraft', true);
      await result.current.markAircraft(7, 'clear', false);
    });
    expect(mockApiPost.mock.calls).toEqual([
      ['/api/aircraft/mark', { sourceId: 'src-1', nodeNum: 7, mode: 'not_aircraft' }],
      ['/api/aircraft/mark', { sourceId: 'src-1', nodeNum: 7, mode: 'aircraft', allSources: true }],
      ['/api/aircraft/mark', { sourceId: 'src-1', nodeNum: 7, mode: 'clear' }],
    ]);
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['poll', 'src-1'] });
    // The same optimistic cache patch AircraftMarkMenuItems writes.
    expect(mockSetNodeFieldInCache.mock.calls.map(c => [c[1], c[2], c[3].aircraftManualMark, c[3].aircraftManualMarkBy])).toEqual([
      ['src-1', 7, 'not_aircraft', 9],
      ['src-1', 7, 'aircraft', 9],
      ['src-1', 7, null, null],
    ]);
  });

  it('overridePosition POSTs /api/nodes/:id/position-override with the data and sourceId', async () => {
    const { authFetch, refetchPoll, result } = setup();
    await act(async () => {
      await result.current.overridePosition(0x12345678, { enabled: true, latitude: 1, longitude: 2 });
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/nodes/!12345678/position-override`,
      method: 'POST',
      body: { enabled: true, latitude: 1, longitude: 2, sourceId: 'src-1' },
    });
    expect(showToast).toHaveBeenCalledWith('position_override.save_success', 'success');
    expect(refetchPoll).toHaveBeenCalled();
  });

  it('overridePosition(null) clears the override', async () => {
    const { authFetch, result } = setup();
    await act(async () => {
      await result.current.overridePosition(0x12345678, null);
    });
    expect(call(authFetch).body).toEqual({ enabled: false, sourceId: 'src-1' });
  });

  it.each([
    ['traceroutes', 'traceroutes', 'toast.purged_traceroutes'],
    ['telemetry', 'telemetry', 'toast.purged_telemetry'],
    ['positionHistory', 'position-history', 'toast.purged_position_history'],
  ] as const)('purgeNodeData %s DELETEs /api/messages/nodes/:nodeNum/%s', async (what, path, toastKey) => {
    const { authFetch, refetchPoll, result } = setup({ deletedCount: 4 });
    await act(async () => {
      await result.current.purgeNodeData(0x12345678, { what });
    });
    expect(call(authFetch)).toEqual({
      url: `${BASE}/api/messages/nodes/${0x12345678}/${path}`,
      method: 'DELETE',
      body: { sourceId: 'src-1' },
    });
    expect(showToast).toHaveBeenCalledWith(toastKey, 'success');
    expect(refetchPoll).toHaveBeenCalled();
  });
});
