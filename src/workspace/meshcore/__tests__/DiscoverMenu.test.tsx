/**
 * @vitest-environment jsdom
 *
 * A press that finds another sweep running starts nothing and is not a failure.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DiscoverMenu from '../DiscoverMenu';

vi.mock('../../shell/useIsPhone', () => ({ useIsPhone: () => false }));
vi.mock('../../../contexts/SettingsContext', () => ({ useSettings: () => ({ timeFormat: '24', dateFormat: 'DD/MM/YYYY' }) }));

describe('DiscoverMenu', () => {
  it('a skipped press shows no "Discovery failed"; a null answer still does', async () => {
    const onDiscover = vi.fn().mockResolvedValueOnce('skipped').mockResolvedValueOnce(null);
    render(<DiscoverMenu onDiscover={onDiscover} onNew={() => {}} />);
    const btn = () => screen.getAllByRole('button')[1];
    await waitFor(() => expect(btn()).toBeEnabled());
    fireEvent.click(btn());
    await waitFor(() => expect(onDiscover).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(btn()).toBeEnabled());
    expect(screen.queryByText(/Discovery failed|discover.failed/)).toBeNull();
    fireEvent.click(btn());
    await screen.findByText(/Discovery failed|discover.failed/);
  });

  it('two presses in one tick call onDiscover once', async () => {
    const onDiscover = vi.fn(() => new Promise<null>(() => {}));
    render(<DiscoverMenu onDiscover={onDiscover} onNew={() => {}} />);
    const b = screen.getAllByRole('button')[1];
    fireEvent.click(b);
    fireEvent.click(b);
    expect(onDiscover).toHaveBeenCalledTimes(1);
  });
});
