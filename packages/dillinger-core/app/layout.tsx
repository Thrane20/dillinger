import type { Metadata } from 'next';
import './globals.css';
import ThemeToggle from './components/ThemeToggle';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';

export const metadata: Metadata = {
  title: 'Dillinger - Game Library Manager',
  description: 'Manage and play games across multiple platforms with containerized execution',
  keywords: ['games', 'library', 'manager', 'docker', 'streaming', 'cross-platform'],
  authors: [{ name: 'Dillinger Team' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-text transition-colors duration-300">
        <div className="min-h-screen flex flex-col bg-background/90">
          <header className="sticky top-0 z-20 bg-surface/80 border-b border-border/60 backdrop-blur-xl shadow-soft">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center justify-between lg:justify-start">
                  <div>
                    <h1 className="text-3xl font-bold text-text">Dillinger</h1>
                    <span className="mt-1 inline-block text-xs font-medium uppercase tracking-widest text-muted">
                      Game Library Manager
                    </span>
                  </div>
                  <div className="lg:hidden">
                    <ThemeToggle />
                  </div>
                </div>
                <div className="flex w-full items-center justify-between lg:justify-end">
                  <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
                    <a
                      href="/"
                      className="px-3 py-2 rounded-xl transition-colors hover:text-primary hover:bg-primary-soft"
                    >
                      Library
                    </a>
                    <a
                      href="/scrapers"
                      className="px-3 py-2 rounded-xl transition-colors hover:text-primary hover:bg-primary-soft"
                    >
                      Scrapers
                    </a>
                    <a
                      href="/add-game"
                      className="px-3 py-2 rounded-xl transition-colors hover:text-primary hover:bg-primary-soft"
                    >
                      Add Game
                    </a>
                    <a
                      href="/sessions"
                      className="px-3 py-2 rounded-xl transition-colors hover:text-primary hover:bg-primary-soft"
                    >
                      Sessions
                    </a>
                    <a
                      href="/collections"
                      className="px-3 py-2 rounded-xl transition-colors hover:text-primary hover:bg-primary-soft"
                    >
                      Collections
                    </a>
                    <a
                      href="/platforms"
                      className="px-3 py-2 rounded-xl transition-colors hover:text-primary hover:bg-primary-soft"
                    >
                      Platforms
                    </a>
                    <a
                      href="/online_sources"
                      className="px-3 py-2 rounded-xl transition-colors hover:text-primary hover:bg-primary-soft"
                    >
                      Online Sources
                    </a>
                    <a
                      href="/settings"
                      className="px-3 py-2 rounded-xl transition-colors hover:text-primary hover:bg-primary-soft"
                    >
                      Settings
                    </a>
                  </nav>
                  <div className="hidden lg:block ml-4">
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Three Column Layout */}
          <div className="flex gap-6 w-full px-4 sm:px-6 lg:px-8 pb-14 overflow-hidden h-[calc(100vh-140px)]">
            {/* Left Sidebar - 1/5 width, fixed height with own scroll */}
            <div className="w-1/5 h-full overflow-y-auto py-6">
              <LeftSidebar />
            </div>

            {/* Center Content - 3/5 width, fixed height, children handle their own overflow */}
            <main className="w-3/5 h-full overflow-y-auto py-6">
              {children}
            </main>

            {/* Right Sidebar - 1/5 width, fixed height with own scroll */}
            <div className="w-1/5 h-full overflow-y-auto py-6">
              <RightSidebar />
            </div>
          </div>

          <footer className="fixed bottom-0 left-0 right-0 bg-surface/80 border-t border-border/60 backdrop-blur-xl z-10">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 text-sm text-muted md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <span>Dillinger Game Library Manager</span>
                  <span className="hidden md:inline" aria-hidden="true">
                    •
                  </span>
                  <span>Version {process.env.npm_package_version || '1.0.0'}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 group cursor-help">
                    <span title="JSON storage status">JSON Storage</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-success shadow-soft" title="Storage healthy"></span>
                  </div>
                  <div className="flex items-center gap-2 group cursor-help">
                    <span title="Backend server status">Backend Server</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-success shadow-soft" title="Server online"></span>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
