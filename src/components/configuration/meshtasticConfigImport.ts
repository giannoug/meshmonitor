/**
 * Today's Meshtastic channel-URL import (ImportConfigModal), shared with the
 * Workspace Share and import page (#6365) so both write the same thing in the
 * same order: one import request, then the wait for the reboot (or a short
 * sync pause), then the poll until the device reports its channels.
 */
import type { TFunction } from 'i18next';
import apiService from '../../services/api';
import { REGION_OPTIONS } from './constants';

/** Where an import is: the status line today's dialog shows for each. */
export type ImportStep = 'sending' | 'rebooting' | 'syncing' | 'verifying' | 'complete';
export const IMPORT_STEPS: readonly ImportStep[] = ['sending', 'rebooting', 'syncing', 'verifying', 'complete'];

// Derived from REGION_OPTIONS (the authoritative protobuf-enum-ordered table)
// instead of a hand-maintained duplicate: the old literal table had codes 13-18
// shifted by one (13 showed UA_433 instead of LORA_24) and knew nothing about
// codes 19+ (PH_*, ANZ_433, KZ_*, NP_865, BR_902, ...).
export const regionNames: { [key: number]: string } = Object.fromEntries(
  REGION_OPTIONS.map((o) => [o.value, o.label.split(' - ')[0]])
);

export interface MeshtasticImportOptions {
  url: string;
  /** A remote node: the admin import endpoint. */
  nodeNum?: number;
  sourceId?: string | null;
  /** The URL's LoRa settings are applied, so the poll waits for them too. */
  includeLoraConfig: boolean;
  t: TFunction;
  /** Each step as it starts; `elapsed` (seconds) repeats while the device reboots. */
  onStep(step: ImportStep, elapsed?: number): void;
}

export async function runMeshtasticImport({ url, nodeNum, sourceId, includeLoraConfig, t, onStep }: MeshtasticImportOptions): Promise<void> {
  // Call the import API which will:
  // - Decode the URL
  // - Write selected channels to the device
  // - Write LoRa config to the device if selected
  onStep('sending');
  const result = await apiService.importConfig(url, nodeNum, sourceId);

  // If reboot is required, wait for device to reconnect and sync
  if (result.requiresReboot) {
    onStep('rebooting');
    await waitForDeviceReconnect(sourceId, t, onStep);
  } else {
    onStep('syncing');
    // Even without reboot, give device time to process and sync
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Poll for updated channel data
  onStep('verifying');
  await pollForChannelUpdates(includeLoraConfig);

  onStep('complete');
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function waitForDeviceReconnect(sourceId: string | null | undefined, t: TFunction, onStep: MeshtasticImportOptions['onStep']): Promise<void> {
  // Wait up to 60 seconds for device to reboot and reconnect
  const maxWaitTime = 60000; // 60 seconds
  const pollInterval = 2000; // 2 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Check connection status to see if device is back online
      const statusData = await apiService.getConnectionStatus();
      if (statusData.connected === true) {
        // Device is back online - request fresh config from device
        await apiService.refreshNodes(sourceId);
        return;
      }
    } catch {
      // Device still offline, continue waiting
    }

    onStep('rebooting', Math.floor((Date.now() - startTime) / 1000));
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(t('import_config.error_reconnect_timeout'));
}

async function pollForChannelUpdates(includeLoraConfig: boolean): Promise<void> {
  // Poll for configuration updates from device for up to 45 seconds
  // IMPORTANT: Use /api/poll (not /api/channels) to get live device state including LoRa config
  const maxWaitTime = 45000; // 45 seconds
  const pollInterval = 2000; // 2 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Fetch live device data from /api/poll (includes channels AND LoRa config)
      const pollData = await apiService.get<{
        channels?: Array<{ psk?: string }>;
        deviceConfig?: { lora?: { modemPreset?: unknown } };
      }>('/api/poll');

      // Check if we have channel data with PSKs (indicates channel sync)
      const hasChannels = pollData?.channels && pollData.channels.length > 0;
      const channelsWithPSKs = pollData?.channels?.filter((ch) => ch.psk && ch.psk !== '').length || 0;

      // Check if LoRa config is synced (if we're importing LoRa config)
      // LoRa config is nested in deviceConfig.lora (requires configuration:read permission)
      const hasLoraConfig = includeLoraConfig ? pollData?.deviceConfig?.lora?.modemPreset !== undefined : true;

      if (hasChannels && channelsWithPSKs > 0 && hasLoraConfig) {
        // Give it a bit more time to ensure all data is fully synced
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
      }
    } catch {
      // Continue polling
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Even if we timeout, consider it successful
  // (the data will eventually sync)
}
