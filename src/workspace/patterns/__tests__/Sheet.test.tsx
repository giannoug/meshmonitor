/**
 * @vitest-environment jsdom
 *
 * Sheet (spec §5.7): bottom on phone, docked right from 768 px, portaled to
 * <body>, aria-modal, Esc and the backdrop close it, Tab stays inside.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import Sheet from '../Sheet';

function renderSheet(opts: { phone?: boolean; side?: 'auto' | 'bottom' | 'right' } = {}) {
  const onClose = vi.fn();
  const utils = renderWorkspace(
    <div data-testid="host">
      <button type="button">trigger</button>
      <Sheet open onClose={onClose} title="Devices" side={opts.side} footer={<button type="button">Done</button>}>
        <button type="button">first</button>
      </Sheet>
    </div>,
    { phone: opts.phone ?? true },
  );
  return { onClose, ...utils };
}

describe('Sheet', () => {
  it('is a labelled modal dialog rendered outside its host', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Devices' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('host')).not.toContainElement(dialog);
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it.each([
    [true, 'auto', 'bottom'],
    [false, 'auto', 'right'],
    [false, 'bottom', 'bottom'],
    [true, 'right', 'right'],
  ] as const)('phone=%s side=%s docks %s', (phone, side, docked) => {
    renderSheet({ phone, side });
    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', docked);
  });

  it('Esc, the close button and the backdrop close it', () => {
    const { onClose } = renderSheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps Tab inside the sheet', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    const done = screen.getByRole('button', { name: 'Done' });
    done.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('renders nothing while closed', () => {
    renderWorkspace(<Sheet open={false} onClose={() => {}} title="Devices">x</Sheet>, { phone: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
