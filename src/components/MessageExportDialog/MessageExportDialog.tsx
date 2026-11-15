/**
 * Filtered message export dialog (#5517).
 *
 * Builds the filter set for `GET /api/messages/export` and downloads the CSV
 * through ApiService. The server applies the same read permissions as the
 * message views, so this dialog only offers what the caller can already see
 * (sources and channels come from `/api/unified/channels`).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import { UiIcon } from '../icons';
import { browserTimeZone, useMessageExport, type MessageExportChannel } from './useMessageExport';
import styles from './MessageExportDialog.module.css';

export type { MessageExportChannel } from './useMessageExport';

export interface MessageExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  channels: MessageExportChannel[];
  /** Channel to pre-select (the one the page is showing). */
  initialChannel?: string;
}

const MessageExportDialog: React.FC<MessageExportDialogProps> = ({ isOpen, onClose, channels, initialChannel }) => {
  const { t } = useTranslation();
  const {
    sources,
    selectedSources,
    setExcludedSources,
    channelMode,
    setChannelMode,
    selectedChannels,
    setSelectedChannels,
    visibleChannels,
    type,
    setType,
    include,
    setInclude,
    exclude,
    setExclude,
    start,
    setStart,
    end,
    setEnd,
    sender,
    setSender,
    includeReactions,
    setIncludeReactions,
    timeZone,
    setTimeZone,
    busy,
    error,
    rangeInvalid,
    canExport,
    toggle,
    runExport,
  } = useMessageExport({ isOpen, onClose, channels, initialChannel });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('unified.messages.export.title')} maxWidth="560px">
      <div className={styles.body}>
        <p className={styles.help}>{t('unified.messages.export.help')}</p>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('unified.messages.export.sources')}</legend>
          {sources.length === 0 && <p className={styles.hint}>{t('unified.messages.export.no_sources')}</p>}
          <div className={styles.checkList}>
            {sources.map((s) => (
              <label key={s.id} className={styles.check}>
                <input
                  type="checkbox"
                  checked={selectedSources.has(s.id)}
                  onChange={() => setExcludedSources((prev) => toggle(prev, s.id))}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('unified.messages.export.channels')}</legend>
          <div className={styles.row}>
            <label className={styles.check}>
              <input
                type="radio"
                name="message-export-channel-mode"
                checked={channelMode === 'all'}
                onChange={() => setChannelMode('all')}
              />
              {t('unified.messages.export.all_channels')}
            </label>
            <label className={styles.check}>
              <input
                type="radio"
                name="message-export-channel-mode"
                checked={channelMode === 'selected'}
                onChange={() => setChannelMode('selected')}
              />
              {t('unified.messages.export.selected_channels')}
            </label>
          </div>
          {channelMode === 'selected' && (
            <div className={styles.checkList}>
              {visibleChannels.map((c) => (
                <label key={c.name} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={selectedChannels.has(c.name)}
                    onChange={() => setSelectedChannels((prev) => toggle(prev, c.name))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
          <label className={styles.field}>
            {t('unified.messages.export.type')}
            <select className={styles.input} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="all">{t('unified.messages.export.type_all')}</option>
              <option value="channels">{t('unified.messages.export.type_channels')}</option>
              <option value="dms">{t('unified.messages.export.type_dms')}</option>
            </select>
          </label>
        </fieldset>

        <div className={styles.row}>
          <label className={styles.field}>
            {t('unified.messages.export.include')}
            <input
              className={styles.input}
              type="text"
              value={include}
              placeholder={t('unified.messages.export.terms_placeholder')}
              onChange={(e) => setInclude(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            {t('unified.messages.export.exclude')}
            <input
              className={styles.input}
              type="text"
              value={exclude}
              placeholder={t('unified.messages.export.terms_placeholder')}
              onChange={(e) => setExclude(e.target.value)}
            />
          </label>
        </div>
        <p className={styles.hint}>{t('unified.messages.export.terms_hint')}</p>

        <div className={styles.row}>
          <label className={styles.field}>
            {t('unified.messages.export.start')}
            <input className={styles.input} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className={styles.field}>
            {t('unified.messages.export.end')}
            <input className={styles.input} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <p className={styles.hint}>{t('unified.messages.export.range_hint', { zone: browserTimeZone() })}</p>
        {rangeInvalid && <p className={styles.error}>{t('unified.messages.export.range_invalid')}</p>}

        <div className={styles.row}>
          <label className={styles.field}>
            {t('unified.messages.export.sender')}
            <input
              className={styles.input}
              type="text"
              value={sender}
              placeholder="!abcd1234"
              onChange={(e) => setSender(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            {t('unified.messages.export.timezone')}
            <input className={styles.input} type="text" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
          </label>
        </div>

        <label className={styles.check}>
          <input type="checkbox" checked={includeReactions} onChange={(e) => setIncludeReactions(e.target.checked)} />
          {t('unified.messages.export.include_reactions')}
        </label>

        <p className={styles.hint}>{t('unified.messages.export.limit_hint')}</p>
        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" className={styles.primary} onClick={() => void runExport()} disabled={!canExport}>
            <UiIcon name="download" size={16} />
            {busy ? t('unified.messages.export.exporting') : t('unified.messages.export.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default MessageExportDialog;
