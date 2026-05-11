'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Cog6ToothIcon,
  ComputerDesktopIcon,
  FolderPlusIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  PlayCircleIcon,
  ServerStackIcon,
  SignalIcon,
  SparklesIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

const platformLinks = [
  { id: 'all', label: 'All Platforms', href: '/' },
  { id: 'linux-native', label: 'Linux', href: '/?platform=linux-native' },
  { id: 'windows-wine', label: 'Wine', href: '/?platform=windows-wine' },
  { id: 'amiga', label: 'Amiga', href: '/?platform=amiga' },
  { id: 'c64', label: 'Commodore', href: '/?platform=c64' },
  { id: 'mame', label: 'Arcade', href: '/?platform=mame' },
];

const systemLinks = [
  { href: '/sessions', label: 'Sessions', icon: PlayCircleIcon },
  { href: '/streaming', label: 'Streaming', icon: SignalIcon },
  { href: '/platforms', label: 'Platforms', icon: ComputerDesktopIcon },
  { href: '/scrapers', label: 'Scrapers', icon: SparklesIcon },
  { href: '/online_sources', label: 'Online Sources', icon: GlobeAltIcon },
  { href: '/settings', label: 'Settings', icon: Cog6ToothIcon },
];

const topNav = [
  { href: '/', label: 'LIBRARY' },
  { href: '/games/add', label: 'ADD' },
  { href: '/sessions', label: 'SESSIONS' },
  { href: '/settings', label: 'CONFIG' },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkbenchShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activePlatform, setActivePlatform] = useState('all');

  useEffect(() => {
    queueMicrotask(() => {
      if (pathname !== '/') {
        setActivePlatform('');
        return;
      }
      setActivePlatform(new URLSearchParams(window.location.search).get('platform') || 'all');
    });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="fixed inset-x-0 top-0 z-40 h-12 border-b-2 border-border bg-background/95">
        <div className="flex h-full items-center gap-3 px-3">
          <Link href="/" className="flex h-full min-w-[190px] items-center gap-2 border-r-2 border-border pr-3">
            <ServerStackIcon className="h-5 w-5 text-accent" />
            <div className="leading-none">
              <div className="font-display text-sm font-black uppercase text-primary">Dillinger</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Workbench</div>
            </div>
          </Link>
          <nav className="hidden h-full items-center gap-1 md:flex">
            {topNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-full items-center border-x border-transparent px-3 text-xs font-bold tracking-wide ${
                  isActivePath(pathname, item.href)
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted hover:border-border hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action="/" className="ml-auto hidden w-full max-w-md items-center gap-2 border-2 border-neutral bg-black/30 px-2 py-1 md:flex">
            <MagnifyingGlassIcon className="h-4 w-4 text-muted" />
            <input
              name="q"
              placeholder="COMMAND / SEARCH LIBRARY"
              className="h-7 flex-1 border-0 bg-transparent p-0 text-xs uppercase tracking-wide text-text placeholder:text-muted focus:ring-0"
            />
          </form>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-success">
            <span className="h-2 w-2 bg-success shadow-[0_0_10px_rgb(var(--color-success))]" />
            Online
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-12 z-30 hidden w-[var(--workbench-sidebar)] border-r-2 border-border bg-surface/95 lg:block">
        <div className="flex h-full flex-col">
          <div className="workbench-titlebar">
            <span>PLATFORMS.SYS</span>
          </div>
          <nav className="space-y-1 p-2">
            {platformLinks.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center justify-between border-2 px-2 py-2 text-xs font-bold uppercase tracking-wide ${
                  activePlatform === item.id
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-transparent text-muted hover:border-neutral hover:text-text'
                }`}
              >
                <span>{item.label}</span>
                <Squares2X2Icon className="h-4 w-4" />
              </Link>
            ))}
          </nav>
          <div className="mt-2 workbench-titlebar border-t-2">
            <span>SYSTEM.LINKS</span>
          </div>
          <nav className="space-y-1 p-2">
            <Link
              href="/games/add"
              className={`flex items-center gap-2 border-2 px-2 py-2 text-xs font-bold uppercase tracking-wide ${
                isActivePath(pathname, '/games/add') ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-muted hover:border-neutral hover:text-text'
              }`}
            >
              <FolderPlusIcon className="h-4 w-4" />
              Add Game
            </Link>
            {systemLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 border-2 px-2 py-2 text-xs font-bold uppercase tracking-wide ${
                    isActivePath(pathname, item.href)
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-transparent text-muted hover:border-neutral hover:text-text'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t-2 border-border p-3 text-[10px] uppercase tracking-wide text-muted">
            <div className="mb-2 flex items-center justify-between">
              <span>JSON Storage</span>
              <span className="text-success">OK</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Version</span>
              <span>1.0.0</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen pt-12 lg:pl-[var(--workbench-sidebar)]">
        <div className="mx-auto w-full max-w-[1600px] p-3 pb-20 lg:p-4">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t-2 border-border bg-background/95 lg:hidden">
        {topNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-2 py-3 text-center text-[10px] font-bold uppercase ${
              isActivePath(pathname, item.href) ? 'text-primary' : 'text-muted'
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/settings" className="px-2 py-3 text-center text-[10px] font-bold uppercase text-muted">
          Settings
        </Link>
      </nav>
    </div>
  );
}
