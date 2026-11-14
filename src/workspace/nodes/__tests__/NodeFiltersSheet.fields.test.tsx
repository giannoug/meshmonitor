/**
 * @vitest-environment jsdom
 *
 * Every field of today's AdvancedNodeFilterPopup is in NodeFiltersSheet. The
 * expected list is read from the popup itself, rendered: each of its checkbox
 * and radio labels (the 13 device roles among them) must be a control of the
 * same kind and name in the sheet, and each section title, mode button, range
 * label and action its text.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { AdvancedNodeFilterPopup } from '../../../components/AdvancedNodeFilterPopup';
import type { Channel } from '../../../types/device';
import { DEFAULT_NODE_FILTERS } from '../../../utils/nodeAdvancedFilter';
import { renderWorkspace } from '../../test/renderWorkspace';
import NodeFiltersSheet from '../NodeFiltersSheet';

const channels = [
  { id: 0, name: 'LongFast' },
  { id: 1, name: 'gauntlet' },
] as Channel[];

/** The labels the popup draws: its checks and radios, and its titles, mode buttons, range labels and actions. */
function popupFields(popup: Element) {
  const controls = [...popup.querySelectorAll<HTMLInputElement>('input[type=checkbox], input[type=radio]')].map((input) => ({
    role: input.type as 'checkbox' | 'radio',
    name: (input.closest('label')?.textContent ?? '').trim(),
  }));
  const texts = [...popup.querySelectorAll('.filter-section-title, .filter-toggle-btn, .filter-range-input label, .filter-popup-actions button')].map((el) =>
    (el.textContent ?? '').replace(/:$/, '').trim(),
  );
  return { controls, texts };
}

describe('NodeFiltersSheet covers AdvancedNodeFilterPopup', () => {
  it('has every popup field, including the 13 device roles', async () => {
    // Both in one real-i18n tree: the popup draws in place, the sheet in a portal.
    const { container } = renderWorkspace(
      <>
        <AdvancedNodeFilterPopup isOpen nodeFilters={DEFAULT_NODE_FILTERS} securityFilter="all" channels={channels} onNodeFiltersChange={vi.fn()} onSecurityFilterChange={vi.fn()} onClose={vi.fn()} />
        <NodeFiltersSheet open onClose={vi.fn()} nodeFilters={DEFAULT_NODE_FILTERS} onNodeFiltersChange={vi.fn()} securityFilter="all" onSecurityFilterChange={vi.fn()} channels={channels} />
      </>,
    );
    const { controls, texts } = popupFields(container.querySelector('.filter-popup')!);
    // The 13 default device roles (ROLE_NAMES), the 11 features, and a check per channel.
    expect(controls.filter((c) => c.role === 'checkbox')).toHaveLength(13 + 11 + channels.length);
    expect(texts.length).toBeGreaterThan(8);
    const sheet = await screen.findByRole('dialog');
    for (const { role, name } of controls) {
      expect(within(sheet).getByRole(role, { name }), `${role} "${name}"`).toBeInTheDocument();
    }
    for (const text of texts) expect(sheet, text).toHaveTextContent(text);
  });
});
