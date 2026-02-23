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
    const loginBody = JSON.stringify({ email: 'crash_test@example.com', password: 'password123' });
    const logRes = await request({
      hostname: 'localhost', port: 5002, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
    }, loginBody);
    
    const token = JSON.parse(logRes.body).token;
    if (!token) {
        console.error("Auth failed:", logRes.body);
        return;
    }

    const headers = { 'Authorization': 'Bearer ' + token };
    const res = await request({ hostname: 'localhost', port: 5002, path: '/api/analytics/daily', headers });
    console.log(`[${res.status}] =>`, res.body);

  } catch(e) {
    console.error("Error:", e);
  }
})();
