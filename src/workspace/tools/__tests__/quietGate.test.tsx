/**
 * @vitest-environment jsdom
 *
 * Task 8.5 fix round 1 (review M1): a device whose Security has no Dead nodes
 * section (`caps.deadNodes` false) has no Quiet nodes page: `security/quiet`
 * goes back to `security`, as today hides the section.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { G2, renderTools } from './renderTools';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../utils/securityCapabilities', async (orig) => {
  const real = await orig<typeof import('../../../utils/securityCapabilities')>();
  return { ...real, securityCapabilities: (...args: Parameters<typeof real.securityCapabilities>) => ({ ...real.securityCapabilities(...args), deadNodes: false }) };
});

describe('Quiet nodes gate', () => {
  it('without the Dead nodes section, security/quiet opens Security instead', async () => {
    renderTools(`${G2}/security/quiet`);
    expect(await screen.findByText('Shared public key')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Penteli Hut')).toBeNull());
    expect(screen.queryByRole('button', { name: /^Quiet nodes/ })).toBeNull();
  });
});
