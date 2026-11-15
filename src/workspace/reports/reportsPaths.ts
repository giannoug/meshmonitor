/** `/overview/reports` or `/reports`: the Reports list a page under either prefix belongs to. */
import { useLocation } from 'react-router-dom';

export function useReportsBase(): string {
  return useLocation().pathname.startsWith('/overview/') ? '/overview/reports' : '/reports';
}
