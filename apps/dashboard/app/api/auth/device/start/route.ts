import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';
import { deviceCodes } from '@/lib/device-codes-store';

interface DeviceStartRequest {
  client_id: string;
}

interface DeviceStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: DeviceStartRequest = await request.json();
    const { client_id } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: 'client_id is required' },
        { status: 400 }
      );
    }

    // Generate device code and user code
    const deviceCode = randomBytes(32).toString('hex');
    const userCode = generateUserCode();

    // Store device code (expires in 15 minutes)
    const expiresIn = 15 * 60; // 15 minutes
    const expiresAt = Date.now() + expiresIn * 1000;

    deviceCodes.set(deviceCode, {
      deviceCode,
      userCode,
      clientId: client_id,
      expiresAt,
      approved: false,
    });

    const baseUrl = resolveDashboardOrigin(request);
    const verificationUri = `${baseUrl}/device?code=${encodeURIComponent(userCode)}`;

    const response: DeviceStartResponse = {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      expires_in: expiresIn,
      interval: 5, // Poll every 5 seconds
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Device flow start error:', error);
    return NextResponse.json(
      { error: 'Failed to start device flow' },
      { status: 500 }
    );
  }
}

function resolveDashboardOrigin(request: NextRequest): string {
  const origin = request.nextUrl.origin;
  if (isValidOrigin(origin)) {
    return origin;
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) {
    const candidate = `${forwardedProto}://${forwardedHost.split(',')[0].trim()}`;
    if (isValidOrigin(candidate)) {
      return candidate;
    }
  }

  const host = request.headers.get('host');
  if (host) {
    const proto =
      request.headers.get('x-forwarded-proto') ??
      (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    const candidate = `${proto}://${host}`;
    if (isValidOrigin(candidate)) {
      return candidate;
    }
  }

  const envUrl =
    process.env.NEXT_PUBLIC_ANALYZER_URL ||
    process.env.NEXT_PUBLIC_DASHBOARD_URL ||
    'http://localhost:3000';

  try {
    return new URL(envUrl).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

function isValidOrigin(origin: string): boolean {
  if (!origin || origin === 'null' || origin.includes('undefined')) {
    return false;
  }
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function generateUserCode(): string {
  // Generate 8-character user code (e.g., "ABCD-1234")
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  const part1 = Array.from({ length: 4 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  const part2 = Array.from({ length: 4 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `${part1}-${part2}`;
}

