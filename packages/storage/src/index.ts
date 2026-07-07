import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadResult {
  /** Public or internal key used to later presign or fetch the object */
  key: string;
  /** Pre-signed download URL (if auto-presigning is enabled, else null) */
  url: string | null;
  /** ISO expiry of the presigned URL, or null */
  expiresAt: string | null;
  /** Adapter used: 's3' | 'firebase' | 'local' */
  adapter: string;
}

export interface StorageAdapter {
  readonly name: string;
  upload(key: string, buffer: Buffer, contentType: string): Promise<UploadResult>;
  presign(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-Compatible Adapter (Railway Volumes or any S3-compatible service)
// ─────────────────────────────────────────────────────────────────────────────

export class S3StorageAdapter implements StorageAdapter {
  readonly name = 's3';
  private client: S3Client;
  private bucket: string;

  constructor(options: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
  }) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      forcePathStyle: options.forcePathStyle ?? true,
    });
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { key, url: null, expiresAt: null, adapter: this.name };
  }

  async presign(key: string, ttlSeconds = 86400): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Storage Adapter (alternative / fallback)
// ─────────────────────────────────────────────────────────────────────────────

export class FirebaseStorageAdapter implements StorageAdapter {
  readonly name = 'firebase';
  private bucket: any; // firebase-admin Storage Bucket

  constructor(bucket: any) {
    this.bucket = bucket;
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
    const file = this.bucket.file(key);
    await file.save(buffer, { contentType, resumable: false });
    return { key, url: null, expiresAt: null, adapter: this.name };
  }

  async presign(key: string, ttlSeconds = 86400): Promise<string> {
    const file = this.bucket.file(key);
    const expires = new Date(Date.now() + ttlSeconds * 1000);
    const [url] = await file.getSignedUrl({ action: 'read', expires });
    return url;
  }

  async delete(key: string): Promise<void> {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Local Filesystem Adapter (development / fallback when no cloud creds)
// ─────────────────────────────────────────────────────────────────────────────

export class LocalFsStorageAdapter implements StorageAdapter {
  readonly name = 'local';
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'tmp', 'exports');
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
    const filePath = path.join(this.baseDir, key.replace(/\//g, path.sep));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    return { key, url: null, expiresAt: null, adapter: this.name };
  }

  async presign(key: string, _ttlSeconds = 86400): Promise<string> {
    // For local dev: return a data URL (fine for testing only)
    const filePath = path.join(this.baseDir, key.replace(/\//g, path.sep));
    if (!fs.existsSync(filePath)) throw new Error(`LocalFsStorageAdapter: file not found: ${key}`);
    const buf = fs.readFileSync(filePath);
    return `data:application/octet-stream;base64,${buf.toString('base64')}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key.replace(/\//g, path.sep));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level StorageClient (adapter selection + helpers)
// ─────────────────────────────────────────────────────────────────────────────

export class StorageClient {
  private primary: StorageAdapter;
  private fallback: StorageAdapter | null;

  constructor(primary: StorageAdapter, fallback?: StorageAdapter) {
    this.primary = primary;
    this.fallback = fallback ?? null;
  }

  /** Upload a buffer and return a presigned URL valid for `ttlSeconds`. */
  async uploadAndPresign(
    key: string,
    buffer: Buffer,
    contentType: string,
    ttlSeconds = 86400,
  ): Promise<{ url: string; expiresAt: string; key: string; adapter: string }> {
    let adapter = this.primary;
    try {
      await adapter.upload(key, buffer, contentType);
    } catch (primaryErr) {
      if (!this.fallback) throw primaryErr;
      console.warn(`[storage] Primary adapter (${this.primary.name}) failed, falling back`, primaryErr);
      adapter = this.fallback;
      await adapter.upload(key, buffer, contentType);
    }
    const url = await adapter.presign(key, ttlSeconds);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return { url, expiresAt, key, adapter: adapter.name };
  }

  /** Presign an already-uploaded key. */
  async presign(key: string, ttlSeconds = 86400): Promise<string> {
    return this.primary.presign(key, ttlSeconds);
  }

  /** Delete an object. */
  async delete(key: string): Promise<void> {
    return this.primary.delete(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory — resolves adapter from environment variables
//
// Primary:   STORAGE_S3_ENDPOINT, STORAGE_S3_BUCKET, STORAGE_S3_REGION,
//            STORAGE_S3_ACCESS_KEY_ID, STORAGE_S3_SECRET_ACCESS_KEY
// Fallback:  STORAGE_FIREBASE_SERVICE_ACCOUNT_JSON, STORAGE_FIREBASE_BUCKET
// Default:   LocalFsStorageAdapter (no creds)
// ─────────────────────────────────────────────────────────────────────────────

export function createStorageClient(env: NodeJS.ProcessEnv = process.env): StorageClient {
  let primary: StorageAdapter;
  let fallback: StorageAdapter | undefined;

  // ── Primary: Railway S3-compatible ──────────────────────────────────────
  const s3Endpoint = env.STORAGE_S3_ENDPOINT;
  const s3Bucket = env.STORAGE_S3_BUCKET;
  const s3Region = env.STORAGE_S3_REGION || 'auto';
  const s3AccessKey = env.STORAGE_S3_ACCESS_KEY_ID;
  const s3SecretKey = env.STORAGE_S3_SECRET_ACCESS_KEY;

  if (s3Endpoint && s3Bucket && s3AccessKey && s3SecretKey) {
    primary = new S3StorageAdapter({
      endpoint: s3Endpoint,
      region: s3Region,
      bucket: s3Bucket,
      accessKeyId: s3AccessKey,
      secretAccessKey: s3SecretKey,
    });
  } else {
    primary = new LocalFsStorageAdapter();
    console.warn('[storage] No S3 credentials found — using local filesystem adapter');
  }

  // ── Fallback: Firebase Storage ───────────────────────────────────────────
  const firebaseServiceAccountJson = env.STORAGE_FIREBASE_SERVICE_ACCOUNT_JSON;
  const firebaseBucket = env.STORAGE_FIREBASE_BUCKET;

  if (firebaseServiceAccountJson && firebaseBucket) {
    try {
      // Lazy import so firebase-admin is not required when not configured
      const admin = require('firebase-admin');
      const serviceAccount = JSON.parse(firebaseServiceAccountJson);
      const appName = 'sots-storage';
      const existingApp = admin.apps.find((a: any) => a?.name === appName);
      const firebaseApp =
        existingApp ||
        admin.initializeApp(
          { credential: admin.credential.cert(serviceAccount), storageBucket: firebaseBucket },
          appName,
        );
      const bucket = admin.storage(firebaseApp).bucket();
      fallback = new FirebaseStorageAdapter(bucket);
    } catch (err) {
      console.warn('[storage] Firebase storage fallback failed to initialize', err);
    }
  }

  return new StorageClient(primary, fallback);
}

// ─────────────────────────────────────────────────────────────────────────────
// Key builder helpers
// ─────────────────────────────────────────────────────────────────────────────

export function buildReportKey(applicationId: string, format: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const rnd = crypto.randomBytes(4).toString('hex');
  return `reports/${applicationId}/${date}/${rnd}.${format}`;
}

export function buildReplayKey(sessionId: string): string {
  return `replays/${sessionId}/replay.json`;
}
