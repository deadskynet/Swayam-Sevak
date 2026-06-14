/**
 * `swayam web` — start the local web server.
 *
 * Bound to 127.0.0.1; prints the URL and the per-process token. Open the URL
 * in a browser. Ctrl-C to stop.
 */
import { bootstrap } from './bootstrap.js';
import { startWebServer } from '../web/server.js';

export async function runWeb(): Promise<void> {
  const { provider, snap, workspace } = await bootstrap();
  const port = process.env.SWAYAM_WEB_PORT
    ? Number(process.env.SWAYAM_WEB_PORT)
    : 7878;
  const started = await startWebServer({
    provider,
    tools: snap.enabled.concat(snap.disabled.map((d) => d.tool)),
    enabledTools: snap.enabled,
    workspace,
    port,
  });

  console.error(`\nswayam-sevak web running at http://localhost:${started.port}`);
  console.error(`  workspace: ${workspace}`);
  console.error(`  provider:  ${provider.name}`);
  console.error(`  token:     ${started.token}`);
  console.error('\nOpen the URL in a browser. Ctrl-C to stop.\n');

  const stop = async () => {
    console.error('\nshutting down ...');
    await started.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await new Promise(() => { /* keep alive */ });
}
