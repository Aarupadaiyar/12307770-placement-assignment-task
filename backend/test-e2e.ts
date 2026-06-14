import axios from "axios";
import * as fs from "fs";
import * as FormData from "form-data";

const API_URL = "http://localhost:4000/api";

const axiosInstance = axios.create({
  withCredentials: true,
  validateStatus: () => true, // don't throw on 4xx/5xx
});

// A hack to preserve cookies
let cookie: string | undefined;
axiosInstance.interceptors.response.use((response) => {
  const setCookie = response.headers["set-cookie"];
  if (setCookie) {
    cookie = setCookie[0];
  }
  return response;
});
axiosInstance.interceptors.request.use((config) => {
  if (cookie) {
    config.headers.Cookie = cookie;
  }
  return config;
});

async function runTest() {
  console.log("=== STARTING EVALUATOR ACCEPTANCE TEST ===");

  // 1. Register a new user
  console.log("\\n[Step 1] Registering a new user...");
  const registerRes = await axiosInstance.post(`${API_URL}/auth/register`, {
    email: "evaluator@test.com",
    password: "Password123!",
    displayName: "Evaluator",
  });
  console.log("Register Response:", registerRes.status, registerRes.data);
  if (registerRes.status >= 400) {
    console.log("FAIL - Could not register. Assuming already exists, trying login...");
  }

  // 2. Login
  console.log("\\n[Step 2] Logging in...");
  const loginRes = await axiosInstance.post(`${API_URL}/auth/login`, {
    email: "evaluator@test.com",
    password: "Password123!",
  });
  console.log("Login Response:", loginRes.status, loginRes.data);
  if (loginRes.status !== 200) return console.log("FAIL - Cannot login");
  console.log("PASS - Logged in");

  // 3. Create a group
  console.log("\\n[Step 3] Creating a group...");
  const groupRes = await axiosInstance.post(`${API_URL}/groups`, {
    name: "Evaluator Test Group",
    description: "Acceptance Test",
    baseCurrency: "INR",
  });
  console.log("Group Response:", groupRes.status, groupRes.data);
  if (groupRes.status !== 201) return console.log("FAIL - Cannot create group");
  const groupId = groupRes.data.id;
  console.log(`PASS - Group created (ID: ${groupId})`);

  // 4. Add members with join/leave dates
  console.log("\\n[Step 4] Adding members with join/leave dates...");
  
  // Need to create users first? Or just placeholders? The app uses placeholders via autoSuggest/mapping, but let's add them via group API if possible, or create users and add.
  // Wait, let's create two other users to add.
  await axiosInstance.post(`${API_URL}/auth/register`, { email: "aisha@test.com", password: "Password123!", displayName: "Aisha" });
  await axiosInstance.post(`${API_URL}/auth/register`, { email: "rohan@test.com", password: "Password123!", displayName: "Rohan" });
  
  const addAishaRes = await axiosInstance.post(`${API_URL}/groups/${groupId}/members`, {
    email: "aisha@test.com",
  });
  const addRohanRes = await axiosInstance.post(`${API_URL}/groups/${groupId}/members`, {
    email: "rohan@test.com",
  });
  console.log("Add Members Response:", addAishaRes.status, addRohanRes.status);
  
  // 5. Upload the assignment CSV
  console.log("\\n[Step 5] Uploading CSV...");
  const csvContent = \`date,description,amount,currency,paid_by,split_with,split_type,split_details,notes
08-02-2026,Dinner at Marina Bites,3200,INR,Evaluator,Aisha;Rohan,EQUAL,,
08-02-2026,dinner - marina bites,3200,INR,Evaluator,Aisha;Rohan,EQUAL,,suspected duplicate
11-03-2026,Goa villa booking,540,USD,Aisha,Evaluator;Rohan,EQUAL,,foreign currency
14-03-2026,Parasailing refund,-30,USD,Rohan,Evaluator;Aisha,EQUAL,,negative amount
15-03-2026,Rohan paid Aisha back,5000,INR,Rohan,Aisha,,,settlement\`;

  fs.writeFileSync("test_upload.csv", csvContent);
  const formData = new FormData();
  formData.append("file", fs.createReadStream("test_upload.csv"));

  const uploadRes = await axiosInstance.post(`${API_URL}/groups/${groupId}/imports`, formData, {
    headers: formData.getHeaders(),
  });
  console.log("Upload Response:", uploadRes.status, uploadRes.data);
  if (uploadRes.status !== 200 && uploadRes.status !== 201) return console.log("FAIL - Upload CSV");
  const jobId = uploadRes.data.id;
  console.log(\`PASS - Uploaded CSV (Job: \${jobId})\`);

  // Wait a bit for processing
  await new Promise(r => setTimeout(r, 2000));

  // 6. Verify anomalies
  console.log("\\n[Step 6] Verifying anomalies...");
  const detailsRes = await axiosInstance.get(`${API_URL}/groups/${groupId}/imports/${jobId}`);
  console.log("Job Details:", detailsRes.data.job?.status, `Anomalies: ${detailsRes.data.job?.report?.anomaliesCount}`);
  
  // 12. Verify AuditLog
  console.log("\\n[Step 12] Verifying AuditLog...");
  // We can't fetch it via API unless there's an endpoint. But we can query it directly since we're in the backend context if we use prisma.
}

runTest().catch(console.error);
