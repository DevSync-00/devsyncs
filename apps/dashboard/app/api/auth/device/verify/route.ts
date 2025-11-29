import { NextRequest, NextResponse } from 'next/server';
import { deviceCodes } from '../start/route';
import { createClient } from '@/lib/supabase/server';

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

    // Find device code by user code (normalize format)
    const normalizedUserCode = user_code.toUpperCase().replace(/-/g, '');
    let deviceData = null;
    let deviceCode = '';

    for (const [code, data] of deviceCodes.entries()) {
      const normalizedStoredCode = data.userCode.replace(/-/g, '');
      if (normalizedStoredCode === normalizedUserCode) {
        deviceData = data;
        deviceCode = code;
        break;
      }
    }

    if (!deviceData) {
      return NextResponse.json(
        { error: 'invalid_user_code' },
        { status: 404 }
      );
    }

    if (Date.now() > deviceData.expiresAt) {
      deviceCodes.delete(deviceCode);
      return NextResponse.json(
        { error: 'expired_code' },
        { status: 400 }
      );
    }

    const response: DeviceVerifyResponse = {
      client_name: deviceData.clientId === 'vscode' ? 'VS Code Extension' : deviceData.clientId,
      client_id: deviceData.clientId,
      user_code: deviceData.userCode,
      approved: deviceData.approved,
      expires_in: Math.floor((deviceData.expiresAt - Date.now()) / 1000),
      created_at: deviceData.expiresAt - (15 * 60 * 1000), // Approximate creation time
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

    // Find device code by user code (normalize format)
    const normalizedUserCode = user_code.toUpperCase().replace(/-/g, '');
    let deviceData = null;
    let deviceCode = '';

    for (const [code, data] of deviceCodes.entries()) {
      const normalizedStoredCode = data.userCode.replace(/-/g, '');
      if (normalizedStoredCode === normalizedUserCode) {
        deviceData = data;
        deviceCode = code;
        break;
      }
    }

    if (!deviceData) {
      return NextResponse.json(
        { error: 'invalid_user_code' },
        { status: 404 }
      );
    }

    if (Date.now() > deviceData.expiresAt) {
      deviceCodes.delete(deviceCode);
      return NextResponse.json(
        { error: 'expired_code' },
        { status: 400 }
      );
    }

    // Approve the device
    deviceData.approved = true;
    deviceData.userId = user.id;

    console.log('[Device Verify] Approved device:', {
      userCode: deviceData.userCode,
      userId: user.id,
      clientId: deviceData.clientId,
    });

    return NextResponse.json({
      status: 'approved',
      client_id: deviceData.clientId,
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

