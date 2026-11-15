/**
 * Overview › Messages (Task 4.6) under the real Workspace routes, against the
 * Athens fixture. `channel` presets the channel the viewer last picked
 * (today's `unifiedMessagesChannel`), as a returning user has it.
 */
import { onTestFinished } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { UNIFIED_CHANNEL_STORAGE_KEY } from '../../../pages/unifiedChannelPreference';
import WorkspaceApp from '../../WorkspaceApp';

export interface MessagesOptions extends RenderWorkspaceOptions {
  channel?: string;
  /** localStorage entries preset before the render (raw strings), as a returning user has them. */
  storage?: Record<string, string>;
}

export function renderMessages(route = '/overview/messages', opts: MessagesOptions = {}) {
  localStorage.clear();
  if (opts.channel) localStorage.setItem(UNIFIED_CHANNEL_STORAGE_KEY, opts.channel);
  for (const [k, v] of Object.entries(opts.storage ?? {})) localStorage.setItem(k, v);
  onTestFinished(() => localStorage.clear());
  return renderWorkspace(<WorkspaceApp />, { route, ...opts });
}

/** The feed row that holds `text`. */
export async function feedRow(text: string): Promise<HTMLElement> {
  // The text is matched twice: the row's text block and the link-rendered span inside it.
  const [el] = await screen.findAllByText(text, {}, { timeout: 5000 });
  return el.closest<HTMLElement>('[data-testid="feed-row"]')!;
}
