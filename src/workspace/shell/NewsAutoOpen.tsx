/**
 * New news opens by itself once (s13n2), as Classic's App and Dashboard do:
 * when the shell mounts for a signed-in user, one `GET /api/news/unread`
 * (today's request); when it lists anything, today's NewsPopup opens without
 * `forceShowAll`, so it shows the unseen items (`unseenNewsItems`) and marks
 * them seen when closed. No interval; the full-page sign-in has no shell.
 * Re-hosted Classic pages skip their own check while embedded.
 */
import { useEffect, useState } from 'react';
import { NewsPopup } from '../../components/NewsPopup';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { logger } from '../../utils/logger';

export default function NewsAutoOpen() {
  const { authStatus } = useAuth();
  const signedIn = authStatus?.authenticated === true;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    apiService
      .getUnreadNews()
      .then((reply) => {
        if (live && reply.items && reply.items.length > 0) setOpen(true);
      })
      .catch((err: unknown) => logger.debug('Failed to fetch unread news:', err));
    return () => {
      live = false;
    };
  }, [signedIn]);

  return <NewsPopup isOpen={open} onClose={() => setOpen(false)} isAuthenticated={signedIn} />;
}
