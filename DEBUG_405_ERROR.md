# Debugging 405 Method Not Allowed Error

## Current Issue
Login request to `/api/auth/login` is returning 405 (Method Not Allowed)

## Steps to Debug

### 1. Check Railway Backend Logs
**This is the most important step - it will show the actual error:**

1. Go to Railway Dashboard: https://railway.app/
2. Click on your **Backend Service** (server)
3. Click on the **"Deployments"** tab
4. Click on the most recent deployment
5. Click on **"View Logs"**
6. Look for errors when you try to login

**What to look for:**
- CORS errors (e.g., "Origin not allowed")
- Route errors (e.g., "Cannot POST /api/auth/login")
- Any stack traces or error messages

### 2. Verify Backend Environment Variables

In Railway Backend Service, check that these are set:

```
DATABASE_URL=postgresql://neondb_owner:npg_M6gIDPs2oUiE@ep-round-feather-agg67a9e-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=leadtime-labs-jwt-secret-key-change-in-production-2026
NODE_ENV=production
FRONTEND_URL=https://go.getleadtime.de
```

**CRITICAL:** Make sure `FRONTEND_URL` is set to `https://go.getleadtime.de` (with https, without trailing slash)

### 3. Verify Frontend Environment Variables

In Railway Frontend Service, check that this is set:

```
VITE_API_URL=https://[your-backend-url].railway.app/api
```

**How to find your backend URL:**
1. Go to Backend Service in Railway
2. Click on "Settings" tab
3. Look for "Domains" section
4. Copy the Railway-provided domain (e.g., `tinycrm-production.up.railway.app`)
5. Add `/api` to the end

### 4. Common Issues and Fixes

#### Issue A: CORS Error
**Symptoms:** 405 or CORS error in browser console
**Fix:** Ensure FRONTEND_URL is correctly set in backend (see step 2)

#### Issue B: Wrong API URL
**Symptoms:** Request goes to wrong URL (check Network tab in browser)
**Fix:** Ensure VITE_API_URL is correctly set in frontend (see step 3)

#### Issue C: Backend Not Running
**Symptoms:** "Failed to fetch" or connection refused errors
**Fix:** Check backend logs for startup errors, ensure database migration ran

#### Issue D: Missing Environment Variables After Deploy
**Symptoms:** Backend starts but fails on first request
**Fix:** After adding environment variables, you must **redeploy** the service

### 5. Testing Steps

After fixing environment variables:

1. **Redeploy backend** if you changed environment variables
2. **Redeploy frontend** if you changed environment variables
3. **Clear browser cache** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
4. **Try login again**
5. **Check browser Network tab** to see the actual request/response

### 6. Quick Verification Checklist

- [ ] Backend service is deployed and running (green status in Railway)
- [ ] Frontend service is deployed and running (green status in Railway)
- [ ] FRONTEND_URL is set in backend environment variables
- [ ] VITE_API_URL is set in frontend environment variables
- [ ] Custom domain go.getleadtime.de is configured in frontend settings
- [ ] Backend logs show no startup errors
- [ ] Browser Network tab shows request going to correct backend URL

## Expected Network Request

When you try to login, you should see in the browser Network tab:

```
Request URL: https://[backend-url].railway.app/api/auth/login
Request Method: POST
Status Code: 200 OK (or 401 if wrong password)

Request Headers:
  Content-Type: application/json
  Origin: https://go.getleadtime.de

Response Headers:
  Access-Control-Allow-Origin: https://go.getleadtime.de
```

If you see 405, the issue is that the backend is not accepting the POST request.

## Most Likely Cause

Based on the error, the most likely causes are:

1. **FRONTEND_URL not set** - Backend CORS is blocking the request
2. **FRONTEND_URL incorrect** - Set to http instead of https, or has trailing slash
3. **VITE_API_URL not set** - Frontend is sending request to wrong URL
4. **Environment variables not applied** - Need to redeploy after setting variables

## Next Steps

1. Check backend logs (step 1) - this will tell you the exact error
2. Verify FRONTEND_URL is set to `https://go.getleadtime.de` (no trailing slash)
3. Verify VITE_API_URL is set to your backend URL + `/api`
4. Redeploy both services after setting environment variables
5. Try login again and check browser console/network tab

## Need More Help?

If the issue persists, share:
- Backend logs from Railway
- Browser console errors (full error message)
- Network tab screenshot showing the failed request
- Confirmation that environment variables are set
