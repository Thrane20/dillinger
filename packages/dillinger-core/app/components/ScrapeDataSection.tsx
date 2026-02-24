'use client';

import Link from 'next/link';

interface ScrapeDataSectionProps {
  scrapeHref: string | null;
}

export default function ScrapeDataSection({ scrapeHref }: ScrapeDataSectionProps) {
  if (!scrapeHref) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      <h3 className="text-lg font-semibold text-text border-b pb-2">Scrape Data</h3>
      <p className="text-sm text-muted">
        Fetch metadata and images from external sources, then pick tile/backdrop images.
      </p>
      <div>
        <Link
          href={scrapeHref}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          title="Scrape metadata and images"
        >
          Scrape Data
          <span aria-hidden>
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
