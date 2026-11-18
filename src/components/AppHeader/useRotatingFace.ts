/**
 * The header badge's face rotation (#4917), shared by today's
 * `CyclingConnectionStatus` and the Workspace Reticulum status line (#6365):
 * one face at a time, the next every 5 s, restarting when the set of faces
 * changes and stopping when there is only one. Display only.
 */
import { useEffect, useState } from 'react';

/** How long each face is shown before rotating to the next. */
const ROTATE_MS = 5000;

export function useRotatingFace<T>(faces: readonly T[]): T {
  const [index, setIndex] = useState(0);

  // Restart the rotation whenever the set of available faces changes, and stop
  // it entirely when there's nothing to rotate through.
  useEffect(() => {
    setIndex(0);
    if (faces.length <= 1) return;
    const id = setInterval(() => {
      setIndex(i => (i + 1) % faces.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [faces.length]);

  // Guard against a transient out-of-range index if faces shrank this render.
  return faces[Math.min(index, faces.length - 1)];
}
