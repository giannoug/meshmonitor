/**
 * A default for `useDashboardUnifiedData`'s options, for a whole subtree. The
 * Workspace Overview map (#6365) draws today's Map Analysis components, whose
 * many data calls pass no options; inside its provider they ask for the
 * Dashboard's age window (`ageWindow`), as Classic's `/` map does. Without a
 * provider (Classic Map Analysis) nothing changes: an explicit `options`
 * argument always wins.
 */
import { createContext } from 'react';

export const DashboardDataOptionsContext = createContext<{ ageWindow?: boolean } | undefined>(undefined);
