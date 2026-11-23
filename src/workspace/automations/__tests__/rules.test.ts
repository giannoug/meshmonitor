/**
 * The rules readers (Task 8.4): what the steps view can draw without losing
 * anything (GR), the Sends line, a run's result, and step summaries that keep
 * secrets out.
 */
import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { BRANCHED_RULE, RULES } from '../../__fixtures__/rules';
import { drawable, readGraph, ruleSends, runKind, stepSummary } from '../rules';

const t = ((k: string, o?: Record<string, unknown>) => `${k}${o ? JSON.stringify(o) : ''}`) as unknown as TFunction;

describe('rules readers', () => {
  it('drawable: today\'s builder shape only, with no key compile() does not write', () => {
    expect(RULES.every((r) => drawable(JSON.parse(r.config)))).toBe(true);
    expect(drawable(JSON.parse(BRANCHED_RULE.config))).toBe(false);
    const extraNodeKey = JSON.parse(RULES[2].config);
    extraNodeKey.nodes[0].position = { x: 1, y: 2 };
    expect(drawable(extraNodeKey)).toBe(false);
    expect(drawable({ ...JSON.parse(RULES[2].config), version: 2 })).toBe(false);
  });

  it('ruleSends: nothing for a rule that does not transmit; the limit when there is one', () => {
    expect(ruleSends(readGraph(RULES[1].config), t)).toBe('workspace.settings.savebar.sends_nothing');
    expect(ruleSends(readGraph(RULES[4].config), t)).toContain('workspace.rules.sends.rate{"max":20,"seconds":60}');
  });

  it('runKind reads today\'s status and steps', () => {
    const run = { id: 'r', status: 'completed', sourceId: null, startedAt: 0, log: null, triggerEvent: null };
    expect(runKind({ ...run, status: 'failed' }, [])).toBe('failed');
    expect(runKind(run, [{ type: 'condition.string', outcome: 'condition:false' }])).toBe('skipped');
    expect(runKind(run, [{ type: 'action.sendMessage', outcome: 'action:ok' }])).toBe('sent');
    expect(runKind(run, [{ type: 'action.sendMessage', outcome: 'action:ok', detail: { skipped: true } }])).toBe('skipped');
    expect(runKind(run, [{ type: 'action.notify', outcome: 'action:ok' }])).toBe('done');
  });

  it('a step summary never shows an advanced field such as Apprise URLs', () => {
    const line = stepSummary({ type: 'action.notify', params: { urls: 'tgram://secret-token/123' } }, 'trigger.message', t, []);
    expect(line).not.toContain('secret-token');
  });

  it('names only devices the viewer can read', () => {
    const line = stepSummary({ type: 'condition.sourceFilter', params: { sourceIds: ['a', 'b'] } }, 'trigger.message', t, [{ id: 'a', name: 'Station G2' }]);
    expect(line).toContain('Station G2');
    expect(line).toContain('workspace.rules.other_devices');
    expect(line).not.toContain('"b"');
  });
});
