/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { ShellDevicesContext } from '../../shell/shellDevices';
import ConfirmSheet from '../ConfirmSheet';
import OneTimeReveal from '../OneTimeReveal';
import StateView from '../StateView';
import SendsLine from '../SendsLine';
import DeviceTag from '../DeviceTag';

const confirm = (p: Partial<React.ComponentProps<typeof ConfirmSheet>> = {}) => {
  const onConfirm = vi.fn(), onCancel = vi.fn();
  renderWorkspace(
    <ConfirmSheet open title="Purge" body="Gone for good" consequences={['Deletes messages']} confirmLabel="Purge now"
      confirmWord="PURGE" danger onConfirm={onConfirm} onCancel={onCancel} {...p} />,
  );
  return { onConfirm, onCancel };
};

describe('ConfirmSheet', () => {
  it('keeps confirm disabled until the word is typed, case-sensitive', () => {
    const { onConfirm } = confirm();
    const btn = screen.getByRole('button', { name: 'Purge now' });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type PURGE to confirm'), { target: { value: 'purge' } });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type PURGE to confirm'), { target: { value: 'PURGE' } });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Deletes messages')).toBeInTheDocument();
  });
  it('disables field and both buttons while busy, with a spinner', () => {
    confirm({ busy: true });
    expect(screen.getByLabelText('Type PURGE to confirm')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Purge now' })).toBeDisabled();
    expect(screen.getByTestId('confirm-spinner')).toBeInTheDocument();
  });
  it('Esc cancels', () => {
    const { onCancel } = confirm();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
  it('confirms at once with no word', () => {
    const { onConfirm } = confirm({ confirmWord: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Purge now' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe('ConfirmSheet failure and busy', () => {
  it('keeps the sheet open and shows the error when onConfirm rejects', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const { onCancel } = confirm({ confirmWord: undefined, onConfirm: vi.fn().mockRejectedValue(new Error('Server said no')) });
    fireEvent.click(screen.getByRole('button', { name: 'Purge now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server said no');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Purge now' })).toBeEnabled();
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
  it('falls back to the generic error copy and clears it on retry', async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce('boom').mockResolvedValue(undefined);
    confirm({ confirmWord: undefined, onConfirm });
    fireEvent.click(screen.getByRole('button', { name: 'Purge now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An error occurred');
    fireEvent.click(screen.getByRole('button', { name: 'Purge now' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
  it('announces busy: aria-busy on confirm and a live status', () => {
    confirm({ busy: true });
    expect(screen.getByRole('button', { name: /Purge now/ })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });
});

describe('OneTimeReveal', () => {
  it('Done waits for the ack when mustAck', () => {
    const onDone = vi.fn();
    renderWorkspace(<OneTimeReveal secrets={['aaa', 'bbb']} mustAck onDone={onDone} />);
    expect(screen.getByText('Shown once')).toBeInTheDocument();
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I saved these codes'));
    expect(done).toBeEnabled();
    fireEvent.click(done);
    expect(onDone).toHaveBeenCalled();
  });
  it('Done is enabled without mustAck', () => {
    renderWorkspace(<OneTimeReveal secrets={['a']} onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
  });
});

describe('StateView', () => {
  it.each([
    ['loading', 'Loading…'],
    ['empty', 'Nothing here yet'],
    ['error', 'Something went wrong'],
    ['noPermission', "You don't have permission to do this"],
    ['notFound', 'Not found'],
  ] as const)('%s shows today\'s string', (kind, text) => {
    renderWorkspace(<StateView kind={kind} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
  it('error retry calls onRetry', () => {
    const onRetry = vi.fn();
    renderWorkspace(<StateView kind="error" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('SendsLine and DeviceTag', () => {
  it('SendsLine shows its text', () => {
    renderWorkspace(<SendsLine>Sends 1 message</SendsLine>);
    expect(screen.getByText('Sends 1 message')).toBeInTheDocument();
  });
  it('DeviceTag renders nothing outside the shell provider', () => {
    const { container } = renderWorkspace(<DeviceTag sourceId="a" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('DeviceTag shows the abbreviation, and nothing for an unknown id', () => {
    const src = { id: 'a', name: 'Alpha Base', abbrev: 'AB', colorToken: 'var(--device-2)' } as never;
    renderWorkspace(
      <ShellDevicesContext.Provider value={{ sources: [src], home: null }}>
        <DeviceTag sourceId="a" /><div data-testid="x"><DeviceTag sourceId="zzz" /></div>
      </ShellDevicesContext.Provider>,
    );
    expect(screen.getByText('AB').getAttribute('style')).toContain('var(--device-2)');
    expect(screen.getByTestId('x')).toBeEmptyDOMElement();
  });
});
