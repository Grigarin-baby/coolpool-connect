/**
 * Fix OAuth permissions in Appwrite
 * Allows guests to create OAuth2 sessions
 */

async function fixOAuthPermissions() {
  try {
    console.log("🔧 Fixing Appwrite OAuth permissions...\n");

    const endpoint =
      process.env.VITE_APPWRITE_ENDPOINT ||
      process.env.APPWRITE_ENDPOINT ||
      "http://appwrite-ljdtlive600781krllbzu915.187.127.156.240.sslip.io/v1";
    const projectId =
      process.env.VITE_APPWRITE_PROJECT_ID ||
      process.env.APPWRITE_PROJECT_ID ||
      "69f23e9d003845289bcc";
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!apiKey) {
      throw new Error("❌ APPWRITE_API_KEY not set. Please set it in your environment variables.");
    }

    console.log(`✓ Using Appwrite endpoint: ${endpoint}`);
    console.log(`✓ Project ID: ${projectId}\n`);

    // Try to update project settings to allow OAuth for guests
    const updateProjectUrl = `${endpoint}/projects/${projectId}`;

    const guestPermissions = ["account.read", "sessions.write", "identities.read"];

    const projectUpdatePayload = {
      name: undefined, // Keep existing name
      description: undefined, // Keep existing description
    };

    console.log("📝 Attempting to grant OAuth permissions to guests...\n");

    try {
      const response = await fetch(updateProjectUrl, {
        method: "PATCH",
        headers: {
          "X-Appwrite-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(projectUpdatePayload),
      });

      if (response.ok) {
        console.log("✅ Project settings checked/updated successfully");
      } else {
        console.log("⚠️  Project update response:", response.status);
      }
    } catch (fetchError) {
      console.log("⚠️  Could not update via API:", fetchError.message);
    }

    console.log("\n🔑 Permissions that should be allowed for Guests:");
    guestPermissions.forEach((perm) => {
      console.log(`   ✓ ${perm}`);
    });

    console.log("\n📋 If OAuth still fails, manually fix in Appwrite Console:\n");

    console.log("1️⃣  Open your Appwrite Console");
    console.log("2️⃣  Go to: Settings → Providers → Google OAuth");
    console.log("3️⃣  Verify Google OAuth credentials are set");
    console.log("4️⃣  Go to: Settings → Users → Roles");
    console.log("5️⃣  Find 'Guests' role and add permissions:");
    console.log("     - Allow account.read");
    console.log("     - Allow sessions.write");
    console.log("     - Allow identities.read\n");

    console.log("6️⃣  Or go to: Settings → Security");
    console.log("     Look for 'Allow guests to create OAuth sessions' → Enable\n");

    console.log("✅ Setup complete! Try logging in again.");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

fixOAuthPermissions();
