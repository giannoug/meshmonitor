/**
 * The Activity feed's wire shape (#6365): `GET /api/sources/:id/activity`
 * (Task 2.7) returns an `ActivityPage`; the Workspace feed (Task 2.8) reads it.
 */
export type ActivityConversation = { type: 'channel'; channel: number } | { type: 'dm'; peerId: string };

export interface ActivityItem {
  kind: 'reply' | 'reaction' | 'mention';
  id: string;
  targetMessageId: string | null;
  /** Reply only: the text of our message it answers (a reaction's `text` is already that). */
  targetText?: string;
  conversation: ActivityConversation;
  fromId: string;
  fromName: string;
  text: string;
  reactions?: Array<{ emoji: string; count: number; fromNames: string[] }>;
  timestamp: number;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextBefore: number | null;
}
