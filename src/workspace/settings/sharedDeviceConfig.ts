/** The settings frame's one device-config instance (Ruling DG), shared with its category pages. */
import { createContext, useContext } from 'react';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import type { DeviceConfigSaves } from '../../hooks/deviceConfig/useDeviceConfigSaves';

export interface SharedDeviceConfig {
  state: DeviceConfigState;
  saves: DeviceConfigSaves;
  /** Opens the frame's reboot wait, as a save that restarts the radio does (a sent Maintenance reboot, Task 9.1). */
  expectReboot?(e: 'always' | 'possible'): void;
}

export const DeviceConfigContext = createContext<SharedDeviceConfig | null>(null);

/** The device's one configuration instance; null on a device without a radio, or for a viewer who cannot read it. */
export const useSharedDeviceConfig = () => useContext(DeviceConfigContext);
