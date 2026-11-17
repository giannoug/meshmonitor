import React from 'react';
import { NumberInput } from './common/NumberInput';
import { useGeoJsonLayers } from './useGeoJsonLayers';
import styles from './GeoJsonLayerManager.module.css';

const GeoJsonLayerManager: React.FC = () => {
  const { layers, setLayers, loading, uploading, fileInputRef, handleUpload, updateLayer, removeLayer } = useGeoJsonLayers((message) => alert(message));

  const deleteLayer = async (id: string, name: string) => {
    if (!confirm(`Delete layer "${name}"? This cannot be undone.`)) return;
    await removeLayer(id);
  };

  if (loading) {
    return <div className="setting-item"><span>Loading GeoJSON layers...</span></div>;
  }

  return (
    <div>
      <div className="setting-item">
        <label>
          GeoJSON Layers
          <span className="setting-description">Upload and manage GeoJSON overlay layers on the map.</span>
        </label>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,.kml,.kmz"
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
            {uploading ? 'Uploading...' : 'Upload Overlay (GeoJSON/KML/KMZ)'}
          </button>
        </div>
      </div>

      {layers.length === 0 ? (
        <div className="setting-item">
          <span style={{ color: 'var(--text-muted, #888)', fontStyle: 'italic' }}>
            No GeoJSON layers uploaded yet.
          </span>
        </div>
      ) : (
        layers.map(layer => (
          <div key={layer.id} className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
            <div className={styles.controlRow}>
              {/* Visibility */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={(e) => updateLayer(layer.id, { visible: e.target.checked })}
                />
                <span style={{ fontSize: '0.85em' }}>Visible</span>
              </label>

              {/* Public exposure (issue #3407) — opt-in, default off */}
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                title="Show this layer to anonymous viewers on the public map and in embeds. Off by default — private/operational layers stay hidden."
              >
                <input
                  type="checkbox"
                  checked={layer.publiclyVisible ?? false}
                  onChange={(e) => updateLayer(layer.id, { publiclyVisible: e.target.checked })}
                />
                <span style={{ fontSize: '0.85em' }}>Public</span>
              </label>

              {/* Click popup opt-out (issue #4344) — off by default, so layers
                  keep the popup they have today. */}
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                title="Suppress the popup that opens when you click this layer's features, so map clicks (such as creating a Waypoint) pass through. The hover tooltip still shows the feature name."
              >
                <input
                  type="checkbox"
                  checked={layer.disablePopup ?? false}
                  onChange={(e) => updateLayer(layer.id, { disablePopup: e.target.checked })}
                />
                <span style={{ fontSize: '0.85em' }}>Disable click popup</span>
              </label>

              {/* Color */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.85em' }}>Color</span>
                <input
                  type="color"
                  value={layer.style.color}
                  onChange={(e) => updateLayer(layer.id, { style: { ...layer.style, color: e.target.value } })}
                  style={{ width: '36px', height: '24px', padding: '1px', border: '1px solid var(--border-color, #ccc)', borderRadius: '3px', cursor: 'pointer' }}
                />
              </label>

              {/* Name */}
              <input
                type="text"
                value={layer.name}
                onChange={(e) => setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, name: e.target.value } : l))}
                onBlur={(e) => updateLayer(layer.id, { name: e.target.value })}
                className={styles.nameInput}
                style={{ padding: '2px 6px', border: '1px solid var(--border-color, #ccc)', borderRadius: '3px', background: 'var(--input-bg, #fff)', color: 'var(--text-color, #000)' }}
              />

              {/* Delete */}
              <button
                onClick={() => deleteLayer(layer.id, layer.name)}
                style={{ padding: '2px 8px', background: 'var(--danger-color, #dc3545)', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '0.85em' }}
              >
                Delete
              </button>
            </div>

            <div className={styles.styleRow}>
              {/* Opacity */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em' }}>
                Opacity
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={layer.style.opacity}
                  onChange={(e) => updateLayer(layer.id, { style: { ...layer.style, opacity: parseFloat(e.target.value) } })}
                  style={{ width: '80px' }}
                />
                <span>{Math.round(layer.style.opacity * 100)}%</span>
              </label>

              {/* Fill Opacity */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em' }}>
                Fill Opacity
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={layer.style.fillOpacity}
                  onChange={(e) => updateLayer(layer.id, { style: { ...layer.style, fillOpacity: parseFloat(e.target.value) } })}
                  style={{ width: '80px' }}
                />
                <span>{Math.round(layer.style.fillOpacity * 100)}%</span>
              </label>

              {/* Weight */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em' }}>
                Line Width
                <NumberInput
                  min={1}
                  max={10}
                  integer
                  value={layer.style.weight}
                  onChange={(weight) => updateLayer(layer.id, { style: { ...layer.style, weight } })}
                  style={{ width: '50px', padding: '2px 4px', border: '1px solid var(--border-color, #ccc)', borderRadius: '3px', background: 'var(--input-bg, #fff)', color: 'var(--text-color, #000)' }}
                />
              </label>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default GeoJsonLayerManager;
