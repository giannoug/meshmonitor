/**
 * In MeshMonitor › Filters (Task 7.4, note s8n4: "ignore/block,
 * exact/wildcard/regex, sender/text, case, ignored/blocked table"), on today's
 * hooks (useMeshCoreFilters) and gates (nodes for the table, messages for the
 * rules). The rule being added or edited saves from the page's own bar: one
 * create or update request per press. A rule's On switch, a rule's Delete
 * and an ignored node's Remove act at once with one request, as today.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useAuth } from '../../../contexts/AuthContext';
import {
  useCreateMeshCoreMessageFilter,
  useDeleteMeshCoreMessageFilter,
  useMeshCoreIgnoredNodes,
  useMeshCoreMessageFilters,
  useRemoveMeshCoreIgnoredNode,
  useUpdateMeshCoreMessageFilter,
  type MeshCoreMessageFilter,
  type MeshCoreMessageFilterInput,
} from '../../../hooks/useMeshCoreFilters';
import { formatRelativeTime } from '../../../utils/datetime';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingRow from '../../settings/kit/SettingRow';
import SettingSelect from '../../settings/kit/SettingSelect';
import SettingText from '../../settings/kit/SettingText';
import SettingToggle from '../../settings/kit/SettingToggle';
import { McDock, McPage } from './mcShared';
import kit from '../../settings/kit/kit.module.css';
import styles from './McSettings.module.css';

const MAX_PATTERN = 256;
const EMPTY: MeshCoreMessageFilterInput = { mode: 'ignore', matchType: 'wildcard', pattern: '', caseSensitive: false, fields: 'both', enabled: true };

export default function FiltersCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const scope = { sourceId };
  const canReadNodes = hasPermission('nodes', 'read', scope);
  const canWriteNodes = hasPermission('nodes', 'write', scope);
  const canRead = hasPermission('messages', 'read', scope);
  const canWrite = hasPermission('messages', 'write', scope);
  const ignored = useMeshCoreIgnoredNodes(sourceId, { enabled: canReadNodes });
  const remove = useRemoveMeshCoreIgnoredNode(sourceId);
  const { data: rules, isLoading } = useMeshCoreMessageFilters(canRead ? sourceId : null);
  const create = useCreateMeshCoreMessageFilter(sourceId);
  const update = useUpdateMeshCoreMessageFilter(sourceId);
  const del = useDeleteMeshCoreMessageFilter(sourceId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MeshCoreMessageFilterInput | null>(null);
  const [base, setBase] = useState<MeshCoreMessageFilterInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const matchLabel = (m: MeshCoreMessageFilter['matchType']) =>
    m === 'regex' ? t('meshcore.filters.match_regex', 'Regex') : m === 'wildcard' ? t('meshcore.filters.match_wildcard', 'Wildcard') : t('meshcore.filters.match_exact', 'Exact');
  const fieldsLabel = (f: MeshCoreMessageFilter['fields']) =>
    f === 'name' ? t('meshcore.filters.fields_name', 'Sender name') : f === 'body' ? t('meshcore.filters.fields_body', 'Message text') : t('meshcore.filters.fields_both', 'Name and text');
  const modeLabel = (m: 'ignore' | 'block') => (m === 'block' ? t('meshcore.ignore.mode_block', 'Block') : t('meshcore.ignore.mode_ignore', 'Ignore'));

  const open = (id: string | null, value: MeshCoreMessageFilterInput) => {
    setEditingId(id);
    setDraft(value);
    setBase(value);
    setFormError(null);
  };
  const close = () => {
    setEditingId(null);
    setDraft(null);
    setBase(null);
    setFormError(null);
  };
  const set = <K extends keyof MeshCoreMessageFilterInput>(k: K, v: MeshCoreMessageFilterInput[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const save = async () => {
    if (!draft) return;
    if (!draft.pattern.trim()) return setFormError(t('meshcore.filters.pattern_required', 'Enter a pattern.'));
    setFormError(null);
    try {
      if (editingId) await update.mutateAsync({ id: editingId, patch: draft });
      else await create.mutateAsync(draft);
      close();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('meshcore.ignore.save_failed', 'Could not save'));
    }
  };
  const labels: Record<keyof MeshCoreMessageFilterInput, string> = {
    pattern: t('meshcore.filters.col_pattern', 'Pattern'),
    matchType: t('meshcore.filters.col_match', 'Match'),
    fields: t('meshcore.filters.col_fields', 'Checks'),
    mode: t('meshcore.ignore.col_mode', 'Mode'),
    caseSensitive: t('meshcore.filters.case_sensitive', 'Case sensitive'),
    enabled: t('meshcore.filters.enabled', 'Enabled'),
  };
  // A new rule counts as one change; an edited one lists what changed.
  const changes = draft && base
    ? editingId
      ? (Object.keys(labels) as Array<keyof MeshCoreMessageFilterInput>).filter((k) => draft[k] !== base[k]).map((k) => labels[k])
      : [t('meshcore.filters.add', 'Add filter')]
    : [];
  const busy = create.isPending || update.isPending;

  return (
    <McPage>
      {canReadNodes && (
        <section className={styles.section} aria-labelledby="mc-ignored">
          <h2 className={styles.heading} id="mc-ignored">{t('meshcore.ignore.nodes_title', 'Ignored and blocked nodes')}</h2>
          <p className={styles.lead}>
            {t('meshcore.ignore.nodes_desc', 'Ignored nodes are hidden and their messages are stored but collapsed, with no notifications, automations or auto-replies. Blocked nodes are hidden and their messages are dropped on receipt. Add a node from its Node Details.')}
          </p>
          <div className={styles.card}>
            {ignored.error ? <p className={styles.error} role="alert">{(ignored.error as Error).message}</p> : null}
            {ignored.isLoading ? (
              <p className={styles.muted}>{t('common.loading', 'Loading…')}</p>
            ) : !ignored.data?.length ? (
              <p className={styles.muted}>{t('meshcore.ignore.nodes_empty', 'No ignored or blocked nodes.')}</p>
            ) : (
              <ul className={styles.results} aria-label={t('meshcore.ignore.nodes_title', 'Ignored and blocked nodes')}>
                {ignored.data.map((e) => (
                  <li key={e.publicKey} className={styles.cardRow}>
                    <span className={styles.rowText}>
                      <span className={styles.rowLabel}>
                        {e.name || t('meshcore.ignore.unknown_name', 'Unknown')} <span className={styles.tag} data-kind={e.mode === 'block' ? 'block' : undefined}>{modeLabel(e.mode)}</span>
                      </span>
                      <span className={styles.muted}>
                        <span className={styles.mono}>{`${e.publicKey.slice(0, 12)}…`}</span>
                        {` · ${t('meshcore.ignore.col_hits', 'Hits')} ${e.hitCount} · ${t('meshcore.ignore.col_last_hit', 'Last hit')} ${e.lastHitAt ? formatRelativeTime(e.lastHitAt) : t('meshcore.ignore.never', 'Never')}`}
                      </span>
                    </span>
                    {canWriteNodes && (
                      <button
                        type="button"
                        className={styles.icon}
                        disabled={remove.isPending}
                        aria-label={t('meshcore.ignore.remove_entry', 'Remove {{name}}', { name: e.name || e.publicKey.slice(0, 12) })}
                        onClick={() => remove.mutate(e.publicKey)}
                      >
                        <UiIcon name="delete" size={18} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {remove.error ? <p className={styles.error} role="alert">{(remove.error as Error).message}</p> : null}
          </div>
        </section>
      )}

      {canRead && (
        <section className={styles.section} aria-labelledby="mc-filters">
          <h2 className={styles.heading} id="mc-filters">{t('meshcore.filters.title', 'Message filters')}</h2>
          <p className={styles.lead}>
            {t('meshcore.filters.desc', 'Ignore or block messages whose sender name or text matches a pattern. Wildcard: * matches any run of characters, ? matches one, and the pattern must match the whole field. Regex matches anywhere; lookaround and backreferences are not supported. Block wins when both match.')}
          </p>
          <p className={styles.lead}>
            {t('meshcore.ignore.spoof_note', 'Channel messages carry only a sender name, so they are matched by the node’s advert name. Anyone can use that name, and two nodes can share one.')}
          </p>
          <div className={styles.card}>
            {isLoading ? (
              <p className={styles.muted}>{t('common.loading', 'Loading…')}</p>
            ) : !rules?.length ? (
              <p className={styles.muted}>{t('meshcore.filters.empty', 'No message filters.')}</p>
            ) : (
              <ul className={styles.results} aria-label={t('meshcore.filters.title', 'Message filters')}>
                {rules.map((r) => (
                  <li key={r.id} className={styles.cardRow}>
                    <input
                      type="checkbox"
                      role="switch"
                      className={kit.switch}
                      checked={r.enabled}
                      disabled={!canWrite || update.isPending}
                      aria-label={t('meshcore.filters.toggle_enabled', 'Enable rule {{pattern}}', { pattern: r.pattern })}
                      onChange={(e) => update.mutate({ id: r.id, patch: { enabled: e.target.checked } })}
                    />
                    <span className={styles.rowText}>
                      <span className={styles.rowLabel}>
                        <span className={styles.mono}>{r.pattern}</span>
                        {r.caseSensitive && ` (${t('meshcore.filters.case_sensitive_short', 'Aa')})`} <span className={styles.tag}>{modeLabel(r.mode)}</span>
                      </span>
                      <span className={styles.muted}>
                        {`${matchLabel(r.matchType)} · ${fieldsLabel(r.fields)} · ${t('meshcore.ignore.col_hits', 'Hits')} ${r.hitCount} · ${t('meshcore.ignore.col_last_hit', 'Last hit')} ${r.lastHitAt ? formatRelativeTime(r.lastHitAt) : t('meshcore.ignore.never', 'Never')}`}
                      </span>
                    </span>
                    {canWrite && (
                      <span className={styles.slotActions}>
                        <button
                          type="button"
                          className={styles.icon}
                          aria-label={t('meshcore.filters.edit_rule', 'Edit rule {{pattern}}', { pattern: r.pattern })}
                          onClick={() => open(r.id, { mode: r.mode, matchType: r.matchType, pattern: r.pattern, caseSensitive: r.caseSensitive, fields: r.fields, enabled: r.enabled })}
                        >
                          <UiIcon name="edit" size={18} />
                        </button>
                        <button
                          type="button"
                          className={styles.icon}
                          disabled={del.isPending}
                          aria-label={t('meshcore.filters.delete_rule', 'Delete rule {{pattern}}', { pattern: r.pattern })}
                          onClick={() => del.mutate(r.id)}
                        >
                          <UiIcon name="delete" size={18} />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && !draft && (
              <span>
                <button type="button" className={styles.button} onClick={() => open(null, { ...EMPTY })}>
                  <UiIcon name="plus" size={16} /> {t('meshcore.filters.add', 'Add filter')}
                </button>
              </span>
            )}
            {(update.error || del.error) && !draft ? <p className={styles.error} role="alert">{((update.error || del.error) as Error).message}</p> : null}
          </div>
        </section>
      )}

      {canWrite && draft && (
        <SettingGroup title={editingId ? t('workspace.meshcore.settings.edit_filter') : t('meshcore.filters.add', 'Add filter')}>
          <SettingRow id="meshcore-filter.pattern" label={labels.pattern}>
            <SettingText value={draft.pattern} maxLength={MAX_PATTERN} mono onChange={(v) => set('pattern', v)} />
          </SettingRow>
          <SettingRow id="meshcore-filter.matchType" label={labels.matchType}>
            <SettingSelect
              value={draft.matchType}
              options={(['wildcard', 'exact', 'regex'] as const).map((m) => ({ value: m, label: matchLabel(m) }))}
              onChange={(v) => set('matchType', v as MeshCoreMessageFilterInput['matchType'])}
            />
          </SettingRow>
          <SettingRow id="meshcore-filter.fields" label={labels.fields}>
            <SettingSelect
              value={draft.fields}
              options={(['both', 'name', 'body'] as const).map((f) => ({ value: f, label: fieldsLabel(f) }))}
              onChange={(v) => set('fields', v as MeshCoreMessageFilterInput['fields'])}
            />
          </SettingRow>
          <SettingRow id="meshcore-filter.mode" label={labels.mode}>
            <SettingSelect value={draft.mode} options={(['ignore', 'block'] as const).map((m) => ({ value: m, label: modeLabel(m) }))} onChange={(v) => set('mode', v as MeshCoreMessageFilterInput['mode'])} />
          </SettingRow>
          <SettingRow id="meshcore-filter.caseSensitive" label={labels.caseSensitive}>
            <SettingToggle checked={draft.caseSensitive} onChange={(v) => set('caseSensitive', v)} />
          </SettingRow>
          <SettingRow id="meshcore-filter.enabled" label={labels.enabled}>
            <SettingToggle checked={draft.enabled} onChange={(v) => set('enabled', v)} />
          </SettingRow>
        </SettingGroup>
      )}
      {canWrite && draft && changes.length === 0 && (
        <span>
          <button type="button" className={styles.plain} onClick={close}>{t('common.cancel', 'Cancel')}</button>
        </span>
      )}

      {draft && (
        <McDock
          // A new rule is a change from the start; Discard closes the editor.
          changes={changes}
          page={t('workspace.meshcore.settings.filters')}
          sends={t('workspace.settings.savebar.sends_nothing')}
          saveLabel={t('common.save', 'Save')}
          saving={busy}
          blocked={!canWrite}
          error={formError}
          onSave={() => void save()}
          onDiscard={close}
        />
      )}
    </McPage>
  );
}
