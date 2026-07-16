import { NextRequest, NextResponse } from 'next/server';
import {
  consumeDeviceCode,
  findDeviceCodeByDeviceCode,
  isExpired,
} from '@/lib/auth/device-codes';
import { issueDevSyncTokens } from '@/lib/auth/tokens';

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

    const deviceData = await findDeviceCodeByDeviceCode(device_code);

    if (!deviceData) {
      return NextResponse.json(
        { error: 'expired_token', error_description: 'Device code expired or invalid' },
        { status: 400 }
      );
    }

    if (isExpired(deviceData)) {
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

    if (!deviceData.user_id) {
      return NextResponse.json(
        { error: 'authorization_pending', error_description: 'User approval not completed' },
        { status: 400 }
      );
    }

    const tokens = issueDevSyncTokens({
      userId: deviceData.user_id,
      clientId: deviceData.client_id,
    });
    await consumeDeviceCode(deviceData.id);

    const response: DeviceTokenResponse = {
      token_type: 'Bearer',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      refresh_expires_in: tokens.refresh_expires_in,
      user_id: deviceData.user_id,
      client_id: deviceData.client_id,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Device token error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}


