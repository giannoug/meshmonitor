/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import RowMenu from '../RowMenu';

const setup = (onSelect = vi.fn()) => {
  renderWorkspace(
    <RowMenu label="Row actions" items={[{ key: 'a', label: 'Pin', icon: 'check', checked: false, onSelect }]} />,
  );
  const trigger = screen.getByRole('button', { name: 'Row actions' });
  fireEvent.click(trigger);
  return { trigger, onSelect };
};

describe('RowMenu', () => {
  it('selecting a checkbox item returns focus to the trigger', () => {
    const seen: (Element | null)[] = [];
    const { trigger, onSelect } = setup(vi.fn(() => seen.push(document.activeElement)));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Pin' }));
    expect(onSelect).toHaveBeenCalled();
    expect(seen[0]).toBe(trigger);
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab closes the open menu', () => {
    const { trigger } = setup();
    fireEvent.keyDown(screen.getByRole('menuitemcheckbox', { name: 'Pin' }), { key: 'Tab' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
