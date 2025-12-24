import { NextRequest, NextResponse } from 'next/server';

interface TokenRefreshRequest {
  refresh_token: string;
}

interface TokenRefreshResponse {
  token_type: 'Bearer';
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  user_id: string;
  client_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenRefreshRequest = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return NextResponse.json(
        { error: 'refresh_token is required' },
        { status: 400 }
      );
    }

    // Decode the refresh token to get user info
    // Device flow tokens use base64url encoding
    try {
      const tokenData = JSON.parse(
        Buffer.from(refresh_token, 'base64url').toString('utf-8')
      );

      if (Date.now() / 1000 > tokenData.exp) {
        return NextResponse.json(
          { error: 'expired_token', error_description: 'Refresh token expired' },
          { status: 400 }
        );
      }

      const userId = tokenData.sub;

      // Generate new tokens (using base64url to match device flow)
      const now = Math.floor(Date.now() / 1000);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      
      const accessTokenPayload = {
          sub: userId,
        email: '', // Email not available in refresh flow
        role: 'authenticated',
        exp: now + 3600, // 1 hour
        iat: now,
        aud: 'authenticated',
        iss: supabaseUrl,
      };

      const refreshTokenPayload = {
          sub: userId,
        exp: now + 2592000, // 30 days
        iat: now,
        type: 'refresh',
      };
      
      const accessToken = Buffer.from(JSON.stringify(accessTokenPayload)).toString('base64url');
      const newRefreshToken = Buffer.from(JSON.stringify(refreshTokenPayload)).toString('base64url');

      const response: TokenRefreshResponse = {
        token_type: 'Bearer',
        access_token: accessToken,
        refresh_token: newRefreshToken,
        expires_in: 3600,
        refresh_expires_in: 2592000,
        user_id: userId,
        client_id: 'vscode', // Default client ID
      };

      return NextResponse.json(response);
    } catch (error) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Invalid refresh token' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}

