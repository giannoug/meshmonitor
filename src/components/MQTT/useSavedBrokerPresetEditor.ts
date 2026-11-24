/**
 * Saved MQTT broker presets' editor values and the Save as preset / Manage
 * dialogs' state and calls (#5794), moved out of SavedBrokerPresetDialogs
 * unchanged (Rule X) so the Workspace's broker preset sheets (#6365) run the
 * same logic.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  useCreateBrokerPreset,
  useDeleteBrokerPreset,
  useUpdateBrokerPreset,
  type SavedBrokerPreset,
  type SavedBrokerPresetBody,
} from '../../hooks/useMqttBrokerPresets';
import { mqttRootErrorMessage } from './mqttRootApiError';
import { isChangedInvalidMqttRoot } from '../../utils/mqttRootTopic';
import { defaultMqttPort } from '../../utils/mqttBrokerEndpoint';
import type { RootFinderTarget } from '../../hooks/useMqttRootFinder';

/** A form's current broker values, offered to "Save as preset". */
export interface BrokerPresetDraft {
  host: string;
  port: number;
  tls: boolean;
  username: string;
  password: string;
  rootTopic: string;
}

export interface EditorValues {
  name: string;
  host: string;
  port: number;
  tls: boolean;
  username: string;
  password: string;
  rootTopic: string;
}

export function valuesFromDraft(draft: BrokerPresetDraft, name = ''): EditorValues {
  return {
    name,
    host: draft.host,
    port: draft.port,
    tls: draft.tls,
    username: draft.username,
    password: draft.password,
    rootTopic: draft.rootTopic,
  };
}

export function valuesFromPreset(p: SavedBrokerPreset, name = p.name): EditorValues {
  return {
    name,
    host: p.host,
    port: p.port,
    tls: p.tls,
    username: p.username ?? '',
    password: p.password ?? '',
    rootTopic: p.rootTopic ?? '',
  };
}

export function bodyFromValues(v: EditorValues): SavedBrokerPresetBody {
  return {
    name: v.name.trim(),
    host: v.host.trim(),
    port: v.port,
    tls: v.tls,
    username: v.username.trim() || null,
    password: v.password || null,
    rootTopic: v.rootTopic.trim() || null,
  };
}

export function errorText(err: unknown, t: TFunction): string {
  return mqttRootErrorMessage(err, t) ?? (err instanceof Error ? err.message : String(err));
}

/**
 * The server trims a preset root and strips a trailing `/`, then refuses it
 * when it changed and breaks the root rules (#6338). `saved` is the stored
 * root, or undefined for a new preset.
 */
export function presetRootBlocksSave(rootTopic: string, saved: string | null | undefined): boolean {
  return isChangedInvalidMqttRoot(rootTopic.trim().replace(/\/+$/, ''), saved);
}


/** Switching TLS moves a default port along with it. */
export function withTls(values: EditorValues, tls: boolean): EditorValues {
  const port = values.port === defaultMqttPort(values.tls) ? defaultMqttPort(tls) : values.port;
  return { ...values, tls, port };
}

/** The broker Find topics listens on: the editor's own values, or null with no host. */
export function presetFinderTarget(values: EditorValues): RootFinderTarget | null {
  return values.host.trim()
    ? {
        broker: { url: `${values.tls ? 'mqtts' : 'mqtt'}://${values.host.trim()}:${values.port}` },
        username: values.username,
        password: values.password,
      }
    : null;
}

/** Save as preset: a new preset from a form's current values. */
export function useSaveBrokerPresetForm({
  isOpen,
  draft,
  onClose,
}: {
  isOpen: boolean;
  draft: BrokerPresetDraft | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateBrokerPreset();
  const [values, setValues] = useState<EditorValues | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && draft) {
      setValues(valuesFromDraft(draft));
      setError('');
    }
  }, [isOpen, draft]);

  const save = async () => {
    if (!values) return;
    setError('');
    try {
      await create.mutateAsync(bodyFromValues(values));
      onClose();
    } catch (err) {
      setError(errorText(err, t));
    }
  };

  const canSave = !(!values || !values.name.trim() || presetRootBlocksSave(values.rootTopic, undefined) || create.isPending);
  return { values, setValues, error, save, canSave, isPending: create.isPending };
}

export type EditTarget = { mode: 'edit'; preset: SavedBrokerPreset } | { mode: 'duplicate'; preset: SavedBrokerPreset };

/** Manage saved presets: edit, duplicate ("Copy of …") and delete, with the inline "Delete this preset?". */
export function useManageBrokerPresets({ isOpen }: { isOpen: boolean }) {
  const { t } = useTranslation();
  const create = useCreateBrokerPreset();
  const update = useUpdateBrokerPreset();
  const remove = useDeleteBrokerPreset();
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [values, setValues] = useState<EditorValues | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTarget(null);
      setValues(null);
      setConfirmDeleteId(null);
      setError('');
    }
  }, [isOpen]);

  const startEdit = (next: EditTarget) => {
    setTarget(next);
    setError('');
    setConfirmDeleteId(null);
    setValues(
      next.mode === 'edit'
        ? valuesFromPreset(next.preset)
        : valuesFromPreset(next.preset, t('mqtt_presets.saved.copy_of', 'Copy of {{name}}', { name: next.preset.name })),
    );
  };

  const saveEdit = async () => {
    if (!target || !values) return;
    setError('');
    try {
      if (target.mode === 'edit') await update.mutateAsync({ id: target.preset.id, body: bodyFromValues(values) });
      else await create.mutateAsync(bodyFromValues(values));
      setTarget(null);
      setValues(null);
    } catch (err) {
      setError(errorText(err, t));
    }
  };

  const doDelete = async (id: number) => {
    setError('');
    try {
      await remove.mutateAsync(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(errorText(err, t));
    }
  };

  const cancelEdit = () => {
    setTarget(null);
    setValues(null);
  };
  const canSaveEdit =
    !!target &&
    !!values &&
    !(
      !values.name.trim()
      || presetRootBlocksSave(values.rootTopic, target.mode === 'edit' ? target.preset.rootTopic : undefined)
      || update.isPending
      || create.isPending
    );
  return {
    target,
    values,
    setValues,
    confirmDeleteId,
    setConfirmDeleteId,
    error,
    startEdit,
    cancelEdit,
    saveEdit,
    doDelete,
    canSaveEdit,
    deletePending: remove.isPending,
  };
}
