const puppeteer = require('puppeteer');
const http = require('http');

const request = (options, postData) => {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
};

(async () => {
    try {
        // 1. Get a token
        const registerBody = JSON.stringify({ name: 'Crash Test', email: 'crash_test2@example.com', password: 'password123', timezone: 'UTC' });
        let logRes = await request({
            hostname: 'localhost', port: 5002, path: '/api/auth/register', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(registerBody) }
        }, registerBody);

        let authData = JSON.parse(logRes.body);
        if (!authData.token) {
            const loginBody = JSON.stringify({ email: 'crash_test2@example.com', password: 'password123' });
            logRes = await request({
                hostname: 'localhost', port: 5002, path: '/api/auth/login', method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
            }, loginBody);
            authData = JSON.parse(logRes.body);
        }

        const token = authData.token;
        const user = authData.user;
        if (!token) {
            console.error("Failed to get token:", logRes.body);
            process.exit(1);
        }

        // 2. Launch Puppeteer
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        const logs = [];
        page.on('console', msg => {
            if (msg.type() === 'error') logs.push(`CONSOLE ERROR: ${msg.text()}`);
        });
        page.on('pageerror', err => {
            logs.push(`PAGE ERROR: ${err.toString()}`);
        });

        // Go to an empty page on the same origin to set localStorage
        await page.goto('http://localhost:5173/login', { waitUntil: 'load' });
        await page.evaluate((token, user) => {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
        }, token, user);

        // Now go to the dashboard
        console.log("Navigating to dashboard with injected token...");
        await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2', timeout: 10000 }).catch(e => console.log(e.message));

        await new Promise(r => setTimeout(r, 2000));

        console.log("=== BROWSER ERRORS ===");
        logs.forEach(l => console.log(l));
        console.log("======================");

        await browser.close();

    } catch (error) {
        console.error("Script error:", error);
    }
})();
