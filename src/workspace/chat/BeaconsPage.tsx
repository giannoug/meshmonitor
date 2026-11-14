/**
 * Beacons (boards 10-04 desktop, 10-13 phone): today's beacons list as a page
 * under the channel header, and the join step as a Sheet.
 *
 * The list is today's (`BeaconsList`: search, Pending / Hidden / All, sort,
 * Join channel / Dismiss / Mute / Restore). Join keeps today's confirm: the
 * slot (first free one preselected), and a slot already in use turns the
 * button into "Replace and join" in red with today's warning. Joining writes a
 * channel slot on the radio over the connection; it sends nothing on the mesh.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { BeaconsList } from '../../components/beacons/BeaconsModal';
import { JOINABLE_SLOTS, type PendingAccept, type PublicBeaconOffer } from '../../components/beacons/types';
import type { UseBeaconOffers } from '../../components/beacons/useBeaconOffers';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import styles from './BeaconsPage.module.css';

export interface BeaconsPageProps {
  beacons: UseBeaconOffers;
  deviceName: string;
  /** The device's channels, to name occupied slots. */
  channels: Array<{ id: number; name: string }>;
  /** `nodes:write`, as today: without it the actions are hidden. */
  canWrite: boolean;
  nodeName(nodeNum: number): string | undefined;
}

export default function BeaconsPage({ beacons, deviceName, channels, canWrite, nodeName }: BeaconsPageProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingAccept | null>(null);
  const [busy, setBusy] = useState(false);

  const occupied = useMemo(() => new Map(channels.filter((c) => c.name).map((c) => [c.id, c.name])), [channels]);

  // The list loads only while it is on screen, as with today's modal.
  const { setListOpen } = beacons;
  useEffect(() => {
    setListOpen(true);
    return () => setListOpen(false);
  }, [setListOpen]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      // useBeaconOffers has put the message on `beacons.error`.
    } finally {
      setBusy(false);
    }
  };

  const startJoin = (offer: PublicBeaconOffer) =>
    setPending({ offer, slot: JOINABLE_SLOTS.find((s) => !occupied.has(s)) ?? JOINABLE_SLOTS[0] });
  const occupant = pending ? occupied.get(pending.slot) : undefined;
  const cancel = () => {
    setPending(null);
    beacons.clearError();
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{t('workspace.chat.beacons_title')}</h2>
      <p className={styles.intro}>{t('workspace.chat.beacons_intro', { device: deviceName })}</p>
      <div className={styles.list}>
        <BeaconsList
          offers={beacons.offers}
          loading={beacons.loading}
          error={pending ? null : beacons.error}
          canWrite={canWrite}
          nodeName={nodeName}
          busy={busy}
          onJoin={startJoin}
          onDismiss={(o) => void run(() => beacons.dismiss(o.nodeNum))}
          onMute={(o) => void run(() => beacons.mute(o.nodeNum))}
          onRestore={(o) => void run(() => beacons.restore(o.nodeNum))}
        />
      </div>
      <p className={styles.footnote}>{t('workspace.chat.beacons_footnote')}</p>

      <Sheet
        open={pending !== null}
        onClose={() => !busy && cancel()}
        title={t('beacons.confirm_title')}
        footer={
          pending && (
            <div className={styles.footer}>
              <div className={styles.buttons}>
                <button type="button" className={styles.cancel} onClick={cancel} disabled={busy}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className={occupant ? `${styles.go} ${styles.danger}` : styles.go}
                  disabled={busy}
                  aria-busy={busy || undefined}
                  onClick={() =>
                    void run(async () => {
                      await beacons.accept(pending.offer.nodeNum, pending.slot, Boolean(occupant));
                      setPending(null);
                    })
                  }
                >
                  {occupant ? t('beacons.confirm_replace') : t('beacons.confirm_join')}
                </button>
              </div>
              <SendsLine>{t('workspace.chat.beacons_sends', { slot: pending.slot, device: deviceName })}</SendsLine>
            </div>
          )
        }
      >
        {pending && (
          <div className={styles.content}>
            <p className={styles.offered}>
              {t('workspace.chat.beacons_offered', {
                name: nodeName(pending.offer.nodeNum) ?? `!${pending.offer.nodeNum.toString(16).padStart(8, '0')}`,
                channel: pending.offer.offerChannelName ?? '',
              })}
            </p>
            <p>{t('beacons.confirm_body', { channel: pending.offer.offerChannelName ?? '', slot: pending.slot })}</p>
            <fieldset className={styles.slots} disabled={busy}>
              <legend className={styles.legend}>{t('beacons.slot_label')}</legend>
              <div className={styles.slotList}>
              {JOINABLE_SLOTS.map((slot) => (
                <label key={slot} className={styles.slot} data-on={slot === pending.slot || undefined}>
                  <input
                    type="radio"
                    name="beacon-slot"
                    checked={slot === pending.slot}
                    onChange={() => setPending({ ...pending, slot })}
                  />
                  {occupied.has(slot)
                    ? t('beacons.slot_in_use', { slot, name: occupied.get(slot) })
                    : t('beacons.slot_free', { slot })}
                </label>
              ))}
              </div>
            </fieldset>
            {occupant && (
              <p className={styles.warning} role="alert">
                <UiIcon name="alert" size={16} /> {t('beacons.confirm_overwrite', { name: occupant, slot: pending.slot })}
              </p>
            )}
            {beacons.error && <p className={styles.error} role="alert">{beacons.error}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}
