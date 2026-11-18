/**
 * A local repeater's settings as its pages share them (Task 7.4, Ruling HL):
 * read over the serial CLI once while the device's settings stay open (today
 * reads once per Device Configuration view), and again after a save, as today.
 */
import { createContext, useContext } from 'react';
import type { RepeaterSettingsSnapshot } from '../../../components/MeshCore/hooks/useMeshCore';

export interface LocalRepeater {
  snapshot: RepeaterSettingsSnapshot | null;
  loading: boolean;
  /** Read again (Retry, and after a save). */
  load(): Promise<void>;
}

export const LocalRepeaterContext = createContext<LocalRepeater | null>(null);

export const useLocalRepeater = () => useContext(LocalRepeaterContext);
