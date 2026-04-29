/**
 * cli-build Extension for Cocos Creator 3.8
 * Starts an HTTP server inside the running editor,
 * allowing CLI tools to trigger builds without closing the editor.
 *
 * Builder messages (from source):
 *   - command-build: CLI build entry point
 *   - add-task: Add a build task
 *   - query-tasks-info: Query task info
 *   - query-task: Query single task
 *   - save-task: Save task config
 *   - recompile-task: Recompile a task
 *   - remove-task: Remove a task
 *
 * Endpoints:
 *   GET  /status          - Check if server is running
 *   POST /build           - Trigger a build (uses command-build)
 *   GET  /build-status    - Query current build status
 *   GET  /tasks           - Query all build tasks info
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 7499;
let server = null;
let currentBuildStatus = 'idle';
let lastBuildResult = null;

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

async function triggerBuild(buildOptions) {
    try {
        console.log(`[cli-build] Triggering build with command-build: ${JSON.stringify(buildOptions)}`);
        const result = await Editor.Message.request('builder', 'command-build', buildOptions);
        return { ok: true, result };
    } catch (err) {
        const errMsg = err.message || String(err);
        console.error(`[cli-build] command-build failed: ${errMsg}`);
        throw err;
    }
}

async function handleRequest(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        if (req.method === 'GET' && req.url === '/status') {
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, status: 'running', buildStatus: currentBuildStatus }));
            return;
        }

        if (req.method === 'GET' && req.url === '/build-status') {
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, status: currentBuildStatus, lastResult: lastBuildResult }));
            return;
        }

        if (req.method === 'GET' && req.url === '/tasks') {
            try {
                const tasksInfo = await Editor.Message.request('builder', 'query-tasks-info');
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true, tasks: tasksInfo }));
            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
            }
            return;
        }

        if (req.method === 'POST' && req.url === '/build') {
            if (currentBuildStatus === 'building') {
                res.writeHead(409);
                res.end(JSON.stringify({ ok: false, error: 'Build already in progress' }));
                return;
            }

            const options = await parseBody(req);
            const buildOptions = {
                platform: options.platform || 'wechatgame',
                buildPath: options.buildPath || 'build',
                debug: options.debug ?? false,
                separateEngine: options.separateEngine ?? true,
                startSceneAssetBundle: options.startSceneAssetBundle ?? true,
                ...options,
            };

            currentBuildStatus = 'building';
            lastBuildResult = null;

            // Respond immediately, build runs async
            res.writeHead(202);
            res.end(JSON.stringify({ ok: true, message: 'Build started', options: buildOptions }));

            try {
                const result = await triggerBuild(buildOptions);
                currentBuildStatus = 'success';
                lastBuildResult = result;
                console.log('[cli-build] Build completed successfully');
            } catch (err) {
                currentBuildStatus = 'failed';
                lastBuildResult = { ok: false, error: err.message || String(err) };
                console.error('[cli-build] Build failed:', err);
            }
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ ok: false, error: 'Not found' }));
    } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
    }
}

exports.load = function () {
    server = http.createServer(handleRequest);
    server.listen(PORT, '127.0.0.1', () => {
        console.log(`[cli-build] HTTP server running on http://127.0.0.1:${PORT}`);
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[cli-build] Port ${PORT} already in use, skipping server start`);
        } else {
            console.error('[cli-build] Server error:', err);
        }
    });
};

exports.unload = function () {
    if (server) {
        server.close();
        server = null;
        console.log('[cli-build] HTTP server stopped');
    }
};

exports.methods = {
    async build(options) {
        const buildOptions = {
            platform: options.platform || 'wechatgame',
            buildPath: options.buildPath || 'build',
            debug: options.debug ?? false,
            separateEngine: options.separateEngine ?? true,
            startSceneAssetBundle: options.startSceneAssetBundle ?? true,
            ...options,
        };
        return await triggerBuild(buildOptions);
    }
};
