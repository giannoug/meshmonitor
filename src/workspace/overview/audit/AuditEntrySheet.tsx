/**
 * 16-08-audit-entry: one audit entry on the phone, as a sheet: today's fields
 * (User, IP Address, Resource) and today's expanded details (Details as
 * formatted JSON; Before / After when the entry carries them). `EntryDetails`
 * is also the desktop table's expanded row (o5).
 */
import { useTranslation } from 'react-i18next';
import type { AuditLogEntry } from '../../../components/useAuditLog';
import Sheet from '../../patterns/Sheet';
import styles from './AuditPage.module.css';

/** Today's rendering of a stored value: pretty JSON when it parses, else the text. */
function pretty(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function EntryDetails({ log }: { log: AuditLogEntry }) {
  const { t } = useTranslation();
  return (
    <div className={styles.details}>
      <div>
        <strong>{t('audit.details')}:</strong>
        <pre className={styles.pre}>{log.details ? pretty(log.details) : t('audit.na')}</pre>
      </div>
      {(log.valueBefore || log.valueAfter) && (
        <div className={styles.comparison}>
          {log.valueBefore && (
            <div>
              <strong>{t('audit.value_before')}</strong>
              <pre className={styles.pre}>{pretty(log.valueBefore)}</pre>
            </div>
          )}
          {log.valueAfter && (
            <div>
              <strong>{t('audit.value_after')}</strong>
              <pre className={styles.pre}>{pretty(log.valueAfter)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditEntrySheet({ log, when, onClose }: { log: AuditLogEntry | null; when: string; onClose(): void }) {
  const { t } = useTranslation();
  if (!log) return null;
  const rows: [string, string][] = [
    [t('audit.user'), log.username || t('audit.system')],
    [t('audit.ip_address'), log.ipAddress || '-'],
    [t('audit.resource'), log.resource || '-'],
  ];
  return (
    <Sheet open onClose={onClose} title={log.action}>
      <div className={styles.sheetBody}>
        <p className={styles.when}>{when}</p>
        <div className={styles.card}>
          {rows.map(([label, value]) => (
            <div key={label} className={styles.field}>
              <span className={styles.fieldLabel}>{label}</span>
              <span className={styles.fieldValue}>{value}</span>
            </div>
          ))}
        </div>
        <EntryDetails log={log} />
      </div>
    </Sheet>
  );
}
