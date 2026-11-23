/**
 * The step picker (Task 8.4; n3): "When…" lists today's 18 triggers in groups
 * with a search, and its If / Then twins list today's conditions and actions
 * (s14n4). Names and descriptions are the catalogue's (AutomationBuilder's
 * pickers). Picking only changes the draft; nothing is sent.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { ACTIONS, BLOCK_BY_TYPE, CONDITIONS, TRIGGERS, type BlockDef } from '../../components/automations/catalog';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from '../meshcore/McTools.module.css';
import own from './Rules.module.css';

export type PickerKind = 'when' | 'step' | 'if' | 'then';

const WHEN_GROUPS: Array<{ key: string; icon: UiIconName; types: string[] }> = [
  { key: 'messages', icon: 'messages', types: ['trigger.message', 'trigger.meshBeacon'] },
  { key: 'nodes', icon: 'nodes', types: ['trigger.nodeDiscovered', 'trigger.nodeUpdated', 'trigger.telemetry', 'trigger.nodeStale', 'trigger.nodeOnline', 'trigger.nodeRebooted', 'trigger.nodePowerChanged', 'trigger.batteryTrend', 'trigger.clockOutOfSync'] },
  { key: 'places', icon: 'location', types: ['trigger.geofence', 'trigger.becameMobile', 'trigger.leftHome', 'trigger.becameLikelyAircraft'] },
  { key: 'time', icon: 'time', types: ['trigger.schedule'] },
  { key: 'mesh', icon: 'route', types: ['trigger.neighborAdded'] },
  { key: 'system', icon: 'server', types: ['trigger.system'] },
];

export default function WhenSheet({ kind, open, onClose, onPick }: { kind: PickerKind; open: boolean; onClose(): void; onPick(type: string): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [query, setQuery] = useState('');
  const groups: Array<{ key: string; icon: UiIconName; blocks: BlockDef[] }> = kind === 'when'
    ? WHEN_GROUPS.map((g) => ({ key: g.key, icon: g.icon, blocks: g.types.map((x) => BLOCK_BY_TYPE[x]).filter(Boolean) }))
    : [
        ...(kind !== 'then' ? [{ key: 'if', icon: 'filter' as UiIconName, blocks: CONDITIONS }] : []),
        ...(kind !== 'if' ? [{ key: 'then', icon: 'zap' as UiIconName, blocks: ACTIONS }] : []),
      ];
  const count = kind === 'when' ? TRIGGERS.length : groups.reduce((n, g) => n + g.blocks.length, 0);
  const q = query.trim().toLowerCase();
  const match = (b: BlockDef) => !q || b.label.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
  const title = t(`workspace.rules.picker.${kind}`);
  const pick = (type: string) => {
    setQuery('');
    onPick(type);
  };

  return (
    <Sheet open={open} onClose={() => { setQuery(''); onClose(); }} title={title}>
      <div className={own.picker} data-phone={isPhone || undefined}>
        <label className={own.search}>
          <UiIcon name="search" size={18} />
          <span className={styles.srOnly}>{t('workspace.rules.picker.search_label')}</span>
          <input type="search" value={query} placeholder={t('workspace.rules.picker.search', { count })} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {groups.map((g) => {
          const blocks = g.blocks.filter(match);
          if (blocks.length === 0) return null;
          return (
            <section key={g.key} aria-label={t(`workspace.rules.picker.group_${g.key}`)}>
              <h3 className={styles.sectionTitle}>{t(`workspace.rules.picker.group_${g.key}`)}</h3>
              <ul className={own.pickList}>
                {blocks.map((b) => (
                  <li key={b.type}>
                    <button type="button" className={own.pickRow} onClick={() => pick(b.type)}>
                      <span className={own.pickIcon}><UiIcon name={g.icon} size={18} /></span>
                      <span className={own.pickText}>
                        <strong>{b.label}</strong>
                        <span>{b.description}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}
