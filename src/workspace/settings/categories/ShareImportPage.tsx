/**
 * Channels › Share and import (boards 12-03 desktop, 12-16 phone),
 * `/settings/channels/share`: today's Export and Import dialogs as one page.
 *
 * - Export: today's channel URL request (apiService.encodeChannelUrl) for the
 *   ticked slots and LoRa, its QR code (QrCodeCanvas) and Copy. The URL format
 *   is the server's, unchanged. Building it sends nothing on the mesh.
 * - Import: paste, decode (today's request), preview, then today's import
 *   (runMeshtasticImport, shared with ImportConfigModal): one import request,
 *   the reboot wait and the sync poll, shown as its steps. The node restarts;
 *   nothing is sent on the mesh.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { QrCodeCanvas } from '../../../components/common/QrCodeCanvas';
import { MODEM_PRESET_OPTIONS, REGION_OPTIONS } from '../../../components/configuration/constants';
import { IMPORT_STEPS, regionNames, runMeshtasticImport, type ImportStep } from '../../../components/configuration/meshtasticConfigImport';
import { ROLE_LABEL_KEYS } from '../../../components/configuration/channelSlots';
import { useSource } from '../../../contexts/SourceContext';
import { useDashboardSources } from '../../../hooks/useDashboardData';
import { useToast } from '../../../components/ToastContainer';
import apiService from '../../../services/api';
import type { Channel } from '../../../types/device';
import { MODEM_PRESET_NAMES } from '../../../utils/loraFrequency';
import SendsLine from '../../patterns/SendsLine';
import { useReadOnly } from '../kit/useFieldRegistry';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import { useSettingsHeader } from '../settingsDock';
import styles from './SettingsPages.module.css';

interface DecodedChannel {
  psk?: string;
  name?: string;
  uplinkEnabled?: boolean;
  downlinkEnabled?: boolean;
  positionPrecision?: number;
  useAead?: boolean;
}
interface Decoded {
  channels: DecodedChannel[];
  loraConfig?: { region?: number; modemPreset?: number; hopLimit?: number; txPower?: number };
}

export interface ShareImportPageProps {
  base: string;
  sourceId: string;
  channels: Channel[];
  /** Refreshes the channel list after an import, as ConfigurationTab does. */
  onImported(): void;
  /**
   * A remote node (Task 5.9, Ruling GC): the URL imports to it as today's Admin Commands import does.
   * Export is this radio's only: building a remote URL asks the node for each ticked slot on every tick.
   */
  remote?: { nodeNum: number; name: string };
}

/** A key in a table cell: its ends only. */
const shortKey = (psk: string) => (psk.length > 10 ? `${psk.slice(0, 4)}…${psk.slice(-3)}` : psk);

export default function ShareImportPage({ base, sourceId, channels, onImported, remote }: ShareImportPageProps) {
  const { t } = useTranslation();
  const { sourceName } = useSource();
  const { showToast } = useToast();
  const readOnly = useReadOnly();
  const state = useSharedDeviceConfig()?.state;
  const meshcore = useDashboardSources().data?.find((s) => s.type === 'meshcore');
  useSettingsHeader({ title: t('workspace.settings.channels.share_title'), back: { to: base, label: t('channels.title') }, scope: t('workspace.settings.channels.share_scope') });

  // Export: today's Export dialog preselects every channel that is not disabled, with LoRa.
  const [selected, setSelected] = useState(() => new Set(channels.filter((c) => c.role !== 0).map((c) => c.id)));
  const [includeLora, setIncludeLora] = useState(true);
  const [url, setUrl] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const ids = [...selected].sort((a, b) => a - b).join(',');
  useEffect(() => {
    let cancelled = false;
    if (!ids || remote) {
      setUrl('');
      return;
    }
    setExportError(null);
    apiService
      .encodeChannelUrl(ids.split(',').map(Number), includeLora, undefined, sourceId)
      .then((u) => !cancelled && setUrl(u))
      .catch((err: unknown) => {
        if (cancelled) return;
        setExportError(err instanceof Error ? err.message : 'Failed to generate URL');
        setUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [ids, includeLora, sourceId, remote]);
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const preset = (n: number | undefined) => MODEM_PRESET_OPTIONS.find((o) => o.value === n)?.name ?? MODEM_PRESET_NAMES[n ?? 0] ?? String(n);
  const region = (n: number | undefined) => regionNames[n ?? 0] ?? REGION_OPTIONS.find((o) => o.value === n)?.label ?? String(n);

  // Import.
  const [input, setInput] = useState('');
  const [decoded, setDecoded] = useState<Decoded | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [importLora, setImportLora] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<ImportStep | null>(null);
  // Today's import either waits for a reboot or pauses to sync, never both: only steps it reached are ticked.
  const [seen, setSeen] = useState<ImportStep[]>([]);
  const [status, setStatus] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const decode = async () => {
    if (!input.trim()) {
      setImportError(t('import_config.error_enter_url'));
      return;
    }
    setDecoding(true);
    setImportError(null);
    try {
      const result = await apiService.decodeChannelUrl(input);
      if (result?.protocol === 'meshcore') throw new Error(t('import_config.error_decode_failed'));
      setDecoded(result);
      setPicked(new Set(result.channels.map((_: unknown, i: number) => i)));
      setImportLora(!!result.loraConfig);
    } catch (err) {
      setImportError((err instanceof Error && err.message) || t('import_config.error_decode_failed'));
      setDecoded(null);
    } finally {
      setDecoding(false);
    }
  };
  const apply = async () => {
    if (!decoded || !input) return;
    setImporting(true);
    setImportError(null);
    setStep(null);
    setSeen([]);
    try {
      await runMeshtasticImport({
        url: input,
        nodeNum: remote?.nodeNum,
        sourceId,
        includeLoraConfig: importLora,
        t,
        onStep: (s, elapsed) => {
          setStep(s);
          setSeen((prev) => (prev.includes(s) ? prev : [...prev, s]));
          setStatus(elapsed !== undefined ? t('import_config.status_rebooting_elapsed', { elapsed }) : t(`import_config.status_${s}`));
        },
      });
      // Today's ImportConfigModal success: the toast and one channel refresh (ConfigurationTab's onImportSuccess). The steps stay, ending on Complete.
      showToast(t('config.import_success'), 'success');
      onImported();
    } catch (err) {
      setImportError((err instanceof Error && err.message) || t('import_config.error_import_failed'));
    } finally {
      setImporting(false);
    }
  };
  const paste = async () => {
    try {
      setInput(await navigator.clipboard.readText());
    } catch {
      // The browser refused the clipboard: the field still takes a paste.
    }
  };
  const share = typeof navigator.share === 'function' && url ? () => void navigator.share({ url }).catch(() => {}) : null;
  const togglePick = (i: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const onOff = (v: boolean | undefined) => (v === undefined ? '—' : t(v ? 'workspace.settings.tag_on' : 'workspace.settings.tag_off'));

  return (
    <div className={styles.twoUp}>
      {!remote && (
      <section className={styles.card} aria-labelledby="share-export">
        <h2 className={styles.cardTitle} id="share-export">{t('common.export')}</h2>
        <p className={styles.infoHelp}>{t('export_config.description')}</p>
        <ul className={styles.checkList}>
          {channels.map((c) => (
            <li key={c.id}>
              <label className={styles.check}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span className={styles.checkText}>{t('workspace.settings.channels.slot_name', { slot: c.id, name: c.name || t('channels_config.unnamed') })}</span>
                <span className={styles.checkMeta}>{t(ROLE_LABEL_KEYS[c.role ?? 2] ?? 'channels_config.role_secondary')}</span>
              </label>
            </li>
          ))}
          <li>
            <label className={styles.check}>
              <input type="checkbox" checked={includeLora} onChange={(e) => setIncludeLora(e.target.checked)} />
              <span className={styles.checkText}>{t('export_config.lora_config')}</span>
              {state && <span className={styles.checkMeta}>{`${region(state.region)} · ${preset(state.modemPreset)}`}</span>}
            </label>
          </li>
        </ul>
        {exportError && <p className={styles.error} role="alert">{exportError}</p>}
        {url && (
          <div className={styles.qr}>
            <QrCodeCanvas value={url} size={200} className={styles.qrCanvas} ariaLabel={t('export_config.qr_code')} onError={() => {}} />
            <div className={styles.qrSide}>
              <code className={styles.url}>{url}</code>
              <span className={styles.inline}>
                <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => void navigator.clipboard?.writeText(url)}>
                  <UiIcon name="copy" size={16} /> {t('export_config.copy')}
                </button>
                {share && (
                  <button type="button" className={styles.button} onClick={share}>
                    <UiIcon name="link" size={16} /> {t('workspace.settings.channels.share')}
                  </button>
                )}
              </span>
              <span className={styles.infoHelp}>{t('export_config.qr_code')}: {t('export_config.scan_qr_description')}</span>
            </div>
          </div>
        )}
        <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
      </section>
      )}

      <section className={styles.card} aria-labelledby="share-import">
        <h2 className={styles.cardTitle} id="share-import">{t('common.import')}</h2>
        <label className={styles.field}>
          <span className={styles.infoLabel}>{t('import_config.url_label')}</span>
          <span className={styles.inline}>
            <input
              className={styles.keyInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('import_config.url_placeholder')}
              disabled={decoding || importing || readOnly}
              spellCheck={false}
            />
            <button type="button" className={styles.button} onClick={() => void paste()} disabled={importing || readOnly}>
              <UiIcon name="copy" size={16} /> {t('workspace.settings.channels.paste')}
            </button>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => void decode()} disabled={decoding || importing || !input.trim() || readOnly}>
              {decoding ? t('import_config.decoding') : t('import_config.decode_button')}
            </button>
          </span>
        </label>
        {importError && <p className={styles.error} role="alert">{importError}</p>}
        {decoded && (
          <>
            <h3 className={styles.subTitle}>{t('import_config.channels_count', { count: decoded.channels.length })}</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th><span className={styles.visuallyHidden}>{t('workspace.settings.channels.apply')}</span></th>
                    <th>{t('workspace.settings.channels.col_channel')}</th>
                    <th>PSK</th>
                    <th>{t('workspace.settings.channels.col_precision')}</th>
                    <th>{t('channels_config.uplink')}</th>
                    <th>{t('channels_config.downlink')}</th>
                    <th>{t('channels.aead_badge')}</th>
                  </tr>
                </thead>
                <tbody>
                  {decoded.channels.map((c, i) => (
                    <tr key={i}>
                      <td><input type="checkbox" checked={picked.has(i)} onChange={() => togglePick(i)} aria-label={c.name || t('import_config.channel_unnamed')} disabled={importing} /></td>
                      <td>{c.name || t('import_config.channel_unnamed')}</td>
                      <td><code>{c.psk ? shortKey(c.psk) : '—'}</code></td>
                      <td>{c.positionPrecision ?? '—'}</td>
                      <td>{onOff(c.uplinkEnabled)}</td>
                      <td>{onOff(c.downlinkEnabled)}</td>
                      <td>{onOff(c.useAead ?? false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {decoded.loraConfig && (
              <label className={styles.check}>
                <input type="checkbox" checked={importLora} onChange={(e) => setImportLora(e.target.checked)} disabled={importing} />
                <span className={styles.checkText}>{t('import_config.lora_settings')}</span>
                <span className={styles.checkMeta}>
                  {[
                    decoded.loraConfig.region !== undefined && region(decoded.loraConfig.region),
                    preset(decoded.loraConfig.modemPreset ?? 0),
                    decoded.loraConfig.hopLimit !== undefined && t('import_config.hop_limit', { limit: decoded.loraConfig.hopLimit }),
                  ].filter(Boolean).join(' · ')}
                </span>
              </label>
            )}
            {(importing || step === 'complete') && (
              <div className={styles.progress} role="status">
                <h3 className={styles.subTitle}>{t('workspace.settings.channels.applying', { device: sourceName })}</h3>
                <ol className={styles.steps}>
                  {IMPORT_STEPS.map((s, i) => (
                    <li key={s} className={styles.step} data-state={s === step ? 'now' : seen.includes(s) ? 'done' : undefined}>
                      <span className={styles.stepDot}>{s !== step && seen.includes(s) ? <UiIcon name="check" size={14} /> : i + 1}</span>
                      {t(`workspace.settings.channels.step_${s}`)}
                    </li>
                  ))}
                </ol>
                <p className={styles.infoHelp}>{status}</p>
              </div>
            )}
            <div className={styles.inline}>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={() => void apply()}
                disabled={decoding || importing || readOnly || (picked.size === 0 && !importLora)}
              >
                {importing ? t('import_config.importing') : t('import_config.import_selected')}
              </button>
            </div>
            <p className={styles.infoHelp}>{t('workspace.settings.channels.import_note', { device: remote?.name ?? sourceName })}</p>
            <SendsLine>
              {remote
                ? t('workspace.settings.remote.import_sends', { count: decoded?.channels.length ?? 0, name: remote.name }) + (importLora ? t('workspace.settings.remote.import_lora_sends') : '')
                : t('workspace.settings.savebar.sends_nothing')}
            </SendsLine>
          </>
        )}
        {meshcore && (
          <p className={styles.note}>
            <UiIcon name="info" size={16} />
            <span>{t('workspace.settings.channels.meshcore_note', { device: meshcore.name, path: t('meshcore.channels.import_url') })}</span>
          </p>
        )}
      </section>
    </div>
  );
}
