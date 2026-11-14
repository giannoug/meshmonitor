/**
 * A conversation opened from message search (`state.focusMessageId`, set by
 * SearchMessages) scrolls to and highlights that message, as App's
 * focusMessageId does in Classic's tabs. Handled once: the state is dropped
 * from the history entry, as App clears focusMessageId.
 */
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useScrollToFocusedMessage } from '../../hooks/useScrollToFocusedMessage';
import styles from './MessageRowD.module.css';

export function useSearchFocus(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const focusMessageId = (location.state as { focusMessageId?: string } | null)?.focusMessageId ?? null;
  const { pathname, search, hash } = location;
  const onHandled = useCallback(
    () => void navigate({ pathname, search, hash }, { replace: true, state: null }),
    [navigate, pathname, search, hash],
  );
  useScrollToFocusedMessage(focusMessageId, onHandled, styles.searchHighlight);
}
