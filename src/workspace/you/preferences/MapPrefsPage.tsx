/**
 * You › Preferences › Map (boards 13-04 desktop, 13-21 phone; Task 6.3):
 * today's Map section of global Settings, the per-viewer part, saving as you
 * go.
 *
 * - Tilesets follow the viewer (You's note: "Map style is the one
 *   exception"): each choice is today's `setMapTilesets`, which keeps it in
 *   this browser and in `user_map_preferences` (`POST
 *   /api/user/map-preferences`, as the map's tileset picker does). A viewer
 *   who may write settings also writes the install's key, as global
 *   Settings' Save did.
 * - Lines and zoom, clicks and clusters: today's keys to `POST
 *   /api/settings`, fanned out to SettingsContext (settings:write).
 * - Desktop preview: BaseMap with the current tileset, at the click zoom gate.
 * - Admins: one row to Server › Map & tiles, today's re-hosted Map section
 *   (custom tilesets, GeoJSON layers, map styles, Carto key, default map
 *   centre, embed maps) until Task 6.4 redraws it (s13n0).
 *
 * Nothing here transmits.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { BaseMap } from '../../../components/map/BaseMap';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings, type PositionHistoryLineStyle } from '../../../contexts/SettingsContext';
import { getAllTilesets, type TilesetId } from '../../../config/tilesets';
import apiService from '../../../services/api';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingRow from '../../settings/kit/SettingRow';
import SettingSelect from '../../settings/kit/SettingSelect';
import { AutoNumber, AutoSelect, AutoToggle, SavedLine } from '../../settings/categories/autosave';
import { useAutosaveValue } from '../../settings/useAutosaveSetting';
import { useIsPhone } from '../../shell/useIsPhone';
import PrefsFrame from './PrefsFrame';
import { int, on01, onText, text, useCanWriteSettings } from './prefValues';
import styles from './Preferences.module.css';

export default function MapPrefsPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const s = useSettings();
  const { authStatus } = useAuth();
  const isAdmin = authStatus?.authenticated === true && authStatus.user?.isAdmin === true;

  return (
    <PrefsFrame categoryId="map" title={t('settings.map')} icon="map" scope={t('workspace.prefs.scope_map')}>
      <div className={styles.columns} data-phone={isPhone || undefined}>
        <div className={styles.column}>
          <SettingGroup title={t('workspace.prefs.tilesets')}>
            <TilesetRow mode="dark" />
            <TilesetRow mode="light" />
          </SettingGroup>
          <SettingGroup title={t('workspace.prefs.lines_zoom')}>
            <AutoSelect
              stacked
              k="positionHistoryLineStyle"
              id="map.positionHistoryLineStyle"
              label={t('settings.position_history_line_style_label')}
              help={t('settings.position_history_line_style_description')}
              options={[
                { value: 'linear', label: t('settings.position_history_line_style_linear') },
                { value: 'spline', label: t('settings.position_history_line_style_spline') },
              ]}
              parse={text(s.positionHistoryLineStyle)}
              onSaved={(v) => s.setPositionHistoryLineStyle(v as PositionHistoryLineStyle)}
            />
            <AutoNumber
              k="neighborInfoMinZoom"
              id="map.neighborInfoMinZoom"
              label={t('settings.neighbor_info_min_zoom_label')}
              help={t('settings.neighbor_info_min_zoom_description')}
              min={1}
              max={18}
              parse={int(s.neighborInfoMinZoom)}
              onSaved={s.setNeighborInfoMinZoom}
            />
            <AutoNumber
              k="mapCenterTargetZoom"
              id="map.mapCenterTargetZoom"
              label={t('settings.map_center_target_zoom_label')}
              help={t('settings.map_center_target_zoom_description')}
              min={1}
              max={18}
              parse={int(s.mapCenterTargetZoom)}
              onSaved={s.setMapCenterTargetZoom}
            />
          </SettingGroup>
        </div>
        <div className={styles.column}>
          <SettingGroup title={t('workspace.prefs.clicks_clusters')}>
            <AutoNumber
              k="mapZoomGateThreshold"
              id="map.mapZoomGateThreshold"
              label={t('settings.map_zoom_gate_threshold_label')}
              help={t('settings.map_zoom_gate_threshold_description')}
              // #4551: 0 is a real value ("never gate").
              min={0}
              max={18}
              parse={int(s.mapZoomGateThreshold)}
              onSaved={s.setMapZoomGateThreshold}
            />
            <AutoToggle
              k="mapClusteringEnabled"
              id="map.mapClusteringEnabled"
              label={t('settings.map_clustering_enabled_label')}
              help={t('settings.map_clustering_enabled_description')}
              {...onText(s.mapClusteringEnabled)}
              onSaved={s.setMapClusteringEnabled}
            />
            <AutoToggle
              k="discardInvalidPositions"
              id="map.discardInvalidPositions"
              label={t('settings.discard_invalid_positions', 'Discard invalid positions')}
              help={t(
                'settings.discard_invalid_positions_description',
                'When enabled (default), GPS fixes at Null Island (0,0) — including precision-obscured ones — are discarded on ingest across all sources. Disable to store (0,0) reports as received so you can see which nodes transmit them. Out-of-range / garbage coordinates are always discarded.',
              )}
              {...on01(s.discardInvalidPositions)}
              onSaved={s.setDiscardInvalidPositions}
            />
          </SettingGroup>
          {!isPhone && <Preview />}
          {isAdmin && (
            <SettingGroup>
              <Link to="/server/map" className={styles.rowLink}>
                <span className={styles.rowIcon}>
                  <UiIcon name="server" size={18} />
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t('workspace.prefs.map_tiles')}</span>
                  <span className={styles.rowSub}>{t('workspace.prefs.map_tiles_desc')}</span>
                </span>
                <UiIcon name="chevronRight" size={18} />
              </Link>
            </SettingGroup>
          )}
          <p className={styles.note}>
            <UiIcon name="info" size={16} />
            <span>{t('workspace.prefs.tilesets_note')}</span>
          </p>
        </div>
      </div>
    </PrefsFrame>
  );
}

/** One appearance's tileset: today's per-user save, plus the install key for settings writers. */
function TilesetRow({ mode }: { mode: 'dark' | 'light' }) {
  const { t } = useTranslation();
  const s = useSettings();
  const canWrite = useCanWriteSettings();
  const current = mode === 'dark' ? s.mapTilesetDark : s.mapTilesetLight;
  const [value, set, status] = useAutosaveValue<string>(current, {
    commit: 'change',
    same: (v) => v === current,
    write: async (v) => {
      const id = v as TilesetId;
      if (canWrite) await apiService.post('/api/settings', { [mode === 'dark' ? 'mapTilesetDark' : 'mapTilesetLight']: id });
      await (mode === 'dark' ? s.setMapTilesets(s.mapTilesetLight, id) : s.setMapTilesets(id, s.mapTilesetDark));
    },
  });
  const key = mode === 'dark' ? 'map_tileset_dark' : 'map_tileset_light';
  return (
    <SettingRow stacked id={`map.${mode === 'dark' ? 'mapTilesetDark' : 'mapTilesetLight'}`} label={t(`settings.${key}_label`)} help={t(`settings.${key}_description`)}>
      <SavedLine status={status} />
      <SettingSelect
        value={value}
        readOnly={false}
        onChange={set}
        options={getAllTilesets(s.customTilesets).map((ts) => ({
          value: ts.id,
          label: `${ts.name}${ts.description ? ` - ${ts.description}` : ''}${ts.isCustom ? ' [Custom]' : ''}`,
        }))}
      />
    </SettingRow>
  );
}

/** 13-04's preview: today's tileset at the click zoom gate, around the default map centre (else the world). */
function Preview() {
  const { t } = useTranslation();
  const s = useSettings();
  const centred = s.defaultMapCenterLat !== null && s.defaultMapCenterLon !== null;
  const zoom = centred ? Math.max(1, s.mapZoomGateThreshold || s.defaultMapCenterZoom || 10) : 2;
  const center: [number, number] = centred ? [s.defaultMapCenterLat!, s.defaultMapCenterLon!] : [20, 0];
  const name = getAllTilesets(s.customTilesets).find((ts) => ts.id === s.mapTileset)?.name ?? s.mapTileset;
  return (
    <SettingGroup title={t('workspace.prefs.preview')}>
      <div className={styles.preview}>
        <BaseMap
          key={`${s.mapTileset}:${zoom}`}
          center={center}
          zoom={zoom}
          tilesetId={s.mapTileset}
          customTilesets={s.customTilesets}
          cartoApiKey={s.cartoApiKey}
          styleJson={s.activeStyleJson ?? undefined}
          scrollWheelZoom={false}
          zoomControl={false}
        />
        <span className={styles.previewCaption}>{t('workspace.prefs.preview_caption', { tileset: name, zoom })}</span>
      </div>
    </SettingGroup>
  );
}
