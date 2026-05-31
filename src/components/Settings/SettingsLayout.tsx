import PageTitle from '@app/components/Common/PageTitle';
import type { SettingsRoute } from '@app/components/Common/SettingsTabs';
import SettingsTabs from '@app/components/Common/SettingsTabs';
import globalMessages from '@app/i18n/globalMessages';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  menuGeneralSettings: 'General',
  menuPlexSettings: 'Plex',
  menuJellyfinSettings: 'Jellyfin',
  menuEmbySettings: 'Emby',
  menuSources: 'Sources',
  menuDownloads: 'Downloads',
  menuLogs: 'Logs',
  menuJobs: 'Jobs',
  menuAbout: 'About',
});

type SettingsLayoutProps = {
  children: React.ReactNode;
};

const SettingsLayout = ({ children }: SettingsLayoutProps) => {
  const intl = useIntl();

  const settingsRoutes: SettingsRoute[] = [
    {
      text: intl.formatMessage(messages.menuGeneralSettings),
      route: '/settings/main',
      regex: /^\/settings(\/main)?$/,
    },
    {
      text: intl.formatMessage(messages.menuPlexSettings),
      route: '/settings/plex',
      regex: /^\/settings\/plex/,
    },
    {
      text: intl.formatMessage(messages.menuJellyfinSettings),
      route: '/settings/jellyfin',
      regex: /^\/settings\/jellyfin/,
    },
    {
      text: intl.formatMessage(messages.menuEmbySettings),
      route: '/settings/emby',
      regex: /^\/settings\/emby/,
    },
    {
      text: intl.formatMessage(messages.menuSources),
      route: '/settings/sources',
      regex: /^\/settings\/sources/,
    },
    {
      text: intl.formatMessage(messages.menuDownloads),
      route: '/settings/downloads',
      regex: /^\/settings\/downloads/,
    },
    {
      text: intl.formatMessage(messages.menuLogs),
      route: '/settings/logs',
      regex: /^\/settings\/logs/,
    },
    {
      text: intl.formatMessage(messages.menuJobs),
      route: '/settings/jobs',
      regex: /^\/settings\/jobs/,
    },
    {
      text: intl.formatMessage(messages.menuAbout),
      route: '/settings/about',
      regex: /^\/settings\/about/,
    },
  ];

  return (
    <>
      <PageTitle title={intl.formatMessage(globalMessages.settings)} />
      <div className="mt-6">
        <SettingsTabs settingsRoutes={settingsRoutes} />
      </div>
      <div className="mt-6 text-white sm:mt-10">{children}</div>
    </>
  );
};

export default SettingsLayout;
