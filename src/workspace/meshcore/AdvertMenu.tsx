/**
 * A MeshCore device's own sends (note s8n1), each once per press with its
 * Sends line:
 * - Advert (nearby, zero-hop): today's `POST /advert {mode: zero_hop}`; it does not ask.
 * - Flood advert: asks first in a ConfirmSheet with today's words
 *   (MeshCoreAdvertButtons), then `{mode: flood}`; Enter does not confirm (Ruling BH).
 * - Disconnect: today's source disconnect (the manager stays registered); sends nothing on the mesh.
 *
 * `MeshCoreDeviceBar` is the desktop status line over a channel (boards 8-01,
 * 8-02): "Connected to …" with the device type, the three buttons and the two
 * Sends lines; Connect while disconnected. `AdvertMenu` is the phone header's ⋯
 * (8-16). Receive-only turns the adverts off with today's reason.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { MeshCoreAdvertMode } from '../../types/meshcoreAdvert';
import ConfirmSheet from '../patterns/ConfirmSheet';
import SendsLine from '../patterns/SendsLine';
import { useMeshCoreRuntime } from './runtime';
import styles from './AdvertMenu.module.css';

function useAdverts() {
  const { t } = useTranslation();
  const { meshCore, receiveOnly } = useMeshCoreRuntime();
  const [confirm, setConfirm] = useState(false);
  const off = meshCore.loading || receiveOnly;
  const reason = receiveOnly ? t('meshcore.receive_only.control_tooltip') : undefined;
  const send = (mode: MeshCoreAdvertMode) => void meshCore.actions.sendAdvert(mode);
  const sheet = (
    <ConfirmSheet
      open={confirm}
      title={t('meshcore.advert.flood_confirm_title', 'Send a flood advert?')}
      body={t('meshcore.advert.flood_confirm')}
      confirmLabel={t('meshcore.advert.flood_confirm_button', 'Send flood advert')}
      submitOnEnter={false}
      onConfirm={() => {
        setConfirm(false);
        send('flood');
      }}
      onCancel={() => setConfirm(false)}
    />
  );
  return { meshCore, off, reason, nearby: () => send('zero_hop'), askFlood: () => setConfirm(true), sheet };
}

export function MeshCoreDeviceBar() {
  const { t } = useTranslation();
  const { meshCore, receiveOnly } = useMeshCoreRuntime();
  const adverts = useAdverts();
  const status = meshCore.status;
  const connected = status?.connected ?? false;
  const name = status?.localNode?.name || t('meshcore.unknown', 'Unknown');
  return (
    <div className={styles.bar}>
      <div className={styles.line}>
        <span className={styles.dot} data-on={connected || undefined} aria-hidden="true" />
        <span className={styles.status}>
          {connected ? t('meshcore.connected_to', { name }) : t('meshcore.disconnected', 'Disconnected')}
        </span>
        {connected && status?.deviceTypeName && <span className={styles.meta}>{status.deviceTypeName}</span>}
        {receiveOnly && (
          <span className={styles.chip}>
            <UiIcon name="blocked" size={12} /> {t('meshcore.receive_only.status_chip')}
          </span>
        )}
        <span className={styles.actions}>
          {connected ? (
            <>
              <button type="button" className={styles.button} disabled={adverts.off} title={adverts.reason} onClick={adverts.nearby}>
                <UiIcon name="radioSignal" size={16} /> {t('meshcore.advert.zero_hop_button')}
              </button>
              <button type="button" className={styles.button} disabled={adverts.off} title={adverts.reason} onClick={adverts.askFlood}>
                <UiIcon name="radioSignal" size={16} /> {t('meshcore.advert.flood_button')}
              </button>
              <button type="button" className={styles.plain} disabled={meshCore.loading} onClick={() => void meshCore.actions.disconnect()}>
                {t('meshcore.disconnect')}
              </button>
            </>
          ) : (
            <button type="button" className={styles.button} disabled={meshCore.loading} onClick={() => void meshCore.actions.connect()}>
              {meshCore.loading ? t('meshcore.connecting', 'Connecting…') : t('meshcore.connect')}
            </button>
          )}
        </span>
      </div>
      {connected && (
        <div className={styles.sends}>
          <SendsLine>{t('workspace.meshcore.nearby_line', { sends: t('workspace.meshcore.sends_nearby') })}</SendsLine>
          <SendsLine>{t('workspace.meshcore.flood_line', { sends: t('workspace.meshcore.sends_flood') })}</SendsLine>
        </div>
      )}
      {adverts.sheet}
    </div>
  );
}

/** The phone header's ⋯ (8-16): Advert nearby, Flood advert and Disconnect, each with its line. */
export default function AdvertMenu() {
  const { t } = useTranslation();
  const adverts = useAdverts();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const connected = adverts.meshCore.status?.connected ?? false;
  const label = t('workspace.meshcore.device_actions');

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (run: () => void) => () => {
    setOpen(false);
    run();
  };
  const item = (key: string, icon: 'radioSignal' | 'enterKey', title: string, line: ReactNode, run: () => void, disabled = false) => (
    <button key={key} type="button" role="menuitem" className={styles.item} disabled={disabled} title={disabled ? adverts.reason : undefined} onClick={pick(run)}>
      <UiIcon name={icon} size={20} />
      <span className={styles.itemText}>
        <span className={styles.itemTitle}>{title}</span>
        {line}
      </span>
    </button>
  );

  return (
    <span
      className={styles.menuWrap}
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <UiIcon name="more" size={22} />
      </button>
      {open && (
        <span className={styles.menu} role="menu" aria-label={label}>
          {connected ? (
            <>
              {item('nearby', 'radioSignal', t('meshcore.advert.zero_hop_button'), <SendsLine>{t('workspace.meshcore.sends_nearby')}</SendsLine>, adverts.nearby, adverts.off)}
              {item('flood', 'radioSignal', t('meshcore.advert.flood_button'), <SendsLine>{t('workspace.meshcore.sends_flood')}</SendsLine>, adverts.askFlood, adverts.off)}
              {item(
                'disconnect',
                'enterKey',
                t('meshcore.disconnect'),
                <span className={styles.hint}>{t('workspace.meshcore.disconnect_hint')}</span>,
                () => void adverts.meshCore.actions.disconnect(),
                adverts.meshCore.loading,
              )}
            </>
          ) : (
            item('connect', 'enterKey', t('meshcore.connect'), null, () => void adverts.meshCore.actions.connect(), adverts.meshCore.loading)
          )}
        </span>
      )}
      {adverts.sheet}
    </span>
  );
}
