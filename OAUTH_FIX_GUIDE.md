# Fix OAuth Permission Error in Appwrite

## Error

```
User (role: guests) missing scope (account)
Code: 401
Type: general_unauthorized_scope
```

## Solution

This error means guests (unauthenticated users) don't have permission to create OAuth2 sessions. Follow these steps:

### Step 1: Access Appwrite Console

Go to your Appwrite Console (usually `http://localhost` if local or your deployed URL)

### Step 2: Configure Google OAuth Provider

1. Navigate to **Settings** → **Providers** (or **Auth Providers**)
2. Click on **Google**
3. Make sure it's **Enabled**
4. Verify you have:
   - Client ID (from Google Cloud Console)
   - Client Secret (from Google Cloud Console)
5. Save

### Step 3: Fix Guest Permissions

Choose ONE of these methods:

#### Method A: Via Security Settings (Easiest)

1. Go to **Settings** → **Security** (or **Auth Settings**)
2. Look for **"Allow guests to create OAuth sessions"** or similar
3. **Enable** it
4. Save

#### Method B: Via Role Permissions

1. Go to **Settings** → **Users** → **Roles** (or **Access Control**)
2. Find the **"Guests"** role
3. Add the following permissions:
   - `account.read`
   - `sessions.write`
   - `identities.read`
4. Save

#### Method C: Via API (if you have admin key)

Run this from your terminal:

```bash
# Set your environment variables
export APPWRITE_ENDPOINT="http://your-appwrite-url/v1"
export APPWRITE_PROJECT_ID="your-project-id"
export APPWRITE_API_KEY="your-api-key"

# Run the fix script
node scripts/fix-oauth-permissions.js
```

### Step 4: Verify Google OAuth Redirect URLs

In **Google Cloud Console**:

1. Go to **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID
3. Edit it and add your app URLs to "Authorized redirect URIs":
   ```
   http://localhost:5173/members
   http://localhost:5173
   https://yourdomain.com/members
   ```

### Step 5: Test

1. Clear browser cache/cookies
2. Try logging in with Google again
3. Should now redirect to Google login page instead of showing error

---

## If Still Not Working

1. **Check Appwrite logs** - Run `docker logs appwrite` (if using Docker)
2. **Verify API Key** - Make sure your `APPWRITE_API_KEY` is correct
3. **Check Google OAuth credentials** - Verify Client ID and Secret are correct
4. **Browser console** - Press F12 and check for error messages

## Quick Appwrite Console URLs

- **Local**: `http://localhost` (port 80 or as configured)
- **Settings**: `http://localhost/settings`
- **Providers**: `http://localhost/settings/providers`
- **Security**: `http://localhost/settings/security`
