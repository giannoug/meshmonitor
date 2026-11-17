/**
 * @vitest-environment jsdom
 *
 * Boards 18-11 (desktop) and 18-12 (phone), Task 6.4: Server › Notification
 * services. Apprise URL with Test Connection and External URL keep their own
 * Save (s13n1); the VAPID block moved here from Notifications (s18n6).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SERVER_SETTINGS } from '../../__fixtures__/server';
import { grants, renderServer } from './serverHarness';

const PATH = '/server/notification-services';
const urls = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));

describe('18-11 / 18-12 notification services', () => {
  it.each([
    ['18-11-notification-services', false],
    ['18-12-notification-services', true],
  ])('%s shows the board', async (board, phone) => {
    const { container } = renderServer(PATH, { phone });
    await screen.findByText('Update Contact Email');
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await screen.findByText('Connected successfully (42ms)');
    expectBoard(board, container);
  });

  it('Test Connection sends one request with the URL as typed, only when pressed, and never retries', async () => {
    const { log } = renderServer(PATH, {
      fixtures: { 'POST /api/settings/test-apprise': () => new Response(JSON.stringify({ error: 'unreachable' }), { status: 502 }) },
    });
    const input = await screen.findByLabelText('Apprise API Server URL');
    expect(urls().some((u) => u.includes('test-apprise'))).toBe(false);
    fireEvent.change(input, { target: { value: '  http://apprise:8000 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    expect(await screen.findByText('unreachable')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    const tests = vi.mocked(fetch).mock.calls.filter(([u]) => String(u).includes('test-apprise'));
    expect(tests).toHaveLength(1);
    expect(JSON.parse(String(tests[0][1]?.body))).toEqual({ url: 'http://apprise:8000' });
    // Testing saves nothing.
    expect(log.writes.filter((w) => w.path === '/api/settings')).toEqual([]);
  });

  it('the Apprise URL saves only with Save, trimmed', async () => {
    const { log } = renderServer(PATH);
    const input = await screen.findByLabelText('Apprise API Server URL');
    fireEvent.change(input, { target: { value: ' http://apprise:8000 ' } });
    fireEvent.blur(input);
    await new Promise((r) => setTimeout(r, 20));
    expect(log.writes.filter((w) => w.path === '/api/settings')).toEqual([]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { appriseApiServerUrl: 'http://apprise:8000' } }));
  });

  it('External URL saves with its own Save', async () => {
    const { log } = renderServer(PATH, { settings: { ...SERVER_SETTINGS, externalUrl: 'https://old.example.com' } });
    const input = await screen.findByLabelText('External URL');
    await waitFor(() => expect(input).toHaveValue('https://old.example.com'));
    fireEvent.change(input, { target: { value: 'https://mesh.example.com' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[1]);
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { externalUrl: 'https://mesh.example.com' } }));
  });

  it('VAPID: today\'s status, then Update Contact Email writes and reads the status again', async () => {
    const { log } = renderServer(PATH);
    expect(await screen.findByText('Configured')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/^BKx9Qm2rT7vLw0aP4sYdN8eF3hJ6uZc1oI5gRkWq2xYzTnB8vC\.\.\.$/)).toBeInTheDocument();
    const email = screen.getByLabelText('Contact Email (VAPID Subject):');
    expect(email).toHaveValue('mailto:admin@example.com');
    fireEvent.change(email, { target: { value: 'mailto:ops@example.com' } });
    const before = log.reads.filter((r) => r === '/api/push/status').length;
    fireEvent.click(screen.getByRole('button', { name: 'Update Contact Email' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'PUT', path: '/api/push/vapid-subject', body: { subject: 'mailto:ops@example.com' } }));
    await waitFor(() => expect(log.reads.filter((r) => r === '/api/push/status').length).toBe(before + 1));
  });

  it('a non-admin gets no access and nothing is read', async () => {
    renderServer(PATH, { permissions: grants({ write: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(urls().some((u) => u.includes('/api/push/status'))).toBe(false);
  });
});
