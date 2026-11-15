/** The settings frame's one device-config instance (Ruling DG), shared with its category pages. */
import { createContext, useContext } from 'react';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import type { DeviceConfigSaves } from '../../hooks/deviceConfig/useDeviceConfigSaves';

export interface SharedDeviceConfig {
  state: DeviceConfigState;
  saves: DeviceConfigSaves;
}

export const DeviceConfigContext = createContext<SharedDeviceConfig | null>(null);

/** The device's one configuration instance; null on a device without a radio, or for a viewer who cannot read it. */
export const useSharedDeviceConfig = () => useContext(DeviceConfigContext);
