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
    // In a real implementation, you'd verify and decode a proper JWT
    try {
      const tokenData = JSON.parse(
        Buffer.from(refresh_token, 'base64').toString('utf-8')
      );

      if (Date.now() / 1000 > tokenData.exp) {
        return NextResponse.json(
          { error: 'expired_token', error_description: 'Refresh token expired' },
          { status: 400 }
        );
      }

      const userId = tokenData.sub;

      // Generate new tokens
      const accessToken = Buffer.from(
        JSON.stringify({
          sub: userId,
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64');

      const newRefreshToken = Buffer.from(
        JSON.stringify({
          sub: userId,
          exp: Math.floor(Date.now() / 1000) + 2592000,
        })
      ).toString('base64');

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

