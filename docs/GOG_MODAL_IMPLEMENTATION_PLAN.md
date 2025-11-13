# GOG Game Modal & Download UI Implementation Plan

## Remaining Tasks

### 1. Game Details Modal (gog-library/page.tsx)
- Add state: `selectedGame`, `showModal`, `gameDetails`, `loading Details`
- On tile click: fetch `/api/online-sources/gog/games/:id`, show modal
- Modal content:
  - Background image
  - Title, developer, publisher, release date
  - Description
  - Screenshots carousel
  - "Add to Library" button → triggers runner selection
  
### 2. Runner Selection in Modal
- Show platform selection (Windows/Wine or Linux/Native)
- Pass runner to download endpoint

### 3. Add Game to Library Endpoint
- Create POST `/api/games/from-gog` endpoint
- Parameters: `{ gogId, title, runner, coverImage, metadata }`
- Create Game entry with:
  - `installation.status = 'not_installed'`
  - `installation.installerPath = '/storage/metadata/<gogId>/installers'`
  - `installation.installMethod = 'automated'`
- Start download via DownloadManager
- Return gameId

### 4. Download Progress UI
- Poll `/api/online-sources/gog/downloads` every 2 seconds
- Show progress bar on game tiles in main library
- Display: `Downloading... 45%` or `Ready to Install`
- WebSocket alternative: subscribe to download events

### 5. Ready to Install State
- When download complete, update game status
- Show "Install" button instead of "Play"
- Skip installer path prompt in installation flow
- Use files from `/storage/metadata/<gogId>/installers`

## API Endpoints Already Implemented ✅
- GET `/api/online-sources/gog/games/:id` - Game details
- POST `/api/online-sources/gog/games/:id/download` - Start download
- GET `/api/online-sources/gog/downloads` - All downloads
- GET `/api/online-sources/gog/downloads/:gameId/progress` - Progress
- DELETE `/api/online-sources/gog/downloads/:gameId` - Cancel

## File Structure
```
frontend/app/
  online_sources/
    gog-library/
      page.tsx ← Add modal here
  games/
    page.tsx ← Show download progress
  components/
    GameDetailsModal.tsx ← New component
    DownloadProgress.tsx ← New component
    
backend/src/
  api/
    games.ts ← Add from-gog endpoint
    online-sources.ts ← Already done ✅
  services/
    download-manager.ts ← Already done ✅
```

## Next Session Commands
```bash
# Continue with modal implementation
cd /mnt/linuxfast/dev/dillinger
# Edit frontend/app/online_sources/gog-library/page.tsx
# Add modal UI and wire up API calls
```
