import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// GET /api/auth/google — redirect to Google OAuth consent screen
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId) {
      return Response.json({ error: 'Google OAuth is not configured' }, { status: 500 });
    }

    // Generate CSRF state token
    const stateChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let state = '';
    for (let i = 0; i < 32; i++) {
      state += stateChars.charAt(Math.floor(Math.random() * stateChars.length));
    }

    // Store state in cookie for CSRF validation
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      path: '/',
      maxAge: 600, // 10 minutes
      sameSite: 'lax',
    });

    // Construct Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return Response.redirect(googleAuthUrl);
  } catch (error) {
    console.error('GET /api/auth/google error:', error);
    return Response.json({ error: 'OAuth initialization failed' }, { status: 500 });
  }
}
