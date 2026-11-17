import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMapEvents, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BaseMap } from '../map/BaseMap';
import mapFrame from '../map/EmbeddedMapFrame.module.css';
import { NumberInput } from '../common/NumberInput';
import { NumberInputScope } from '../common/NumberInputScope';
import { isAnyMeshCoreSourceType } from '../../utils/nodeTypeCategory';
import { EmbedDialogContent } from './EmbedDialogContent';
import { UiIcon } from '../icons';
import { useEmbedProfiles, type ProfileFormData } from './useEmbedProfiles';
import './EmbedSettings.css';

// ---------------------------------------------------------------------------
// Mini-map sub-components for picking center/zoom
// ---------------------------------------------------------------------------

interface MapClickHandlerProps {
  onLocationPick: (lat: number, lng: number) => void;
  onZoomChange: (zoom: number) => void;
}

function MapClickHandler({ onLocationPick, onZoomChange }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onLocationPick(
        Math.round(e.latlng.lat * 1e6) / 1e6,
        Math.round(e.latlng.lng * 1e6) / 1e6,
      );
    },
    zoomend(e) {
      onZoomChange(e.target.getZoom());
    },
  });
  return null;
}

interface MapCenterUpdaterProps {
  lat: number;
  lng: number;
}

function MapCenterUpdater({ lat, lng }: MapCenterUpdaterProps) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const EmbedSettings = () => {
  const { t } = useTranslation();
  const {
    sources,
    profiles,
    loading,
    editingId,
    form,
    setForm,
    numberScope,
    originsText,
    setOriginsText,
    copyProfileId,
    setCopyProfileId,
    tilesets,
    openCreate,
    openEdit,
    closeModal,
    closeCodeModal,
    toggleChannel,
    originsValidation,
    handleSave,
    deleteProfile,
    buildIframeSnippet,
    copyToClipboard,
  } = useEmbedProfiles();

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('settings.embed.delete_confirm', 'Are you sure you want to delete this embed profile?'))) {
      return;
    }
    await deleteProfile(id);
  };

  // ---- Render ----

  if (loading) {
    return <p>{t('settings.embed.loading', 'Loading embed profiles...')}</p>;
  }

  return (
    <NumberInputScope scope={numberScope}>
    <div className="embed-settings">
      <p className="setting-description">
        {t('settings.embed.description', 'Create embed profiles to share interactive maps on external websites via iframe.')}
      </p>

      <button className="settings-button settings-button-primary" onClick={openCreate}>
        {t('settings.embed.add_profile', '+ New Embed Profile')}
      </button>

      {profiles.length === 0 ? (
        <p className="setting-description" style={{ marginTop: '1rem' }}>{t('settings.embed.none', 'No embed profiles yet.')}</p>
      ) : (
        <table className="embed-table">
          <thead>
            <tr>
              <th>{t('settings.embed.col_name', 'Name')}</th>
              <th className="embed-table-center">{t('settings.embed.col_enabled', 'Enabled')}</th>
              <th className="embed-table-actions">{t('settings.embed.col_actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="embed-table-center">
                  {p.enabled
                    ? <span className="embed-status-enabled">{t('settings.embed.yes', 'Yes')}</span>
                    : <span className="embed-status-disabled">{t('settings.embed.no', 'No')}</span>}
                </td>
                <td className="embed-table-actions">
                  <button className="settings-button" onClick={() => openEdit(p)}>
                    {t('settings.embed.edit_btn', 'Edit')}
                  </button>
                  <button className="settings-button" onClick={() => setCopyProfileId(p.id)}>
                    {t('settings.embed.copy_embed', 'Embed Code')}
                  </button>
                  <button className="settings-button embed-button-danger" onClick={() => handleDelete(p.id)}>
                    {t('settings.embed.delete_btn', 'Delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Security info */}
      <div className="embed-info-box">
        <strong>{t('settings.embed.security_note_title', 'Security Note')}</strong>
        <p>
          {t(
            'settings.embed.security_note',
            'Embed maps are served using the anonymous user permissions. Make sure the anonymous user has read access to the channels you want to display. If anonymous access is disabled, embed maps will not work.'
          )}
        </p>
      </div>

      {/* ===== Create/Edit Modal ===== */}
      {editingId !== null && (
        <div className="modal-overlay" onClick={closeModal} role="presentation">
          <EmbedDialogContent className="modal-content embed-modal" labelledBy="embed-profile-dialog-title" onClose={closeModal}>
            <div className="modal-header">
              <h2 id="embed-profile-dialog-title">{editingId === 'new' ? t('settings.embed.create_title', 'Create Embed Profile') : t('settings.embed.edit_title', 'Edit Embed Profile')}</h2>
              <button type="button" className="modal-close" onClick={closeModal} aria-label={t('common.close', 'Close')}><UiIcon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              {/* Name */}
              <div className="setting-item">
                <label htmlFor="embed-name">{t('settings.embed.name', 'Name')}</label>
                <input
                  id="embed-name"
                  className="setting-input embed-input-wide"
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('settings.embed.name_placeholder', 'My Embed Map')}
                />
              </div>

              {/* Enabled */}
              <div className="setting-item">
                <label className="embed-checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span>{t('settings.embed.enabled', 'Enabled')}</span>
                </label>
              </div>

              {/* Channels */}
              <div className="setting-item">
                <label>{t('settings.embed.channels', 'Channels')}</label>
                <div className="embed-grid">
                  {Array.from({ length: 8 }, (_, i) => (
                    <label key={i} className="embed-checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.channels.includes(i)}
                        onChange={() => toggleChannel(i)}
                      />
                      <span>{t('settings.embed.channel_n', 'Channel {{n}}', { n: i })}</span>
                    </label>
                  ))}
                </div>
                {/* #5999: the channel list is Meshtastic-only. */}
                {(form.sourceId === null
                  ? sources.some(s => isAnyMeshCoreSourceType(s.type))
                  : isAnyMeshCoreSourceType(sources.find(s => s.id === form.sourceId)?.type)) && (
                  <p className="setting-description" data-testid="embed-channels-meshcore-hint">
                    {t('settings.embed.channels_meshcore_hint', 'MeshCore nodes have no channel, so this filter applies only to Meshtastic nodes. MeshCore nodes with a position always show.')}
                  </p>
                )}
              </div>

              {/* Source filter — null = all sources */}
              <div className="setting-item">
                <label htmlFor="embed-source">
                  {t('settings.embed.source', 'Source')}
                </label>
                <select
                  id="embed-source"
                  className="setting-input embed-input-wide"
                  value={form.sourceId ?? ''}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      sourceId: e.target.value === '' ? null : e.target.value,
                    }))
                  }
                >
                  <option value="">
                    {t('settings.embed.source_all', 'All sources')}
                  </option>
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tileset */}
              <div className="setting-item">
                <label htmlFor="embed-tileset">{t('settings.embed.tileset', 'Map Tileset')}</label>
                <select
                  id="embed-tileset"
                  className="setting-input embed-input-wide"
                  value={form.tileset}
                  onChange={e => setForm(prev => ({ ...prev, tileset: e.target.value }))}
                >
                  {tilesets.filter(ts => !ts.isVector).map(ts => (
                    <option key={ts.id} value={ts.id}>{ts.name}</option>
                  ))}
                </select>
              </div>

              {/* Map picker for center + zoom */}
              <div className="setting-item">
                <label>{t('settings.embed.map_center', 'Default Map Center & Zoom')}</label>
                <p className="setting-description">
                  {t('settings.embed.map_center_help', 'Click the map to set the center. Zoom with scroll or controls.')}
                </p>
                <div className={`embed-map-picker ${mapFrame.frame}`} data-testid="embed-map-frame">
                  <BaseMap
                    center={[form.defaultLat, form.defaultLng]}
                    zoom={form.defaultZoom}
                    scrollWheelZoom
                  >
                    <MapClickHandler
                      onLocationPick={(lat, lng) => setForm(prev => ({ ...prev, defaultLat: lat, defaultLng: lng }))}
                      onZoomChange={(zoom) => setForm(prev => ({ ...prev, defaultZoom: zoom }))}
                    />
                    <MapCenterUpdater lat={form.defaultLat} lng={form.defaultLng} />
                    <Marker position={[form.defaultLat, form.defaultLng]} />
                  </BaseMap>
                </div>
                <div className="embed-map-coords">
                  <span>{t('settings.embed.lat', 'Lat')}: <strong>{form.defaultLat}</strong></span>
                  <span>{t('settings.embed.lng', 'Lng')}: <strong>{form.defaultLng}</strong></span>
                  <span>{t('settings.embed.zoom', 'Zoom')}: <strong>{form.defaultZoom}</strong></span>
                </div>
              </div>

              {/* Feature toggles */}
              <div className="setting-item">
                <label>{t('settings.embed.features', 'Feature Toggles')}</label>
                <div className="embed-grid">
                  {([
                    ['showTooltips', t('settings.embed.show_tooltips', 'Show Tooltips')],
                    ['showPopups', t('settings.embed.show_popups', 'Show Popups')],
                    ['showLegend', t('settings.embed.show_legend', 'Show Legend')],
                    ['showPaths', t('settings.embed.show_paths', 'Show Paths')],
                    ['showNeighborInfo', t('settings.embed.show_neighbor_info', 'Show Neighbor Info')],
                    ['showTraceroutes', t('settings.embed.show_traceroutes', 'Show Traceroutes (exposes mesh topology)')],
                    ['showMqttNodes', t('settings.embed.show_mqtt_nodes', 'Show MQTT Nodes')],
                  ] as [keyof ProfileFormData, string][]).map(([key, label]) => (
                    <label key={key} className="embed-checkbox-label">
                      <input
                        type="checkbox"
                        checked={form[key] as boolean}
                        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.checked }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Poll interval */}
              <div className="setting-item">
                <label htmlFor="embed-poll">{t('settings.embed.poll_interval', 'Poll Interval (seconds)')}</label>
                <NumberInput
                  id="embed-poll"
                  className="setting-input"
                  min={10}
                  max={300}
                  value={form.pollIntervalSeconds}
                  onChange={pollIntervalSeconds => setForm(prev => ({ ...prev, pollIntervalSeconds }))}
                />
              </div>

              {/* Allowed origins */}
              <div className="setting-item">
                <label htmlFor="embed-origins">{t('settings.embed.allowed_origins', 'Allowed Origins')}</label>
                <p className="setting-description">
                  {t('settings.embed.allowed_origins_help', 'Comma-separated URLs that may embed this map. Leave blank to allow any origin.')}
                </p>
                <input
                  id="embed-origins"
                  className="setting-input embed-input-wide"
                  type="text"
                  value={originsText}
                  onChange={e => setOriginsText(e.target.value)}
                  placeholder="https://example.com, https://*.example.com"
                />
                {originsValidation.length > 0 && (
                  <div className="embed-origins-validation">
                    {originsValidation.map(({ origin, valid }, i) => (
                      <span key={i} className={`embed-origin-tag ${valid ? 'valid' : 'invalid'}`}>
                        {origin}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Security note */}
              <div className="embed-info-box">
                <strong>{t('settings.embed.security_note_title', 'Security Note')}</strong>
                <p>
                  {t(
                    'settings.embed.security_note',
                    'Embed maps are served using the anonymous user permissions. Make sure the anonymous user has read access to the channels you want to display. If anonymous access is disabled, embed maps will not work.'
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="settings-buttons">
                <button className="settings-button settings-button-primary" onClick={handleSave} disabled={numberScope.invalid}>
                  {editingId === 'new' ? t('settings.embed.create_btn', 'Create') : t('settings.embed.save_btn', 'Save')}
                </button>
                <button className="settings-button" onClick={closeModal}>
                  {t('settings.embed.cancel_btn', 'Cancel')}
                </button>
              </div>
            </div>
          </EmbedDialogContent>
        </div>
      )}

      {/* ===== Embed Code Modal ===== */}
      {copyProfileId && (
        <div className="modal-overlay" onClick={closeCodeModal} role="presentation">
          <EmbedDialogContent className="modal-content" labelledBy="embed-code-dialog-title" onClose={closeCodeModal}>
            <div className="modal-header">
              <h2 id="embed-code-dialog-title">{t('settings.embed.embed_code_title', 'Embed Code')}</h2>
              <button type="button" className="modal-close" onClick={closeCodeModal} aria-label={t('common.close', 'Close')}><UiIcon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="setting-description">
                {t('settings.embed.embed_code_help', 'Copy this HTML snippet and paste it into your website.')}
              </p>
              <textarea
                className="embed-code-textarea"
                readOnly
                rows={3}
                value={buildIframeSnippet(copyProfileId)}
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
              <div className="settings-buttons">
                <button className="settings-button settings-button-primary" onClick={() => copyToClipboard(buildIframeSnippet(copyProfileId))}>
                  {t('settings.embed.copy_btn', 'Copy to Clipboard')}
                </button>
                <button className="settings-button" onClick={closeCodeModal}>
                  {t('settings.embed.close_btn', 'Close')}
                </button>
              </div>
            </div>
          </EmbedDialogContent>
        </div>
      )}
    </div>
    </NumberInputScope>
  );
};

export default EmbedSettings;
