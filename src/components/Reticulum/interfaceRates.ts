/**
 * The interface cards' byte totals and their derived tx/rx rates (#3960
 * Phase 1b WP4), shared by today's `ReticulumInterfacesView` and the
 * Workspace Interfaces page (#6365). A rate is the delta of two consecutive
 * polls of the cumulative byte counters; the first sample has none.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReticulumInterfaceRow } from '../../types/reticulum';

/** Local byte-humanizer, mirroring the convention already used in
 * `DatabaseMaintenanceSection.tsx` / `FirmwareUpdateSection.tsx` — no shared
 * util exists for this in the codebase yet, so a small local helper stays
 * consistent with the existing pattern rather than inventing a new shared
 * module for one call site. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}

/** Bytes/sec humanizer for the derived rate indicator. */
export function formatRate(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec < 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

interface Sample {
  txBytes: number;
  rxBytes: number;
  at: number;
}

export interface DerivedRate {
  txRate: number;
  rxRate: number;
}

/**
 * Tracks the previous cumulative-byte sample per interface (by name) across
 * poll cycles and derives a byte/sec rate from the delta. Returns a map of
 * only the interfaces that have at least two samples — callers treat a
 * missing entry as "not yet derivable".
 */
export function useDerivedRates(interfaces: ReticulumInterfaceRow[]): Map<string, DerivedRate> {
  const prevRef = useRef<Map<string, Sample>>(new Map());
  const [rates, setRates] = useState<Map<string, DerivedRate>>(new Map());

  useEffect(() => {
    const now = Date.now();
    const prev = prevRef.current;
    const nextPrev = new Map<string, Sample>();
    const nextRates = new Map<string, DerivedRate>();

    for (const iface of interfaces) {
      const sample: Sample = { txBytes: iface.txBytes, rxBytes: iface.rxBytes, at: now };
      const last = prev.get(iface.interfaceName);
      if (last) {
        const deltaSec = (now - last.at) / 1000;
        // Counters can reset (e.g. bridge restart) — a negative delta means
        // "not derivable this cycle" rather than a bogus negative rate.
        if (deltaSec > 0 && iface.txBytes >= last.txBytes && iface.rxBytes >= last.rxBytes) {
          nextRates.set(iface.interfaceName, {
            txRate: (iface.txBytes - last.txBytes) / deltaSec,
            rxRate: (iface.rxBytes - last.rxBytes) / deltaSec,
          });
        }
      }
      nextPrev.set(iface.interfaceName, sample);
    }

    prevRef.current = nextPrev;
    setRates(nextRates);
    // Only recompute when the interface list itself changes (new poll
    // result), not on every render. `prevRef` is a ref and `setRates` is a
    // stable setState identity, so `[interfaces]` is already the complete
    // dependency set.
  }, [interfaces]);

  return rates;
}
