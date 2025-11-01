/**
 * Format a timestamp to display as "X days ago", "Today", "Yesterday", etc.
 */
export function formatLastPlayed(isoTimestamp: string | undefined): string {
  if (!isoTimestamp) {
    return 'Never';
  }

  const now = new Date();
  const played = new Date(isoTimestamp);
  const diffMs = now.getTime() - played.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Check if it's within the last few hours
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes === 0) {
        return 'Just now';
      }
      return `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  if (diffDays < 365) {
    // Note: Using a 30-day approximation for month calculation
    // for simplicity and consistency
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Format hours into a readable format (e.g., "2.5h", "120h")
 */
export function formatPlayTime(hours: number | undefined): string {
  if (!hours || hours === 0) {
    return '0h';
  }

  if (hours < 1) {
    // Show minutes for sessions under 1 hour
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }

  // Round to 1 decimal place for readability
  return `${hours.toFixed(1)}h`;
}
