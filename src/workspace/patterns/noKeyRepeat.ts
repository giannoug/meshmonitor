import type { KeyboardEvent } from 'react';

/**
 * onKeyDown for a transmitting button that stays enabled after a press: Enter
 * clicks a focused button on every auto-repeat keydown, so a held key would
 * send ~30 times a second. One press sends once (F.2 B-I2).
 */
export function noKeyRepeat(e: KeyboardEvent) {
  if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
}
