# GOG Integration Setup

This document explains how to set up GOG (Good Old Games) integration in Dillinger to allow users to view and import games from their GOG library.

## Overview

The GOG integration allows users to:
- Login to their GOG account via OAuth 2.0
- View their owned GOG games
- Import games to their Dillinger library (future feature)

## Prerequisites

To use GOG integration, you need to register an OAuth application with GOG to obtain:
- Client ID
- Client Secret

## Registering a GOG OAuth Application

1. **Visit GOG Developer Portal**
   - Go to https://devportal.gog.com/
   - Sign in with your GOG account

2. **Create a New Application**
   - Navigate to the "My Applications" section
   - Click "Create Application"
   - Fill in the application details:
     - **Application Name**: Dillinger Game Library Manager
     - **Description**: Personal game library manager with multi-platform support
     - **Redirect URI**: `http://localhost:3000/online_sources/gog-callback`
     - For production, use your actual domain: `https://yourdomain.com/online_sources/gog-callback`

3. **Note Your Credentials**
   - After creating the application, note your:
     - **Client ID**: A long alphanumeric string
     - **Client Secret**: Keep this secure and never commit it to version control

## Configuration

### Backend Configuration

Add the following environment variables to your backend configuration:

```bash
# GOG OAuth Configuration
GOG_CLIENT_ID=your_client_id_here
GOG_CLIENT_SECRET=your_client_secret_here
GOG_REDIRECT_URI=http://localhost:3000/online_sources/gog-callback
```

**For Docker deployments**, add these to your `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - GOG_CLIENT_ID=${GOG_CLIENT_ID}
      - GOG_CLIENT_SECRET=${GOG_CLIENT_SECRET}
      - GOG_REDIRECT_URI=http://localhost:3000/online_sources/gog-callback
```

Then create a `.env` file in your project root:

```bash
GOG_CLIENT_ID=your_client_id_here
GOG_CLIENT_SECRET=your_client_secret_here
```

### Development Setup

1. **Create `.env` file** (in the project root):
   ```bash
   GOG_CLIENT_ID=your_client_id_here
   GOG_CLIENT_SECRET=your_client_secret_here
   GOG_REDIRECT_URI=http://localhost:3000/online_sources/gog-callback
   ```

2. **Add to `.gitignore`** (should already be there):
   ```
   .env
   .env.local
   ```

## How It Works

### Authentication Flow

1. **User clicks "Connect GOG Account"** on the Online Sources page
2. **Frontend requests auth URL** from backend (`GET /api/online-sources/gog/auth-url`)
3. **Popup window opens** directing user to GOG's OAuth login page
4. **User logs in** and authorizes the application
5. **GOG redirects** to the callback URL with an authorization code
6. **Callback page sends code** to the parent window via postMessage
7. **Frontend sends code** to backend (`POST /api/online-sources/gog/callback`)
8. **Backend exchanges code** for access token and refresh token
9. **Tokens are stored** in `{DILLINGER_ROOT}/storage/online-sources/gog-tokens.json`
10. **Frontend loads games** from GOG API

### Token Storage

Tokens are stored securely in the data directory:
- **Path**: `{DILLINGER_ROOT}/storage/online-sources/gog-tokens.json`
- **Contents**: 
  - `access_token`: Used to authenticate API requests
  - `refresh_token`: Used to obtain new access tokens
  - `expires_at`: Timestamp when the access token expires
  - `user_id`: GOG user ID

The backend automatically refreshes expired tokens using the refresh token.

### API Endpoints

#### Backend Endpoints

- `GET /api/online-sources/gog/auth-url` - Get OAuth authorization URL
- `POST /api/online-sources/gog/callback` - Exchange code for tokens
- `GET /api/online-sources/gog/status` - Check authentication status
- `POST /api/online-sources/gog/logout` - Logout and delete tokens
- `GET /api/online-sources/gog/games` - Get user's GOG game library

#### Frontend Routes

- `/online_sources` - Main online sources page
- `/online_sources/gog-callback` - OAuth callback handler

## GOG API

The integration uses the GOG Embed API:
- **Base URL**: https://embed.gog.com
- **Auth URL**: https://auth.gog.com/auth
- **Token URL**: https://auth.gog.com/token

### API Endpoints Used

- `GET /user/data` - Get user information
- `GET /user/data/games` - Get list of owned games

## Security Considerations

1. **Never commit secrets** - Keep `GOG_CLIENT_SECRET` out of version control
2. **Use HTTPS in production** - OAuth requires secure connections
3. **Validate redirect URIs** - Ensure they match registered URIs
4. **Token storage** - Tokens are stored locally in the data directory
5. **CSRF protection** - State parameter is used to prevent CSRF attacks

## Troubleshooting

### "Failed to open popup window"
- Browser may be blocking popups
- Add an exception for localhost (or your domain)
- Check browser console for errors

### "Authentication expired"
- Access token has expired and refresh failed
- User needs to login again
- Check backend logs for refresh token errors

### "Failed to load games"
- Check GOG API status
- Verify access token is valid
- Check backend logs for API errors
- Ensure redirect URI matches registered URI exactly

### Token Refresh Failures
- Refresh token may have expired (typically 30 days)
- User needs to re-authenticate
- Tokens are automatically cleared on refresh failure

## Future Enhancements

- [ ] Import games directly to Dillinger library
- [ ] Download game installers via GOG API
- [ ] Sync play statistics with GOG
- [ ] Support for GOG Galaxy features
- [ ] Multiple account support

## References

- [GOG Developer Portal](https://devportal.gog.com/)
- [GOG API Documentation](https://gogapidocs.readthedocs.io/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
