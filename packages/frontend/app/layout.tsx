import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-6">
                <div className="flex items-center">
                  <h1 className="text-3xl font-bold text-gray-900">Dillinger</h1>
                  <span className="ml-2 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                    Game Library Manager
                  </span>
                </div>
                <nav className="flex space-x-8">
                  <a 
                    href="/" 
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Library
                  </a>
                  <a 
                    href="/add-game" 
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Add Game
                  </a>
                  <a 
                    href="/sessions" 
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Sessions
                  </a>
                  <a 
                    href="/collections" 
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Collections
                  </a>
                  <a 
                    href="/platforms" 
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Platforms
                  </a>
                </nav>
              </div>
            </div>
          </header>
          
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
          
          <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center text-sm text-gray-500">
                <div>
                  <span>Dillinger Game Library Manager</span>
                  <span className="mx-2">•</span>
                  <span>Version {process.env.npm_package_version || '1.0.0'}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span>JSON Storage</span>
                  <span className="w-2 h-2 bg-green-400 rounded-full" title="Storage healthy"></span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}