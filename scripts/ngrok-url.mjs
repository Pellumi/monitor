const inspectorUrl = 'http://127.0.0.1:4040/api/tunnels';

try {
  const response = await fetch(inspectorUrl);
  if (!response.ok) {
    throw new Error(`ngrok inspector returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  const tunnel = payload.tunnels?.find((item) => item.proto === 'https') ?? payload.tunnels?.[0];

  if (!tunnel?.public_url) {
    throw new Error('ngrok is running but has not published a URL yet');
  }

  console.log(tunnel.public_url);
} catch (error) {
  console.error(`Unable to read the ngrok URL from ${inspectorUrl}.`);
  console.error('Check the tunnel with `docker compose --profile tunnel ps ngrok`.');
  console.error('View authentication or startup errors with `pnpm tunnel:ngrok:logs`.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
