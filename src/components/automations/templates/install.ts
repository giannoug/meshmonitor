/**
 * A template's install, moved verbatim out of TemplateGallery (#6365 Rule X)
 * so the Workspace's template wizard installs exactly as today: build the
 * automation(s) from the wizard's values, name them, validate each graph, then
 * POST each to /api/automations/import in order (each lands disabled). Not
 * transactional: an automation that fails leaves the earlier ones installed.
 */
import apiService from '../../../services/api';
import { validateAutomationGraph } from '../../../types/automation';
import type { AutomationTemplate, BuiltAutomation } from './types';

/** Minimal shape of a created automation row, as returned by POST /api/automations/import. */
export interface InstalledAutomationRow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  config: string;
  createdAt?: number;
  updatedAt?: number;
}

export type InstallOutcome =
  | { status: 'success'; name: string; row: InstalledAutomationRow }
  | { status: 'error'; name: string; error: string };

/** Seed the editable name/description from a first build() pass. Templates that need
 * required params may throw on an empty `{}` — that's fine, we just fall back. */
export function isMultiTemplate(template: AutomationTemplate): boolean {
  if (template.multi) return true;
  try {
    const built = template.build({});
    return Array.isArray(built) && built.length > 1;
  } catch {
    return false;
  }
}

export function seedFromBuild(template: AutomationTemplate): BuiltAutomation | null {
  try {
    const built = template.build({});
    // Multi-automation templates have no single "first" identity worth showing (#6272):
    // the wizard Name/Description are template-level text there.
    if (template.multi || (Array.isArray(built) && built.length > 1)) return null;
    const first = Array.isArray(built) ? built[0] : built;
    return first ?? null;
  } catch {
    return null;
  }
}

/** The automations a wizard's values install, named and validated; or the errors that stop it. */
export function prepareTemplateInstall(
  template: AutomationTemplate,
  values: Record<string, unknown>,
  name: string,
  description: string,
): { list: BuiltAutomation[] } | { errors: string[] } {
  let built: BuiltAutomation | BuiltAutomation[];
  try {
    built = template.build(values);
  } catch (e) {
    return { errors: [e instanceof Error ? e.message : 'Failed to build this template from the entered values.'] };
  }
  const list = Array.isArray(built) ? built.slice() : [built];
  if (list.length === 0) {
    return { errors: ['This template produced no automations to install.'] };
  }
  if (template.multi || list.length > 1) {
    // Wizard Name prefixes every installed automation (#6272); each keeps its own
    // description. A built name that already leads with the template name has
    // that lead swapped for the wizard Name rather than doubled.
    const lead = `${template.name} — `;
    list.forEach((a, i) => {
      const rest = a.name.startsWith(lead) ? a.name.slice(lead.length) : a.name;
      list[i] = { ...a, name: `${name.trim() || template.name} — ${rest}` };
    });
  } else {
    list[0] = { ...list[0], name, description };
  }

  const validationErrors: string[] = [];
  for (const a of list) {
    const v = validateAutomationGraph(a.config);
    if (!v.valid) validationErrors.push(`"${a.name}": ${v.errors.join('; ')}`);
  }
  if (validationErrors.length > 0) return { errors: validationErrors };
  return { list };
}

/** POST each automation to /api/automations/import, one after another, and report each. */
export async function installTemplateAutomations(list: BuiltAutomation[]): Promise<InstallOutcome[]> {
  const results: InstallOutcome[] = [];
  for (const a of list) {
    try {
      const row = await apiService.post<InstalledAutomationRow>('/api/automations/import', {
        name: a.name,
        description: a.description,
        config: a.config,
      });
      results.push({ status: 'success', name: a.name, row });
    } catch (e) {
      results.push({ status: 'error', name: a.name, error: e instanceof Error ? e.message : 'Install failed' });
    }
  }
  return results;
}
