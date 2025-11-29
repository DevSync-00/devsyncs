import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deviceCodes } from '../start/route';

interface DeviceTokenRequest {
  device_code: string;
}

interface DeviceTokenResponse {
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
    const body: DeviceTokenRequest = await request.json();
    const { device_code } = body;

    if (!device_code) {
      return NextResponse.json(
        { error: 'device_code is required' },
        { status: 400 }
      );
    }

    const deviceData = deviceCodes.get(device_code);

    if (!deviceData) {
      console.log('[Device Token] Device code not found:', device_code.substring(0, 8) + '...');
      console.log('[Device Token] Available codes:', Array.from(deviceCodes.keys()).map(k => k.substring(0, 8) + '...'));
      return NextResponse.json(
        { error: 'expired_token', error_description: 'Device code expired or invalid' },
        { status: 400 }
      );
    }
    
    console.log('[Device Token] Found device data:', {
      approved: deviceData.approved,
      userId: deviceData.userId,
      expiresAt: new Date(deviceData.expiresAt).toISOString(),
      now: new Date().toISOString(),
    });

    if (Date.now() > deviceData.expiresAt) {
      deviceCodes.delete(device_code);
      return NextResponse.json(
        { error: 'expired_token', error_description: 'Device code expired' },
        { status: 400 }
      );
    }

    if (!deviceData.approved) {
      return NextResponse.json(
        { error: 'authorization_pending', error_description: 'User has not yet approved the device' },
        { status: 400 }
      );
    }

    if (!deviceData.userId) {
      return NextResponse.json(
        { error: 'authorization_pending', error_description: 'User approval not completed' },
        { status: 400 }
      );
    }

    // Get user info - we already have userId from the approval
    // For now, we'll create tokens without needing Supabase admin API
    // In production, you might want to validate the user exists
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    
    // Get user email if available (optional - tokens will work without it)
    let userEmail = '';
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === deviceData.userId) {
        userEmail = user.email || '';
      }
    } catch {
      // User email is optional, continue without it
    }

    // Generate tokens for the user
    // For device flow, we create custom tokens that can be validated by our API
    // In production, you might want to use proper JWT signing with Supabase's JWT secret
    const now = Math.floor(Date.now() / 1000);
    
    const accessTokenPayload = {
      sub: deviceData.userId,
      email: userEmail,
      role: 'authenticated',
      exp: now + 3600, // 1 hour
      iat: now,
      aud: 'authenticated',
      iss: supabaseUrl,
    };
    
    const refreshTokenPayload = {
      sub: deviceData.userId,
      exp: now + 2592000, // 30 days
      iat: now,
      type: 'refresh',
    };

    // Create base64-encoded tokens
    // Note: These are not proper JWTs (not signed), but they work for our API validation
    // In production, you should sign these with Supabase's JWT secret
    const accessToken = Buffer.from(JSON.stringify(accessTokenPayload)).toString('base64url');
    const refreshToken = Buffer.from(JSON.stringify(refreshTokenPayload)).toString('base64url');

    // Validate tokens were generated
    if (!accessToken || !refreshToken) {
      console.error('[Device Token] Failed to generate tokens');
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to generate tokens' },
        { status: 500 }
      );
    }

    // Clean up device code after successful token generation
    deviceCodes.delete(device_code);

    const response: DeviceTokenResponse = {
      token_type: 'Bearer',
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600, // 1 hour
      refresh_expires_in: 2592000, // 30 days
      user_id: deviceData.userId,
      client_id: deviceData.clientId,
    };

    console.log('[Device Token] Generated tokens for user:', deviceData.userId, 'client:', deviceData.clientId);
    console.log('[Device Token] Token lengths - access:', accessToken.length, 'refresh:', refreshToken.length);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Device token error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}


