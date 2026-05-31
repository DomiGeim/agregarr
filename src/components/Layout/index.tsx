// SearchInput removed - no discovery functionality needed
import Sidebar, { menuMessages } from '@app/components/Layout/Sidebar';
import UserDropdown from '@app/components/Layout/UserDropdown';
import type { AvailableLocale } from '@app/context/LanguageContext';
import useFirstTimeSetup from '@app/hooks/useFirstTimeSetup';
import useLocale from '@app/hooks/useLocale';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import {
  Bars3Icon,
  ChartBarIcon,
  CogIcon,
  HomeIcon,
  PhotoIcon,
  QueueListIcon,
  RectangleStackIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const mobileNavLinks = [
  {
    href: '/dashboard',
    label: menuMessages.dashboard,
    icon: ChartBarIcon,
    activeRegExp: /^\/dashboard$/,
  },
  {
    href: '/',
    label: menuMessages.home,
    icon: HomeIcon,
    activeRegExp: /^\/$/,
  },
  {
    href: '/recommended',
    label: menuMessages.recommended,
    icon: StarIcon,
    activeRegExp: /^\/recommended$/,
  },
  {
    href: '/library',
    label: menuMessages.library,
    icon: RectangleStackIcon,
    activeRegExp: /^\/library/,
  },
  {
    href: '/allcollections',
    label: menuMessages.allcollections,
    icon: QueueListIcon,
    activeRegExp: /^\/allcollections$/,
  },
  {
    href: '/posters',
    label: menuMessages.posters,
    icon: PhotoIcon,
    activeRegExp: /^\/posters/,
  },
  {
    href: '/settings',
    label: menuMessages.settings,
    icon: CogIcon,
    activeRegExp: /^\/settings/,
  },
];

type LayoutProps = {
  children: React.ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useUser();
  const { currentSettings } = useSettings();
  const { setLocale } = useLocale();
  const router = useRouter();
  const intl = useIntl();
  const { isFirstTimeSetup } = useFirstTimeSetup();
  // Request and issue counting removed - not needed in Agregarr

  useEffect(() => {
    if (setLocale && user) {
      setLocale(
        (user?.settings?.locale
          ? user.settings.locale
          : currentSettings.locale) as AvailableLocale
      );
    }
  }, [setLocale, currentSettings.locale, user]);

  return (
    <div className="flex h-full min-h-full min-w-0 overflow-x-hidden bg-stone-900">
      <div className="pwa-only fixed inset-0 z-20 h-1 w-full border-stone-700 md:border-t" />
      <div className="absolute top-0 h-64 w-full bg-gradient-to-bl from-stone-800 to-stone-900">
        <div className="relative inset-0 h-full w-full bg-gradient-to-t from-stone-900 to-transparent" />
      </div>
      <Sidebar
        open={isSidebarOpen}
        setClosed={() => setIsSidebarOpen(false)}
        pendingRequestsCount={0}
        openIssuesCount={0}
        revalidateIssueCount={() => undefined}
        revalidateRequestsCount={() => undefined}
        isFirstTimeSetup={isFirstTimeSetup}
      />

      <div className="relative flex w-0 min-w-0 flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-800/80 bg-stone-900/95 px-3 py-2 backdrop-blur lg:static lg:justify-end lg:border-b-0 lg:bg-transparent lg:p-4">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-md bg-stone-800 text-white shadow-sm transition hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <Link href="/">
            <a className="flex min-w-0 flex-1 justify-center px-3 lg:hidden">
              <img
                src="/logo_full.svg"
                alt="Agregarr"
                className="h-8 max-w-[9rem]"
              />
            </a>
          </Link>
          <UserDropdown />
        </header>

        <main className="relative z-0 focus:outline-none" tabIndex={0}>
          <div className="mb-6 pb-24 lg:pb-0">
            <div className="max-w-8xl mx-auto w-full px-3 sm:px-4 lg:px-6">
              {children}
            </div>
          </div>
        </main>

        <nav
          className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-stone-700 bg-stone-900/95 px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1.5 shadow-2xl backdrop-blur lg:hidden"
          aria-label="Mobile navigation"
        >
          <div className="hide-scrollbar flex gap-1 overflow-x-auto">
            {mobileNavLinks.map((link) => {
              const active = router.pathname.match(link.activeRegExp);
              const Icon = link.icon;

              return (
                <Link href={link.href} key={link.href}>
                  <a
                    className={`flex min-w-[4.7rem] flex-1 flex-col items-center justify-center rounded-md px-2 py-1.5 text-[0.68rem] font-medium transition ${
                      active
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-300 hover:bg-stone-800 hover:text-white'
                    }`}
                  >
                    <Icon className="mb-0.5 h-5 w-5" />
                    <span className="max-w-full truncate">
                      {intl.formatMessage(link.label)}
                    </span>
                  </a>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
