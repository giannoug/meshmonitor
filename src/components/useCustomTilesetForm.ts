/**
 * The custom tileset form's state and actions, moved unchanged out of
 * CustomTilesetManager (Rule X, #6365) so the Workspace's Server › Map &
 * tiles page validates, tests, autodetects and saves exactly as today. A save
 * failure goes to `report` (Classic passes `alert`).
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNumberInputScope } from './common/numberInputScopeContext';
import { useSettings } from '../contexts/SettingsContext';
import { validateTileUrl, type CustomTileset } from '../config/tilesets';
import { testTileServer, autodetectTileServer, type TileTestResult, type AutodetectResult, type AutodetectProgress } from '../utils/tileServerTest';

export interface TilesetFormData {
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  description: string;
  overlayScheme: 'light' | 'dark';
}

export const DEFAULT_FORM_DATA: TilesetFormData = {
  name: '',
  url: '',
  attribution: '',
  maxZoom: 18,
  description: '',
  overlayScheme: 'dark' as const,
};
export function useCustomTilesetForm(report: (message: string) => void) {
  const { t } = useTranslation();
  const { customTilesets, addCustomTileset, updateCustomTileset, deleteCustomTileset } = useSettings();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TilesetFormData>(DEFAULT_FORM_DATA);
  const [urlValidation, setUrlValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const numberScope = useNumberInputScope();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TileTestResult | null>(null);
  const [isAutodetecting, setIsAutodetecting] = useState(false);
  const [autodetectProgress, setAutodetectProgress] = useState<AutodetectProgress | null>(null);
  const [autodetectResult, setAutodetectResult] = useState<AutodetectResult | null>(null);
  const [autodetectBaseUrl, setAutodetectBaseUrl] = useState('');
  const [showReloadNotice, setShowReloadNotice] = useState(false);

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      return false;
    }

    if (!formData.url.trim()) {
      return false;
    }

    const validation = validateTileUrl(formData.url);
    setUrlValidation(validation);

    return validation.valid;
  };

  const handleUrlChange = (url: string) => {
    setFormData({ ...formData, url });
    setTestResult(null); // Clear test results when URL changes
    if (url.trim()) {
      const validation = validateTileUrl(url);
      setUrlValidation(validation);
    } else {
      setUrlValidation(null);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.url.trim() || !urlValidation?.valid) {
      return;
    }
    await testUrl(formData.url);
  };

  /** Tests one tile URL (the Workspace's Test URL tests a URL it has just picked). */
  const testUrl = async (url: string) => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testTileServer(url);
      setTestResult(result);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult({
        success: false,
        status: 'error',
        tileType: 'unknown',
        message: 'Test failed unexpectedly',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        details: {}
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // #5649: a blank or out-of-range zoom is never saved.
    if (numberScope.invalid) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateCustomTileset(editingId, formData);
        setEditingId(null);
      } else {
        await addCustomTileset(formData);
        setIsAdding(false);
      }

      setFormData(DEFAULT_FORM_DATA);
      setUrlValidation(null);
      setShowReloadNotice(true);
    } catch (error) {
      console.error('Failed to save custom tileset:', error);
      report(t('tileset_manager.save_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(DEFAULT_FORM_DATA);
    setUrlValidation(null);
    setTestResult(null);
    setAutodetectResult(null);
    setAutodetectBaseUrl('');
  };

  const handleAutodetect = async () => {
    if (!autodetectBaseUrl.trim()) {
      return;
    }
    await autodetectFrom(autodetectBaseUrl);
  };

  /** Autodetects from one address (the Workspace's Test URL passes the URL field). */
  const autodetectFrom = async (base: string) => {
    setIsAutodetecting(true);
    setAutodetectProgress(null);
    setAutodetectResult(null);
    setTestResult(null);

    try {
      const result = await autodetectTileServer(
        base,
        (progress) => setAutodetectProgress(progress)
      );
      setAutodetectResult(result);
    } catch (error) {
      console.error('Autodetect failed:', error);
      setAutodetectResult({
        success: false,
        detectedUrls: [],
        baseUrl: base,
        testedPatterns: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsAutodetecting(false);
      setAutodetectProgress(null);
    }
  };

  const handleSelectAutodetectedUrl = (url: string) => {
    setFormData({ ...formData, url });
    handleUrlChange(url);
    setAutodetectResult(null);
    setAutodetectBaseUrl('');
  };

  const handleEdit = (tileset: CustomTileset) => {
    setFormData({
      name: tileset.name,
      url: tileset.url,
      attribution: tileset.attribution,
      maxZoom: tileset.maxZoom,
      description: tileset.description,
      overlayScheme: tileset.overlayScheme ?? 'dark',
    });
    setEditingId(tileset.id);
    setIsAdding(false);
  };

  return {
    customTilesets,
    addCustomTileset,
    updateCustomTileset,
    deleteCustomTileset,
    isAdding,
    setIsAdding,
    editingId,
    setEditingId,
    formData,
    setFormData,
    urlValidation,
    setUrlValidation,
    isSaving,
    setIsSaving,
    numberScope,
    isTesting,
    setIsTesting,
    testResult,
    setTestResult,
    isAutodetecting,
    setIsAutodetecting,
    autodetectProgress,
    setAutodetectProgress,
    autodetectResult,
    setAutodetectResult,
    autodetectBaseUrl,
    setAutodetectBaseUrl,
    showReloadNotice,
    setShowReloadNotice,
    validateForm,
    handleUrlChange,
    handleTestConnection,
    handleSubmit,
    handleCancel,
    handleAutodetect,
    autodetectFrom,
    testUrl,
    handleSelectAutodetectedUrl,
    handleEdit,
  };
}
