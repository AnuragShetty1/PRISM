const { ethers, upgrades, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, '../.env') }); // Ensure correct .env path

async function main() {
  // --- 1. Get Signers ---
  // Get the deployer account from Hardhat config (using DEPLOYER_PRIVATE_KEY)
  const [deployer] = await ethers.getSigners();

  // Get the sponsor account from .env (using SPONSOR_PRIVATE_KEY)
  const sponsorPk = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorPk) {
    throw new Error("SPONSOR_PRIVATE_KEY not found in .env file");
  }
  const sponsorWallet = new ethers.Wallet(sponsorPk, ethers.provider);

  console.log("Deploying contracts with the account (Super Admin):", deployer.address);
  console.log("Sponsor account will be:", sponsorWallet.address);

  // --- 2. Deploy Contract ---
  const MedicalRecords = await ethers.getContractFactory("MedicalRecords");
  console.log("Deploying MedicalRecords (upgradeable) to Amoy...");

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

  // --- 3. Grant Sponsor Role ---
  console.log("Granting SPONSOR_ROLE to the sponsor account...");
  try {
    // The deployer (super admin) grants the role to the sponsor wallet
    const tx = await medicalRecords.connect(deployer).grantSponsorRole(sponsorWallet.address);
    await tx.wait();
    console.log("Successfully granted SPONSOR_ROLE to:", sponsorWallet.address);
  } catch (error) {
    console.error("Failed to grant sponsor role:", error);
    process.exit(1);
  }

  // --- 4. Save Frontend Files ---
  saveFrontendFiles(contractAddress);
}

function saveFrontendFiles(contractAddress) {
  const contractsDir = path.join(__dirname, "/../src/contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  // Save the contract address
  fs.writeFileSync(
    path.join(contractsDir, "/contract-address.json"),
    JSON.stringify({ MedicalRecords: contractAddress }, undefined, 2)
  );

  // Save the contract's ABI
  const MedicalRecordsArtifact = artifacts.readArtifactSync("MedicalRecords");
  fs.writeFileSync(
    path.join(contractsDir, "/MedicalRecords.json"),
    JSON.stringify(MedicalRecordsArtifact, null, 2)
  );

  console.log("Frontend configuration files saved to /src/contracts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

