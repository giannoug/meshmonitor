/**
 * The radio save queue (Task 5.3, boards b-set-d1 / b-set-d3 / b-set-p2): the
 * device's unsaved radio edits, by category, saved together from one bar.
 *
 * The edits live in the frame's one device-config instance (Ruling DG), so the
 * queue is what differs from the frame's baseline for each queued section
 * (radioSections.ts): it survives moving between categories, whose pages
 * remount. The baseline is what the node is known to hold: taken when the
 * configuration (re)loads, and moved for a section only after the node took its
 * save, as useSectionBaseline does on today's page.
 *
 * `saveAll` writes the queued sections one after another through today's
 * handlers (no parallel writes, no retries); the frame shows one RebootModal
 * with the strongest expectation afterwards (`runBatch`). A failed section
 * stays queued and is returned in `failed`, also across the reload that
 * follows that notice.
 */
import { createContext, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigSaveSection } from '../../hooks/deviceConfig/useDeviceConfigSaves';
import type { NumberInputScopeHandle } from '../../components/common/numberInputScopeContext';
import { rebootExpectation } from '../../utils/configRebootRules';
import { CATEGORIES } from './categories';
import { KEEP_ON_RELOAD, RELOADED_SECTIONS, changedKeys, fieldLabel, isQueued, pickValues, setterOf, type Values } from './radioSections';
import type { SharedDeviceConfig } from './sharedDeviceConfig';

export type SaveLabel = 'save' | 'saveMayRestart' | 'saveAndRestart';

/** Today's "Save" (D9b), else the restart wording the boards draw. */
export const SAVE_LABEL_KEY: Record<SaveLabel, string> = {
  save: 'common.save',
  saveMayRestart: 'workspace.settings.savebar.save_may_restart',
  saveAndRestart: 'workspace.settings.savebar.save_and_restart',
};

export interface QueueEntry {
  section: ConfigSaveSection;
  categoryId: string;
  /** `field` is the state value's name; `label` today's label for it. */
  changes: Array<{ field: string; label: string; from: unknown; to: unknown }>;
}

export interface SaveResult {
  ok: ConfigSaveSection[];
  failed: ConfigSaveSection[];
}

export interface RadioSaveQueue {
  queue: QueueEntry[];
  /** Puts one section (or every queued one) back to the baseline. */
  discard(section?: ConfigSaveSection): void;
  label: SaveLabel;
  saveAll(): Promise<SaveResult>;
  saving: boolean;
  /** A number field on screen holds invalid text: nothing saves (#5649). */
  invalid: boolean;
  /** What the node holds for `section`, for a row's "was …". */
  baseline(section: ConfigSaveSection): Values | undefined;
}

const SECTIONS = CATEGORIES.map((c) => c.saveSection).filter(isQueued);

/** The save button's words: the strongest restart rule among the queued sections (configRebootRules). */
export function saveLabel(sections: readonly ConfigSaveSection[], firmware: string | null | undefined): SaveLabel {
  const rules = sections.map((s) => rebootExpectation(s, firmware));
  if (rules.includes('always')) return 'saveAndRestart';
  if (rules.includes('possible')) return 'saveMayRestart';
  return 'save';
}

export interface QueueOptions {
  numberScope: NumberInputScopeHandle;
  /** Runs the saves so the frame shows one reboot notice when they are done. */
  runBatch<T>(fn: () => Promise<T>): Promise<T>;
}

/** The frame's one queue; categories read it with `useRadioSaveQueue()`. */
export function useRadioSaveQueueState({ state, saves }: SharedDeviceConfig, { numberScope, runBatch }: QueueOptions): RadioSaveQueue {
  const { t } = useTranslation();
  const [baselines, setBaselines] = useState<Partial<Record<ConfigSaveSection, Values>>>({});
  const [seen, setSeen] = useState({ loading: true, version: -1 });
  // The values each saved section sent, which become its baseline.
  const [committed, setCommitted] = useState<Partial<Record<ConfigSaveSection, Values>>>({});
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  // A failed section's edits, put back after the reload that follows the restart of the sections that saved.
  const carry = useRef<QueueEntry[] | null>(null);

  // Moved during render, as useSectionBaseline does, so the render that shows
  // freshly loaded or saved values never counts them as changes.
  // - A load that finishes re-baselines every section.
  // - Reload config (configVersion alone) re-baselines only the values it re-reads, as today's page does.
  // - A save moves its section to the values it sent, so an edit typed meanwhile stays queued.
  let current = baselines;
  const loaded = !state.loading && seen.loading;
  const reloaded = !state.loading && !seen.loading && seen.version !== state.configVersion;
  if (loaded) {
    current = Object.fromEntries(SECTIONS.map((s) => [s, pickValues(state, s)]));
    for (const entry of carry.current ?? []) {
      for (const c of entry.changes) setterOf(state, c.field as keyof typeof state)?.(c.to);
    }
    carry.current = null;
  } else if (reloaded) {
    current = { ...current };
    for (const section of RELOADED_SECTIONS) {
      const next = pickValues(state, section);
      for (const k of KEEP_ON_RELOAD[section] ?? []) next[k] = baselines[section]?.[k];
      current[section] = next;
    }
  }
  const commits = Object.keys(committed).length > 0;
  if (commits && !loaded) current = { ...current, ...committed };
  if (commits) setCommitted({});
  if (current !== baselines) setBaselines(current);
  if (seen.loading !== state.loading || seen.version !== state.configVersion) {
    setSeen({ loading: state.loading, version: state.configVersion });
  }

  const queue: QueueEntry[] = [];
  for (const section of SECTIONS) {
    const base = current[section];
    if (!base) continue;
    const keys = changedKeys(state, section, base);
    if (keys.length === 0) continue;
    queue.push({
      section,
      categoryId: CATEGORIES.find((c) => c.saveSection === section)!.id,
      changes: keys.map((k) => ({ field: k, label: fieldLabel(t, section, k), from: base[k], to: state[k] })),
    });
  }

  const discard = (section?: ConfigSaveSection) => {
    for (const entry of queue) {
      if (section && entry.section !== section) continue;
      for (const c of entry.changes) setterOf(state, c.field as keyof typeof state)?.(c.from);
    }
    numberScope.reset();
  };

  const saveAll = async (): Promise<SaveResult> => {
    const result: SaveResult = { ok: [], failed: [] };
    if (busy.current || numberScope.invalid || queue.length === 0) return result;
    busy.current = true;
    setSaving(true);
    try {
      await runBatch(async () => {
        for (const { section } of queue) {
          // Today's handlers report their own errors and resolve false; a throw counts as a failure too.
          const ok = await (saves[section] as () => Promise<boolean>)().catch(() => false);
          result[ok ? 'ok' : 'failed'].push(section);
        }
      });
    } finally {
      busy.current = false;
      setSaving(false);
      if (result.ok.length) {
        const sent = queue.filter((e) => result.ok.includes(e.section));
        setCommitted((prev) => ({
          ...prev,
          ...Object.fromEntries(sent.map((e) => [e.section, { ...current[e.section], ...Object.fromEntries(e.changes.map((c) => [c.field, c.to])) }])),
        }));
      }
      // The reboot notice reloads the configuration when it closes, which would drop the failed edits.
      if (result.ok.some((s) => rebootExpectation(s, state.localFirmwareVersion) !== 'never')) {
        carry.current = queue.filter((e) => result.failed.includes(e.section));
      }
    }
    return result;
  };

  return {
    queue,
    discard,
    label: saveLabel(queue.map((e) => e.section), state.localFirmwareVersion),
    saveAll,
    saving,
    invalid: numberScope.invalid,
    baseline: (section) => current[section],
  };
}

export const RadioSaveQueueContext = createContext<RadioSaveQueue | null>(null);

/** The device's one radio save queue (Ruling DG); null on a device without a radio. */
export const useRadioSaveQueue = () => useContext(RadioSaveQueueContext);
