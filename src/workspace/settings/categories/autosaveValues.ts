/** The stored forms the In MeshMonitor rows read and write (Task 5.8), and the page's source. */
import { useSource } from '../../../contexts/SourceContext';
import type { AutosaveOptions } from '../useAutosaveSetting';

/** '1' / 'true' is on, as SettingsTab reads the 0/1 keys. */
export const bool01: Pick<AutosaveOptions<boolean>, 'parse' | 'serialize'> = {
  parse: (raw) => raw === '1' || raw === 'true',
  serialize: (v) => (v ? '1' : '0'),
};
/** Keys stored as 'true' / 'false'. */
export const boolText: Pick<AutosaveOptions<boolean>, 'parse' | 'serialize'> = {
  parse: (raw) => raw === 'true',
  serialize: (v) => (v ? 'true' : 'false'),
};

/** The source this page edits, as the frame's SourceProvider names it. */
export const usePageSource = () => useSource().sourceId ?? undefined;
