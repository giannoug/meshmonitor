/**
 * The editable free-text node note (#3921), moved unchanged out of
 * NodeDetailsBlock (#6365) so the Workspace node page's Admin tab edits it the
 * same way. The draft is kept locally and only persisted on Save; it re-syncs
 * whenever the node (or its stored note) changes.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeviceInfo } from '../types/device';

export const MAX_NODE_NOTES_LENGTH = 2000;

export function useNodeNotesDraft(node: DeviceInfo | null, onSaveNotes?: (notes: string) => Promise<void>) {
  const { t } = useTranslation();
  const nodeNum = node?.nodeNum;
  const storedNotes = node?.notes ?? '';
  const [notesDraft, setNotesDraft] = useState<string>(storedNotes);
  // Baseline the draft is compared against for the "dirty" check. It tracks the
  // last-persisted value locally so the Save button settles immediately after a
  // successful save, even before the polled `nodes` prop catches up.
  const [notesBaseline, setNotesBaseline] = useState<string>(storedNotes);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // Re-sync draft/baseline whenever the selected node or its stored note changes.
  useEffect(() => {
    setNotesDraft(storedNotes);
    setNotesBaseline(storedNotes);
    setNotesError(null);
  }, [nodeNum, storedNotes]);

  const notesDirty = notesDraft !== notesBaseline;

  const handleSaveNotes = async () => {
    if (!onSaveNotes || notesSaving || !notesDirty) return;
    setNotesSaving(true);
    setNotesError(null);
    try {
      await onSaveNotes(notesDraft);
      setNotesBaseline(notesDraft);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : t('node_details.notes_error', 'Failed to save notes'));
    } finally {
      setNotesSaving(false);
    }
  };

  return { storedNotes, notesDraft, setNotesDraft, notesSaving, notesError, notesDirty, handleSaveNotes };
}
