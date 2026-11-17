/**
 * A MeshCore remote target's page header (boards 8-06, 8-07): the node's name
 * over the title on desktop (a link to its node page), and the scope line
 * "Remote repeater · <name> · <key> · <path> · SNR". The phone bar keeps
 * Back to the settings list (8-21, 8-25).
 */
import { useSettingsHeader } from '../../settings/settingsDock';
import { useIsPhone } from '../../shell/useIsPhone';
import { useMeshCoreRuntime } from '../runtime';
import type { MeshCoreTarget } from './remoteTarget';

export function useTargetHeader(target: MeshCoreTarget | null): void {
  const { sourceId } = useMeshCoreRuntime();
  const isPhone = useIsPhone();
  useSettingsHeader(
    target
      ? {
          scope: target.scope,
          back: isPhone ? undefined : { to: `/source/${encodeURIComponent(sourceId)}/node/${target.publicKey}`, label: target.name },
        }
      : null,
  );
}
