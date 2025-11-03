const { ethers, upgrades, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

// [REMOVED] Hardcoded private keys are a security risk.

async function main() {
  const signers = await ethers.getSigners();
  
  if (signers.length < 20) {
    throw new Error("Need at least 20 Hardhat accounts. Please check your hardhat.config.js");
  }

  const deployer = signers[0]; // Super Admin (Account #0)
  const sponsorAccount = signers[19]; // Sponsor (Account #19)

  console.log("Deploying contracts with the account (Super Admin):", deployer.address);
  console.log("Sponsor account will be:", sponsorAccount.address);

  const MedicalRecords = await ethers.getContractFactory("MedicalRecords");
  console.log("Deploying MedicalRecords (upgradeable)...");

  const medicalRecords = await upgrades.deployProxy(
    MedicalRecords,
    [deployer.address], // Pass the deployer's address to the initializer
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  await medicalRecords.waitForDeployment();
  const contractAddress = await medicalRecords.getAddress();
  console.log("MedicalRecords proxy deployed to:", contractAddress);

  // --- Grant Sponsor Role ---
  console.log("Granting SPONSOR_ROLE to the sponsor account...");
  try {
    const tx = await medicalRecords.connect(deployer).grantSponsorRole(sponsorAccount.address);
    await tx.wait();
    console.log("Successfully granted SPONSOR_ROLE to:", sponsorAccount.address);
  } catch (error) {
    console.error("Failed to grant sponsor role:", error);
    process.exit(1);
  }

  saveFrontendFiles(contractAddress);
  // [MODIFIED] Pass the signers to saveBackendFiles to get their private keys
  // This is ONLY for local development convenience
  saveBackendFiles(contractAddress);
}

function saveFrontendFiles(contractAddress) {
  const contractsDir = path.join(__dirname, "/../src/contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, "/contract-address.json"),
    JSON.stringify({ MedicalRecords: contractAddress }, undefined, 2)
  );

  const MedicalRecordsArtifact = artifacts.readArtifactSync("MedicalRecords");
  fs.writeFileSync(
    path.join(contractsDir, "/MedicalRecords.json"),
    JSON.stringify(MedicalRecordsArtifact, null, 2)
  );

  console.log("Frontend configuration files saved to /src/contracts");
}

function saveBackendFiles(contractAddress) {
    const backendDir = path.join(__dirname, '/../backend');
    const envFilePath = path.join(backendDir, '.env');

    if (!fs.existsSync(backendDir)) {
        fs.mkdirSync(backendDir);
    }
    
    let envContent = {};

    // If .env file exists, read its contents
    if (fs.existsSync(envFilePath)) {
        const fileContent = fs.readFileSync(envFilePath, { encoding: 'utf8' });
        fileContent.split('\n').forEach(line => {
            if (line) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=');
                envContent[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
            }
        });
    }

    // Update or add the necessary variables
    envContent['CONTRACT_ADDRESS'] = contractAddress;
    envContent['PROVIDER_URL'] = "http://127.0.0.1:8545/";

    // [MODIFIED] Ensure placeholders exist, but DO NOT write private keys.
    // Private keys must be set manually by the developer.
    if (!envContent['MONGO_URI']) {
        envContent['MONGO_URI'] = "mongodb://127.0.0.1:27017/medical_records_db";
    }
    if (!envContent['JWT_SECRET']) {
        envContent['JWT_SECRET'] = "YOUR_SUPER_SECRET_JWT_KEY";
    }
    
    // [NEW] Add placeholder text to instruct the user
    if (!envContent['SUPER_ADMIN_PRIVATE_KEY']) {
        envContent['SUPER_ADMIN_PRIVATE_KEY'] = "PASTE_HARDHAT_ACCOUNT_0_PRIVATE_KEY_HERE";
    }
    if (!envContent['SPONSOR_WALLET_PRIVATE_KEY']) {
        envContent['SPONSOR_WALLET_PRIVATE_KEY'] = "PASTE_HARDHAT_ACCOUNT_19_PRIVATE_KEY_HERE";
    }

    // Format the content back to KEY="VALUE" strings
    const newEnvFileContent = Object.entries(envContent)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n');
    
    fs.writeFileSync(envFilePath, newEnvFileContent);

    console.log(`Backend .env file created/updated at ${envFilePath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

