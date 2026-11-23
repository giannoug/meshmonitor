import { useState } from 'react';
import type { EventState, FactState, SimResult } from '../../components/automations/automationTesterHelpers';

/**
 * The Test run's inputs and last result, held by the page so they survive the
 * panel or sheet giving way to Tokens (D9c) and coming back.
 */
export function useTestDraft() {
  const [ev, setEv] = useState<EventState>({});
  const [facts, setFacts] = useState<FactState>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [more, setMore] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  return { ev, setEv, facts, setFacts, overrides, setOverrides, samples, setSamples, more, setMore, advanced, setAdvanced, result, setResult, error, setError, running, setRunning };
}

export type TestDraft = ReturnType<typeof useTestDraft>;
