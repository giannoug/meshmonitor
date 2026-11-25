/**
 * @vitest-environment jsdom
 *
 * NodeHeader on its own (the node menus are stubbed): Message opens the DM
 * at the node's user id, so a node with none (a MeshCore contact) has no Message.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { ToastProvider } from '../../../components/ToastContainer';
import { appBasename } from '../../../init';
import NodeHeader from '../NodeHeader';

vi.mock('../../patterns/NodeActionMenus', () => ({ default: () => null }));

const node = athensFixture.nodes.find((n) => n.nodeNum === 0xa1b2c301)!;
const render = (n: typeof node) =>
  renderWorkspace(
    <ToastProvider>
      <SettingsProvider baseUrl={appBasename}>
        <NodeHeader sourceId={SOURCE_IDS.g2} node={n} tab="overview" />
      </SettingsProvider>
    </ToastProvider>,
    { route: `/source/${SOURCE_IDS.g2}/node/!a1b2c301` },
  );

describe('NodeHeader', () => {
  it('a node with a user id has the Message action', async () => {
    render(node);
    expect(await screen.findByRole('link', { name: 'Message' })).toHaveAttribute('href', expect.stringContaining('/dm/'));
  });

  it('a node with no user id has no Message action (there is no DM to open)', async () => {
    render({ ...node, user: { ...node.user!, id: undefined as unknown as string } });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Message' })).toBeNull();
  });
});
