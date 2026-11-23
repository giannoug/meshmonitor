/**
 * @vitest-environment jsdom
 *
 * Board q1-tools (phone; note ds12): a device's Tools, the door to Info,
 * Packet monitor and Security, then its Dashboard and the Overview. Each row
 * follows today's tab gate; the page reads and sends nothing of its own. The
 * desktop sidebar's More tools… holds the same three.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { fetched, G2, nonGets, renderTools } from './renderTools';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

describe('q1-tools', () => {
  it('q1-tools shows the board', async () => {
    const { container } = renderTools(`${G2}/tools`, { phone: true });
    await screen.findByRole('link', { name: /Analysis, Reports, Users, Audit log/ });
    expectBoard('q1-tools', container);
    expect(screen.getByRole('link', { name: /^Info/ })).toHaveAttribute('href', `${G2}/info`);
    expect(screen.getByRole('link', { name: /^Packet Monitor/ })).toHaveAttribute('href', `${G2}/packetmonitor`);
    expect(screen.getByRole('link', { name: /^Security/ })).toHaveAttribute('href', `${G2}/security`);
    expect(screen.getByRole('link', { name: /^Dashboard/ })).toHaveAttribute('href', `${G2}/dashboard`);
    expect(screen.getByRole('link', { name: /^Overview/ })).toHaveAttribute('href', '/overview');
    expect(nonGets()).toEqual([]);
    expect(fetched().filter((r) => /\/api\/(security|packets\?|virtual-node)/.test(r))).toEqual([]);
  });

  it("the device Home's Tools tile opens it", async () => {
    renderTools(G2, { phone: true });
    const tools = await screen.findByRole('navigation', { name: 'Device tools' });
    expect(within(tools).getByRole('link', { name: 'Tools' })).toHaveAttribute('href', `${G2}/tools`);
  });

  it('rows follow today\'s tab gates: a viewer with info:read only sees Info', async () => {
    renderTools(`${G2}/tools`, {
      phone: true,
      permissions: { bySource: { 'src-g2': { info: { read: true, write: false }, nodes: { read: true, write: false } } } },
    });
    await screen.findByRole('link', { name: /^Info/ });
    expect(screen.queryByRole('link', { name: /^Packet Monitor/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Security/ })).toBeNull();
  });

  it('on desktop More tools… opens Info, Packet Monitor and Security', async () => {
    renderTools(`${G2}/nodes`);
    const more = await screen.findByRole('button', { name: /More tools/ });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    const list = screen.getByRole('list', { name: 'More tools…' });
    expect(within(list).getByRole('link', { name: 'Info' })).toHaveAttribute('href', `${G2}/info`);
    expect(within(list).getByRole('link', { name: 'Packet Monitor' })).toHaveAttribute('href', `${G2}/packetmonitor`);
    expect(within(list).getByRole('link', { name: 'Security' })).toHaveAttribute('href', `${G2}/security`);
  });
});
