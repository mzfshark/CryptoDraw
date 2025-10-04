// Deployment script for CryptoDraw on Harmony blockchain
// Run: npx hardhat run scripts/deploy-harmony.js --network harmony

const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting CryptoDraw deployment on Harmony...\n");

  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log("Network:", hre.network.name, `(${net.chainId.toString()})`);
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.getBalance()).toString(),
    "\n",
  );

  // Determine gas price (use env override if provided). Harmony nodes can reject 1 gwei as underpriced.
  const minGwei = ethers.BigNumber.from("2000000000"); // 2 gwei minimum
  let networkGasPrice = await ethers.provider.getGasPrice();
  let gasPrice = networkGasPrice.mul(12).div(10); // +20%
  if (process.env.GAS_PRICE) {
    try {
      gasPrice = ethers.BigNumber.from(process.env.GAS_PRICE);
    } catch (_) {}
  }
  if (gasPrice.lt(minGwei)) gasPrice = minGwei;
  const overrides = { gasPrice };
  console.log("Using gasPrice:", gasPrice.toString(), "wei\n");

  // Configuration - UPDATE THESE VALUES
  const config = {
    // Initial ONE price in USD (18 decimals) - e.g., $0.015 = 15000000000000000
    initialONEPriceUSD: ethers.utils.parseEther("0.015"),

    // Wallet addresses - MUST UPDATE
    treasuryWallet: "0x0000000000000000000000000000000000000001", // UPDATE
    prizeWallet: "0x0000000000000000000000000000000000000002", // UPDATE
    projectFund: "0x0000000000000000000000000000000000000003", // UPDATE
    grantFund: "0x0000000000000000000000000000000000000004", // UPDATE
    operationFund: "0x0000000000000000000000000000000000000005", // UPDATE

    // Example deppegs tokens on Harmony (UPDATE with actual addresses)
    tokens: {
      wONE: "0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a", // Wrapped ONE
      // Add more deppegs tokens here
    },
  };

  // 1. Deploy PriceOracle
  console.log("📊 Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(config.initialONEPriceUSD, overrides);
  await priceOracle.deployed();
  console.log("✅ PriceOracle deployed to:", priceOracle.address, "\n");

  // 2. Deploy TicketNFT
  console.log("🎫 Deploying TicketNFT...");
  const TicketNFT = await ethers.getContractFactory("TicketNFT");
  const ticketNFT = await TicketNFT.deploy(overrides);
  await ticketNFT.deployed();
  console.log("✅ TicketNFT deployed to:", ticketNFT.address, "\n");

  // 3. Deploy GameLibrary
  console.log("📚 Deploying GameLibrary...");
  const GameLibrary = await ethers.getContractFactory("GameLibrary");
  const gameLibrary = await GameLibrary.deploy(overrides);
  await gameLibrary.deployed();
  console.log("✅ GameLibrary deployed to:", gameLibrary.address, "\n");

  // 4. Deploy CryptoDraw (link with GameLibrary)
  console.log("🎰 Deploying CryptoDrawV2...");
  const CryptoDraw = await ethers.getContractFactory("CryptoDraw", {
    libraries: {
      GameLibrary: gameLibrary.address,
    },
  });

  const cryptoDraw = await CryptoDraw.deploy(
    ticketNFT.address,
    priceOracle.address,
    config.treasuryWallet,
    config.prizeWallet,
    config.projectFund,
    config.grantFund,
    config.operationFund,
    overrides,
  );
  await cryptoDraw.deployed();
  console.log("✅ CryptoDrawV2 deployed to:", cryptoDraw.address, "\n");

  // 5. Configure TicketNFT
  console.log("⚙️  Configuring TicketNFT...");
  let tx = await ticketNFT.setCryptoDrawAddress(cryptoDraw.address, overrides);
  await tx.wait();
  console.log("✅ TicketNFT configured\n");

  // 6. Add supported tokens
  console.log("💎 Adding supported tokens...");

  // Add wONE to PriceOracle (example: $0.015 per wONE)
  tx = await priceOracle.addToken(
    config.tokens.wONE,
    18, // decimals
    config.initialONEPriceUSD,
    overrides,
  );
  await tx.wait();
  console.log("✅ wONE added to PriceOracle");

  // Add wONE to CryptoDraw
  tx = await cryptoDraw.setSupportedToken(config.tokens.wONE, true, overrides);
  await tx.wait();
  console.log("✅ wONE added to CryptoDraw");

  // Add native ONE (address(0))
  tx = await cryptoDraw.setSupportedToken(ethers.constants.AddressZero, true, overrides);
  await tx.wait();
  console.log("✅ Native ONE added to CryptoDraw\n");

  // 7. Grant roles (optional - for multi-sig setups)
  console.log("👥 Setting up roles...");
  const OPERATOR_ROLE = await cryptoDraw.OPERATOR_ROLE();
  const AGENT_ROLE = await cryptoDraw.AGENT_ROLE();

  // Example: Grant operator role to deployer (can change later)
  tx = await cryptoDraw.grantRole(OPERATOR_ROLE, deployer.address, overrides);
  await tx.wait();
  console.log("✅ Operator role granted to deployer\n");

  // Summary
  console.log("=".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("PriceOracle:   ", priceOracle.address);
  console.log("TicketNFT:     ", ticketNFT.address);
  console.log("GameLibrary:   ", gameLibrary.address);
  console.log("CryptoDrawV2:  ", cryptoDraw.address);

  console.log("\n📝 Next Steps:");
  console.log("1. Verify contracts on explorer");
  console.log("2. Update token prices in PriceOracle");
  console.log("3. Grant AGENT_ROLE to authorized agents");
  console.log("4. Fund prizeWallet with wONE for payouts");
  console.log("5. Test with small transactions first");

  console.log("\n🔍 Verification Commands:");
  console.log(
    `npx hardhat verify --network harmony ${priceOracle.address} "${config.initialONEPriceUSD}"`,
  );
  console.log(`npx hardhat verify --network harmony ${ticketNFT.address}`);
  console.log(`npx hardhat verify --network harmony ${gameLibrary.address}`);
  console.log(
    `npx hardhat verify --network harmony ${cryptoDraw.address} ${ticketNFT.address} ${priceOracle.address} ${config.treasuryWallet} ${config.prizeWallet} ${config.projectFund} ${config.grantFund} ${config.operationFund}`,
  );

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "harmony",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      priceOracle: priceOracle.address,
      ticketNFT: ticketNFT.address,
      gameLibrary: gameLibrary.address,
      cryptoDraw: cryptoDraw.address,
    },
    config: config,
  };

  fs.writeFileSync(
    "./deployment-harmony.json",
    JSON.stringify(deploymentInfo, null, 2),
  );
  console.log("\n💾 Deployment info saved to deployment-harmony.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
