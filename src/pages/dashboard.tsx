import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import { Permission, useUser } from '@app/hooks/useUser';
import type { NextPage } from 'next';
import { defineMessages, useIntl } from 'react-intl';
// useSWR import removed - not used in simplified dashboard
import CollectionStatsGrid from '@app/components/Dashboard/CollectionStatsGrid';
import DashboardInsights from '@app/components/Dashboard/DashboardInsights';
import DashboardStats from '@app/components/Dashboard/DashboardStats';
import MissingItemsFeed from '@app/components/Dashboard/MissingItemsFeed';
import { useEffect, useState } from 'react';

const messages = defineMessages({
  dashboardTitle: 'Dashboard',
  dashboardDescription:
    'Overview of your Agregarr statistics and collection performance',
  compactMode: 'Compact mode',
  comfortableMode: 'Comfortable mode',
});

const DashboardPage: NextPage = () => {
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    try {
      setCompactMode(
        localStorage.getItem('agregarr-dashboard-compact') === 'on'
      );
    } catch {
      setCompactMode(false);
    }
  }, []);

  const toggleCompactMode = () => {
    setCompactMode((current) => {
      const next = !current;

      try {
        localStorage.setItem('agregarr-dashboard-compact', next ? 'on' : 'off');
      } catch {
        // Ignore localStorage write failures in private browsing contexts.
      }

      return next;
    });
  };

  if (!user) {
    return <LoadingSpinner />;
  }

  if (!hasPermission(Permission.ADMIN)) {
    return (
      <>
        <PageTitle title={intl.formatMessage(messages.dashboardTitle)} />
        <div className="mb-8">
          <h3 className="heading text-white">Access Denied</h3>
          <p className="description">
            You don&apos;t have permission to access this page.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.dashboardTitle)} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="heading text-white">
            {intl.formatMessage(messages.dashboardTitle)}
          </h3>
          <p className="description">
            {intl.formatMessage(messages.dashboardDescription)}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleCompactMode}
          className="rounded border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-orange-500/60"
        >
          {intl.formatMessage(
            compactMode ? messages.comfortableMode : messages.compactMode
          )}
        </button>
      </div>

      <div className={compactMode ? 'space-y-4 text-sm' : 'space-y-6'}>
        {/* Overview Stats */}
        <DashboardStats />

        <DashboardInsights />

        <div
          className={`grid grid-cols-1 lg:grid-cols-2 ${
            compactMode ? 'gap-4' : 'gap-6'
          }`}
        >
          {/* Collection Statistics */}
          <div className="lg:col-span-1">
            <CollectionStatsGrid />
          </div>

          {/* Recently Added Missing Items */}
          <div className="lg:col-span-1">
            <MissingItemsFeed />
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
