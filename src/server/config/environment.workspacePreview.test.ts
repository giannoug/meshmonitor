import { describe, it, expect, afterEach } from 'vitest';
import { loadEnvironmentConfig, resetEnvironmentConfig } from './environment.js';

describe('Environment Configuration - WORKSPACE_PREVIEW (#6365)', () => {
  const original = process.env.WORKSPACE_PREVIEW;
  afterEach(() => {
    if (original === undefined) delete process.env.WORKSPACE_PREVIEW;
    else process.env.WORKSPACE_PREVIEW = original;
    resetEnvironmentConfig();
  });

  it('is false unless WORKSPACE_PREVIEW is exactly "true"', () => {
    for (const [v, want] of [[undefined, false], ['1', false], ['true', true]] as const) {
      if (v === undefined) delete process.env.WORKSPACE_PREVIEW;
      else process.env.WORKSPACE_PREVIEW = v;
      resetEnvironmentConfig();
      expect(loadEnvironmentConfig().workspacePreview).toBe(want);
    }
  });
});
