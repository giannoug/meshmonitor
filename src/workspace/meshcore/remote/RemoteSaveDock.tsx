/**
 * The remote settings dock (boards 8-07, 8-25), on the frame's save bar
 * pattern (RadioSaveBar's styles; Task 5.9's remote words): "N changes · Save
 * repeater settings" with what saving sends, Discard changes, and Send to
 * node. Send to node is today's save: one request with only the changed
 * fields, one message each over the mesh, once per press. With nothing
 * changed it stays, "No changes yet", as the Meshtastic remote bar does.
 */
import { useTranslation } from 'react-i18next';
import SendsLine from '../../patterns/SendsLine';
import { useIsPhone } from '../../shell/useIsPhone';
import type { MeshCoreTarget } from './remoteTarget';
import bar from '../../settings/RadioSaveBar.module.css';

export default function RemoteSaveDock({ target }: { target: MeshCoreTarget }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const d = target.draft;
  const count = d.changedCount;
  const title = count === 0
    ? t('workspace.settings.remote.no_changes')
    : `${t('workspace.meshcore.remote.changes', { count })} · ${isPhone ? target.name : t('meshcore.repeater.save')}`;
  const sends = count === 0 ? t('workspace.meshcore.remote.sends_save') : t('workspace.meshcore.remote.sends_save_count', { count });
  const send = (
    <button
      type="button"
      className={bar.save}
      disabled={d.locked || count === 0 || target.numbers.invalid || d.secretInvalid}
      aria-busy={d.saving || undefined}
      onClick={() => void d.handleSave()}
    >
      {t('workspace.settings.remote.send')}
    </button>
  );
  const discard = (
    <button type="button" className={isPhone ? bar.secondary : bar.plain} disabled={d.locked || (count === 0 && !d.results)} onClick={d.handleDiscard}>
      {isPhone ? t('workspace.settings.savebar.discard') : t('meshcore.repeater.discard')}
    </button>
  );
  return (
    <>
      {isPhone && <div className={bar.spacer} aria-hidden="true" />}
      <section className={bar.bar} data-phone={isPhone || undefined} aria-label={t('workspace.settings.savebar.label')}>
        {isPhone ? (
          <>
            <span className={bar.title}>{title}</span>
            <SendsLine>{sends}</SendsLine>
            <div className={bar.buttons}>
              {discard}
              {send}
            </div>
          </>
        ) : (
          <div className={bar.row}>
            <div className={bar.text}>
              <span className={bar.title}>{title}</span>
              <SendsLine>{sends}</SendsLine>
            </div>
            {discard}
            {send}
          </div>
        )}
        {d.requestFailed && <p className={bar.error} role="alert">{t('meshcore.repeater.save_failed')}</p>}
        {d.drifted && <p className={bar.error} role="status">{t('meshcore.repeater.drifted')}</p>}
        {(target.numbers.invalid || d.secretInvalid) && <p className={bar.error}>{t('savebar.fix_invalid_fields')}</p>}
      </section>
    </>
  );
}
