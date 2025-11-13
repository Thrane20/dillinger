# GOG Library Pagination Implementation

## Overview
Implemented automatic pagination to fetch all games from a user's GOG library, not just the first 100.

## Changes Made

### Backend (`packages/dillinger-core/backend/src/api/online-sources.ts`)

**Endpoint**: `GET /api/online-sources/gog/games`

**Key Changes**:
1. Added pagination loop to fetch all pages:
   ```typescript
   let allProducts: any[] = [];
   let currentPage = 1;
   let totalPages = 1;

   while (currentPage <= totalPages) {
     const url = `${GOG_EMBED_URL}/account/getFilteredProducts?mediaType=1&page=${currentPage}`;
     const gamesResponse = await axios.get(url, {
       headers: { Authorization: `Bearer ${accessToken}` },
     });
     
     allProducts = allProducts.concat(gamesResponse.data.products || []);
     totalPages = gamesResponse.data.totalPages || 1;
     currentPage++;
   }
   ```

2. Added logging to track progress:
   - Logs each page fetched: `Fetched page X/Y (Z games)`
   - Logs total count: `Total games fetched: X`

3. Updated response to include `totalPages`:
   ```typescript
   res.json({
     success: true,
     games,
     count: games.length,
     totalPages,
   });
   ```

### Frontend (`packages/dillinger-core/frontend/app/online_sources/gog-library/page.tsx`)

**Key Changes**:
1. Added `GOGLibraryResponse` interface with `totalPages` field
2. Added state to track total pages: `const [totalPages, setTotalPages] = useState<number>(0);`
3. Updated header to show page count: `X games owned (Y pages fetched)`
4. Enhanced loading message: "Fetching all pages, this may take a moment"

## API Reference

### GOG API Pagination Parameters
- **Parameter**: `page` (query parameter)
- **Response**: `totalPages` (indicates total number of pages)
- **Page Size**: ~100 games per page (default)
- **Endpoint**: `https://embed.gog.com/account/getFilteredProducts?mediaType=1&page=X`

### Response Format
```json
{
  "success": true,
  "games": [
    {
      "id": "1234567890",
      "title": "Game Title",
      "image": "https://images.gog.com/xyz_196.jpg",
      "url": "https://www.gog.com/game/game-slug"
    }
  ],
  "count": 250,
  "totalPages": 3
}
```

## Performance Considerations

- **Sequential Fetching**: Pages are fetched sequentially to avoid rate limiting
- **Loading Time**: For large libraries (300+ games), this may take 3-5 seconds
- **Memory Usage**: All games are loaded into memory at once
- **Future Enhancement**: Consider implementing client-side pagination or infinite scroll for very large libraries (500+ games)

## Testing

To test with different library sizes:
1. Connect a GOG account with 100+ games
2. Click "Browse Library"
3. Watch backend logs for pagination progress
4. Verify all games appear in the grid
5. Check header shows correct game count and page count

## References

- Lutris GOG implementation: `/specs/gog.py` (lines 248-278)
- GOG embed API: `https://embed.gog.com/account/getFilteredProducts`
