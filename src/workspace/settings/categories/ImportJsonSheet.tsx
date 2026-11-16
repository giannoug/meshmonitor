/**
 * Today's channel JSON import (ChannelsConfigSection's import dialog) as a
 * Sheet: pick an exported channel file, see it, write it to `slot`. One
 * import write to this device; it sends nothing on the mesh.
 */
import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useChannelActions } from '../../../components/configuration/channelSlots';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import styles from './SettingsPages.module.css';
import bar from '../RadioSaveBar.module.css';

export interface ImportJsonSheetProps {
  /** The slot to import into; null keeps the sheet closed. */
  slot: number | null;
  sourceId: string;
  onClose(): void;
  onImported(): void;
  /** A remote node's import (Task 5.9): its setChannel, and what that sends. */
  remote?: { actions: ReturnType<typeof useChannelActions>; sends: string };
}

export default function ImportJsonSheet({ slot, sourceId, onClose, onImported, remote }: ImportJsonSheetProps) {
  const { t } = useTranslation();
  const local = useChannelActions(sourceId);
  const actions = remote?.actions ?? local;
  const [content, setContent] = useState('');
  const [importing, setImporting] = useState(false);

  const close = () => {
    if (importing) return;
    setContent('');
    onClose();
  };
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setContent(ev.target?.result as string);
    reader.readAsText(file);
  };
  const run = async () => {
    if (slot === null) return;
    setImporting(true);
    try {
      if (await actions.importJson(slot, content)) {
        setContent('');
        onClose();
        onImported();
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <Sheet
      open={slot !== null}
      onClose={close}
      title={t('channels_config.import_channel', { slot })}
      footer={
        <div className={bar.buttons}>
          <button type="button" className={bar.secondary} onClick={close} disabled={importing}>{t('common.cancel')}</button>
          <button type="button" className={bar.save} onClick={() => void run()} disabled={importing || !content}>
            {importing ? t('channels_config.importing') : t('channels_config.import_channel_button')}
          </button>
        </div>
      }
    >
      <label className={styles.field}>
        <span className={styles.infoLabel}>{t('channels_config.select_file')}</span>
        <span className={styles.infoHelp}>{t('channels_config.select_file_description')}</span>
        <input type="file" accept=".json" onChange={pick} className={styles.file} />
      </label>
      {content && (
        <div className={styles.field}>
          <span className={styles.infoLabel}>{t('channels_config.preview')}</span>
          <pre className={styles.preview}>{content}</pre>
        </div>
      )}
      <SendsLine>{remote?.sends ?? t('workspace.settings.savebar.sends_nothing')}</SendsLine>
    </Sheet>
  );
}
