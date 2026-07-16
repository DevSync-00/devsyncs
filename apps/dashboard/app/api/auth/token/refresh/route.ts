import { NextRequest, NextResponse } from 'next/server';
import { issueDevSyncTokens, verifyJwt } from '@/lib/auth/tokens';

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

    const tokenData = verifyJwt(refresh_token, 'refresh');

    if (!tokenData) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Invalid or expired refresh token' },
        { status: 400 }
      );
    }

    try {
      const tokens = issueDevSyncTokens({
        userId: tokenData.sub,
        email: tokenData.email,
        clientId: tokenData.client_id || 'vscode',
      });

      const response: TokenRefreshResponse = {
        token_type: 'Bearer',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        refresh_expires_in: tokens.refresh_expires_in,
        user_id: tokenData.sub,
        client_id: tokenData.client_id || 'vscode',
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

