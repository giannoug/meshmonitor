/**
 * o4-users (ds13): one user's Permissions matrix on desktop. Today's per-device
 * resources down the side (only the rows a device has, as UsersTab filters its
 * scope), the devices across, a None / Read / Write cell per pair that saves as
 * you go; View on Map stays a separate toggle where today has that checkbox;
 * today's install-wide resources in their own card; today's virtual channel
 * permissions with their own Save. The parts are shared with the phone.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import type { ResourceType } from '../../../types/permission';
import {
  GLOBAL_PERMISSION_RESOURCES,
  PERMISSION_KEYS,
  isMqttSourceType,
  isSourceRowShown,
  type PermissionSource,
} from '../../../components/users/userPermissionModel';
import DeviceTag from '../../patterns/DeviceTag';
import StateView from '../../patterns/StateView';
import { hasViewOnMap, levelOf, type Level, type PermissionMatrixModel } from './usePermissionMatrix';
import { resourceLabel, resourceTooltip } from './resourceLabels';
import styles from './PermissionMatrix.module.css';

const LEVELS: Level[] = ['none', 'read', 'write'];
const WORD: Record<Level, string> = { none: 'common.none', read: 'users.read', write: 'users.write' };
const MQTT_HINT = 'Channel permissions for MQTT sources are managed under Virtual Channel Permissions below — MQTT channels are identified by name across all sources, not by per-source slot.';

/** Packet Monitor is read-only today (no write checkbox). */
const levelsFor = (resource: ResourceType): Level[] => (resource === 'packetmonitor' ? ['none', 'read'] : LEVELS);
const shownLevel = (resource: ResourceType, level: Level): Level => (levelsFor(resource).includes(level) ? level : 'read');

/** The rows a device shows (today's scope filter), in today's order. */
function deviceRows(model: PermissionMatrixModel, sources: PermissionSource[]): ResourceType[] {
  return PERMISSION_KEYS.filter((r) =>
    sources.some((s) => isSourceRowShown(r, s.type, model.devices?.[s.id]?.channelIds ?? new Set())));
}

export function MapToggle({ model, source, resource, className }: { model: PermissionMatrixModel; source: PermissionSource; resource: ResourceType; className?: string }) {
  const { t } = useTranslation();
  const on = !!model.devices?.[source.id]?.perms[resource]?.viewOnMap;
  return (
    <button
      type="button"
      className={className ?? styles.map}
      aria-pressed={on}
      aria-label={t('workspace.users.view_on_map_cell', { resource: resourceLabel(t, resource), device: source.name })}
      title={t('users.view_on_map')}
      disabled={model.saving}
      onClick={() => void model.setViewOnMap(source.id, resource)}
    >
      <UiIcon name="map" size={16} />
    </button>
  );
}

export function LevelSegments({ label, tooltip, resource, level, saving, onPick, className }: {
  label: string; tooltip?: string; resource: ResourceType; level: Level; saving: boolean; onPick(level: Level): void; className?: string;
}) {
  const { t } = useTranslation();
  const shown = shownLevel(resource, level);
  return (
    <div role="group" aria-label={label} title={tooltip} className={className ?? styles.segments}>
      {levelsFor(resource).map((l) => (
        <button key={l} type="button" aria-pressed={shown === l} disabled={saving} onClick={() => shown !== l && onPick(l)}>
          {t(WORD[l])}
        </button>
      ))}
    </div>
  );
}

/** Today's install-wide resources (stored with no device). `scope` is the device today's PUT goes out with. */
export function GlobalRows({ model, scope, rowClassName, segmentsClassName }: {
  model: PermissionMatrixModel; scope: string | null; rowClassName?: string; segmentsClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      {GLOBAL_PERMISSION_RESOURCES.map((r) => (
        <div key={r} className={rowClassName ?? styles.globalRow}>
          <span className={styles.globalLabel} title={resourceTooltip(r)}>{resourceLabel(t, r)}</span>
          <LevelSegments
            label={resourceLabel(t, r)}
            tooltip={resourceTooltip(r)}
            resource={r}
            level={levelOf(model.globals[r])}
            saving={model.saving}
            onPick={(l) => void model.setGlobalLevel(scope, r, l)}
            className={segmentsClassName}
          />
        </div>
      ))}
    </>
  );
}

export function MqttHint({ sources }: { sources: PermissionSource[] }) {
  const { t } = useTranslation();
  return sources.some((s) => isMqttSourceType(s.type)) ? <p className={styles.note}>{t('users.mqtt_channel_permissions_hint', MQTT_HINT)}</p> : null;
}

/** Today's Virtual Channel Permissions: checkboxes, then one Save for the list (today's whole-list PUT). */
export function ChannelDbCard({ model, className }: { model: PermissionMatrixModel; className?: string }) {
  const { t } = useTranslation();
  const headingId = useId();
  const { entries, get, toggle, save } = model.channelDb;
  if (entries.length === 0) return <p className={styles.note}>{t('users.no_channel_database_entries')}</p>;
  return (
    <section className={className ?? styles.card} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>{t('users.channel_database_permissions')}</h3>
      {entries.map((e) => {
        const p = get(e.id);
        // Only Read applies to a MeshCore key (#5552), as today.
        const meshcore = e.protocol === 'meshcore';
        return (
          <fieldset key={e.id} aria-label={e.name} className={styles.dbRow}>
            <span className={styles.dbName}>
              {e.name}
              {meshcore && <span className={styles.muted}>{t('channel_database.protocol_meshcore', 'MeshCore')}</span>}
              {e.description && <span className={styles.muted}>({e.description})</span>}
            </span>
            <span className={styles.dbBoxes}>
              <label hidden={meshcore}>
                <input type="checkbox" checked={p.canViewOnMap} onChange={() => toggle(e.id, 'canViewOnMap')} />
                {t('users.view_on_map')}
              </label>
              <label>
                <input type="checkbox" checked={p.canRead} disabled={p.canWrite ?? false} onChange={() => toggle(e.id, 'canRead')} />
                {t('users.read_messages')}
              </label>
              <label hidden={meshcore}>
                <input type="checkbox" checked={p.canWrite ?? false} onChange={() => toggle(e.id, 'canWrite')} />
                {t('users.write')}
              </label>
            </span>
          </fieldset>
        );
      })}
      <button type="button" className={styles.save} onClick={() => void save()}>{t('users.save_channel_db_permissions')}</button>
    </section>
  );
}

export default function PermissionMatrix({ model, sources }: { model: PermissionMatrixModel; sources: PermissionSource[] }) {
  const { t } = useTranslation();
  const matrixId = useId();
  const globalId = useId();
  if (model.failed) return <StateView kind="error" title={t('users.failed_load_permissions')} />;
  const devices = model.devices;
  if (!devices) return <StateView kind="loading" />;

  return (
    <div className={styles.matrix} aria-busy={model.saving || undefined}>
      <h3 id={matrixId} className={styles.heading}>{t('workspace.users.on_each_device')}</h3>
      <div className={styles.scroll}>
        <table className={styles.table} aria-labelledby={matrixId}>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>{t('workspace.users.can_use')}</th>
              {sources.map((s) => (
                <th key={s.id} scope="col" title={s.name}>
                  <span className={styles.device}>
                    <DeviceTag sourceId={s.id} />
                    <span className={styles.deviceName}>{s.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deviceRows(model, sources).map((r) => {
              const label = resourceLabel(t, r);
              return (
                <tr key={r}>
                  <th scope="row" title={resourceTooltip(r)}>{label}</th>
                  {sources.map((s) => {
                    const d = devices[s.id];
                    if (!d || !isSourceRowShown(r, s.type, d.channelIds)) {
                      return <td key={s.id} className={styles.na} title={t('workspace.users.not_on_device')} />;
                    }
                    const p = d.perms[r];
                    const level = shownLevel(r, levelOf(p));
                    const options = levelsFor(r);
                    const next = options[(options.indexOf(level) + 1) % options.length];
                    const word = t(WORD[level]);
                    const channel = /^channel_(\d+)$/.exec(r);
                    return (
                      <td key={s.id}>
                        <span className={styles.cellWrap}>
                          <button
                            type="button"
                            className={styles.cell}
                            data-level={level}
                            title={channel ? d.channelNames.get(Number(channel[1])) : undefined}
                            aria-label={t('workspace.users.cell', { resource: label, device: s.name, level: word })}
                            disabled={model.saving}
                            onClick={() => void model.setLevel(s.id, r, next)}
                          >
                            {word}
                          </button>
                          {hasViewOnMap(r, s) && <MapToggle model={model} source={s} resource={r} />}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>{t('workspace.users.cycle_hint')}</p>
      <MqttHint sources={sources} />

      <h3 id={globalId} className={styles.heading}>{t('workspace.users.across')}</h3>
      <section className={styles.card} aria-labelledby={globalId}>
        <GlobalRows model={model} scope={sources[0]?.id ?? null} />
      </section>

      <ChannelDbCard model={model} />
    </div>
  );
}
