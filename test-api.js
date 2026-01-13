#!/usr/bin/env node

/**
 * Test script for AI Chat Server
 *
 * Usage:
 *   node test-api.js register          # Register a test user
 *   node test-api.js login             # Login test user
 *   node test-api.js chat <token>      # Test chat endpoint
 *   node test-api.js embed <token>     # Test embedding endpoint
 *   node test-api.js settings <token>  # Get AI settings
 *
 * Make sure the server is running first: npm run dev
 */

const API_URL = process.env.API_URL || "http://localhost:3001";
const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "test123";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "admin-key-change-me";
async function register() {
  console.log("🔐 Registering test user...");

  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: "Test User",
    }),
  });

  const data = await response.json();
  console.log("Response:", data);

  if (response.ok) {
    console.log("✅ User registered successfully!");
    console.log("⚠️  Remember to approve the user in the database:");
    console.log(
      `   UPDATE app_users SET approved = true WHERE email = '${TEST_EMAIL}';`
    );
  } else {
    console.log("❌ Registration failed");
  }
}

async function login() {
  console.log("🔑 Logging in...");

  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  const data = await response.json();
  console.log("Response:", data);

  if (response.ok && data.token) {
    console.log("✅ Login successful!");
    console.log("📋 Token:", data.token);
    console.log("\nUse this token for subsequent requests:");
    console.log(`   node test-api.js chat ${data.token}`);
  } else if (data.approved === false) {
    console.log("⚠️  User not approved yet. Approve in database first.");
  } else {
    console.log("❌ Login failed");
  }
}

async function chat(token) {
  if (!token) {
    console.log("❌ Token required. Usage: node test-api.js chat <token>");
    return;
  }

  console.log("💬 Testing chat endpoint...");

  const response = await fetch(`${API_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: "Hello! Can you tell me a short joke about programming?",
    }),
  });

  const data = await response.json();

  if (response.ok) {
    console.log("✅ Chat successful!");
    console.log("\n📝 AI Response:");
    console.log(data.response);
  } else {
    console.log("❌ Chat failed");
    console.log("Response:", data);
  }
}

async function embed(token) {
  if (!token) {
    console.log("❌ Token required. Usage: node test-api.js embed <token>");
    return;
  }

  console.log("🔢 Testing embedding endpoint...");

  const response = await fetch(`${API_URL}/ai/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text: "The quick brown fox jumps over the lazy dog",
    }),
  });

  const data = await response.json();

  if (response.ok) {
    console.log("✅ Embedding successful!");
    console.log("📊 Embedding dimensions:", data.embedding.length);
    console.log("📊 First 5 values:", data.embedding.slice(0, 5));
  } else {
    console.log("❌ Embedding failed");
    console.log("Response:", data);
  }
}

async function settings(token) {
  if (!token) {
    console.log("❌ Token required. Usage: node test-api.js settings <token>");
    return;
  }

  console.log("⚙️  Getting AI settings...");

  const response = await fetch(`${API_URL}/ai/settings`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (response.ok) {
    console.log("✅ Settings retrieved!");
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("❌ Failed to get settings");
    console.log("Response:", data);
  }
}

async function streamChat(token) {
  if (!token) {
    console.log("❌ Token required. Usage: node test-api.js stream <token>");
    return;
  }

  console.log("💬 Testing streaming chat endpoint...");
  console.log("📡 Streaming response:\n");

  const response = await fetch(`${API_URL}/ai/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: "Tell me a very short haiku about coding",
    }),
  });

  if (!response.ok) {
    console.log("❌ Stream failed");
    const data = await response.json();
    console.log("Response:", data);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) {
              process.stdout.write(data.chunk);
            } else if (data.done) {
              console.log("\n\n✅ Stream complete!");
            } else if (data.error) {
              console.log("\n❌ Stream error:", data.error);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (error) {
    console.log("\n❌ Stream error:", error.message);
  }
}

async function adminListUsers() {
  console.log("📋 Getting all users (admin)...");

  const response = await fetch(`${API_URL}/admin/users`, {
    method: "GET",
    headers: {
      "X-API-Key": ADMIN_API_KEY,
    },
  });

  const data = await response.json();

  if (response.ok) {
    console.log("✅ Users retrieved!");
    console.log(`Total users: ${data.total}`);
    data.users.forEach((user) => {
      console.log(`\n- ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name || "N/A"}`);
      console.log(`  Approved: ${user.approved ? "✅" : "❌"}`);
      console.log(`  Created: ${user.created_at}`);
    });
  } else {
    console.log("❌ Failed to get users");
    console.log("Response:", data);
  }
}

async function adminApproveUser(userId) {
  if (!userId) {
    console.log(
      "❌ User ID required. Usage: node test-api.js approve <userId>"
    );
    return;
  }

  console.log(`✅ Approving user ${userId}...`);

  const response = await fetch(`${API_URL}/admin/users/${userId}/approval`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": ADMIN_API_KEY,
    },
    body: JSON.stringify({ approved: true }),
  });

  const data = await response.json();

  if (response.ok) {
    console.log("✅ User approved successfully!");
    console.log("User:", data.user);
  } else {
    console.log("❌ Failed to approve user");
    console.log("Response:", data);
  }
}

async function adminRejectUser(userId) {
  if (!userId) {
    console.log("❌ User ID required. Usage: node test-api.js reject <userId>");
    return;
  }

  console.log(`❌ Rejecting user ${userId}...`);

  const response = await fetch(`${API_URL}/admin/users/${userId}/approval`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": ADMIN_API_KEY,
    },
    body: JSON.stringify({ approved: false }),
  });

  const data = await response.json();

  if (response.ok) {
    console.log("✅ User rejected successfully!");
    console.log("User:", data.user);
  } else {
    console.log("❌ Failed to reject user");
    console.log("Response:", data);
  }
}

// Main
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case "register":
    register().catch(console.error);
    break;
  case "login":
    login().catch(console.error);
    break;
  case "chat":
    chat(arg).catch(console.error);
    break;
  case "stream":
    streamChat(arg).catch(console.error);
    break;
  case "embed":
    embed(arg).catch(console.error);
    break;
  case "settings":
    settings(arg).catch(console.error);
    break;
  case "users":
    adminListUsers().catch(console.error);
    break;
  case "approve":
    adminApproveUser(arg).catch(console.error);
    break;
  case "reject":
    adminRejectUser(arg).catch(console.error);
    break;
  default:
    console.log(`
🧪 AI Chat Server Test Script

Usage:
  node test-api.js register           - Register test user
  node test-api.js login              - Login and get token
  node test-api.js chat <token>       - Test static chat
  node test-api.js stream <token>     - Test streaming chat
  node test-api.js embed <token>      - Test embeddings
  node test-api.js settings <token>   - Get AI settings

Admin Commands (requires ADMIN_API_KEY):
  node test-api.js users              - List all users
  node test-api.js approve <userId>   - Approve user
  node test-api.js reject <userId>    - Reject/unapprove user

Environment:
  API_URL=${API_URL}
  ADMIN_API_KEY=${ADMIN_API_KEY ? "***set***" : "not set"}
  
Make sure the server is running: npm run dev
    `);
}
