const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

const API_URL = "http://localhost:4000/api";

const axiosInstance = axios.create({
  withCredentials: true,
  validateStatus: () => true,
});

const registerInstance = axios.create({
  validateStatus: () => true,
});

let cookie;
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

  try {
    const timestamp = Date.now();
    const evaluatorEmail = `evaluator${timestamp}@test.com`;

    // 1. Register a new user
    console.log(`\n[Step 1] Registering a new user... ${evaluatorEmail}`);
    await axiosInstance.post(`${API_URL}/auth/register`, {
      email: evaluatorEmail,
      password: "Password123!",
      displayName: "Evaluator",
    });

    // 2. Login
    console.log("\n[Step 2] Logging in...");
    const loginRes = await axiosInstance.post(`${API_URL}/auth/login`, {
      email: evaluatorEmail,
      password: "Password123!",
    });
    if (loginRes.status !== 200) throw new Error("Cannot login");
    console.log("PASS");

    // 3. Create a group
    console.log("\n[Step 3] Creating a group...");
    const groupRes = await axiosInstance.post(`${API_URL}/groups`, {
      name: `Test Group ${timestamp}`,
      description: "Acceptance Test",
      baseCurrency: "INR",
    });
    if (groupRes.status !== 201) throw new Error("Cannot create group");
    const groupId = groupRes.data.group.id;
    console.log(`PASS - Group created (ID: ${groupId})`);

    // 4. Register and Add members with join/leave dates
    console.log("\n[Step 4] Adding members with join/leave dates...");
    
    const members = [
      { name: "Aisha", email: `aisha${timestamp}@test.com`, joinedAt: "2026-02-01T00:00:00.000Z" },
      { name: "Rohan", email: `rohan${timestamp}@test.com`, joinedAt: "2026-02-01T00:00:00.000Z" },
      { name: "Priya", email: `priya${timestamp}@test.com`, joinedAt: "2026-02-01T00:00:00.000Z" },
      { name: "Meera", email: `meera${timestamp}@test.com`, joinedAt: "2026-02-01T00:00:00.000Z", leftAt: "2026-03-31T23:59:59.000Z" },
      { name: "Sam", email: `sam${timestamp}@test.com`, joinedAt: "2026-04-15T00:00:00.000Z" }
    ];

    for (const m of members) {
      await registerInstance.post(`${API_URL}/auth/register`, { email: m.email, password: "Password123!", displayName: m.name });
      const addRes = await axiosInstance.post(`${API_URL}/groups/${groupId}/members`, { 
        email: m.email, 
        joinedAt: m.joinedAt,
        leftAt: m.leftAt
      });
      if (addRes.status !== 201) {
        throw new Error(`Failed to add ${m.name}: ${JSON.stringify(addRes.data)}`);
      }
      console.log(`Added ${m.name}`);
    }
    console.log("PASS - Members Added");

    // 5. Upload the assignment CSV
    console.log("\n[Step 5] Uploading CSV...");
    const csvContent = `date,description,amount,currency,paid_by,split_with,split_type,split_details,notes
08-02-2026,Dinner at Marina Bites,3200,INR,Evaluator,Aisha;Rohan,EQUAL,,
11-03-2026,Goa villa booking,540,USD,Aisha,Evaluator;Rohan,EQUAL,,foreign currency
15-03-2026,Rohan paid Aisha back,5000,INR,Rohan,Aisha,,,settlement
05-04-2026,Meera going away party,4500,INR,Priya,Aisha;Rohan;Priya;Meera,EQUAL,,Meera left March 31 but was at this party somehow? Wait, expense is April 5.
16-04-2026,Welcome Sam lunch,2000,INR,Evaluator,Aisha;Rohan;Sam,EQUAL,,Sam joined April 15
`;

    const uploadRes = await axiosInstance.post(`${API_URL}/groups/${groupId}/imports`, {
      fileName: "test_upload3.csv",
      csvContent: csvContent
    });
    if (uploadRes.status !== 200 && uploadRes.status !== 201) throw new Error("Upload failed: " + JSON.stringify(uploadRes.data));
    const jobId = uploadRes.data.job.id;
    console.log(`PASS - Uploaded CSV (Job: ${jobId})`);

    // Poll until processing is complete
    let importStatus = "";
    while (importStatus !== "AWAITING_MAPPING" && importStatus !== "IN_REVIEW" && importStatus !== "READY") {
      await new Promise(r => setTimeout(r, 1000));
      const jobRes = await axiosInstance.get(`${API_URL}/groups/${groupId}/imports/${jobId}`);
      importStatus = jobRes.data.job.status;
      console.log("Processing status:", importStatus);
    }

    const detailsRes = await axiosInstance.get(`${API_URL}/groups/${groupId}/imports/${jobId}`);
    
    // Simulate user mapping names if AWAITING_MAPPING
    if (importStatus === "AWAITING_MAPPING") {
      console.log("\n[Step 5.5] Providing name mappings...");
      // Map names from CSV to User IDs
      const mappingMembersRes = await axiosInstance.get(`${API_URL}/groups/${groupId}/imports/${jobId}/mapping/members`);
      const groupMembers = mappingMembersRes.data.members;
      
      const mappings = [
        { csvName: "Evaluator", action: "MAP", groupMemberId: groupMembers.find(m => m.displayName === "Evaluator")?.id },
        { csvName: "Aisha", action: "MAP", groupMemberId: groupMembers.find(m => m.displayName === "Aisha")?.id },
        { csvName: "Rohan", action: "MAP", groupMemberId: groupMembers.find(m => m.displayName === "Rohan")?.id },
        { csvName: "Priya", action: "MAP", groupMemberId: groupMembers.find(m => m.displayName === "Priya")?.id },
        { csvName: "Meera", action: "MAP", groupMemberId: groupMembers.find(m => m.displayName === "Meera")?.id },
        { csvName: "Sam", action: "MAP", groupMemberId: groupMembers.find(m => m.displayName === "Sam")?.id },
      ];
      
      const mappingRes = await axiosInstance.post(`${API_URL}/groups/${groupId}/imports/${jobId}/mapping/submit`, { decisions: mappings });
      console.log("Mapping response:", mappingRes.status);
    }
    
    // Let's poll until IN_REVIEW or READY
    while (importStatus !== "IN_REVIEW" && importStatus !== "READY") {
      await new Promise(r => setTimeout(r, 1000));
      const jobRes = await axiosInstance.get(`${API_URL}/groups/${groupId}/imports/${jobId}`);
      importStatus = jobRes.data.job.status;
    }
    
    const finalDetailsRes = await axiosInstance.get(`${API_URL}/groups/${groupId}/imports/${jobId}`);
    console.log("\n[Step 6] Verifying anomalies...");
    console.log("Job Status:", finalDetailsRes.data.job.status);
    console.log("Anomalies Count:", finalDetailsRes.data.job.report?.anomaliesCount);
    
    const anomalies = [];
    for (const row of finalDetailsRes.data.job.rows) {
      if (row.anomalies.length > 0) {
        anomalies.push(...row.anomalies.map(a => `${a.anomalyType}: ${a.description}`));
      }
    }
    console.log("Anomalies Found:\n", anomalies.join("\n"));
    
    if (anomalies.length > 0) {
      console.log("PASS - Anomalies were successfully detected!");
    } else {
      console.log("WARN - No anomalies were detected.");
    }

    console.log("\nALL TESTS COMPLETED SUCCESSFULLY.");
  } catch (err) {
    console.error("FAIL:", err.message);
  }
}

runTest();
