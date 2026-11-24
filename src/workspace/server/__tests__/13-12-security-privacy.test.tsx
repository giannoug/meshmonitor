/**
 * @vitest-environment jsdom
 *
 * Boards 13-12 (desktop) and 13-28 (phone), Task 6.5: Server › Security &
 * privacy and Server › Analytics (13-12 draws the two side by side only to fit
 * the canvas, s13n0). Security & privacy: today's PKI switch, Reliable PKI
 * default, remote admin attempts, noindex and disclosure links save as you go
 * (admins); hosted documents keep today's settings:write. Analytics keeps its
 * own Save (s13n1), admins only.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { grants, renderServer } from './serverHarness';

const PATH = '/server/security';
const urls = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));
const settingsWrites = (log: { writes: Array<{ path: string; body?: unknown }> }) => log.writes.filter((w) => w.path === '/api/settings').map((w) => w.body);

describe('13-12 / 13-28 security & privacy', () => {
  it.each([
    ['13-12-security-privacy', false],
    ['13-28-security-privacy', true],
  ])('%s shows the board', async (board, phone) => {
    const { container } = renderServer(PATH, { phone });
    await screen.findByText('Privacy Policy');
    await screen.findByText('Reliable PKI (default for every source)');
    expectBoard(board, container);
  });

  it('PKI, Reliable PKI, remote admin attempts and noindex save as you go in today\'s format', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('radio', { name: 'Avoid PKI' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ reliablePkiMode: 'avoid' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Discourage search engine & LLM indexing' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ noIndexEnabled: '0' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Enable PKI direct message decryption' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ pkiDmDecryptionGloballyEnabled: 'false' }));
    const attempts = screen.getByLabelText('Admin command attempts');
    fireEvent.change(attempts, { target: { value: '4' } });
    fireEvent.blur(attempts);
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ adminRetryAttempts: '4' }));
  });

  it('Reliable PKI "As needed" carries its Sends line', async () => {
    renderServer(PATH);
    expect(await screen.findByText(/MeshMonitor sends it your node info first \(at most once an hour per node\)/)).toBeInTheDocument();
  });

  it('a disclosure URL saves trimmed on blur', async () => {
    const { log } = renderServer(PATH);
    const terms = await screen.findByLabelText('Terms of service URL');
    fireEvent.change(terms, { target: { value: ' https://athensmesh.gr/terms ' } });
    fireEvent.blur(terms);
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ termsOfServiceUrl: 'https://athensmesh.gr/terms' }));
  });

  it('the default Meshtastic source links to General, where it is set', async () => {
    renderServer(PATH);
    const link = await screen.findByRole('link', { name: /Default Meshtastic source/ });
    expect(link).toHaveAttribute('href', '/server/general');
  });

  it('a hosted document: Edit opens it, Publish writes today\'s body, ⋯ Unpublish removes it', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Privacy Policy' }));
    const sheet = await screen.findByRole('dialog', { name: 'Privacy Policy' });
    fireEvent.change(within(sheet).getByLabelText('Document (Markdown)'), { target: { value: '# Privacy Policy\n\nNinety days.' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/privacy/admin/documents/privacy', body: { title: 'Privacy Policy', content: '# Privacy Policy\n\nNinety days.' } }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'More for Privacy Policy' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Unpublish' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/privacy/admin/documents/privacy', body: undefined }));
  });

  it('a settings writer who is not an admin sees today\'s writer part only: the hosted documents', async () => {
    renderServer(PATH, { permissions: grants({ write: true }) });
    await screen.findByText('Privacy Policy');
    expect(screen.getByText('Documents hosted here')).toBeInTheDocument();
    expect(screen.queryByText('Reliable PKI (default for every source)')).toBeNull();
    expect(screen.queryByLabelText('Admin command attempts')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Privacy Policy' })).toBeEnabled();
  });

  it('a non-admin reader sees the Privacy rows read-only: no control that would 403', async () => {
    renderServer(PATH, { permissions: grants({ write: true }) });
    await screen.findByText('Privacy Policy');
    expect(await screen.findByRole('switch', { name: /Discourage search engine/ })).toBeDisabled();
    expect(screen.getByPlaceholderText('https://example.org/privacy')).toBeDisabled();
  });

  it('a settings viewer sees today\'s hosted documents, view only: no Publish, Upload or Unpublish', async () => {
    const { log } = renderServer(PATH, { permissions: grants({ read: true }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Privacy Policy' }));
    const sheet = await screen.findByRole('dialog', { name: 'Privacy Policy' });
    expect(within(sheet).getByLabelText('Document (Markdown)')).toBeDisabled();
    expect(within(sheet).queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(within(sheet).queryByRole('button', { name: /Upload file/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More for Privacy Policy' })).toBeNull();
    expect(screen.queryByText('Reliable PKI (default for every source)')).toBeNull();
    expect(log.writes).toHaveLength(0);
  });

  it('on phone a disclosure URL opens a field; Save writes it trimmed', async () => {
    const { log } = renderServer(PATH, { phone: true });
    fireEvent.click((await screen.findAllByRole('button', { name: /Hidden/ }))[0]);
    const sheet = await screen.findByRole('dialog', { name: 'Privacy policy URL' });
    fireEvent.change(within(sheet).getByLabelText('Privacy policy URL'), { target: { value: ' https://athensmesh.gr/privacy ' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ privacyPolicyUrl: 'https://athensmesh.gr/privacy' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Privacy policy URL' })).toBeNull());
  });
});

describe('Server › Analytics', () => {
  it('provider and fields write nothing until Save; Save writes both, the config as today\'s JSON', async () => {
    const { log } = renderServer('/server/analytics');
    const domain = await screen.findByLabelText('Domain');
    expect(domain).toHaveValue('mesh.athensmesh.gr');
    expect(screen.getByText(/Enabling analytics will send visitor data/)).toBeInTheDocument();
    fireEvent.change(domain, { target: { value: 'athensmesh.gr' } });
    fireEvent.blur(domain);
    await new Promise((r) => setTimeout(r, 20));
    expect(settingsWrites(log)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(settingsWrites(log)).toContainEqual({ analyticsProvider: 'plausible', analyticsConfig: JSON.stringify({ domain: 'athensmesh.gr' }) }),
    );
    expect(urls().some((u) => u.includes('athensmesh.gr'))).toBe(false);
  });

  it('changing the provider starts its fields empty, as today', async () => {
    const { log } = renderServer('/server/analytics');
    fireEvent.change(await screen.findByLabelText('Analytics Provider'), { target: { value: 'umami' } });
    expect(screen.queryByLabelText('Domain')).toBeNull();
    expect(screen.getByLabelText('Website ID')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(settingsWrites(log)).toContainEqual({ analyticsProvider: 'umami', analyticsConfig: '{}' }));
  });

  it('admins only', async () => {
    renderServer('/server/analytics', { permissions: grants({ write: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
  });
});
