/**
 * The reboot wait's polling, moved verbatim out of RebootModal (#6365, Rule X)
 * so the Workspace's RebootWait draws the same sequence: 30 s for the restart,
 * up to 3 connection checks 3 s apart, then up to 20 (or 5 for a possible
 * reboot) config polls 3 s apart, each asking the server to re-read the
 * connected radio's config. Nothing goes on the mesh.
 */
import { useState, useEffect } from 'react';
import apiService from '../services/api';
import { useSource } from '../contexts/SourceContext';

/** Config polls before a `possible` reboot is judged not to have happened. */
const POSSIBLE_REBOOT_POLLS = 5;
const ALWAYS_REBOOT_POLLS = 20;

export type RebootExpectation = 'always' | 'possible';

export function useRebootWait(isOpen: boolean, expectation: RebootExpectation, onClose: () => void) {
  const { sourceId } = useSource();
  const [statusKey, setStatusKey] = useState<string>('reboot.rebooting');
  const [statusParams, setStatusParams] = useState<Record<string, string | number>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setStatusKey('reboot.rebooting');
      setStatusParams({});
      setElapsedSeconds(0);
      setIsVerifying(false);
      return;
    }

    // Start monitoring device reboot
    const startTime = Date.now();
    let aborted = false;

    // Update elapsed time every second
    const intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    const maybe = expectation === 'possible';

    // Polling-based reboot sequence
    const waitForReboot = async () => {
      try {
        console.log('[RebootModal] ===== REBOOT SEQUENCE STARTED =====');

        // Read the reboot count now, before the node restarts (~7 s after the
        // save), so a restart that is already over by the first poll still
        // shows. This reads the server's copy; nothing goes to the node.
        let initialRebootCount: number | undefined;
        try {
          const before = await apiService.getCurrentConfig(sourceId);
          initialRebootCount = before?.localNodeInfo?.rebootCount;
        } catch (err) {
          console.warn('[RebootModal] Failed to read rebootCount before reboot:', err);
        }

        // Wait 30 seconds for device to reboot (typical reboot time)
        setStatusKey(maybe ? 'reboot.possible_please_wait' : 'reboot.rebooting_please_wait');
        setStatusParams({});
        console.log('[RebootModal] Waiting 30 seconds for device reboot...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        if (aborted) {
          console.log('[RebootModal] Aborted after reboot wait');
          return;
        }

        // Now verify device is back online
        setStatusKey('reboot.verifying_connection');
        setStatusParams({});
        setIsVerifying(true);
        console.log('[RebootModal] Starting connection verification...');

        // Try up to 3 times to verify device is back (with 3 second gaps)
        let connected = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          if (aborted) {
            console.log('[RebootModal] Aborted during connection check');
            return;
          }

          console.log(`[RebootModal] Connection check attempt ${attempt}/3...`);
          try {
            const statusData = await apiService.getConnectionStatus();
            console.log(`[RebootModal] Connection status:`, statusData);
            if (statusData.connected === true) {
              console.log('[RebootModal] ✅ Device connected!');
              connected = true;
              break;
            }
          } catch (err) {
            console.warn(`[RebootModal] Connection check attempt ${attempt} failed:`, err);
          }

          if (attempt < 3) {
            console.log('[RebootModal] Waiting 3 seconds before retry...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        if (!connected) {
          console.error('[RebootModal] ❌ Device reconnection timeout');
          setStatusKey('reboot.reconnection_timeout');
          setStatusParams({});
          await new Promise(resolve => setTimeout(resolve, 5000));
          clearInterval(intervalId);
          if (!aborted) onClose();
          return;
        }

        if (aborted) {
          console.log('[RebootModal] Aborted after connection verified');
          return;
        }

        console.log('[RebootModal] ===== STARTING CONFIGURATION POLLING =====');

      // Device is connected - now poll for configuration updates
      setStatusKey('reboot.waiting_for_config');
      setStatusParams({});
      console.log('[RebootModal] Device connected, starting configuration polling...');

      // Fall back to a baseline read now if the one before the wait failed.
      if (initialRebootCount === undefined) {
        try {
          const initialConfig = await apiService.getCurrentConfig(sourceId);
          initialRebootCount = initialConfig?.localNodeInfo?.rebootCount;
        } catch (err) {
          console.warn('[RebootModal] Failed to get initial config:', err);
        }
      }
      console.log('[RebootModal] Initial rebootCount:', initialRebootCount);

      // Poll up to 20 times, 3 seconds apart. A possible reboot gets fewer
      // polls: a node that restarted reports the new count on the first one.
      const totalPolls = maybe ? POSSIBLE_REBOOT_POLLS : ALWAYS_REBOOT_POLLS;
      let configUpdated = false;
      for (let pollAttempt = 1; pollAttempt <= totalPolls; pollAttempt++) {
        if (aborted) return;

        console.log(`[RebootModal] Poll attempt ${pollAttempt}/20 - requesting config refresh...`);
        setStatusKey('reboot.checking_config');
        setStatusParams({ attempt: pollAttempt, total: totalPolls });

        try {
          // Request fresh config from device
          await apiService.refreshNodes(sourceId);

          // Wait a moment for device to respond
          await new Promise(resolve => setTimeout(resolve, 2000));

          if (aborted) return;

          // Check if reboot count has been updated (increments on each reboot)
          const currentConfig = await apiService.getCurrentConfig(sourceId);
          const currentRebootCount = currentConfig?.localNodeInfo?.rebootCount;

          console.log(`[RebootModal] Poll ${pollAttempt}: rebootCount=${currentRebootCount} (initial was ${initialRebootCount})`);

          // If reboot count increased, the device has rebooted and config is updated
          if (currentRebootCount !== undefined && initialRebootCount !== undefined && currentRebootCount > initialRebootCount) {
            console.log(`[RebootModal] ✅ Device rebooted! rebootCount: ${initialRebootCount} → ${currentRebootCount}`);
            setStatusKey('reboot.config_verified');
            setStatusParams({});
            await new Promise(resolve => setTimeout(resolve, 1000));
            configUpdated = true;
            break;
          }
        } catch (err) {
          console.warn(`[RebootModal] Poll attempt ${pollAttempt} failed:`, err);
        }

        // Wait before next poll (unless this was the last attempt)
        if (pollAttempt < totalPolls && !aborted) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      if (aborted) {
        console.log('[RebootModal] Aborted after polling');
        return;
      }

      if (!configUpdated) {
        console.log('[RebootModal] ⏱️ Configuration polling timeout - config may not have changed or device is slow');
        setStatusKey(maybe ? 'reboot.not_needed' : 'reboot.config_saved_reload');
        setStatusParams({});
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      console.log('[RebootModal] ===== REBOOT SEQUENCE COMPLETE =====');
      clearInterval(intervalId);
      if (!aborted) onClose();
    } catch (error) {
      console.error('[RebootModal] ❌ Fatal error in reboot sequence:', error);
      setStatusKey('reboot.error_reload');
      setStatusParams({});
      await new Promise(resolve => setTimeout(resolve, 5000));
      clearInterval(intervalId);
      if (!aborted) onClose();
    }
    };

    // Start the reboot sequence immediately
    console.log('[RebootModal] Launching waitForReboot() function...');
    void waitForReboot();

    return () => {
      aborted = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 moved verbatim from RebootModal: runs once per open
  }, [isOpen]); // Removed onClose from deps - it's stable and doesn't need to trigger re-runs

  return { statusKey, statusParams, elapsedSeconds, isVerifying };
}
