/**
 * One group of the Layers drawer (board f2-layers, ds2): a heading, its rows,
 * and the less-used rows behind "N more". A toggle row is today's switch with
 * today's label; a custom row is one of today's composite controls (age
 * slider, aircraft, packet flights, ducting) placed as is.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import styles from './LayersDrawer.module.css';

export interface LayerToggle {
  kind: 'toggle';
  id: string;
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
  /** Today's tooltip (e.g. "Not available in 3D"). */
  title?: string;
  /** A colour dot before the label (GeoJSON layers). */
  swatch?: string;
  /** Shown under the row while it is on (sub-toggles, the legend). */
  children?: ReactNode;
}

export interface LayerCustom {
  kind: 'custom';
  id: string;
  /** Named in the "N more" summary. */
  label: string;
  node: ReactNode;
}

export type LayerItem = LayerToggle | LayerCustom;

export interface LayerGroupSpec {
  id: string;
  title: string;
  items: LayerItem[];
  /** The less-used rows, folded behind "N more". */
  more?: LayerItem[];
}

export function LayerRow({ item }: { item: LayerItem }) {
  if (item.kind === 'custom') return <li className={styles.custom}>{item.node}</li>;
  return (
    <li className={styles.item}>
      <label className={styles.row} title={item.title}>
        {item.swatch && <span className={styles.swatch} style={{ background: item.swatch }} aria-hidden="true" />}
        <span className={styles.label}>{item.label}</span>
        <input
          type="checkbox"
          role="switch"
          className={styles.switch}
          checked={item.checked}
          disabled={item.disabled}
          onChange={(e) => item.onChange(e.target.checked)}
        />
      </label>
      {item.checked && item.children && <div className={styles.sub}>{item.children}</div>}
    </li>
  );
}

/** A sub-toggle under its parent row (Traceroute-Confirmed Links, Points only). */
export function SubToggle({ label, title, checked, onChange }: { label: string; title?: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <li>
      <label className={styles.row} title={title}>
        <span className={styles.label}>{label}</span>
        <input type="checkbox" role="switch" className={styles.switch} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </label>
    </li>
  );
}

export default function LayerGroup({ group }: { group: LayerGroupSpec }) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const more = group.more ?? [];
  if (group.items.length === 0 && more.length === 0) return null;
  return (
    <section className={styles.group} aria-labelledby={`layers-${group.id}`}>
      <h3 id={`layers-${group.id}`} className={styles.groupTitle}>{group.title}</h3>
      <ul className={styles.card}>
        {group.items.map((item) => <LayerRow key={item.id} item={item} />)}
        {showMore && more.map((item) => <LayerRow key={item.id} item={item} />)}
        {more.length > 0 && (
          <li className={styles.item}>
            <button type="button" className={styles.more} aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
              <span className={styles.label}>
                {showMore
                  ? t('workspace.map.fewer')
                  : `${t('workspace.map.more', { count: more.length })} · ${more.map((i) => i.label).join(', ')}`}
              </span>
              <UiIcon name={showMore ? 'chevronUp' : 'chevronDown'} size={16} />
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
