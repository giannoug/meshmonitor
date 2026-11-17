/**
 * @vitest-environment jsdom
 *
 * You › MeshCore Messaging (Task 6.3; no board, Ruling 6.3 meshcore): today's
 * three rows on the settings kit, saving as you go. The auto-retry row says
 * what it sends.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPrefs } from './prefsHarness';

describe('MeshCore Messaging', () => {
  it('shows today\'s rows, with the retry\'s Sends line, and saves today\'s keys', async () => {
    const { log } = renderPrefs('/preferences/meshcore-messaging');
    const retry = await screen.findByRole('switch', { name: 'Auto-retry automated MeshCore channel sends' });
    expect(screen.getByText(/hears no repeater in 30 s is sent once more/)).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(log.settings).toContainEqual({ meshcoreChannelRetryEnabled: '1' }));
    const timeout = screen.getByLabelText('Remote CLI reply timeout (seconds)');
    expect(timeout).toHaveValue(15);
    fireEvent.change(timeout, { target: { value: '8' } });
    fireEvent.blur(timeout);
    await waitFor(() => expect(log.settings).toContainEqual({ meshcoreCliTimeoutSeconds: '8' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Use other sources to resolve unknown hops' }));
    await waitFor(() => expect(log.settings).toContainEqual({ meshcoreCrossSourceHopResolution: '1' }));
  });
});
