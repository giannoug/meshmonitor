/**
 * jsdom has no layout, so a virtualised list there sees a 0 px viewport and
 * draws nothing. Nodes tests give every element a 600 px client height (the
 * scroller's viewport) and a 57 px offset height (a measured row).
 */
import { afterEach, beforeEach, vi } from 'vitest';

export function withRowLayout(): void {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(57);
  });
  afterEach(() => vi.restoreAllMocks());
}
