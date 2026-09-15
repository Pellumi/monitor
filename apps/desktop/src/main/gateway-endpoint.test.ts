import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTelemetryGateway } from './gateway-endpoint';

test('a loopback fallback is replaced by the gateway the desktop already reaches', () => {
  assert.equal(
    resolveTelemetryGateway({
      gatewayEndpoint: 'http://localhost:3000',
      customized: false,
      desktopApiUrl: 'http://10.232.5.41:3000/',
    }),
    'http://10.232.5.41:3000',
  );
});

test('an endpoint configured for the environment is always kept, even on loopback', () => {
  assert.equal(
    resolveTelemetryGateway({
      gatewayEndpoint: 'http://localhost:4000/',
      customized: true,
      desktopApiUrl: 'https://gateway.example.com',
    }),
    'http://localhost:4000',
  );
});

test('a real gateway from the cloud is kept', () => {
  assert.equal(
    resolveTelemetryGateway({
      gatewayEndpoint: 'https://telemetry.example.com',
      customized: false,
      desktopApiUrl: 'http://10.232.5.41:3000',
    }),
    'https://telemetry.example.com',
  );
});

test('when the desktop also runs against localhost, the loopback endpoint stands', () => {
  assert.equal(
    resolveTelemetryGateway({
      gatewayEndpoint: 'http://localhost:3000',
      customized: false,
      desktopApiUrl: 'http://127.0.0.1:3000',
    }),
    'http://localhost:3000',
  );
});
