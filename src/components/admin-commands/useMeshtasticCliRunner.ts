/**
 * Runs one Meshtastic CLI command against a remote node (#6154): the request
 * MeshtasticRemoteCliConsole sends for each command, moved here so the
 * Workspace's Remote console shares it (#6365, Rule X). One request per
 * command, only when the person sends one; nothing is retried.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CliRunResult } from '../MeshCore/CliConsoleBody';
import apiService, { ApiError } from '../../services/api';

export function useMeshtasticCliRunner(sourceId: string | null | undefined, destNodeId: string | undefined) {
  const { t } = useTranslation();
  return useCallback(
    async (text: string, opts?: { confirm?: boolean }): Promise<CliRunResult> => {
      if (!sourceId || !destNodeId) {
        return { ok: false, error: t('admin_commands.cli_console.no_node', 'Select a remote node first.') };
      }
      try {
        const data = await apiService.sendMeshtasticCli(sourceId, destNodeId, text, opts);
        return { ok: true, reply: data.output, elapsedMs: data.elapsedMs };
      } catch (err) {
        if (err instanceof ApiError) {
          const body = err.body as { output?: string } | undefined;
          const reply = body?.output && body.output.length > 0 ? body.output : err.message;
          return { ok: false, error: reply, code: err.code };
        }
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [sourceId, destNodeId, t],
  );
}
