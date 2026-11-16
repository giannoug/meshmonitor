/**
 * Node management (board 12-11), a remote-only page: today's Node Favorites &
 * Ignored for the remote node, and its Automatic Favorites.
 *
 * - Favorite / Ignored: one admin command per Set or Remove, as Admin
 *   Commands sends them, with its ACK toasts; a rejected command changes
 *   nothing. The admin protocol cannot read the node's lists, so a row knows
 *   only what this session set (today's note), and an unknown row offers both
 *   Set and Remove, as today's buttons do.
 * - Automatic Favorites: today's per-target config (useAutoFavoriteTarget):
 *   Save Settings stores it on the server (nothing on the mesh), Run Cycle Now
 *   asks first with today's words; its cycle cost is today's.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { useNumberInputScope } from '../../../components/common/numberInputScopeContext';
import { filterNodes } from '../../../components/admin-commands/nodeOptionsUtils';
import { SELECTABLE_ROLES, useAutoFavoriteTarget } from '../../../components/admin-commands/useAutoFavoriteTarget';
import { ROLE_NAMES } from '../../../constants/index';
import { useToast } from '../../../components/ToastContainer';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import SettingGroup from '../kit/SettingGroup';
import SettingNumber from '../kit/SettingNumber';
import SettingRow from '../kit/SettingRow';
import SettingToggle from '../kit/SettingToggle';
import { useReadOnly } from '../kit/useFieldRegistry';
import type { CategoryProps } from '../categories';
import TargetActions from './TargetActions';
import { useRemoteTarget } from './useRemoteTarget';
import pages from '../categories/SettingsPages.module.css';
import styles from './Remote.module.css';

type Flag = 'favorite' | 'ignored';
const COMMAND: Record<Flag, { set: string; remove: string; param: string; key: 'isFavorite' | 'isIgnored' }> = {
  favorite: { set: 'setFavoriteNode', remove: 'removeFavoriteNode', param: 'favoriteNodeNum', key: 'isFavorite' },
  ignored: { set: 'setIgnoredNode', remove: 'removeIgnoredNode', param: 'targetNodeNum', key: 'isIgnored' },
};

export default function NodeManagementCategory({ sourceId }: CategoryProps) {
  const remote = useRemoteTarget();
  if (!remote) return <StateView kind="noPermission" />;
  return (
    <>
      <TargetActions />
      <FavoritesAndIgnored />
      <AutoFavorites sourceId={sourceId} />
    </>
  );
}

function FavoritesAndIgnored() {
  const { t } = useTranslation();
  const remote = useRemoteTarget()!;
  const readOnly = useReadOnly();
  const isPhone = useIsPhone();
  const { node } = remote;
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { showToast: toastAck } = useToast();
  const others = remote.nodes.filter((n) => n.nodeNum !== node.nodeNum);
  const shown = filterNodes(others, query);

  const send = async (nodeNum: number, flag: Flag, set: boolean) => {
    const c = COMMAND[flag];
    setBusy(`${nodeNum}:${flag}`);
    try {
      const res = await remote.execute(set ? c.set : c.remove, { [c.param]: nodeNum });
      // Today's reading of the routing ACK: a definitive rejection did not apply; confirmed or timed out may have.
      const ack = res.ack;
      const rejected = !!ack && !ack.acked && !ack.timedOut;
      const stem = flag === 'favorite' ? 'node_favorite' : 'node_ignored';
      if (ack?.acked) toastAck(t(`admin_commands.${stem}_confirmed`, { nodeNum }), 'success');
      else if (ack?.timedOut) toastAck(t(`admin_commands.${stem}_no_ack`, { nodeNum }), 'warning');
      else if (rejected) toastAck(t(`admin_commands.${stem}_rejected`, { nodeNum, status: ack.status }), 'error');
      if (!rejected) remote.setNodeStatus(nodeNum, { [c.key]: set });
    } catch {
      // Shown by execute.
    } finally {
      setBusy(null);
    }
  };

  const hops = node.hopsAway != null ? t('workspace.settings.remote.hops_suffix', { count: node.hopsAway }) : '';
  const off = readOnly || remote.blocked || busy !== null;
  const cell = (nodeNum: number, name: string, flag: Flag, known: boolean | undefined) => {
    const label = (set: boolean) => t(flag === 'favorite' ? (set ? 'admin_commands.set_as_favorite' : 'admin_commands.remove_favorite') : set ? 'admin_commands.set_as_ignored' : 'admin_commands.remove_ignored');
    const button = (set: boolean) => (
      <button
        type="button"
        className={pages.button}
        disabled={off}
        aria-busy={busy === `${nodeNum}:${flag}` || undefined}
        aria-label={`${label(set)}: ${name}`}
        onClick={() => void send(nodeNum, flag, set)}
      >
        {t(set ? 'workspace.settings.remote.set' : 'workspace.settings.remote.remove')}
      </button>
    );
    return (
      <td className={styles.cell}>
        {known !== true && button(true)}
        {known !== false && button(false)}
      </td>
    );
  };

  return (
    <section className={styles.section} data-phone={isPhone || undefined}>
      <h2 className={styles.sectionTitle}>{t('workspace.settings.remote.node_management')}</h2>
      <label className={styles.search}>
        <UiIcon name="search" size={18} />
        <span className={styles.srOnly}>{t('admin_commands.search_node_to_manage')}</span>
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          placeholder={t('workspace.settings.remote.find_node', { name: node.longName })}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('workspace.settings.remote.node_on', { name: node.longName })}</th>
              <th scope="col">{t('admin_commands.favorite')}</th>
              <th scope="col">{t('admin_commands.ignored')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((n) => {
              const s = remote.nodeStatus[n.nodeNum] ?? {};
              const known = [s.isFavorite && t('admin_commands.favorite'), s.isIgnored && t('admin_commands.ignored')].filter(Boolean).join(', ');
              const anyKnown = s.isFavorite !== undefined || s.isIgnored !== undefined;
              return (
                <tr key={n.nodeNum}>
                  <th scope="row" className={styles.nodeCell}>
                    <span className={styles.nodeName}>{n.longName}</span>
                    <span className={styles.nodeSub}>
                      {anyKnown
                        ? t('workspace.settings.remote.from_session', { status: known || t('workspace.settings.remote.neither') })
                        : t('admin_commands.remote_status_unknown')}
                    </span>
                  </th>
                  {cell(n.nodeNum, n.longName, 'favorite', s.isFavorite)}
                  {cell(n.nodeNum, n.longName, 'ignored', s.isIgnored)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SendsLine>{t('workspace.settings.remote.node_change_sends') + hops}</SendsLine>
      <p className={styles.help}>{t('admin_commands.remote_status_readback_note')}</p>
    </section>
  );
}

function AutoFavorites({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const remote = useRemoteTarget()!;
  const readOnly = useReadOnly();
  const isPhone = useIsPhone();
  const fav = useAutoFavoriteTarget(remote.node.nodeNum, sourceId);
  // #5649: mesh timers; a blank or below-minimum value is never saved.
  const numbers = useNumberInputScope();
  const [asking, setAsking] = useState(false);
  const c = fav.config;
  const time = (ts: number | null) => (ts ? new Date(ts).toLocaleString() : t('auto_favorite.never'));
  return (
    <NumberInputScope scope={numbers}>
      <SettingGroup title={t('auto_favorite.nav')}>
        {fav.isLoading || !c ? (
          <p className={pages.infoRow}>{t('auto_favorite.loading')}</p>
        ) : (
          <>
            <SettingRow id="node-management.autoFavorite" label={t('auto_favorite.enabled')} help={t('auto_favorite.enabled_desc')}>
              <SettingToggle checked={c.enabled} onChange={(v) => fav.update({ enabled: v })} />
            </SettingRow>
            <SettingRow id="node-management.useNeighborInfo" label={t('auto_favorite.use_neighborinfo')} help={t('auto_favorite.use_neighborinfo_desc')}>
              <SettingToggle checked={c.useNeighborInfo} onChange={(v) => fav.update({ useNeighborInfo: v })} />
            </SettingRow>
            {c.useNeighborInfo && (
              <SettingRow id="node-management.maxNeighborAge" label={t('auto_favorite.max_neighbor_age')} help={t('auto_favorite.max_neighbor_age_desc')}>
                <SettingNumber value={c.maxNeighborAgeHours} min={0} onChange={(v) => fav.update({ maxNeighborAgeHours: v })} />
              </SettingRow>
            )}
            <SettingRow id="node-management.useTraceroutes" label={t('auto_favorite.use_traceroutes')} help={t('auto_favorite.use_traceroutes_desc')}>
              <SettingToggle checked={c.useTraceroutes} onChange={(v) => fav.update({ useTraceroutes: v })} />
            </SettingRow>
            <SettingRow id="node-management.interval" label={t('auto_favorite.interval_hours')} help={t('auto_favorite.interval_hours_desc')}>
              <SettingNumber value={c.intervalHours} min={1} onChange={(v) => fav.update({ intervalHours: v })} />
            </SettingRow>
            <SettingRow id="node-management.maxNew" label={t('auto_favorite.max_new')} help={t('auto_favorite.max_new_desc')}>
              <SettingNumber value={c.maxNewPerCycle} min={0} onChange={(v) => fav.update({ maxNewPerCycle: v })} />
            </SettingRow>
            <SettingRow id="node-management.maxRefavorite" label={t('auto_favorite.max_refavorite')} help={t('auto_favorite.max_refavorite_desc')}>
              <SettingNumber value={c.maxRefavoritePerCycle} min={0} onChange={(v) => fav.update({ maxRefavoritePerCycle: v })} />
            </SettingRow>
            <SettingRow id="node-management.roles" label={t('auto_favorite.eligible_roles')} help={t('auto_favorite.eligible_roles_desc')}>
              <span className={styles.roles}>
                {SELECTABLE_ROLES.map((role) => (
                  <label key={role} className={styles.role} data-phone={isPhone || undefined}>
                    <input type="checkbox" checked={c.eligibleRoles.includes(role)} disabled={readOnly} onChange={() => fav.toggleRole(role)} />
                    <span>{ROLE_NAMES[role] || `Role ${role}`}</span>
                  </label>
                ))}
              </span>
            </SettingRow>
            <div className={pages.infoRow}>
              <div className={pages.infoText}>
                <span className={pages.infoLabel}>{t('auto_favorite.status')}</span>
                <span className={pages.infoHelp}>
                  {`${t('auto_favorite.last_run')}: ${time(c.lastRunAt)} · ${t('auto_favorite.last_neighbor_request')}: ${time(c.lastNeighborRequestAt)} · ${t('auto_favorite.managed_count')}: ${c.assignments.length}`}
                </span>
                <SendsLine>{t('workspace.settings.remote.cycle_sends', { count: c.maxNewPerCycle + c.maxRefavoritePerCycle })}</SendsLine>
              </div>
              <div className={styles.footerButtons}>
                <button type="button" className={pages.button} disabled={readOnly || fav.isRunning || remote.blocked} title={t('auto_favorite.run_now_title')} onClick={() => setAsking(true)}>
                  <UiIcon name="play" size={16} /> {fav.isRunning ? t('auto_favorite.running') : t('auto_favorite.run_now')}
                </button>
                <button
                  type="button"
                  className={`${pages.button} ${pages.primary}`}
                  disabled={readOnly || fav.isSaving || numbers.invalid}
                  onClick={() => void fav.handleSave()}
                >
                  {fav.isSaving ? t('auto_favorite.saving') : t('auto_favorite.save')}
                </button>
              </div>
            </div>
          </>
        )}
      </SettingGroup>
      <ConfirmSheet
        open={asking}
        title={t('auto_favorite.run_now')}
        body={
          <>
            <p className={pages.para}>{t('auto_favorite.run_now_confirm')}</p>
            <SendsLine>{t('workspace.settings.remote.cycle_sends', { count: (c?.maxNewPerCycle ?? 0) + (c?.maxRefavoritePerCycle ?? 0) })}</SendsLine>
          </>
        }
        confirmLabel={t('auto_favorite.run_now')}
        busy={fav.isRunning}
        submitOnEnter={false}
        onConfirm={async () => {
          await fav.handleRunNow();
          setAsking(false);
        }}
        onCancel={() => setAsking(false)}
      />
    </NumberInputScope>
  );
}
