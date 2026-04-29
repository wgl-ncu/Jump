/**
 * One-shot script: Probe Cocos Creator builder messages
 * Run inside editor via: Editor.Message.send('scene', 'execute-script', ...)
 * 
 * This script starts a temp HTTP server, probes all messages, 
 * then returns results.
 */
const http = require('http');

const PORT = 7500;

const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.url === '/probe') {
        const results = {};
        
        // Try to query builder messages
        const msgNames = [
            'build', 'build-project', 'start-build', 'run-build',
            'query-build-tasks', 'query-info', 'open', 'save',
            'query-packages', 'start',
        ];

        for (const msg of msgNames) {
            try {
                const result = await Editor.Message.request('builder', msg, {});
                results[msg] = { ok: true, result: JSON.stringify(result).substring(0, 200) };
            } catch (e) {
                results[msg] = { ok: false, error: e.message || String(e) };
            }
        }

        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, messages: results }, null, 2));
        server.close();
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found. Use /probe' }));
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[probe-builder] Server running on http://127.0.0.1:${PORT}/probe`);
});

server.on('error', (err) => {
    console.error('[probe-builder] Server error:', err);
});

// Auto-close after 60 seconds
setTimeout(() => { server.close(); }, 60000);
