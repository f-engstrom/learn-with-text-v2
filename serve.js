// Serves the built app (`npm run build` first), like `vite --host`: on this computer only by
// default, or on your network too with `--host`. Usage: `npm start` or `npm start -- --host`.
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';

// The adapter takes each request's origin from its Host header, but assumes https unless a header
// says otherwise. Marking every request plain http lets forms work at whichever address you use
// (localhost, this computer's network address, its .local name) without baking one in.
process.env.PROTOCOL_HEADER = 'x-reader-protocol';
const { handler } = await import('./build/handler.js');

const network = process.argv.includes('--host');
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || (network ? '0.0.0.0' : 'localhost');

const server = createServer((req, res) => {
	req.headers['x-reader-protocol'] = 'http';
	handler(req, res);
});

server.listen(port, host, () => {
	console.log(`  Local:   http://localhost:${port}/`);
	if (network) {
		for (const address of Object.values(networkInterfaces()).flat()) {
			if (address && address.family === 'IPv4' && !address.internal) console.log(`  Network: http://${address.address}:${port}/`);
		}
	} else {
		console.log('  Network: use --host to expose');
	}
});
