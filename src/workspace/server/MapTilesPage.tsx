/**
 * Server › Map & tiles (boards 13-05 desktop, 13-22 phone). One page for two
 * gates (s13n2 and Task 6.3's I1): the custom tile servers, GeoJSON layers
 * and map styles need settings:write, as their routes do, so a non-admin
 * writer reaches them here (You › Map's "Map & tiles" row); the Carto key and
 * the default map centre are admins only, as today.
 *
 * - Custom tile servers: today's CustomTilesetManager form and list through
 *   `useCustomTilesetForm` (Rule X): Test, Autodetect, validation, today's
 *   reload notice after a save. Delete asks with today's words.
 * - GeoJSON layers: today's list and controls through `useGeoJsonLayers`
 *   (visible, public, no click popup, colour, name, opacity, fill, width).
 * - Map styles: today's list, Activate and imports through `useMapStyles`.
 * - Keys and defaults (admins): the Carto key keeps its own Save (s13n1);
 *   the default map centre is picked on a BaseMap in a sheet and saved as
 *   today's three keys in one `POST /api/settings`.
 *
 * Mesh impact: none. Tile tests and imports are browser or server requests.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMapEvents } from 'react-leaflet';
import { useQueryClient } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import { NumberInput } from '../../components/common/NumberInput';
import { NumberInputScope } from '../../components/common/NumberInputScope';
import { BaseMap } from '../../components/map/BaseMap';
import { useCustomTilesetForm } from '../../components/useCustomTilesetForm';
import { useGeoJsonLayers } from '../../components/useGeoJsonLayers';
import { useMapStyles } from '../../components/useMapStyles';
import { isVectorTileUrl, validateTileUrl } from '../../config/tilesets';
import { useSettings } from '../../contexts/SettingsContext';
import apiService from '../../services/api';
import { formatTileSize } from '../../utils/tileServerTest';
import ConfirmSheet from '../patterns/ConfirmSheet';
import RowMenu from '../patterns/RowMenu';
import Sheet from '../patterns/Sheet';
import SettingGroup from '../settings/kit/SettingGroup';
import SettingRow from '../settings/kit/SettingRow';
import { SavedLine } from '../settings/categories/autosave';
import { serverSettingsKey, useAutosaveValue, useServerSettings } from '../settings/useAutosaveSetting';
import { useIsPhone } from '../shell/useIsPhone';
import RowSwitch from './RowSwitch';
import SaveField from './SaveField';
import Field from './Field';
import ServerFrame from './ServerFrame';
import { useServerAccess } from './serverEntries';
import pages from '../settings/categories/SettingsPages.module.css';
import prefs from '../you/preferences/Preferences.module.css';
import styles from './Server.module.css';

export default function MapTilesPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { isAdmin } = useServerAccess();
  return (
    <ServerFrame categoryId="map" title={t('workspace.server.nav.map')} scope={t('workspace.server.scope_everyone')} icon="map" gate="write">
      <div className={prefs.columns} data-phone={isPhone || undefined}>
        <div className={prefs.column}>
          <TileServers />
        </div>
        <div className={prefs.column}>
          <GeoJsonLayers />
          <MapStyles />
          {isAdmin && <KeysAndDefaults />}
        </div>
      </div>
    </ServerFrame>
  );
}

/** An inline failure under a group (today's `alert()` words). */
function useReport() {
  const [error, setError] = useState<string | null>(null);
  const line = error && (
    <p className={`${pages.error} ${styles.groupError}`} role="alert">
      <UiIcon name="alert" size={14} /> {error}
    </p>
  );
  return { report: setError, clear: () => setError(null), line };
}

function TileServers() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { report, clear, line } = useReport();
  const f = useCustomTilesetForm(report);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formOpen = f.isAdding || !!f.editingId;
  const set = (patch: Partial<typeof f.formData>) => f.setFormData({ ...f.formData, ...patch });
  const probing = f.isTesting || f.isAutodetecting;
  // s13n5: Test URL also finds the format. A tile URL is tested as today; a server address is
  // autodetected first (today's Autodetect), and the URL picked from its results is then tested.
  const testOrDetect = () => {
    const url = f.formData.url.trim();
    if (validateTileUrl(url).valid) void f.testUrl(url);
    else void f.autodetectFrom(url);
  };
  const use = (url: string) => {
    f.handleSelectAutodetectedUrl(url);
    void f.testUrl(url);
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await f.deleteCustomTileset(deleting);
      setDeleting(null);
    } catch {
      // Today's words; the sheet stays for a retry.
      throw new Error(t('tileset_manager.delete_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingGroup title={t('tileset_manager.title')}>
      <p className={styles.cardPara}>
        {t('tileset_manager.description')}{' '}
        <a href="https://meshmonitor.org/features/maps" target="_blank" rel="noopener noreferrer" className={prefs.link}>
          {t('tileset_manager.setup_guide')}
        </a>
      </p>
      {f.showReloadNotice && (
        <div className={styles.notice}>
          <UiIcon name="refresh" size={16} />
          <span>{t('tileset_manager.reload_required')}</span>
          <button type="button" className={pages.button} onClick={() => window.location.reload()}>{t('tileset_manager.reload_now')}</button>
          <button type="button" className={pages.iconButton} aria-label={t('common.dismiss')} title={t('common.dismiss')} onClick={() => f.setShowReloadNotice(false)}>
            <UiIcon name="close" size={16} />
          </button>
        </div>
      )}
      {!formOpen && f.customTilesets.length === 0 && (
        <p className={styles.cardPara}>
          {t('tileset_manager.no_tilesets')} {t('tileset_manager.no_tilesets_hint')}
        </p>
      )}
      {!f.editingId &&
        f.customTilesets.map((ts) => {
          const vector = ts.isVector ?? isVectorTileUrl(ts.url);
          return (
            <div key={ts.id} className={pages.infoRow} data-testid="custom-tileset">
              <div className={pages.infoText}>
                <span className={pages.infoLabel}>
                  {ts.name} <span className={pages.chip}>{vector ? t('tileset_manager.vector') : t('tileset_manager.raster')}</span>
                </span>
                <code className={styles.code}>{ts.url}</code>
                {ts.description && <span className={pages.infoHelp}>{ts.description}</span>}
                <span className={pages.infoHelp}>
                  {t('tileset_manager.max_zoom')}: {ts.maxZoom} · {t('tileset_manager.attribution')}: {ts.attribution}
                </span>
              </div>
              <button type="button" className={pages.iconButton} aria-label={`${t('common.edit')} ${ts.name}`} title={t('common.edit')} disabled={f.isSaving} onClick={() => f.handleEdit(ts)}>
                <UiIcon name="edit" size={18} />
              </button>
              <button type="button" className={pages.iconButton} aria-label={`${t('common.delete')} ${ts.name}`} title={t('common.delete')} disabled={f.isSaving} onClick={() => setDeleting(ts.id)}>
                <UiIcon name="delete" size={18} />
              </button>
            </div>
          );
        })}
      {formOpen && (
        <NumberInputScope scope={f.numberScope}>
          <form
            className={styles.form}
            data-phone={isPhone || undefined}
            onSubmit={(e) => {
              clear();
              void f.handleSubmit(e);
            }}
          >
            <h3 className={styles.subTitle}>{f.editingId ? t('tileset_manager.edit_form_title') : t('tileset_manager.add_form_title')}</h3>
            <Field label={t('tileset_manager.field_name')} help={t('tileset_manager.name_help')}>
              <input className={pages.keyInput} value={f.formData.name} maxLength={100} required disabled={f.isSaving} placeholder={t('tileset_manager.name_placeholder')} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label={t('tileset_manager.field_url')} help={`${t('tileset_manager.url_help')} ${t('workspace.server.test_url_help')}`}>
              <span className={styles.fieldLine}>
                <input
                  className={pages.keyInput}
                  value={f.formData.url}
                  maxLength={500}
                  required
                  disabled={f.isSaving || f.isTesting}
                  aria-invalid={f.urlValidation && !f.urlValidation.valid ? true : undefined}
                  placeholder="https://example.com/{z}/{x}/{y}.png"
                  onChange={(e) => f.handleUrlChange(e.target.value)}
                />
                <button type="button" className={pages.button} title={t('tileset_manager.test_button_title')} disabled={f.isSaving || probing || !f.formData.url.trim()} onClick={testOrDetect}>
                  {f.isAutodetecting ? t('tileset_manager.autodetecting') : f.isTesting ? t('tileset_manager.testing') : t('workspace.server.test_url')}
                </button>
              </span>
            </Field>
            {f.urlValidation?.error && <p className={f.urlValidation.valid ? pages.warn : pages.error}>{f.urlValidation.error}</p>}
            {f.testResult && (
              <div className={styles.result} data-ok={f.testResult.status === 'success' || undefined} role="status">
                <UiIcon name={f.testResult.status === 'success' ? 'check' : f.testResult.status === 'warning' ? 'alert' : 'error'} size={14} />
                <span>
                  {f.testResult.message}
                  {f.testResult.details.responseTime && ` (${f.testResult.details.responseTime}ms)`}
                  {f.testResult.details.tileSize &&
                    ` · ${t('tileset_manager.test_tile_type')}: ${f.testResult.tileType === 'vector' ? t('tileset_manager.vector') : t('tileset_manager.raster')} · ${t('tileset_manager.test_tile_size')}: ${formatTileSize(f.testResult.details.tileSize)}`}
                  {!!f.testResult.details.matchedLayers?.length && ` · ${t('tileset_manager.test_matched_layers')}: ${f.testResult.details.matchedLayers.join(', ')}`}
                  {!!f.testResult.details.missingLayers?.length && ` · ${t('tileset_manager.test_missing_layers')}: ${f.testResult.details.missingLayers.join(', ')}`}
                  {[...f.testResult.warnings, ...f.testResult.errors].map((m, i) => (
                    <span key={i} className={styles.block}>{m}</span>
                  ))}
                </span>
              </div>
            )}
            {f.isAutodetecting && f.autodetectProgress && (
              <p className={pages.infoHelp}>{t('tileset_manager.autodetect_testing', { current: f.autodetectProgress.current, total: f.autodetectProgress.total })}</p>
            )}
            {f.autodetectResult &&
              (f.autodetectResult.success ? (
                <>
                  <p className={styles.result} data-ok="">
                    <UiIcon name="check" size={14} /> {t('tileset_manager.autodetect_found', { count: f.autodetectResult.detectedUrls.length })}
                  </p>
                  {f.autodetectResult.detectedUrls.map((d, i) => (
                    <span key={i} className={styles.fieldLine}>
                      <span className={pages.chip}>{d.type === 'vector' ? t('tileset_manager.vector') : t('tileset_manager.raster')}</span>
                      <code className={styles.code}>{d.url}</code>
                      <button type="button" className={pages.button} onClick={() => use(d.url)}>{t('tileset_manager.use_this_url')}</button>
                    </span>
                  ))}
                </>
              ) : (
                <p className={styles.result} role="status">
                  <UiIcon name="error" size={14} /> {t('tileset_manager.autodetect_none_found')} {f.autodetectResult.errors.join(' ')}
                </p>
              ))}
            <p className={pages.infoHelp}>{t('tileset_manager.url_example_raster')}</p>
            <p className={pages.infoHelp}>{t('tileset_manager.url_example_vector')}</p>
            <Field label={t('tileset_manager.field_attribution')} help={t('tileset_manager.attribution_help')}>
              <input className={pages.keyInput} value={f.formData.attribution} maxLength={200} required disabled={f.isSaving} placeholder={t('tileset_manager.attribution_placeholder')} onChange={(e) => set({ attribution: e.target.value })} />
            </Field>
            <Field label={t('tileset_manager.field_max_zoom')} help={t('tileset_manager.max_zoom_help')}>
              <NumberInput className={pages.keyInput} value={f.formData.maxZoom} onChange={(maxZoom) => set({ maxZoom })} min={1} max={22} integer required disabled={f.isSaving} />
            </Field>
            <Field label={t('settings.custom_tileset_overlay_scheme')}>
              <select className={pages.keyInput} value={f.formData.overlayScheme} disabled={f.isSaving} onChange={(e) => set({ overlayScheme: e.target.value as 'light' | 'dark' })}>
                <option value="dark">{t('settings.overlay_scheme_dark')}</option>
                <option value="light">{t('settings.overlay_scheme_light')}</option>
              </select>
            </Field>
            <Field label={t('tileset_manager.field_description')} help={t('tileset_manager.description_help')}>
              <input className={pages.keyInput} value={f.formData.description} maxLength={200} disabled={f.isSaving} placeholder={t('tileset_manager.description_placeholder')} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            {line}
            <div className={styles.formActions}>
              <button type="button" className={pages.button} disabled={f.isSaving} onClick={f.handleCancel}>{t('common.cancel')}</button>
              <button type="submit" className={`${pages.button} ${pages.primary}`} disabled={f.isSaving || f.numberScope.invalid}>
                {f.isSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </NumberInputScope>
      )}
      {!formOpen && (
        <div className={styles.cardActions}>
          <button type="button" className={pages.button} disabled={f.isSaving} onClick={() => f.setIsAdding(true)}>
            <UiIcon name="plus" size={16} />
            {t('tileset_manager.add_button')}
          </button>
        </div>
      )}
      <ConfirmSheet
        open={deleting !== null}
        title={t('common.delete')}
        body={<p className={pages.para}>{t('tileset_manager.delete_confirm')}</p>}
        confirmLabel={t('common.delete')}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </SettingGroup>
  );
}

function GeoJsonLayers() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { report, line } = useReport();
  const g = useGeoJsonLayers(report);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [styling, setStyling] = useState<string | null>(null);
  // The layer as the server last answered, so each change in the sheet starts from it.
  const styled = g.layers.find((l) => l.id === styling);
  return (
    <SettingGroup title={t('workspace.server.geojson_layers')}>
      <p className={styles.cardPara}>{t('workspace.server.geojson_desc')}</p>
      {g.loading ? (
        <p className={styles.cardPara}>{t('common.loading')}</p>
      ) : g.layers.length === 0 ? (
        <p className={styles.cardPara}>{t('workspace.server.geojson_none')}</p>
      ) : (
        g.layers.map((layer) => (
          <div key={layer.id} className={styles.layerRow} data-phone={isPhone || undefined} data-testid="geojson-layer">
            <div className={styles.layerHead}>
              <span
                className={styles.swatch}
                aria-hidden="true"
                style={{ background: layer.style.color }}
              />
              <input
                className={`${pages.keyInput} ${styles.nameInput}`}
                aria-label={t('workspace.server.geojson_name')}
                value={layer.name}
                onChange={(e) => g.setLayers((prev) => prev.map((l) => (l.id === layer.id ? { ...l, name: e.target.value } : l)))}
                onBlur={(e) => void g.updateLayer(layer.id, { name: e.target.value })}
              />
              <span className={styles.switchText} title={t('workspace.server.geojson_public_hint')}>
                {layer.publiclyVisible ? t('workspace.server.geojson_public') : t('workspace.server.geojson_signed_in')}
              </span>
              <RowSwitch
                label={`${t('workspace.server.geojson_public')}: ${layer.name}`}
                checked={layer.publiclyVisible ?? false}
                onChange={(v) => void g.updateLayer(layer.id, { publiclyVisible: v })}
              />
              {/* s13n5: colour, opacity and no popup live in the row's ⋯ (with Visible, so nothing is lost). */}
              <RowMenu
                label={t('workspace.server.layer_actions', { name: layer.name })}
                items={[
                  { key: 'style', label: t('workspace.server.geojson_style'), icon: 'edit', onSelect: () => setStyling(layer.id) },
                  { key: 'visible', label: t('workspace.server.geojson_visible'), icon: 'visibility', checked: layer.visible, onSelect: () => void g.updateLayer(layer.id, { visible: !layer.visible }) },
                  { key: 'popup', label: t('workspace.server.geojson_no_popup'), icon: 'blocked', hint: t('workspace.server.geojson_no_popup_hint'), checked: layer.disablePopup ?? false, onSelect: () => void g.updateLayer(layer.id, { disablePopup: !(layer.disablePopup ?? false) }) },
                  { key: 'delete', label: t('common.delete'), icon: 'delete', danger: true, onSelect: () => setDeleting({ id: layer.id, name: layer.name }) },
                ]}
              />
            </div>
          </div>
        ))
      )}
      {line}
      <div className={styles.cardActions}>
        <input
          ref={g.fileInputRef}
          type="file"
          accept=".geojson,.json,.kml,.kmz"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void g.handleUpload(file);
          }}
        />
        <button type="button" className={pages.button} disabled={g.uploading} onClick={() => g.fileInputRef.current?.click()}>
          <UiIcon name="upload" size={16} />
          {g.uploading ? t('workspace.server.uploading') : t('workspace.server.geojson_upload')}
        </button>
      </div>
      {styled && (
        <Sheet open onClose={() => setStyling(null)} title={`${t('workspace.server.geojson_style')} · ${styled.name}`}>
          <div className={styles.sheetBody} data-phone={isPhone || undefined}>
            <label className={styles.check}>
              {t('workspace.server.geojson_colour')}
              <input
                type="color"
                className={styles.colour}
                value={styled.style.color}
                onChange={(e) => void g.updateLayer(styled.id, { style: { ...styled.style, color: e.target.value } })}
              />
            </label>
            <Range label={t('workspace.server.geojson_opacity')} value={styled.style.opacity} onChange={(v) => void g.updateLayer(styled.id, { style: { ...styled.style, opacity: v } })} />
            <Range label={t('workspace.server.geojson_fill_opacity')} value={styled.style.fillOpacity} onChange={(v) => void g.updateLayer(styled.id, { style: { ...styled.style, fillOpacity: v } })} />
            <label className={styles.check}>
              {t('workspace.server.geojson_width')}
              <NumberInput className={`${pages.keyInput} ${styles.small}`} min={1} max={10} integer value={styled.style.weight} onChange={(weight) => void g.updateLayer(styled.id, { style: { ...styled.style, weight } })} />
            </label>
            <p className={pages.infoHelp}>{t('workspace.server.geojson_style_note')}</p>
          </div>
        </Sheet>
      )}
      <ConfirmSheet
        open={deleting !== null}
        title={t('common.delete')}
        body={<p className={pages.para}>{t('workspace.server.geojson_delete_confirm', { name: deleting?.name ?? '' })}</p>}
        confirmLabel={t('common.delete')}
        danger
        submitOnEnter={false}
        onConfirm={async () => {
          if (deleting) await g.removeLayer(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </SettingGroup>
  );
}

function Range({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return (
    <label className={styles.check}>
      {label}
      <input type="range" min="0" max="1" step="0.05" value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span>{Math.round(value * 100)}%</span>
    </label>
  );
}

function MapStyles() {
  const { t } = useTranslation();
  const { report, line } = useReport();
  const m = useMapStyles(report);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  return (
    <SettingGroup title={t('map_style_manager.title')}>
      <p className={styles.cardPara}>{t('map_style_manager.description')}</p>
      {m.loading ? (
        <p className={styles.cardPara}>{t('map_style_manager.loading')}</p>
      ) : m.styles.length === 0 ? (
        <p className={styles.cardPara}>{t('map_style_manager.no_styles')}</p>
      ) : (
        m.styles.map((style) => (
          <div key={style.id} className={pages.infoRow} data-testid="map-style">
            <div className={pages.infoText}>
              <input
                className={`${pages.keyInput} ${styles.nameInput}`}
                aria-label={t('workspace.server.style_name')}
                value={style.name}
                onChange={(e) => m.setStyles((prev) => prev.map((s) => (s.id === style.id ? { ...s, name: e.target.value } : s)))}
                onBlur={(e) => void m.updateStyle(style.id, { name: e.target.value })}
              />
              <span className={pages.infoHelp}>{style.sourceType === 'upload' ? t('map_style_manager.source_upload') : t('map_style_manager.source_url')}</span>
            </div>
            {m.activeStyleId === style.id && (
              <span className={pages.chip} data-tone="on">
                <UiIcon name="check" size={12} /> {t('map_style_manager.active')}
              </span>
            )}
            {/* s13n5: a style's ⋯ holds Activate and Delete. */}
            <RowMenu
              label={t('workspace.server.style_actions', { name: style.name })}
              items={[
                ...(m.activeStyleId === style.id ? [] : [{ key: 'activate', label: t('map_style_manager.activate'), icon: 'check' as const, onSelect: () => void m.setActiveMapStyleId(style.id) }]),
                { key: 'delete', label: t('common.delete'), icon: 'delete', danger: true, onSelect: () => setDeleting({ id: style.id, name: style.name }) },
              ]}
            />
          </div>
        ))
      )}
      {line}
      <div className={styles.importBox}>
        <p className={pages.infoHelp}>{t('map_style_manager.import_desc')}</p>
        <input
          ref={m.fileInputRef}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void m.handleUpload(file);
          }}
        />
        <button type="button" className={pages.button} disabled={m.uploading} onClick={() => m.fileInputRef.current?.click()}>
          <UiIcon name="upload" size={16} />
          {m.uploading ? t('map_style_manager.uploading') : t('map_style_manager.upload_button')}
        </button>
        <span className={styles.fieldLine}>
          <input className={pages.keyInput} aria-label={t('map_style_manager.style_url_placeholder')} placeholder={t('map_style_manager.style_url_placeholder')} value={m.importUrl} onChange={(e) => m.setImportUrl(e.target.value)} />
          <input className={pages.keyInput} aria-label={t('map_style_manager.name_placeholder')} placeholder={t('map_style_manager.name_placeholder')} value={m.importName} onChange={(e) => m.setImportName(e.target.value)} />
          <button type="button" className={pages.button} disabled={m.fetchingUrl || !m.importUrl.trim()} onClick={() => void m.handleFetchUrl()}>
            <UiIcon name="link" size={16} />
            {m.fetchingUrl ? t('map_style_manager.fetching') : t('map_style_manager.fetch_button')}
          </button>
        </span>
        <h3 className={styles.subTitle}>{t('map_style_manager.generate_title')}</h3>
        <span className={styles.fieldLine}>
          <input className={pages.keyInput} aria-label={t('map_style_manager.tilejson_url_placeholder')} placeholder={t('map_style_manager.tilejson_url_placeholder')} value={m.tileJsonUrl} onChange={(e) => m.setTileJsonUrl(e.target.value)} />
          <input className={pages.keyInput} aria-label={t('workspace.server.generated_name')} placeholder={t('map_style_manager.name_placeholder')} value={m.tileJsonName} onChange={(e) => m.setTileJsonName(e.target.value)} />
          <button type="button" className={pages.button} disabled={m.generatingStyle || !m.tileJsonUrl.trim()} onClick={() => void m.handleGenerateFromTileserver()}>
            {m.generatingStyle ? t('map_style_manager.generating') : t('map_style_manager.generate_button')}
          </button>
        </span>
      </div>
      <ConfirmSheet
        open={deleting !== null}
        title={t('common.delete')}
        body={<p className={pages.para}>{t('map_style_manager.delete_confirm', { name: deleting?.name ?? '' })}</p>}
        confirmLabel={t('common.delete')}
        danger
        submitOnEnter={false}
        onConfirm={async () => {
          if (deleting) await m.removeStyle(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </SettingGroup>
  );
}

const num = (raw?: string) => {
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : null;
};

function KeysAndDefaults() {
  const { t } = useTranslation();
  return (
    <SettingGroup title={t('workspace.server.keys_defaults')}>
      <p className={styles.cardPara}>{t('workspace.server.admins_only')}</p>
      <SaveField
        k="cartoApiKey"
        id="map.cartoApiKey"
        label={t('settings.carto_api_key_label', 'Carto Basemap API Key')}
        help={
          <>
            {t('settings.carto_api_key_description', 'Removes the "API key required" watermark on the Dark/Light (Carto) basemaps. Free and instant — request one at ')}
            <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener noreferrer" className={prefs.link}>carto.com/basemaps/apikey</a>
            {t('settings.carto_api_key_description_suffix', '. Leave empty to use Carto keyless (watermarked) or a non-Carto basemap.')}
          </>
        }
        placeholder={t('settings.carto_api_key_placeholder', 'Carto API key')}
      />
      <DefaultCentre />
    </SettingGroup>
  );
}

type Centre = { lat: number; lon: number; zoom: number } | null;

/** Today's default map centre: three keys, written together; '' clears them (SettingsTab handleSave). */
function DefaultCentre() {
  const { t } = useTranslation();
  const s = useSettings();
  const queryClient = useQueryClient();
  const { data } = useServerSettings();
  const lat = num(data?.defaultMapCenterLat);
  const lon = num(data?.defaultMapCenterLon);
  const zoom = num(data?.defaultMapCenterZoom);
  const stored: Centre = lat !== null && lon !== null && zoom !== null ? { lat, lon, zoom } : null;
  const [open, setOpen] = useState(false);
  const [value, set, status] = useAutosaveValue<Centre>(stored, {
    commit: 'change',
    same: () => false,
    write: async (c) => {
      const body = { defaultMapCenterLat: c ? String(c.lat) : '', defaultMapCenterLon: c ? String(c.lon) : '', defaultMapCenterZoom: c ? String(c.zoom) : '' };
      await apiService.post('/api/settings', body);
      queryClient.setQueryData<Record<string, string>>(serverSettingsKey(), (prev) => ({ ...prev, ...body }));
      s.setDefaultMapCenterLat(c?.lat ?? null);
      s.setDefaultMapCenterLon(c?.lon ?? null);
      s.setDefaultMapCenterZoom(c?.zoom ?? null);
    },
    settled: () => void queryClient.invalidateQueries({ queryKey: serverSettingsKey() }),
  });
  const shown = value ? `${value.lat.toFixed(4)}, ${value.lon.toFixed(4)} · ${t('workspace.server.zoom', { zoom: value.zoom })}` : t('workspace.server.no_default_centre');
  return (
    <SettingRow id="map.defaultMapCenter" label={t('workspace.server.default_centre')} help={`${t('workspace.server.default_centre_help')} · ${shown}`}>
      <SavedLine status={status} />
      <button type="button" className={pages.button} onClick={() => setOpen(true)}>
        <UiIcon name="location" size={16} />
        {t('workspace.server.pick_on_map')}
      </button>
      {/* Mounted per opening, so the view starts at the map's own centre every time (6.4 I2). */}
      {open && (
        <CentreSheet
          value={value}
          onClose={() => setOpen(false)}
          onSave={(c) => {
            set(c);
            setOpen(false);
          }}
        />
      )}
    </SettingRow>
  );
}

function CentreSheet({ value, onClose, onSave }: { value: Centre; onClose(): void; onSave(c: Centre): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  // Where the map is now: today's picker saves the view, not a click. It starts where the map opens.
  const view = useRef({ lat: value?.lat ?? 20, lon: value?.lon ?? 0, zoom: value?.zoom ?? 2 });
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('workspace.server.default_centre')}
      footer={
        <div className={styles.sheetActions} data-phone={isPhone || undefined}>
          {value && <button type="button" className={pages.button} onClick={() => onSave(null)}>{t('workspace.server.clear')}</button>}
          <button type="button" className={`${pages.button} ${pages.primary}`} onClick={() => onSave({ ...view.current })}>{t('workspace.server.save_as_default')}</button>
        </div>
      }
    >
      <div className={styles.sheetBody} data-phone={isPhone || undefined}>
        <p className={pages.para}>{t('workspace.server.centre_sheet_help')}</p>
        <div className={styles.mapFrame}>
          <BaseMap center={value ? [value.lat, value.lon] : [20, 0]} zoom={value?.zoom ?? 2} scrollWheelZoom>
            <ViewTracker onMove={(v) => (view.current = v)} />
          </BaseMap>
        </div>
      </div>
    </Sheet>
  );
}

function ViewTracker({ onMove }: { onMove(v: { lat: number; lon: number; zoom: number }): void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMove({ lat: c.lat, lon: c.lng, zoom: map.getZoom() });
    },
  });
  return null;
}
