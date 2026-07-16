import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  approveDeviceCode,
  findDeviceCodeByUserCode,
  isExpired,
} from '@/lib/auth/device-codes';

interface DeviceVerifyRequest {
  user_code: string;
}

interface DeviceVerifyResponse {
  client_name: string;
  client_id: string;
  user_code: string;
  approved: boolean;
  expires_in: number;
  created_at: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      );
    }

    const body: DeviceVerifyRequest = await request.json();
    const { user_code } = body;

    if (!user_code) {
      return NextResponse.json(
        { error: 'user_code is required' },
        { status: 400 }
      );
    }

    const deviceData = await findDeviceCodeByUserCode(user_code);

    if (!deviceData) {
      return NextResponse.json(
        { error: 'invalid_user_code' },
        { status: 404 }
      );
    }

    if (isExpired(deviceData)) {
      return NextResponse.json(
        { error: 'expired_code' },
        { status: 400 }
      );
    }

    const response: DeviceVerifyResponse = {
      client_name: deviceData.client_id === 'vscode' ? 'VS Code Extension' : deviceData.client_id,
      client_id: deviceData.client_id,
      user_code: deviceData.user_code,
      approved: deviceData.approved,
      expires_in: Math.floor((new Date(deviceData.expires_at).getTime() - Date.now()) / 1000),
      created_at: new Date(deviceData.created_at).getTime(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Device verify error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    );
  }
}

// Approve device code
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { user_code } = body;

    if (!user_code) {
      return NextResponse.json(
        { error: 'user_code is required' },
        { status: 400 }
      );
    }

    const deviceData = await findDeviceCodeByUserCode(user_code);

    if (!deviceData) {
      return NextResponse.json(
        { error: 'invalid_user_code' },
        { status: 404 }
      );
    }

    if (isExpired(deviceData)) {
      return NextResponse.json(
        { error: 'expired_code' },
        { status: 400 }
      );
    }

    await approveDeviceCode({
      id: deviceData.id,
      userId: user.id,
    });

    console.log('[Device Verify] Approved device:', {
      userCode: deviceData.user_code,
      userId: user.id,
      clientId: deviceData.client_id,
    });

    return NextResponse.json({
      status: 'approved',
      client_id: deviceData.client_id,
      approved_at: Date.now(),
    });
  } catch (error) {
    console.error('Device approval error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    );
  }
}

