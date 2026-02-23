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
    const registerBody = JSON.stringify({ name: 'Test', email: 'tztest@example.com', password: 'password123', timezone: 'Asia/Kolkata' });
    const regRes = await request({
      hostname: 'localhost', port: 5002, path: '/api/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(registerBody) }
    }, registerBody);
    
    let token;
    let authData = JSON.parse(regRes.body);
    if (authData.token) {
        token = authData.token;
    } else {
        const loginBody = JSON.stringify({ email: 'tztest@example.com', password: 'password123' });
        const logRes = await request({
          hostname: 'localhost', port: 5002, path: '/api/auth/login', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
        }, loginBody);
        token = JSON.parse(logRes.body).token;
    }

    const headers = { 'Authorization': 'Bearer ' + token };
    
    console.log("Testing Analytics Overall...");
    const overall = await request({ hostname: 'localhost', port: 5002, path: '/api/analytics/overall?period=daily', headers });
    console.log(overall.status, overall.body.slice(0, 100));

    console.log("Testing Weekly Chart...");
    const weekly = await request({ hostname: 'localhost', port: 5002, path: '/api/analytics/weekly-chart', headers });
    console.log(weekly.status, weekly.body.slice(0, 100));

  } catch(e) {
    console.error(e);
  }
})();
