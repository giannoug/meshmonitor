/**
 * Export messages (boards 7-02, 7-09; s7n1, s7n3): today's export form
 * (`useMessageExport`, the fields of MessageExportDialog) with each source's
 * device tag. Download CSV is today's HTTP download of `/api/messages/export`;
 * it sends nothing on the mesh.
 *
 * - Desktop: a dialog over Overview › Messages, with Cancel (7-02).
 * - Phone: a full-screen page at `/overview/messages/export`, back to
 *   Messages, with the channel in view (link state) ticked (7-09).
 */
import { useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Modal from '../../components/common/Modal';
import { UiIcon } from '../../components/icons';
import { browserTimeZone, useMessageExport, type MessageExportChannel } from '../../components/MessageExportDialog/useMessageExport';
import { useUnifiedChannels } from '../../pages/useUnifiedMessagesFeed';
import DeviceTag from '../patterns/DeviceTag';
import { useIsPhone } from '../shell/useIsPhone';
import { readableChannels, useReadableSourceIds } from './readableSources';
import styles from './ExportMessagesPage.module.css';

interface ExportFormProps {
  channels: MessageExportChannel[];
  initialChannel?: string;
  /** After a download, or Cancel. */
  onDone(): void;
  phone: boolean;
}

function ExportForm({ channels, initialChannel, onDone, phone }: ExportFormProps) {
  const { t } = useTranslation();
  const f = useMessageExport({ isOpen: true, onClose: onDone, channels, initialChannel });
  const radioName = useId();
  const download = (
    <button type="button" className={styles.primary} onClick={() => void f.runExport()} disabled={!f.canExport}>
      <UiIcon name="download" size={16} />
      {f.busy ? t('unified.messages.export.exporting') : t('unified.messages.export.submit')}
    </button>
  );

  return (
    <div className={styles.form} data-phone={phone || undefined}>
      <div className={styles.fields}>
        <p className={styles.help}>{t('unified.messages.export.help')}</p>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('unified.messages.export.sources')}</legend>
          {f.sources.length === 0 && <p className={styles.hint}>{t('unified.messages.export.no_sources')}</p>}
          <div className={styles.chips}>
            {f.sources.map((s) => (
              <label key={s.id} className={styles.chip}>
                <input
                  type="checkbox"
                  checked={f.selectedSources.has(s.id)}
                  onChange={() => f.setExcludedSources((prev) => f.toggle(prev, s.id))}
                />
                <DeviceTag sourceId={s.id} />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('unified.messages.export.channels')}</legend>
          <div className={styles.segmented}>
            <label className={styles.segment}>
              <input type="radio" name={radioName} checked={f.channelMode === 'all'} onChange={() => f.setChannelMode('all')} />
              {t('unified.messages.export.all_channels')}
            </label>
            <label className={styles.segment}>
              <input type="radio" name={radioName} checked={f.channelMode === 'selected'} onChange={() => f.setChannelMode('selected')} />
              {t('unified.messages.export.selected_channels')}
            </label>
          </div>
          {f.channelMode === 'selected' && (
            <div className={styles.checks}>
              {f.visibleChannels.map((c) => (
                <label key={c.name} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={f.selectedChannels.has(c.name)}
                    onChange={() => f.setSelectedChannels((prev) => f.toggle(prev, c.name))}
                  />
                  <span aria-hidden="true">#</span>
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className={styles.field}>
          {t('unified.messages.export.type')}
          <select className={styles.input} value={f.type} onChange={(e) => f.setType(e.target.value as typeof f.type)}>
            <option value="all">{t('unified.messages.export.type_all')}</option>
            <option value="channels">{t('unified.messages.export.type_channels')}</option>
            <option value="dms">{t('unified.messages.export.type_dms')}</option>
          </select>
        </label>

        <div className={styles.pair}>
          <label className={styles.field}>
            {t('unified.messages.export.include')}
            <input className={styles.input} type="text" value={f.include} placeholder={t('unified.messages.export.terms_placeholder')} onChange={(e) => f.setInclude(e.target.value)} />
          </label>
          <label className={styles.field}>
            {t('unified.messages.export.exclude')}
            <input className={styles.input} type="text" value={f.exclude} placeholder={t('unified.messages.export.terms_placeholder')} onChange={(e) => f.setExclude(e.target.value)} />
          </label>
        </div>
        <p className={styles.hint}>{t('unified.messages.export.terms_hint')}</p>

        <div className={styles.pair}>
          <label className={styles.field}>
            {t('unified.messages.export.start')}
            <input className={styles.input} type="datetime-local" value={f.start} onChange={(e) => f.setStart(e.target.value)} />
          </label>
          <label className={styles.field}>
            {t('unified.messages.export.end')}
            <input className={styles.input} type="datetime-local" value={f.end} onChange={(e) => f.setEnd(e.target.value)} />
          </label>
        </div>
        <p className={styles.hint}>{t('unified.messages.export.range_hint', { zone: browserTimeZone() })}</p>
        {f.rangeInvalid && <p className={styles.error}>{t('unified.messages.export.range_invalid')}</p>}

        <div className={styles.pair}>
          <label className={styles.field}>
            {t('unified.messages.export.sender')}
            <input className={styles.input} type="text" value={f.sender} placeholder="!abcd1234" onChange={(e) => f.setSender(e.target.value)} />
          </label>
          <label className={styles.field}>
            {t('unified.messages.export.timezone')}
            <input className={styles.input} type="text" value={f.timeZone} onChange={(e) => f.setTimeZone(e.target.value)} />
          </label>
        </div>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            role={phone ? 'switch' : undefined}
            checked={f.includeReactions}
            onChange={(e) => f.setIncludeReactions(e.target.checked)}
          />
          {t('unified.messages.export.include_reactions')}
        </label>

        <p className={styles.hint}>{t('unified.messages.export.limit_hint')}</p>
        {f.error && <p className={styles.error} role="alert">{f.error}</p>}
      </div>

      <div className={styles.actions}>
        {!phone && (
          <button type="button" className={styles.secondary} onClick={onDone} disabled={f.busy}>
            {t('common.cancel')}
          </button>
        )}
        {download}
      </div>
    </div>
  );
}

/** Desktop (7-02): the form in a dialog over the feed. */
export function ExportMessagesDialog({ open, onClose, channels, initialChannel }: {
  open: boolean;
  onClose(): void;
  channels: MessageExportChannel[];
  initialChannel?: string;
}) {
  const { t } = useTranslation();
  // In <body>: the page is a fixed layer, which would keep the dialog under the shell's sidebar.
  return createPortal(
    <Modal isOpen={open} onClose={onClose} title={t('unified.messages.export.title')} maxWidth="720px">
      {open && <ExportForm channels={channels} initialChannel={initialChannel} onDone={onClose} phone={false} />}
    </Modal>,
    document.body,
  );
}

/** Phone (7-09), and a desktop visit to the URL: the form as a page. */
export default function ExportMessagesPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const initialChannel = (useLocation().state as { channel?: string } | null)?.channel;
  const readable = useReadableSourceIds();
  const { data = [] } = useUnifiedChannels();
  const channels = useMemo(() => readableChannels(data, readable), [data, readable]);

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      <header className={styles.head}>
        <Link to="/overview/messages" className={styles.back}>
          <UiIcon name="back" size={20} />
          {t('messages.title')}
        </Link>
        <h1 className={styles.title}>{t('unified.messages.export.title')}</h1>
      </header>
      <ExportForm channels={channels} initialChannel={initialChannel} onDone={() => navigate('/overview/messages')} phone={isPhone} />
    </div>
  );
}
