/**
 * The signed-in user's API token: load, generate, revoke, copy. Shared by
 * Classic's APITokenManagement and the Workspace's You › API Token (Rule X:
 * moved out unchanged). The generated token lives only in this hook's state:
 * `dismiss`, a revoke or unmounting drops it.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../ToastContainer';
import { logger } from '../../utils/logger';
import api from '../../services/api';

export interface APITokenInfo {
  id: number;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  isActive: boolean;
}

export interface APITokenState {
  hasToken: boolean;
  token: APITokenInfo | null;
}

export function useApiToken() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [tokenState, setTokenState] = useState<APITokenState>({ hasToken: false, token: null });
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    void loadTokenInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 load once on mount, as APITokenManagement did
  }, []);

  const loadTokenInfo = async () => {
    try {
      setLoading(true);
      const data = await api.get<APITokenState>('/api/token');
      setTokenState(data);
    } catch (error) {
      logger.error('Failed to load API token info:', error);
      showToast(t('api_token.load_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    try {
      setIsGenerating(true);
      const data = await api.post<{ token: string; tokenInfo: APITokenInfo }>('/api/token/generate');
      setGeneratedToken(data.token);
      setTokenState({
        hasToken: true,
        token: data.tokenInfo
      });
      showToast(t('api_token.generated_success'), 'success');
    } catch (error) {
      logger.error('Failed to generate API token:', error);
      showToast(error instanceof Error ? error.message : t('api_token.generate_failed'), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  /** Resolves true once revoked; a failure shows today's toast and resolves false. */
  const revoke = async (): Promise<boolean> => {
    try {
      setIsRevoking(true);
      await api.delete('/api/token');
      setTokenState({ hasToken: false, token: null });
      setGeneratedToken(null);
      showToast(t('api_token.revoked_success'), 'success');
      return true;
    } catch (error) {
      logger.error('Failed to revoke API token:', error);
      showToast(error instanceof Error ? error.message : t('api_token.revoke_failed'), 'error');
      return false;
    } finally {
      setIsRevoking(false);
    }
  };

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    showToast(t('api_token.copied'), 'success');
  };

  return {
    tokenState, generatedToken, loading, isGenerating, isRevoking,
    generate, revoke, copy, dismiss: () => setGeneratedToken(null),
  };
}
