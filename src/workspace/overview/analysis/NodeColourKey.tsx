/**
 * The colour key for the marker ring (#6125 by source, #6175 by gateway), as
 * DashboardMap draws it: shown while Colour nodes by is on, one row per
 * device or gateway with its colour.
 */
import { useTranslation } from 'react-i18next';
import { getSourceColor } from '../../../utils/sourceColors';
import styles from './NodeColourKey.module.css';

export interface NodeColourKeyProps {
  title: 'source' | 'gateway';
  /** The sorted colour domain (device ids or gateway ids). */
  ids: string[];
  /** Device names; a gateway shows its id. */
  names: Map<string, string>;
}

export default function NodeColourKey({ title, ids, names }: NodeColourKeyProps) {
  const { t } = useTranslation();
  if (ids.length === 0) return null;
  const label = title === 'source'
    ? t('map.colorNodesBySource', 'Colour nodes by source')
    : t('map.colorNodesByGateway', 'Colour nodes by gateway');
  return (
    <div className={styles.key} role="note" aria-label={label}>
      <div className={styles.title}>{label}</div>
      {ids.map((id) => (
        <div key={id} className={styles.row}>
          <span className={styles.swatch} style={{ background: getSourceColor(id, ids) }} />
          <span>{names.get(id) ?? id}</span>
        </div>
      ))}
    </div>
  );
}
