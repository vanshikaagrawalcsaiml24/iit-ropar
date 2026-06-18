import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongodb';
import { createSession, logLoginAttempt } from '@/lib/session';
import { getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// GET /api/auth/google/callback — handle Google OAuth callback
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (error) {
      return Response.redirect(`${appUrl}/raise-query?auth=error&reason=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return Response.redirect(`${appUrl}/raise-query?auth=error&reason=missing_params`);
    }

    // Validate CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_state');
    if (!storedState || storedState.value !== state) {
      return Response.redirect(`${appUrl}/raise-query?auth=error&reason=invalid_state`);
    }
    cookieStore.delete('oauth_state');

    // Exchange code for access token
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      return Response.redirect(`${appUrl}/raise-query?auth=error&reason=not_configured`);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', await tokenRes.text());
      return Response.redirect(`${appUrl}/raise-query?auth=error&reason=token_failed`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Fetch user profile from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      return Response.redirect(`${appUrl}/raise-query?auth=error&reason=profile_failed`);
    }

    const profile = await profileRes.json();
    const googleEmail = (profile.email || '').toLowerCase();
    const googleName = profile.name || '';
    const googleId = profile.id || '';

    if (!googleEmail) {
      return Response.redirect(`${appUrl}/raise-query?auth=error&reason=no_email`);
    }

    const db = await getDb();

    // Check if user already exists
    let user = await db.collection('users').findOne({
      $or: [{ email: googleEmail }, { googleId }],
    });

    if (user) {
      // Existing user — update Google info if needed
      if (!user.googleId) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { googleId, authProvider: user.authProvider === 'local' ? 'local' : 'google' } }
        );
      }
    } else {
      // New user — auto-register
      const username = googleEmail.split('@')[0].replace(/[^a-z0-9_]/g, '_').slice(0, 30);

      // Ensure unique username
      let finalUsername = username;
      let counter = 1;
      while (await db.collection('users').findOne({ username: finalUsername })) {
        finalUsername = `${username.slice(0, 26)}_${counter}`;
        counter++;
      }

      const result = await db.collection('users').insertOne({
        username: finalUsername,
        email: googleEmail,
        passwordHash: null,
        emailVerified: true,
        authProvider: 'google',
        googleId,
        googleName,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
      });

      user = {
        _id: result.insertedId,
        username: finalUsername,
        email: googleEmail,
      };
    }

    // Create session
    await createSession(user._id.toString(), user.username);
    await logLoginAttempt(user._id.toString(), user.username, ip, userAgent, true);

    return Response.redirect(`${appUrl}/raise-query?auth=success`);
  } catch (error) {
    console.error('GET /api/auth/google/callback error:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return Response.redirect(`${appUrl}/raise-query?auth=error&reason=server_error`);
  }
}
