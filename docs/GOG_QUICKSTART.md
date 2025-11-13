# Quick Start: GOG Integration

## Step 1: Get GOG OAuth Credentials

1. Go to https://devportal.gog.com/
2. Sign in with your GOG account
3. Click "Create Application"
4. Fill in:
   - **Name**: Dillinger
   - **Redirect URI**: `http://localhost:3000/online_sources/gog-callback`
5. Save your **Client ID** and **Client Secret**

## Step 2: Configure Dillinger

Create a `.env` file in the project root (or add to existing):

```bash
GOG_CLIENT_ID=your_client_id_here
GOG_CLIENT_SECRET=your_client_secret_here
GOG_REDIRECT_URI=http://localhost:3000/online_sources/gog-callback
```

## Step 3: Restart Backend

```bash
# If running in development
cd packages/dillinger-core/backend
pnpm dev

# Or restart your Docker containers
docker-compose restart
```

## Step 4: Use the Feature

1. Open Dillinger in your browser: http://localhost:3000
2. Click **"Online Sources"** in the top navigation
3. Click **"Connect GOG Account"**
4. Login to GOG in the popup window
5. Authorize Dillinger
6. Your games will appear automatically!

## Troubleshooting

**Popup is blocked?**
- Allow popups for localhost in your browser settings

**Login button does nothing?**
- Check browser console for errors
- Verify your GOG credentials are set correctly
- Restart the backend server

**Games not loading?**
- Check the backend logs
- Try clicking "Refresh" 
- Verify your GOG account has games

**"Authentication expired"?**
- Click "Logout" then login again
- Tokens expire after 30 days of inactivity

## What's Next?

Currently, the integration shows your GOG library. Future updates will add:
- Add games to Dillinger library
- Download installers
- More online sources (Epic, Steam, etc.)

For detailed documentation, see: `docs/GOG_INTEGRATION.md`
