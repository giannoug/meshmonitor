/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { renderWorkspace } from '../renderWorkspace';
import { expectBoard } from '../boardChecks';
import { fixtureApi } from '../../__fixtures__/fixtureApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useDashboardSources } from '../../../hooks/useDashboardData';

function SaveLabel() {
  const { t } = useTranslation();
  return <p>{t('common.save')}</p>;
}

function WhoAndSources() {
  const { authStatus } = useAuth();
  const { data } = useDashboardSources();
  if (!authStatus || !data) return null;
  return (
    <p>
      {authStatus.authenticated ? authStatus.user?.username : 'anonymous'}:{' '}
      {data.map((s) => s.name).join(', ')}
    </p>
  );
}

describe('renderWorkspace', () => {
  it('renders real English strings from en.json', async () => {
    const { findByText } = renderWorkspace(<SaveLabel />);
    expect(await findByText('Save')).toBeInTheDocument();
  });

  it('leaves the global key-only i18n mock in place outside it', () => {
    const { getByText } = render(<SaveLabel />);
    expect(getByText('common.save')).toBeInTheDocument();
  });

  it('serves the fixtures through fetch, inside auth and query providers', async () => {
    const { findByText } = renderWorkspace(<WhoAndSources />);
    expect(
      await findByText(/Station G2, Heltec MeshCore, Rooftop RAK, Reticulum node, Athens MQTT/),
    ).toHaveTextContent(/^admin:/);
  });

  it('signs in as anonymous when asked', async () => {
    const { findByText } = renderWorkspace(<WhoAndSources />, { anonymous: true });
    expect(await findByText(/Station G2/)).toHaveTextContent(/^anonymous:/);
  });

  it('phone: true makes the phone media query match', () => {
    renderWorkspace(<p />, { phone: true });
    expect(window.matchMedia('(max-width: 767.98px)').matches).toBe(true);
    expect(window.matchMedia('(min-width: 1024px)').matches).toBe(false);
  });
});

describe('fixtureApi', () => {
  it('returns the five Athens sources', async () => {
    const res = fixtureApi()('/api/sources');
    expect(res).toBeInstanceOf(Response);
    expect(await res!.json()).toHaveLength(5);
  });

  it('matches :param segments, applies overrides and misses unknown paths', async () => {
    const api = fixtureApi({ 'POST /api/sources/:id/connect': (url) => ({ hit: url.pathname }) });
    expect(await api('/api/sources/src-g2/connect', { method: 'POST' })!.json()).toEqual({
      hit: '/api/sources/src-g2/connect',
    });
    expect((await api('/api/sources/src-rak/status')!.json()).connected).toBe(false);
    expect(api('/api/nope')).toBeUndefined();
  });
});

describe('expectBoard', () => {
  it('passes when every must string is present', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>Station   G2</span><span>Kifisia\nRooftop</span>';
    expect(() => expectBoard('__test__', el)).not.toThrow();
  });

  it('throws when an absent string is present', () => {
    const el = document.createElement('div');
    el.textContent = 'Station G2 Kifisia Rooftop no chat yet';
    expect(() => expectBoard('__test__', el)).toThrow(/no chat yet/);
  });

  it('throws when a must string is missing', () => {
    const el = document.createElement('div');
    el.textContent = 'Station G2';
    expect(() => expectBoard('__test__', el)).toThrow(/Kifisia Rooftop/);
  });
});
