/**
 * Hosted policy documents' state and requests (#5156), moved out of
 * PrivacyDocumentsSection (#6365 Rule X) so Server › Security & privacy uses
 * the same list, Publish, Unpublish and upload checks.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import {
  PRIVACY_LINK_FALLBACK_LABEL,
  type PrivacyDocumentAdmin,
  type PrivacyDocumentSlug,
} from '../../types/privacy';
import { seedFromUpload } from './privacyUpload';

/** Mirrors the server's cap so the UI can refuse before a round trip. */
export const MAX_DOCUMENT_BYTES = 256 * 1024;

/** Extensions we accept. Markdown and plain text only — never HTML. */
export const ACCEPTED_EXTENSIONS = ['.md', '.markdown', '.txt'];

export type DocDraft = { title: string; content: string };

export function usePrivacyDocuments() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Partial<Record<PrivacyDocumentSlug, PrivacyDocumentAdmin>>>({});
  const [drafts, setDrafts] = useState<Partial<Record<PrivacyDocumentSlug, DocDraft>>>({});
  const [openSlug, setOpenSlug] = useState<PrivacyDocumentSlug | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const all = await apiService.getPrivacyDocumentsAdmin();
      const bySlug: Partial<Record<PrivacyDocumentSlug, PrivacyDocumentAdmin>> = {};
      for (const doc of all) bySlug[doc.slug] = doc;
      setDocs(bySlug);
      setError(null);
    } catch {
      setError(t('privacy.docs.load_failed', 'Failed to load hosted documents.'));
    } finally {
      setLoaded(true);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const draftFor = (slug: PrivacyDocumentSlug): DocDraft =>
    drafts[slug] ?? {
      title: docs[slug]?.title ?? PRIVACY_LINK_FALLBACK_LABEL[slug],
      content: docs[slug]?.content ?? '',
    };

  const setDraft = (slug: PrivacyDocumentSlug, patch: Partial<DocDraft>) =>
    setDrafts((prev) => ({ ...prev, [slug]: { ...draftFor(slug), ...patch } }));

  const handleSave = async (slug: PrivacyDocumentSlug) => {
    const draft = draftFor(slug);
    if (!draft.title.trim() || !draft.content.trim()) {
      setError(t('privacy.docs.title_and_body_required', 'A title and document body are both required.'));
      return;
    }
    setBusySlug(slug);
    setError(null);
    try {
      await apiService.savePrivacyDocument(slug, draft.title.trim(), draft.content);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('privacy.docs.save_failed', 'Failed to save document.'));
    } finally {
      setBusySlug(null);
    }
  };

  const handleDelete = async (slug: PrivacyDocumentSlug) => {
    setBusySlug(slug);
    setError(null);
    try {
      await apiService.deletePrivacyDocument(slug);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('privacy.docs.delete_failed', 'Failed to delete document.'));
    } finally {
      setBusySlug(null);
    }
  };

  const handleFile = async (slug: PrivacyDocumentSlug, file: File) => {
    const lower = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setError(
        t(
          'privacy.docs.bad_extension',
          'Documents are stored as Markdown. Upload a .md, .markdown or .txt file.',
        ),
      );
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError(
        t('privacy.docs.too_large', 'That file is larger than {{kb}} KB.', {
          kb: Math.floor(MAX_DOCUMENT_BYTES / 1024),
        }),
      );
      return;
    }
    const text = await file.text();
    const { title, content } = seedFromUpload(text, draftFor(slug).title, slug);
    setDraft(slug, { content, title });
    setOpenSlug(slug);
    setError(null);
  };

  return { docs, drafts, openSlug, setOpenSlug, busySlug, error, loaded, draftFor, setDraft, handleSave, handleDelete, handleFile };
}
