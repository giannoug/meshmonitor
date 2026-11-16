/**
 * In MeshMonitor › PKI DMs (board 12-12, Task 5.8): today's per-source PKI DM
 * decryption switch (PkiDmDecryptionSection), saved on change through its own
 * routes (`/api/sources/:id/pki-dm`, configuration read/write on this source).
 * Turning it on asks the connected node for its key over its own link, as
 * today; nothing is sent on the mesh.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiService from '../../../services/api';
import StateView from '../../patterns/StateView';
import SettingGroup from '../kit/SettingGroup';
import SettingRow from '../kit/SettingRow';
import SettingToggle from '../kit/SettingToggle';
import { useReadOnly } from '../kit/useFieldRegistry';
import type { CategoryProps } from '../categories';
import { Warn } from './RowParts';
import { AutosavePage, SavedLine } from './autosave';
import pages from './SettingsPages.module.css';

interface PkiDmStatus {
  enabled: boolean;
  globallyEnabled: boolean;
  keyStored: boolean;
  canStore: boolean;
  reason?: string | null;
}

export default function PkiDmCategory({ sourceId }: CategoryProps) {
  return (
    <AutosavePage needsSettings={false}>
      <PkiDmRows sourceId={sourceId} />
    </AutosavePage>
  );
}

function PkiDmRows({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const readOnly = useReadOnly();
  const key = ['workspace', 'pkiDm', sourceId];
  const path = `/api/sources/${encodeURIComponent(sourceId)}/pki-dm`;
  const { data: status, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => apiService.get<PkiDmStatus>(`${path}/status`),
    staleTime: Infinity,
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ saved: boolean; error?: string }>({ saved: false });

  if (isLoading) return <StateView kind="loading" />;
  // Today's section renders nothing without a status (no configuration grant, or not a radio).
  if (isError || !status) return <StateView kind="noPermission" />;

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    setState({ saved: false });
    try {
      await apiService.post(path, { enabled });
      setState({ saved: true });
    } catch (e) {
      setState({ saved: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: key });
    }
  };

  return (
    <SettingGroup>
      <SettingRow
        id="pki-dm.enabled"
        label={t('config.pki_dm.enable', 'Decrypt PKI direct messages for this source')}
        help={
          <>
            {t(
              'config.pki_dm.description',
              "Decrypt PKI-encrypted direct messages addressed to this node — including ones relayed still-encrypted via MQTT — so they appear in the unified Messages view. MeshMonitor stores this node's private key, encrypted at rest. Only enable on sources you trust this server with.",
            )}
            {!status.globallyEnabled && (
              <Warn>
                {t(
                  'config.pki_dm.globally_disabled_global_settings',
                  'PKI direct message decryption is turned off globally. Enable it under Security in Global Settings before turning it on per source.',
                )}
              </Warn>
            )}
            {status.globallyEnabled && !status.canStore && (
              <Warn>{status.reason || t('config.pki_dm.no_secret', 'SESSION_SECRET is not configured, so keys cannot be stored persistently.')}</Warn>
            )}
            <span className={pages.block}>
              {status.enabled
                ? status.keyStored
                  ? t('config.pki_dm.key_stored', 'Private key stored — DMs to this node will be decrypted.')
                  : t('config.pki_dm.key_pending', 'Enabled — the key will be extracted the next time this source connects.')
                : t('config.pki_dm.disabled', 'Disabled — PKI DMs to this node are not decrypted server-side.')}
            </span>
            {readOnly && (
              <span className={pages.block}>{t('config.pki_dm.no_write', 'Changing this needs the Device Configuration write permission on this source.')}</span>
            )}
          </>
        }
      >
        <SavedLine status={state} />
        <SettingToggle
          checked={status.enabled}
          readOnly={busy || !status.globallyEnabled || (!status.enabled && !status.canStore) ? true : undefined}
          onChange={(v) => void toggle(v)}
        />
      </SettingRow>
    </SettingGroup>
  );
}
