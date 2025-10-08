// Contract verification script
// Run: npm run verify:testnet

const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const network = hre.network.name;
    console.log(`🔍 Verifying contracts on ${network}...`);

    // Load deployment info (supports harmony and harmony_testnet). Fallback to mainnet file if specific not found.
    const networkKey = network === 'harmony_testnet' ? 'harmony-testnet' : 'harmony';
    const candidateFiles = [
        `./deployment-${networkKey}.json`,
        `./deployment-harmony.json`
    ];
    const deploymentFile = candidateFiles.find((f) => fs.existsSync(f));
    if (!deploymentFile) {
        console.log(`❌ Deployment file not found. Looked for: ${candidateFiles.join(', ')}. Please deploy contracts first.`);
        return;
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    const contracts = deployment.contracts;
    const config = deployment.config;

    try {
        // Verify PriceOracle
        console.log("🔍 Verifying PriceOracle...");
        await hre.run("verify:verify", {
            address: contracts.priceOracle,
            contract: "contracts/PriceOracle.sol:PriceOracle",
            constructorArguments: [config.initialONEPriceUSD]
        });
        console.log("✅ PriceOracle verified");

        // Verify TicketNFT  
        console.log("🔍 Verifying TicketNFT...");
        await hre.run("verify:verify", {
            address: contracts.ticketNFT,
            contract: "contracts/TicketNFT.sol:TicketNFT",
            constructorArguments: []
        });
        console.log("✅ TicketNFT verified");

        // Verify GameLibrary
        console.log("🔍 Verifying GameLibrary...");
        await hre.run("verify:verify", {
            address: contracts.gameLibrary,
            contract: "contracts/GameLibrary.sol:GameLibrary",
            constructorArguments: []
        });
        console.log("✅ GameLibrary verified");

        // Verify CryptoDraw (complex due to libraries)
        console.log("🔍 Verifying CryptoDraw...");
        await hre.run("verify:verify", {
            address: contracts.cryptoDraw,
            contract: "contracts/CryptoDrawV2.sol:CryptoDraw",
            constructorArguments: [
                contracts.ticketNFT,
                contracts.priceOracle,
                config.treasuryWallet,
                config.prizeWallet,
                config.projectFund,
                config.grantFund,
                config.operationFund
            ]
        });
    console.log("✅ CryptoDraw verified");

        console.log("\n🎉 All contracts verified successfully!");

    } catch (error) {
    console.error("❌ Verification failed:", error.message);
        
        // Common troubleshooting tips
        console.log("\n💡 Troubleshooting tips:");
        console.log("- Make sure contracts are deployed and confirmed");
        console.log("- Check if constructor arguments match exactly");
        console.log("- Verify you have the correct API key in hardhat.config.js");
        console.log("- Some contracts may already be verified");
        console.log("- Ensure the verification plugin is loaded (requires @nomicfoundation/hardhat-verify)");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });