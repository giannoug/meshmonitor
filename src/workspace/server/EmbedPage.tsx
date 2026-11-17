/**
 * Server › Embed (boards 13-06 desktop, 13-23 phone): admins only, as the
 * embed-profile routes. Today's EmbedSettings state and actions through
 * `useEmbedProfiles` (Rule X):
 *
 * - The profiles (name, enabled), each with Edit, Embed Code and ⋯ Delete
 *   (today's words). New profile starts at the centroid of today's active
 *   nodes, as today.
 * - The form: today's fields (name, enabled, channels 0–7 with the MeshCore
 *   hint, source, raster tileset, centre and zoom picked on the preview map,
 *   the seven feature toggles, poll interval 10–300 s, allowed origins with
 *   today's validation) and today's security note. A profile saves only with
 *   Save profile (s13n1), one POST or PUT.
 * - Embed code: today's iframe snippet with Copy.
 *
 * Mesh impact: none. Embeds read MeshMonitor; live embeds pick up a change on
 * their next poll.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import { UiIcon } from '../../components/icons';
import { NumberInput } from '../../components/common/NumberInput';
import { NumberInputScope } from '../../components/common/NumberInputScope';
import { BaseMap } from '../../components/map/BaseMap';
import { useEmbedProfiles, type ProfileFormData } from '../../components/settings/useEmbedProfiles';
import { isAnyMeshCoreSourceType } from '../../utils/nodeTypeCategory';
import ConfirmSheet from '../patterns/ConfirmSheet';
import RowMenu from '../patterns/RowMenu';
import SettingGroup from '../settings/kit/SettingGroup';
import { useIsPhone } from '../shell/useIsPhone';
import Field from './Field';
import ServerFrame from './ServerFrame';
import pages from '../settings/categories/SettingsPages.module.css';
import prefs from '../you/preferences/Preferences.module.css';
import styles from './Server.module.css';

type Embed = ReturnType<typeof useEmbedProfiles>;

export default function EmbedPage() {
  const { t } = useTranslation();
  return (
    <ServerFrame categoryId="embed" title={t('workspace.server.nav.embed')} scope={t('workspace.server.scope_admins')} icon="code" gate="admin" needsSettings={false}>
      <EmbedBody />
    </ServerFrame>
  );
}

function EmbedBody() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const e = useEmbedProfiles();
  const [deleting, setDeleting] = useState<string | null>(null);
  const editing = e.editingId !== null;
  // The code shown: the one asked for, else the profile being edited.
  const codeId = e.copyProfileId ?? (e.editingId && e.editingId !== 'new' ? e.editingId : null);

  if (e.loading) return <p className={styles.cardPara}>{t('settings.embed.loading', 'Loading embed profiles...')}</p>;

  const list = (
    <SettingGroup title={t('workspace.server.embed_profiles')}>
      <p className={styles.cardPara}>{t('settings.embed.description', 'Create embed profiles to share interactive maps on external websites via iframe.')}</p>
      {e.profiles.length === 0 ? (
        <p className={styles.cardPara}>{t('settings.embed.none', 'No embed profiles yet.')}</p>
      ) : (
        e.profiles.map((p) => (
          <div key={p.id} className={pages.infoRow} data-testid="embed-profile">
            <div className={pages.infoText}>
              <span className={pages.infoLabel}>{p.name}</span>
              <span className={pages.infoHelp}>
                {t('settings.embed.col_enabled', 'Enabled')}: {p.enabled ? t('settings.embed.yes', 'Yes') : t('settings.embed.no', 'No')}
              </span>
            </div>
            <button type="button" className={pages.button} onClick={() => e.setCopyProfileId(p.id)}>
              <UiIcon name="code" size={16} />
              {t('settings.embed.copy_embed', 'Embed Code')}
            </button>
            <button type="button" className={pages.iconButton} aria-label={`${t('settings.embed.edit_btn', 'Edit')} ${p.name}`} title={t('settings.embed.edit_btn', 'Edit')} onClick={() => e.openEdit(p)}>
              <UiIcon name="edit" size={18} />
            </button>
            <RowMenu
              label={t('workspace.server.profile_actions', { name: p.name })}
              items={[{ key: 'delete', label: t('settings.embed.delete_btn', 'Delete'), icon: 'delete', danger: true, onSelect: () => setDeleting(p.id) }]}
            />
          </div>
        ))
      )}
      <div className={styles.cardActions}>
        <button type="button" className={pages.button} onClick={() => void e.openCreate()}>
          <UiIcon name="plus" size={16} />
          {t('workspace.server.new_profile')}
        </button>
      </div>
      <p className={styles.cardPara}>
        <strong>{t('settings.embed.security_note_title', 'Security Note')}</strong>{' '}
        {t('settings.embed.security_note', 'Embed maps are served using the anonymous user permissions. Make sure the anonymous user has read access to the channels you want to display. If anonymous access is disabled, embed maps will not work.')}
      </p>
    </SettingGroup>
  );

  const preview = editing && <Preview e={e} />;
  const code = codeId && <EmbedCode e={e} profileId={codeId} />;

  return (
    <>
      {isPhone ? (
        editing ? (
          <>
            <p className={styles.crumb}>
              <UiIcon name="code" size={16} />
              {t('workspace.server.embed_profiles')} › {e.form.name || t('workspace.server.new_profile')}
            </p>
            {preview}
            <ProfileForm e={e} />
            {code}
          </>
        ) : (
          <>
            {list}
            {code}
          </>
        )
      ) : (
        <div className={prefs.columns}>
          <div className={prefs.column}>
            {list}
            {editing && <ProfileForm e={e} />}
          </div>
          <div className={prefs.column}>
            {preview}
            {code}
          </div>
        </div>
      )}
      <ConfirmSheet
        open={deleting !== null}
        title={t('settings.embed.delete_btn', 'Delete')}
        body={<p className={pages.para}>{t('settings.embed.delete_confirm', 'Are you sure you want to delete this embed profile?')}</p>}
        confirmLabel={t('settings.embed.delete_btn', 'Delete')}
        danger
        submitOnEnter={false}
        onConfirm={async () => {
          if (deleting) await e.deleteProfile(deleting);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

const FEATURES: Array<[keyof ProfileFormData, string, string]> = [
  ['showTooltips', 'settings.embed.show_tooltips', 'Show Tooltips'],
  ['showPopups', 'settings.embed.show_popups', 'Show Popups'],
  ['showLegend', 'settings.embed.show_legend', 'Show Legend'],
  ['showPaths', 'settings.embed.show_paths', 'Show Paths'],
  ['showNeighborInfo', 'settings.embed.show_neighbor_info', 'Show Neighbor Info'],
  ['showTraceroutes', 'settings.embed.show_traceroutes', 'Show Traceroutes (exposes mesh topology)'],
  ['showMqttNodes', 'settings.embed.show_mqtt_nodes', 'Show MQTT Nodes'],
];

function ProfileForm({ e }: { e: Embed }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { form, setForm, sources } = e;
  // #5999: the channel list is Meshtastic only.
  const meshcoreHint = form.sourceId === null ? sources.some((s) => isAnyMeshCoreSourceType(s.type)) : isAnyMeshCoreSourceType(sources.find((s) => s.id === form.sourceId)?.type);
  return (
    <NumberInputScope scope={e.numberScope}>
      <SettingGroup title={e.editingId === 'new' ? t('settings.embed.create_title', 'Create Embed Profile') : `${t('workspace.server.edit')} · ${form.name}`}>
        <div className={styles.form} data-phone={isPhone || undefined}>
          <div className={styles.twoUp}>
            <Field label={t('settings.embed.name', 'Name')}>
              <input className={pages.keyInput} value={form.name} placeholder={t('settings.embed.name_placeholder', 'My Embed Map')} onChange={(ev) => setForm((prev) => ({ ...prev, name: ev.target.value }))} />
            </Field>
            <Field label={t('settings.embed.source', 'Source')}>
              <select className={pages.keyInput} value={form.sourceId ?? ''} onChange={(ev) => setForm((prev) => ({ ...prev, sourceId: ev.target.value === '' ? null : ev.target.value }))}>
                <option value="">{t('settings.embed.source_all', 'All sources')}</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <label className={styles.check}>
            <input type="checkbox" checked={form.enabled} onChange={(ev) => setForm((prev) => ({ ...prev, enabled: ev.target.checked }))} />
            {t('settings.embed.enabled', 'Enabled')}
          </label>
          <fieldset className={styles.fieldset}>
            <legend className={pages.infoLabel}>{t('settings.embed.channels', 'Channels')}</legend>
            <div className={styles.checkGrid}>
              {Array.from({ length: 8 }, (_, i) => (
                <label key={i} className={styles.check}>
                  <input type="checkbox" checked={form.channels.includes(i)} onChange={() => e.toggleChannel(i)} />
                  {t('settings.embed.channel_n', 'Channel {{n}}', { n: i })}
                </label>
              ))}
            </div>
            {meshcoreHint && <p className={pages.infoHelp}>{t('settings.embed.channels_meshcore_hint')}</p>}
          </fieldset>
          <div className={styles.twoUp}>
            <Field label={t('settings.embed.tileset', 'Map Tileset')}>
              <select className={pages.keyInput} value={form.tileset} onChange={(ev) => setForm((prev) => ({ ...prev, tileset: ev.target.value }))}>
                {e.tilesets.filter((ts) => !ts.isVector).map((ts) => (
                  <option key={ts.id} value={ts.id}>{ts.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('settings.embed.poll_interval', 'Poll Interval (seconds)')}>
              <NumberInput className={pages.keyInput} min={10} max={300} value={form.pollIntervalSeconds} onChange={(pollIntervalSeconds) => setForm((prev) => ({ ...prev, pollIntervalSeconds }))} />
            </Field>
          </div>
          <fieldset className={styles.fieldset}>
            <legend className={pages.infoLabel}>{t('settings.embed.features', 'Feature Toggles')}</legend>
            <div className={styles.checkGrid}>
              {FEATURES.map(([key, labelKey, fallback]) => (
                <label key={key} className={styles.check}>
                  <input type="checkbox" checked={form[key] as boolean} onChange={(ev) => setForm((prev) => ({ ...prev, [key]: ev.target.checked }))} />
                  {t(labelKey, fallback)}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t('settings.embed.allowed_origins', 'Allowed Origins')} help={t('settings.embed.allowed_origins_help', 'Comma-separated URLs that may embed this map. Leave blank to allow any origin.')}>
            <input className={pages.keyInput} value={e.originsText} placeholder="https://example.com, https://*.example.com" onChange={(ev) => e.setOriginsText(ev.target.value)} />
          </Field>
          {e.originsValidation.length > 0 && (
            <div className={styles.tags}>
              {e.originsValidation.map(({ origin, valid }, i) => (
                <span key={i} className={pages.chip} data-tone={valid ? 'on' : undefined} data-invalid={!valid || undefined}>
                  {!valid && <UiIcon name="error" size={12} />}
                  {origin}
                </span>
              ))}
            </div>
          )}
          <div className={styles.dock}>
            <span className={pages.infoHelp}>{t('workspace.server.embed_dock')}</span>
            <button type="button" className={pages.button} onClick={e.closeModal}>{t('settings.embed.cancel_btn', 'Cancel')}</button>
            <button type="button" className={`${pages.button} ${pages.primary}`} disabled={e.numberScope.invalid} onClick={() => void e.handleSave()}>
              {t('workspace.server.save_profile')}
            </button>
          </div>
        </div>
      </SettingGroup>
    </NumberInputScope>
  );
}

/** Today's centre and zoom picker: a click sets the centre, zooming sets the zoom. */
function Preview({ e }: { e: Embed }) {
  const { t } = useTranslation();
  const { form, setForm } = e;
  return (
    <SettingGroup title={t('workspace.server.preview')}>
      <div className={styles.mapFrame} data-testid="embed-preview">
        <BaseMap center={[form.defaultLat, form.defaultLng]} zoom={form.defaultZoom} scrollWheelZoom>
          <PickCentre onPick={(lat, lng) => setForm((prev) => ({ ...prev, defaultLat: lat, defaultLng: lng }))} onZoom={(zoom) => setForm((prev) => ({ ...prev, defaultZoom: zoom }))} />
          <FollowCentre lat={form.defaultLat} lng={form.defaultLng} />
          <Marker position={[form.defaultLat, form.defaultLng]} />
        </BaseMap>
      </div>
      <p className={styles.cardPara}>
        {t('settings.embed.map_center_help', 'Click the map to set the center. Zoom with scroll or controls.')} {t('settings.embed.lat', 'Lat')}: {form.defaultLat} · {t('settings.embed.lng', 'Lng')}: {form.defaultLng} · {t('settings.embed.zoom', 'Zoom')}: {form.defaultZoom}
      </p>
    </SettingGroup>
  );
}

function PickCentre({ onPick, onZoom }: { onPick(lat: number, lng: number): void; onZoom(zoom: number): void }) {
  useMapEvents({
    click(ev) {
      onPick(Math.round(ev.latlng.lat * 1e6) / 1e6, Math.round(ev.latlng.lng * 1e6) / 1e6);
    },
    zoomend(ev) {
      onZoom(ev.target.getZoom());
    },
  });
  return null;
}

function FollowCentre({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

function EmbedCode({ e, profileId }: { e: Embed; profileId: string }) {
  const { t } = useTranslation();
  const snippet = e.buildIframeSnippet(profileId);
  return (
    <SettingGroup title={t('workspace.server.embed_code')}>
      <div className={styles.form}>
        <p className={pages.infoHelp}>{t('settings.embed.embed_code_help', 'Copy this HTML snippet and paste it into your website.')}</p>
        <textarea className={styles.codeBox} readOnly rows={3} value={snippet} aria-label={t('workspace.server.embed_code')} onClick={(ev) => (ev.target as HTMLTextAreaElement).select()} />
        <div className={styles.formActions}>
          {e.copyProfileId && <button type="button" className={pages.button} onClick={e.closeCodeModal}>{t('settings.embed.close_btn', 'Close')}</button>}
          <button type="button" className={`${pages.button} ${pages.primary}`} onClick={() => void e.copyToClipboard(snippet)}>
            <UiIcon name="copy" size={16} />
            {t('workspace.server.copy')}
          </button>
        </div>
      </div>
    </SettingGroup>
  );
}
