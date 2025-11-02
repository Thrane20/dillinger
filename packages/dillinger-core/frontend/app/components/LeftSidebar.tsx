'use client';

export default function LeftSidebar() {
  return (
    <div className="space-y-4">
      <div className="card sticky top-4 border-2 border-primary/30 shadow-lg bg-surface/75 backdrop-blur-sm">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-text">Quick Actions</h2>
          </div>
          
          <div className="space-y-3">
            {/* Add Game */}
            <a 
              href="/games/add"
              className="block p-4 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">Add Game</h3>
                  <p className="text-xs text-muted mt-1">Add games to your library</p>
                </div>
              </div>
            </a>

            {/* Scrape Game */}
            <a 
              href="/scrapers"
              className="block p-4 rounded-lg bg-secondary/10 border border-secondary/30 hover:bg-secondary/20 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20 text-secondary group-hover:bg-secondary group-hover:text-white transition-all">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text group-hover:text-secondary transition-colors">Scrape Game</h3>
                  <p className="text-xs text-muted mt-1">Fetch game metadata from external sources</p>
                </div>
              </div>
            </a>

            {/* Filters Section */}
            <div className="pt-2">
              <div className="p-4 rounded-lg bg-surface/50 border border-border">
                <h3 className="text-sm font-semibold text-text mb-2">Filters</h3>
                <p className="text-xs text-muted italic">This space for rent</p>
              </div>
            </div>
            
            {/* Collections Section */}
            <div className="p-4 rounded-lg bg-surface/50 border border-border">
              <h3 className="text-sm font-semibold text-text mb-2">Collections</h3>
              <p className="text-xs text-muted italic">This space for rent</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
