# GOG Integration - Implementation Summary

## Overview
Added complete GOG.com integration to allow users to connect their GOG account, view their game library, and prepare for future game imports.

## What Was Implemented

### 1. Frontend Changes

#### Header Navigation (`app/layout.tsx`)
- Added new "Online Sources" link to the main navigation header
- Positioned before the "Settings" link

#### Online Sources Page (`app/online_sources/page.tsx`)
- Complete page for managing online game sources
- GOG section with:
  - Login/logout functionality
  - Authentication status display
  - Game library grid (4 columns with smaller tiles)
  - Refresh capability
  - Future placeholder sections for Epic, Steam, Xbox Game Pass

#### OAuth Callback Page (`app/online_sources/gog-callback/page.tsx`)
- Handles GOG OAuth redirect
- Processes authorization code
- Sends credentials to parent window via postMessage
- Provides user feedback (success/error states)
- Auto-closes after completion

### 2. Backend Changes

#### New API Routes (`backend/src/api/online-sources.ts`)
Implemented complete GOG OAuth 2.0 flow:

- **`GET /api/online-sources/gog/auth-url`**
  - Generates GOG OAuth authorization URL with CSRF protection
  - Returns URL for popup window

- **`POST /api/online-sources/gog/callback`**
  - Exchanges authorization code for access/refresh tokens
  - Stores tokens securely in data directory
  - Fetches and returns user information

- **`GET /api/online-sources/gog/status`**
  - Checks if user is authenticated with GOG
  - Validates token expiration
  - Returns authentication status and user info

- **`POST /api/online-sources/gog/logout`**
  - Deletes stored tokens
  - Logs user out of GOG integration

- **`GET /api/online-sources/gog/games`**
  - Fetches user's GOG game library
  - Auto-refreshes expired tokens
  - Returns formatted game list with images and URLs

#### Token Management
- Automatic token refresh when expired
- Secure storage in `{DILLINGER_ROOT}/storage/online-sources/gog-tokens.json`
- Tokens include: access_token, refresh_token, expires_at, user_id

#### Server Registration (`backend/src/index.ts`)
- Registered online-sources router
- Added proper import and route mounting

### 3. Documentation

#### GOG Integration Guide (`docs/GOG_INTEGRATION.md`)
Comprehensive documentation covering:
- Overview and prerequisites
- Step-by-step GOG OAuth app registration
- Environment variable configuration
- Authentication flow explanation
- Token storage details
- API endpoint reference
- Security considerations
- Troubleshooting guide
- Future enhancement ideas

#### Environment Template (`.env.example`)
- Added GOG configuration variables
- Included example values
- Documented all required settings

## Configuration Required

To use this feature, you need to:

1. **Register a GOG OAuth Application**
   - Visit https://devportal.gog.com/
   - Create new application
   - Set redirect URI to: `http://localhost:3000/online_sources/gog-callback`

2. **Add Environment Variables**
   ```bash
   GOG_CLIENT_ID=your_client_id
   GOG_CLIENT_SECRET=your_client_secret
   GOG_REDIRECT_URI=http://localhost:3000/online_sources/gog-callback
   ```

3. **Restart Backend**
   - Backend will use these credentials for OAuth flow

## User Flow

1. User navigates to "Online Sources" from header
2. Clicks "Connect GOG Account"
3. Popup opens with GOG login
4. User authorizes Dillinger
5. Tokens stored, popup closes
6. Games load automatically in 4-column grid
7. User can refresh or logout as needed

## Technical Details

### Security
- OAuth 2.0 with CSRF protection (state parameter)
- Tokens stored server-side only
- Automatic token refresh
- Secure postMessage communication between windows
- Origin validation on messages

### Token Lifecycle
1. User authorizes → receive access + refresh tokens
2. Access token expires (typically 1 hour)
3. Backend auto-refreshes using refresh token
4. Refresh token expires (typically 30 days) → user must re-login

### UI Design
- GOG games displayed in smaller tiles (4 per row)
- Each tile shows:
  - Game cover image
  - Game title
  - "Add" button (future: add to library)
  - "View on GOG" link
- Responsive design matching existing Dillinger style

## Future Enhancements

The implementation is structured to support:
- [ ] Adding games directly to Dillinger library
- [ ] Downloading game installers
- [ ] Additional online sources (Epic, Steam, Xbox)
- [ ] Sync game metadata and images
- [ ] Multi-account support
- [ ] Play statistics sync

## Files Changed

### Created
- `frontend/app/online_sources/page.tsx` - Main page
- `frontend/app/online_sources/gog-callback/page.tsx` - OAuth callback
- `backend/src/api/online-sources.ts` - API endpoints
- `docs/GOG_INTEGRATION.md` - Documentation
- `.env.example` - Configuration template

### Modified
- `frontend/app/layout.tsx` - Added navigation link
- `backend/src/index.ts` - Registered new API routes

## Dependencies

No new dependencies required - all necessary packages already present:
- `axios` - HTTP client for GOG API calls
- `fs-extra` - File system operations for token storage
- `uuid` - CSRF state generation

## Testing Recommendations

1. **Without GOG Credentials**
   - Page should load showing "Not connected" state
   - Login button should show helpful error about missing credentials

2. **With GOG Credentials**
   - Test login flow
   - Verify popup opens and closes properly
   - Check token storage in data directory
   - Verify games load correctly
   - Test logout functionality
   - Test token auto-refresh

3. **Edge Cases**
   - Popup blocked by browser
   - Network errors during OAuth
   - Expired refresh token
   - Invalid GOG credentials
   - Browser without postMessage support

## Notes

- Implementation follows existing Dillinger patterns
- Uses established storage service for token persistence
- Matches UI/UX of existing game library features
- Fully typed with TypeScript
- Error handling throughout
- Console logging for debugging
