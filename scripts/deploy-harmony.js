// Deployment script for CryptoDraw on Harmony blockchain
// Run: npx hardhat run scripts/deploy-harmony.js --network harmony

const hre = require("hardhat");

async function main() {
  console.log("Starting CryptoDraw deployment on Harmony...\n");

  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const networkName = hre.network.name;
  const networkKey = networkName === 'harmony_testnet' ? 'harmony-testnet' : 'harmony';
  console.log("Network:", networkName, `(${net.chainId.toString()})`);
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
  const ONE_GWEI = ethers.BigNumber.from("1000000000");
  const overrides = { gasPrice };
  console.log("Using gasPrice:", gasPrice.toString(), "wei\n");

  // Helper: Retry wrapper that bumps gasPrice on underpriced errors
  async function withGasRetry(sendFn, label) {
    let attempts = 0;
    while (attempts < 10) {
      try {
        const res = await sendFn();
        return res;
      } catch (e) {
        const msg = (e && e.message) || String(e);
        if (
          msg.includes("underpriced") ||
          msg.includes("replacement") ||
          msg.toLowerCase().includes("fee too low")
        ) {
          // Bump ~+25% over previous and ensure +1 gwei floor
          const prev = gasPrice;
          gasPrice = gasPrice.mul(125).div(100);
          if (gasPrice.lte(prev)) gasPrice = prev.add(ONE_GWEI);
          // Also re-fetch current network gas and take 130% of it if higher
          try {
            const netNow = await ethers.provider.getGasPrice();
            const netTarget = netNow.mul(13).div(10);
            if (netTarget.gt(gasPrice)) gasPrice = netTarget;
          } catch (_) {}
          if (gasPrice.lt(minGwei)) gasPrice = minGwei;
          console.log(` ${label}: attempt ${attempts + 1} → bump gasPrice to ${gasPrice.toString()} wei and retrying...`);
          attempts += 1;
          continue;
        }
        throw e;
      }
    }
    throw new Error(`${label}: failed after ${attempts} attempts`);
  }

  // Configuration - UPDATE THESE VALUES
  const config = {
    // Initial ONE price in USD (18 decimals) - e.g., $0.015 = 15000000000000000
    initialONEPriceUSD: ethers.utils.parseEther("0.015"),

    // Wallet addresses - MUST UPDATE
    treasuryWallet: process.env.TREASURY_WALLET || "0x0000000000000000000000000000000000000001", // UPDATE
    prizeWallet: process.env.PRIZE_WALLET || "0x0000000000000000000000000000000000000002", // UPDATE
    projectFund: process.env.PROJECT_FUND || "0x0000000000000000000000000000000000000003", // UPDATE
    grantFund: process.env.GRANT_FUND || "0x0000000000000000000000000000000000000004", // UPDATE
    operationFund: process.env.OPERATION_FUND || "0x0000000000000000000000000000000000000005", // UPDATE

    // Example deppegs tokens on Harmony (UPDATE with actual addresses)
    tokens: {
      wONE: process.env.WONE_TOKEN || "0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a", // Wrapped ONE
      // Add more deppegs tokens here
    },
  };

  // 1. Deploy PriceOracle
  console.log("[deploy] Deploying PriceOracle...");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await withGasRetry(
    () => PriceOracle.deploy(config.initialONEPriceUSD, { gasPrice }),
    "PriceOracle.deploy"
  );
  await priceOracle.deployed();
  console.log("✅ PriceOracle deployed to:", priceOracle.address, "\n");

  // 2. Deploy TicketNFT
  console.log("[deploy] Deploying TicketNFT...");
  const TicketNFT = await ethers.getContractFactory("TicketNFT");
  const ticketNFT = await withGasRetry(
    () => TicketNFT.deploy({ gasPrice }),
    "TicketNFT.deploy"
  );
  await ticketNFT.deployed();
  console.log("✅ TicketNFT deployed to:", ticketNFT.address, "\n");

  // 3. Deploy GameLibrary
  console.log("[deploy] Deploying GameLibrary...");
  const GameLibrary = await ethers.getContractFactory("GameLibrary");
  const gameLibrary = await withGasRetry(
    () => GameLibrary.deploy({ gasPrice }),
    "GameLibrary.deploy"
  );
  await gameLibrary.deployed();
  console.log("✅ GameLibrary deployed to:", gameLibrary.address, "\n");

  // 4. Deploy CryptoDraw (link with GameLibrary)
  console.log("[deploy] Deploying CryptoDrawV2...");
  const CryptoDraw = await ethers.getContractFactory("CryptoDraw");

  const cryptoDraw = await withGasRetry(
    () => CryptoDraw.deploy(
    ticketNFT.address,
    priceOracle.address,
    config.treasuryWallet,
    config.prizeWallet,
    config.projectFund,
    config.grantFund,
      config.operationFund,
      { gasPrice }
    ),
    "CryptoDraw.deploy"
  );
  await cryptoDraw.deployed();
  console.log("✅ CryptoDrawV2 deployed to:", cryptoDraw.address, "\n");

  // 5. Configure TicketNFT
  console.log("[config] Configuring TicketNFT...");
  let tx = await withGasRetry(
    () => ticketNFT.setCryptoDrawAddress(cryptoDraw.address, { gasPrice }),
    "TicketNFT.setCryptoDrawAddress"
  );
  await tx.wait();
  console.log("✅ TicketNFT configured\n");

  // 6. Add supported tokens
  console.log("[config] Adding supported tokens...");

  // Add wONE to PriceOracle (example: $0.015 per wONE)
  tx = await withGasRetry(
    () => priceOracle.addToken(
    config.tokens.wONE,
    18, // decimals
    config.initialONEPriceUSD,
      { gasPrice }
    ),
    "PriceOracle.addToken(wONE)"
  );
  await tx.wait();
  console.log("✅ wONE added to PriceOracle");

  // Add wONE to CryptoDraw
  tx = await withGasRetry(
    () => cryptoDraw.setSupportedToken(config.tokens.wONE, true, { gasPrice }),
    "CryptoDraw.setSupportedToken(wONE)"
  );
  await tx.wait();
  console.log("✅ wONE added to CryptoDraw");

  // Add native ONE (address(0))
  tx = await withGasRetry(
    () => cryptoDraw.setSupportedToken(ethers.constants.AddressZero, true, { gasPrice }),
    "CryptoDraw.setSupportedToken(native)"
  );
  await tx.wait();
  console.log("✅ Native ONE added to CryptoDraw\n");

  // 7. Grant roles (optional - for multi-sig setups)
  console.log("[config] Setting up roles...");
  const OPERATOR_ROLE = await cryptoDraw.OPERATOR_ROLE();
  const AGENT_ROLE = await cryptoDraw.AGENT_ROLE();

  // Example: Grant operator role to deployer (can change later)
  tx = await withGasRetry(
    () => cryptoDraw.grantRole(OPERATOR_ROLE, deployer.address, { gasPrice }),
    "CryptoDraw.grantRole(OPERATOR)"
  );
  await tx.wait();
  console.log("✅ Operator role granted to deployer\n");

  // Summary
  console.log("=".repeat(60));
  console.log(" Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n Contract Addresses:");
  console.log("PriceOracle:   ", priceOracle.address);
  console.log("TicketNFT:     ", ticketNFT.address);
  console.log("GameLibrary:   ", gameLibrary.address);
  console.log("CryptoDrawV2:  ", cryptoDraw.address);

  console.log("\n Next Steps:");
  console.log("1. Verify contracts on explorer");
  console.log("2. Update token prices in PriceOracle");
  console.log("3. Grant AGENT_ROLE to authorized agents");
  console.log("4. Fund prizeWallet with wONE for payouts");
  console.log("5. Test with small transactions first");

  console.log("\n Verification Commands:");
  console.log(
    `npx hardhat verify --network ${networkName} ${priceOracle.address} "${config.initialONEPriceUSD}"`,
  );
  console.log(`npx hardhat verify --network ${networkName} ${ticketNFT.address}`);
  console.log(`npx hardhat verify --network ${networkName} ${gameLibrary.address}`);
  console.log(
    `npx hardhat verify --network ${networkName} ${cryptoDraw.address} ${ticketNFT.address} ${priceOracle.address} ${config.treasuryWallet} ${config.prizeWallet} ${config.projectFund} ${config.grantFund} ${config.operationFund}`,
  );

  // Optional: Auto-verify contracts (best-effort)
  try {
    const confirmations = net.chainId === 1 ? 6 : 2;
    console.log(`\n Waiting ${confirmations} confirmations before verification...`);
    // Wait for deploy tx confirmations
    const poTx = priceOracle.deployTransaction; if (poTx?.wait) await poTx.wait(confirmations);
    const tnTx = ticketNFT.deployTransaction;  if (tnTx?.wait) await tnTx.wait(confirmations);
    const glTx = gameLibrary.deployTransaction; if (glTx?.wait) await glTx.wait(confirmations);
    const cdTx = cryptoDraw.deployTransaction; if (cdTx?.wait) await cdTx.wait(confirmations);

    console.log("\n[verify] Auto-verifying on explorer...");
    // PriceOracle
    await hre.run('verify:verify', {
      address: priceOracle.address,
      constructorArguments: [config.initialONEPriceUSD],
      conttract: "contracts/PriceOracle.sol:PriceOracle"
    }).then(() => console.log('✅ Verified: PriceOracle')).catch((e) => console.warn('⚠️ Verify PriceOracle:', e?.message || e));

    // TicketNFT
    await hre.run('verify:verify', {
      address: ticketNFT.address,
      constructorArguments: [],
      contract: "contracts/TicketNFT.sol:TicketNFT"
    }).then(() => console.log('✅ Verified: TicketNFT')).catch((e) => console.warn('⚠️ Verify TicketNFT:', e?.message || e));

    // GameLibrary
    await hre.run('verify:verify', {
      address: gameLibrary.address,
      contract: "contracts/GameLibrary.sol:GameLibrary",
      constructorArguments: []
    }).then(() => console.log('✅ Verified: GameLibrary')).catch((e) => console.warn('⚠️ Verify GameLibrary:', e?.message || e));

    // CryptoDraw
    await hre.run('verify:verify', {
      address: cryptoDraw.address,
      constructorArguments: [
        ticketNFT.address,
        priceOracle.address,
        config.treasuryWallet,
        config.prizeWallet,
        config.projectFund,
        config.grantFund,
        config.operationFund,
      ],
      contract: "contracts/CryptoDrawV2.sol:CryptoDraw"
    }).then(() => console.log('✅ Verified: CryptoDrawV2')).catch((e) => console.warn('⚠️ Verify CryptoDrawV2:', e?.message || e));
  } catch (err) {
    console.warn('⚠️ Auto-verification skipped or failed:', err?.message || String(err));
  }

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: networkName,
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

  const fileName = `./deployment-${networkKey}.json`;
  fs.writeFileSync(fileName, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to ${fileName}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
