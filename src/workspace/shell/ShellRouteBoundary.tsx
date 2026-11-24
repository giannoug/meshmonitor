/**
 * The route error state (boards 17-04 / 17-11): an error thrown while a
 * Workspace page renders shows today's error screen (AppErrorScreen's words:
 * Error details, Try again, Reload page) on StateView inside the shell,
 * instead of main.tsx's whole-page one. Try again re-renders the page; moving
 * to another URL clears the error too.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import StateView from '../patterns/StateView';

export default function ShellRouteBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary fallback={(error, retry) => <RouteError error={error} retry={retry} />}>{children}</ErrorBoundary>;
}

function RouteError({ error, retry }: { error: unknown; retry(): void }) {
  const { pathname } = useLocation();
  const at = useRef(pathname);
  useEffect(() => {
    if (pathname !== at.current) retry();
  }, [pathname, retry]);
  return <StateView kind="error" error={error} onRetry={retry} page />;
}
