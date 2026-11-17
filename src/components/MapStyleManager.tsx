import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useMapStyles } from './useMapStyles';
import { UiIcon } from './icons';

const MapStyleManager: React.FC = () => {
  const { t } = useTranslation();
  const {
    styles, setStyles, loading, uploading, fetchingUrl, importUrl, setImportUrl, importName, setImportName,
    tileJsonUrl, setTileJsonUrl, tileJsonName, setTileJsonName, generatingStyle, fileInputRef,
    activeStyleId, setActiveMapStyleId, handleUpload, handleFetchUrl, handleGenerateFromTileserver, updateStyle, removeStyle,
  } = useMapStyles((message) => alert(message));

  const deleteStyle = async (id: string, name: string) => {
    if (!confirm(t('map_style_manager.delete_confirm', { name }))) return;
    await removeStyle(id);
  };

  if (loading) {
    return <div className="setting-item"><span>{t('map_style_manager.loading')}</span></div>;
  }

  return (
    <div>
      <div className="setting-item">
        <label>
          {t('map_style_manager.title')}
          <span className="setting-description">{t('map_style_manager.description')}</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Import: upload a file directly, or fetch a ready style.json by URL.
              Both save immediately as a usable map style (issue #4348). */}
          <div style={{ fontWeight: 600, fontSize: '0.9em' }}>{t('map_style_manager.import_title')}</div>
          <div style={{ fontSize: '0.85em', color: 'var(--text-muted, #888)', marginBottom: '2px' }}>
            {t('map_style_manager.import_desc')}
          </div>

          {/* File upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <button
              className="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? t('map_style_manager.uploading') : t('map_style_manager.upload_button')}
            </button>
          </div>

          {/* URL import */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder={t('map_style_manager.style_url_placeholder')}
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              style={{ flex: 2, minWidth: '160px', padding: '4px 8px', border: '1px solid var(--border-color, #ccc)', borderRadius: '3px', background: 'var(--input-bg, #fff)', color: 'var(--text-color, #000)' }}
            />
            <input
              type="text"
              placeholder={t('map_style_manager.name_placeholder')}
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              style={{ flex: 1, minWidth: '100px', padding: '4px 8px', border: '1px solid var(--border-color, #ccc)', borderRadius: '3px', background: 'var(--input-bg, #fff)', color: 'var(--text-color, #000)' }}
            />
            <button
              className="button"
              onClick={handleFetchUrl}
              disabled={fetchingUrl || !importUrl.trim()}
            >
              {fetchingUrl ? t('map_style_manager.fetching') : t('map_style_manager.fetch_button')}
            </button>
          </div>

          {/* Generate from tileserver: this is a DIFFERENT feature from the
              import above — it builds a brand-new style from a raw TileJSON
              endpoint and only downloads it to your browser (issue #4348,
              problem 3). It does not save a map style server-side; edit the
              downloaded file and upload it above to actually use it. */}
          <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color, #eee)', paddingTop: '8px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9em' }}>{t('map_style_manager.generate_title')}</div>
            <div style={{ fontSize: '0.85em', color: 'var(--text-muted, #888)', margin: '2px 0 4px' }}>
              {/* Kept as one translatable sentence (rather than split around the
                  <code> element) so translators can reorder it freely. */}
              <Trans
                i18nKey="map_style_manager.generate_desc"
                components={{ code: <code style={{ fontSize: '0.9em' }} /> }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder={t('map_style_manager.tilejson_url_placeholder')}
                value={tileJsonUrl}
                onChange={(e) => setTileJsonUrl(e.target.value)}
                style={{ flex: 2, minWidth: '200px', padding: '4px 8px', border: '1px solid var(--border-color, #ccc)', borderRadius: '3px', background: 'var(--input-bg, #fff)', color: 'var(--text-color, #000)' }}
              />
              <input
                type="text"
                placeholder={t('map_style_manager.name_placeholder')}
                value={tileJsonName}
                onChange={(e) => setTileJsonName(e.target.value)}
                style={{ flex: 1, minWidth: '100px', padding: '4px 8px', border: '1px solid var(--border-color, #ccc)', borderRadius: '3px', background: 'var(--input-bg, #fff)', color: 'var(--text-color, #000)' }}
              />
              <button
                className="button"
                onClick={handleGenerateFromTileserver}
                disabled={generatingStyle || !tileJsonUrl.trim()}
              >
                {generatingStyle ? t('map_style_manager.generating') : t('map_style_manager.generate_button')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {styles.length === 0 ? (
        <div className="setting-item">
          <span style={{ color: 'var(--text-muted, #888)', fontStyle: 'italic' }}>
            {t('map_style_manager.no_styles')}
          </span>
        </div>
      ) : (
        styles.map(style => (
          <div key={style.id} className="setting-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              {/* Editable name */}
              <input
                type="text"
                value={style.name}
                onChange={(e) => setStyles(prev => prev.map(s => s.id === style.id ? { ...s, name: e.target.value } : s))}
                onBlur={(e) => updateStyle(style.id, { name: e.target.value })}
                style={{ flex: 1, padding: '2px 6px', border: '1px solid var(--border-color, #ccc)', borderRadius: '3px', background: 'var(--input-bg, #fff)', color: 'var(--text-color, #000)' }}
              />

              {/* Source badge */}
              <span style={{
                fontSize: '0.75em',
                padding: '2px 6px',
                borderRadius: '3px',
                background: style.sourceType === 'upload' ? 'var(--accent-color, #4a9eff)' : 'var(--success-color, #28a745)',
                color: '#fff',
                whiteSpace: 'nowrap',
              }}>
                {style.sourceType === 'upload'
                  ? t('map_style_manager.source_upload')
                  : t('map_style_manager.source_url')}
              </span>

              {/* Active indicator / Activate action — same "which style is
                  used on the map" state as the in-map "Map Style" dropdown,
                  surfaced here so it's discoverable from Settings (#4348). */}
              {activeStyleId === style.id ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75em',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: 'var(--success-color, #28a745)',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}>
                  <UiIcon name="check" /> {t('map_style_manager.active')}
                </span>
              ) : (
                <button
                  onClick={() => void setActiveMapStyleId(style.id)}
                  style={{ padding: '2px 8px', background: 'var(--accent-color, #4a9eff)', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '0.85em', whiteSpace: 'nowrap' }}
                >
                  {t('map_style_manager.activate')}
                </button>
              )}

              {/* Delete */}
              <button
                onClick={() => deleteStyle(style.id, style.name)}
                style={{ padding: '2px 8px', background: 'var(--danger-color, #dc3545)', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '0.85em' }}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MapStyleManager;
