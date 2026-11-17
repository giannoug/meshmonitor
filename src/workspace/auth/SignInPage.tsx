/**
 * The full-page sign-in (boards 11-01, 11-07; note s11n0): today's LoginPage,
 * shown by WorkspaceApp instead of the shell when anonymous viewing is off
 * and there is no session. No rail, sidebar or tab bar, and none of the
 * shell's data requests. The custom title and logo (CUSTOM_TITLE /
 * CUSTOM_LOGO_URL) or today's default mark, the card, then today's footer:
 * the version, View on GitHub and the operator's privacy links.
 */
import { useTranslation } from 'react-i18next';
import { version } from '../../../package.json';
import { useAuth } from '../../contexts/AuthContext';
import { usePrivacyLinks, privacyLinkHref, isExternalPrivacyLink } from '../../hooks/usePrivacyLinks';
import { PRIVACY_LINK_FALLBACK_LABEL } from '../../types/privacy';
import MeshMonitorLogo from '../../components/MeshMonitorLogo';
import { UiIcon } from '../../components/icons';
import { appBasename } from '../../init';
import { useIsPhone } from '../shell/useIsPhone';
import SignInCard from './SignInCard';
import styles from './SignIn.module.css';

export default function SignInPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { authStatus } = useAuth();
  const { links } = usePrivacyLinks();
  // The server trims these and sends null when unset (LoginPage's fallback).
  const title = authStatus?.customTitle || 'MeshMonitor';
  const logoUrl = authStatus?.customLogoUrl || null;

  return (
    <main className={styles.page} data-phone={isPhone || undefined}>
      <div className={styles.frame}>
        <header className={styles.brand}>
          {logoUrl ? (
            <img className={styles.logoImage} src={logoUrl} alt={title} width={64} height={64} />
          ) : (
            <span className={styles.logo} aria-hidden="true">
              <MeshMonitorLogo size={36} />
            </span>
          )}
          <h1 className={styles.title}>{title}</h1>
        </header>
        <SignInCard page />
      </div>
      <footer className={styles.footer}>
        <span>{t('common.version')} {version}</span>
        <a className={styles.footerLink} href="https://github.com/yeraze/meshmonitor" target="_blank" rel="noopener noreferrer">
          <UiIcon name="code" size={14} />
          {t('common.view_on_github')}
        </a>
        {/* Disclosure links (#5156), as PrivacyLinks draws them. */}
        {links.length > 0 && (
          <nav className={styles.footerLinks} aria-label={t('privacy.links_label', 'Site policies')}>
            {links.map((link) => {
              const external = isExternalPrivacyLink(link);
              return (
                <a
                  key={link.slug}
                  className={styles.footerLink}
                  href={privacyLinkHref(link, appBasename)}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {link.title?.trim() || t(`privacy.link.${link.slug}`, PRIVACY_LINK_FALLBACK_LABEL[link.slug])}
                </a>
              );
            })}
          </nav>
        )}
      </footer>
    </main>
  );
}
