import assert from 'node:assert/strict';
import test from 'node:test';
import { StorageAdapter, StorageClient, UploadResult } from './index';

class StubAdapter implements StorageAdapter {
  constructor(readonly name: string) {}
  upload(): Promise<UploadResult> { throw new Error('not used'); }
  presign(key: string): Promise<string> { return Promise.resolve(`${this.name}:${key}`); }
  delete(): Promise<void> { throw new Error('not used'); }
  download(): Promise<Buffer> { throw new Error('not used'); }
}

test('presign honors the adapter that originally stored the object', async () => {
  const storage = new StorageClient(new StubAdapter('s3'), new StubAdapter('firebase'));

  assert.equal(await storage.presign('screenshots/example.png', 900, 'firebase'), 'firebase:screenshots/example.png');
  assert.equal(await storage.presign('screenshots/example.png', 900, 's3'), 's3:screenshots/example.png');
});

test('presign rejects a recorded adapter that is no longer configured', async () => {
  const storage = new StorageClient(new StubAdapter('s3'));

  await assert.rejects(
    storage.presign('screenshots/example.png', 900, 'firebase'),
    /Storage adapter unavailable: firebase/,
  );
});
