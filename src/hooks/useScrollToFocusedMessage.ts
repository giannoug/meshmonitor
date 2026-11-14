/**
 * Scroll to and highlight a message picked in message search (`[data-message-id]`),
 * once its conversation has rendered: after 300 ms, then the highlight for 3 s.
 * A message not in the loaded list is skipped. Shared by Classic's Channels and
 * Messages tabs and the Workspace conversations (Rule X; moved out of both tabs).
 */
import { useEffect } from 'react';

export function useScrollToFocusedMessage(
  focusMessageId: string | null | undefined,
  onFocusMessageHandled?: () => void,
  highlightClass = 'search-highlight',
): void {
  useEffect(() => {
    if (!focusMessageId) return;
    // Delay to allow React to render the channel's messages after tab/channel switch
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${CSS.escape(focusMessageId)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add(highlightClass);
        setTimeout(() => el.classList.remove(highlightClass), 3000);
      }
      onFocusMessageHandled?.();
    }, 300);
    return () => clearTimeout(timer);
  }, [focusMessageId, onFocusMessageHandled, highlightClass]);
}
