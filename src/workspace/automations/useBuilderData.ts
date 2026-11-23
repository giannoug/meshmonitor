/**
 * The pickers today's rule editor and template wizard load (AutomationsPage's
 * AutomationEditor, TemplateGallery): variables, channels, scripts, regions,
 * nodes and the other rules, each read once and only while a step or wizard is
 * open (`enabled`). Sources come from the shell's device list (today's
 * `/api/sources` poll, readable devices only), so no new request is made.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { loadNodeOptions } from '../../components/automations/loadNodeOptions';
import type { AutomationOption, ScriptOption, SourceOption, VariableOption } from '../../components/automations/AutomationBuilder';
import { useShellDevices } from '../shell/shellDevices';
import { scriptsQuery } from './useBuiltins';
import { rulesQuery } from './engineRules';
import { channelsQuery, regionsQuery, variablesQuery } from './rules';

export function useBuilderData(enabled: boolean) {
  const { hasPermission } = useAuth();
  const on = enabled && hasPermission('automations', 'read');
  const { sources: devices } = useShellDevices();
  const { data: vars = [] } = useQuery({ ...variablesQuery, enabled: on });
  const { data: channels = [] } = useQuery({ ...channelsQuery, enabled: on });
  const { data: scriptRows = [] } = useQuery({ ...scriptsQuery, enabled: on });
  const { data: regions = [] } = useQuery({ ...regionsQuery, enabled: on });
  const { data: nodes = [] } = useQuery({ queryKey: ['workspace', 'automations', 'nodes'], queryFn: loadNodeOptions, enabled: on, refetchOnWindowFocus: false });
  const { data: rules = [] } = useQuery({ ...rulesQuery, enabled: on });
  const sources: SourceOption[] = devices.map((s) => ({
    id: s.id, name: s.name, type: s.type, enabled: s.enabled, txEnabled: s.radio?.txEnabled, canTransmit: s.radio?.canTransmit,
  }));
  const variables: VariableOption[] = vars.map((v) => ({ name: v.name, type: v.type }));
  // Today's picker stores the file name.
  const scripts: ScriptOption[] = scriptRows.map((s) => ({ value: s.path.split('/').pop() ?? s.path, label: s.name }));
  const automations: AutomationOption[] = rules.map((a) => ({ id: a.id, name: a.name, enabled: a.enabled })).sort((x, y) => x.name.localeCompare(y.name));
  return { sources, variables, channels, scripts, regions, nodes, automations };
}

export type BuilderData = ReturnType<typeof useBuilderData>;
