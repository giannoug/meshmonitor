import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTapbackEmojiEditor } from './themes/useTapbackEmojiEditor';

/**
 * TapbackEmojiSettings - Settings component for managing tapback emoji reactions
 */
const TapbackEmojiSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    tapbackEmojis,
    newEmoji,
    setNewEmoji,
    newTitle,
    setNewTitle,
    isSaving,
    handleAddEmoji,
    handleRemoveEmoji,
    resetToDefaults,
  } = useTapbackEmojiEditor();

  const handleResetToDefaults = async () => {
    const confirmed = window.confirm(
      t('settings.tapback_confirm_reset', 'Reset tapback emojis to defaults? This will replace all your custom emojis.')
    );

    if (!confirmed) return;

    await resetToDefaults();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving) {
      void handleAddEmoji();
    }
  };

  return (
    <div className="settings-section" id="settings-tapback-emojis">
      <h3>{t('settings.tapback_emojis', 'Tapback Emojis')}</h3>
      <p className="setting-description">
        {t('settings.tapback_emojis_description', 'Customize the emoji reactions available when responding to messages. These settings apply to all users.')}
      </p>

      {/* Current emoji grid */}
      <div className="tapback-emoji-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
        gap: '8px',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        maxHeight: '200px',
        overflowY: 'auto'
      }}>
        {tapbackEmojis.map(({ emoji, title }) => (
          <div
            key={emoji}
            title={title}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              padding: '8px',
              backgroundColor: 'var(--color-surface-hover)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            className="tapback-emoji-item"
          >
            {emoji}
            <button
              onClick={() => handleRemoveEmoji(emoji)}
              disabled={isSaving}
              title={t('settings.tapback_remove_emoji', 'Remove emoji')}
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '18px',
                height: '18px',
                padding: 0,
                border: 'none',
                borderRadius: '50%',
                backgroundColor: 'var(--color-error)',
                color: 'var(--color-bg)',
                fontSize: '12px',
                lineHeight: '18px',
                cursor: 'pointer',
                opacity: 0,
                transition: 'opacity 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="tapback-emoji-remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add emoji form */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          value={newEmoji}
          onChange={(e) => setNewEmoji(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('settings.tapback_emoji_placeholder', 'Emoji')}
          disabled={isSaving}
          style={{
            width: '80px',
            padding: '8px 12px',
            fontSize: '1.2rem',
            textAlign: 'center',
            borderRadius: '6px',
            border: '1px solid var(--color-surface-active)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)'
          }}
        />
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('settings.tapback_title_placeholder', 'Title (optional)')}
          disabled={isSaving}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--color-surface-active)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)'
          }}
        />
        <button
          onClick={handleAddEmoji}
          disabled={isSaving || !newEmoji.trim()}
          className="btn btn-primary"
          style={{
            padding: '8px 16px',
            borderRadius: '6px'
          }}
        >
          {t('settings.tapback_add_emoji', 'Add')}
        </button>
      </div>

      {/* Reset button */}
      <button
        onClick={handleResetToDefaults}
        disabled={isSaving}
        className="btn btn-secondary"
        style={{
          padding: '8px 16px',
          borderRadius: '6px'
        }}
      >
        {t('settings.tapback_reset_defaults', 'Reset to Defaults')}
      </button>

      {/* CSS for hover effects */}
      <style>{`
        .tapback-emoji-item:hover {
          background-color: var(--color-surface-active) !important;
        }
        .tapback-emoji-item:hover .tapback-emoji-remove {
          opacity: 1 !important;
        }
        .tapback-emoji-remove:hover {
          background-color: var(--color-danger) !important;
        }
      `}</style>
    </div>
  );
};

export default TapbackEmojiSettings;
