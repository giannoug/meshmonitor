/**
 * Task 8.3 routing: a Classic user following a Workspace built-in link lands
 * on today's Automation tab; every built-in id is one of today's anchors.
 */
import { describe, it, expect } from 'vitest';
import { classicFallback } from '../../layout/classicFallback';
import { automationNavItems } from '../../../components/search/configSections';
import { BUILTIN_IDS } from '../ids';

describe('automation routes', () => {
  it('a built-in page and the list fall back to Classic\'s Automation tab', () => {
    expect(classicFallback('/source/src-g2/automation/auto-acknowledge')).toBe('/source/src-g2/automation');
    expect(classicFallback('/source/src-g2/automation/builtins')).toBe('/source/src-g2/automation');
    expect(classicFallback('/source/src-g2/automation')).toBeNull();
  });

  it('the built-in ids are exactly today\'s Automation tab anchors', () => {
    expect([...BUILTIN_IDS].sort()).toEqual(automationNavItems(((k: string) => k) as unknown as Parameters<typeof automationNavItems>[0]).map((i) => i.id).sort());
  });
});
