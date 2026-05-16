/**
 * Check and fix OAuth settings via Appwrite API
 */

async function checkAndFixOAuth() {
  try {
    const endpoint =
      process.env.VITE_APPWRITE_ENDPOINT ||
      process.env.APPWRITE_ENDPOINT ||
      "https://coolpool.in/v1";
    const projectId =
      process.env.VITE_APPWRITE_PROJECT_ID ||
      process.env.APPWRITE_PROJECT_ID ||
      "69f23e9d003845289bcc";
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!apiKey) {
      throw new Error("APPWRITE_API_KEY not set");
    }

    console.log("🔍 Checking Appwrite OAuth Configuration...\n");
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Project: ${projectId}\n`);

    // 1. Check project settings
    console.log("1️⃣  Checking Project Settings...");
    try {
      const projectRes = await fetch(`${endpoint}/projects/${projectId}`, {
        method: "GET",
        headers: {
          "X-Appwrite-Key": apiKey,
        },
      });

      if (projectRes.ok) {
        const project = await projectRes.json();
        console.log("   ✓ Project found:", project.name);
      } else {
        console.log("   ⚠️  Could not fetch project:", projectRes.status);
      }
    } catch (e) {
      console.log("   ⚠️  Error:", e.message);
    }

    // 2. Check Google OAuth provider
    console.log("\n2️⃣  Checking Google OAuth Provider...");
    try {
      const providersRes = await fetch(`${endpoint}/projects/${projectId}/providers/google`, {
        method: "GET",
        headers: {
          "X-Appwrite-Key": apiKey,
        },
      });

      if (providersRes.ok) {
        const provider = await providersRes.json();
        console.log("   ✓ Google OAuth Status:", provider.enabled ? "ENABLED ✅" : "DISABLED ❌");
        console.log("   ✓ Client ID:", provider.appID ? "SET ✅" : "NOT SET ❌");
        console.log("   ✓ Client Secret:", provider.secret ? "SET ✅" : "NOT SET ❌");
      } else if (providersRes.status === 404) {
        console.log("   ❌ Google OAuth provider not found");
      } else {
        console.log("   ⚠️  Status:", providersRes.status);
      }
    } catch (e) {
      console.log("   ⚠️  Error:", e.message);
    }

    // 3. Try to enable OAuth for guests
    console.log("\n3️⃣  Enabling OAuth for Guests...");
    try {
      const updateRes = await fetch(`${endpoint}/projects/${projectId}/providers/google`, {
        method: "PATCH",
        headers: {
          "X-Appwrite-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: true,
        }),
      });

      if (updateRes.ok) {
        console.log("   ✓ OAuth enabled for guests!");
      } else {
        const error = await updateRes.json();
        console.log("   ⚠️  Could not update:", error.message);
      }
    } catch (e) {
      console.log("   ⚠️  Error:", e.message);
    }

    // 4. Check user roles
    console.log("\n4️⃣  Checking User Roles...");
    try {
      const rolesRes = await fetch(`${endpoint}/projects/${projectId}/roles`, {
        method: "GET",
        headers: {
          "X-Appwrite-Key": apiKey,
        },
      });

      if (rolesRes.ok) {
        const roles = await rolesRes.json();
        console.log("   ✓ Found roles:", roles.length || "None");
      }
    } catch (e) {
      console.log("   ⚠️  Error:", e.message);
    }

    // 5. Check project settings for auth options
    console.log("\n5️⃣  Checking Auth Security Settings...");
    try {
      const settingsRes = await fetch(`${endpoint}/projects/${projectId}/auth/settings`, {
        method: "GET",
        headers: {
          "X-Appwrite-Key": apiKey,
        },
      });

      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        console.log("   ✓ Auth Settings retrieved");
        if (settings.usersAuthPassword) {
          console.log("   ✓ Password auth:", settings.usersAuthPassword.enabled ? "ON" : "OFF");
        }
        if (settings.oauth2) {
          console.log("   ✓ OAuth2 auth:", "Available");
        }
      } else if (settingsRes.status === 404) {
        console.log("   ℹ️  Auth settings endpoint not available (might be different version)");
      }
    } catch (e) {
      console.log("   ⚠️  Error:", e.message);
    }

    console.log("\n✅ Configuration Check Complete!\n");

    console.log("📝 Next Steps:");
    console.log("1. Verify Google OAuth is ENABLED above");
    console.log("2. Make sure Client ID and Client Secret are SET");
    console.log("3. Try logging in again with Google\n");

    console.log("If OAuth still fails:");
    console.log("- Check browser console (F12) for error details");
    console.log("- Verify Google Cloud Console has correct redirect URIs");
    console.log("- Restart your Appwrite instance");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkAndFixOAuth();
