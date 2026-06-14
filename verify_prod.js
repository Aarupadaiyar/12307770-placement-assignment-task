const http = require('https');

function makeRequest(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'flattrackplanner.onrender.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function verify() {
  console.log("=== STEP 0: REGISTER ===");
  const email = `evaluator${Date.now()}@test.com`;
  const registerBody = JSON.stringify({ email: email, password: "password123", displayName: "Prod Evaluator" });
  const regRes = await makeRequest('POST', '/api/auth/register', registerBody);
  console.log("Status:", regRes.statusCode);

  console.log("\n=== STEP 1: LOGIN ===");
  const loginBody = JSON.stringify({ email: email, password: "password123" });
  const loginRes = await makeRequest('POST', '/api/auth/login', loginBody);
  console.log("Status:", loginRes.statusCode);
  const setCookie = loginRes.headers['set-cookie'];
  console.log("Set-Cookie:", setCookie);

  if (!setCookie) {
    console.log("FAIL: No Set-Cookie header received.");
    return;
  }

  const cookieStr = setCookie[0];
  console.log("Cookie string:", cookieStr);
  console.log("Has SameSite=None?", cookieStr.includes("SameSite=None"));
  console.log("Has Secure?", cookieStr.includes("Secure"));

  const rawCookie = cookieStr.split(';')[0];
  
  console.log("\n=== STEP 2: GET /api/auth/me ===");
  const meRes = await makeRequest('GET', '/api/auth/me', null, rawCookie);
  console.log("Status:", meRes.statusCode);
  console.log("Body:", meRes.body);

  console.log("\n=== STEP 3: POST /api/groups ===");
  const groupBody = JSON.stringify({ name: "Production Verification Group" });
  const groupRes = await makeRequest('POST', '/api/groups', groupBody, rawCookie);
  console.log("Status:", groupRes.statusCode);
  console.log("Body:", groupRes.body);
}

verify().catch(console.error);
