// Detached entry point: `node daemon-entry.mjs` becomes the long-lived daemon.
import { runDaemon } from './daemon.mjs';
runDaemon();
