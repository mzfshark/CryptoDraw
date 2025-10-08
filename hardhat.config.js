const { skip } = require('node:test');

// Minimal plugins and conditional verify to avoid runtime crashes during deploy
require('@nomiclabs/hardhat-ethers');
try { require('@nomiclabs/hardhat-waffle'); } catch { /* optional */ }
try { require('@nomicfoundation/hardhat-chai-matchers'); } catch { /* optional */ }
try { require('hardhat-gas-reporter'); } catch { /* optional */ }

// Only load verify plugin when needed (CLI task or forced via env)
const shouldLoadVerify = process.argv.some((a) => /\bverify\b/.test(a)) || process.env.HARDHAT_LOAD_VERIFY === '1';
if (shouldLoadVerify) {
  // Prefer the CJS-compatible etherscan plugin to avoid ESM import issues
  try {
    require('@nomiclabs/hardhat-etherscan');
    console.log('[verify] Loaded @nomiclabs/hardhat-etherscan');
  } catch (e) {
    console.log('Warning: verify plugin not available (@nomiclabs/hardhat-etherscan)', e && e.message);
    // As a last resort, try the foundation plugin (may fail on Node >=20 due to ESM)
    try {
      require('@nomicfoundation/hardhat-verify');
      console.log('[verify] Loaded @nomicfoundation/hardhat-verify');
    } catch (e2) {
      console.log('Warning: no verify plugin available');
    }
  }
}
// Register coverage plugin
try {
  require('solidity-coverage');
} catch (e) {
  console.log('Warning: solidity-coverage not available');
}
// Load env vars per network: .env.develop for testnets, .env.production for mainnets
const path = require('path');
const dotenv = require('dotenv');

function detectNetworkFromArgv() {
  const idx = process.argv.indexOf('--network');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

const selectedNetwork = process.env.HARDHAT_NETWORK || detectNetworkFromArgv();
const TESTNETS = new Set(['harmony_testnet', 'sepolia', 'bsc_testnet']);
const MAINNETS = new Set(['harmony', 'mainnet', 'bsc']);

let envFile = '.env';
if (selectedNetwork && TESTNETS.has(selectedNetwork)) envFile = '.env.develop';
if (selectedNetwork && MAINNETS.has(selectedNetwork)) envFile = '.env.production';

dotenv.config({ path: path.resolve(__dirname, envFile) });
console.log(`[env] Loaded ${envFile} for network: ${selectedNetwork ?? 'default'}`);

// Try to require network helpers with fallback
try {
  require('@nomicfoundation/hardhat-network-helpers');
} catch (error) {
  console.log('Warning: @nomicfoundation/hardhat-network-helpers not available');
}

module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true, // Enable IR compilation to avoid "Stack too deep" errors
      evmVersion: "paris" // Harmony supports up to Paris EVM
    }
  },
  coverage: {
    skipFiles: ["mocks/", "v2/"],
  },
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        count: 20,
        accountsBalance: "10000000000000000000000" // 10,000 ETH
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    harmony: {
      url: process.env.HARMONY_MAINNET_URL || "https://api.harmony.one",
      chainId: 1666600000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: parseInt(process.env.GAS_PRICE || "1000000000"), // 1 gwei
      gasMultiplier: parseFloat(process.env.GAS_MULTIPLIER || "1.1"),
      timeout: 60000
    },
    harmony_testnet: {
      url: process.env.HARMONY_TESTNET_URL || "https://api.s0.b.hmny.io",
      chainId: 1666700000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: parseInt(process.env.GAS_PRICE || "1000000000"), // 1 gwei
      gasMultiplier: parseFloat(process.env.GAS_MULTIPLIER || "1.2"),
      timeout: 60000
    },
    mainnet: {
      url: process.env.ETHEREUM_MAINNET_URL || "https://mainnet.infura.io/v3/554262fab79f49adb4fdba2db2587800",
      chainId: 1,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    sepolia: {
      url: process.env.ETHEREUM_SEPOLIA_URL || "https://sepolia.infura.io/v3/554262fab79f49adb4fdba2db2587800",
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    bsc: {
      url: process.env.BSC_MAINNET_URL || "https://bsc-dataseed1.binance.org/",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    bsc_testnet: {
      url: process.env.BSC_TESTNET_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      harmony: process.env.HARMONY_EXPLORER_API_KEY || "dummy",
      harmony_testnet: process.env.HARMONY_EXPLORER_API_KEY || "dummy",
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "harmony",
        chainId: 1666600000,
        urls: {
          // Harmony explorer is Blockscout-based; use its /api endpoint
          apiURL: "https://explorer.harmony.one/api",
          browserURL: "https://explorer.harmony.one"
        }
      },
      {
        network: "harmony_testnet",  
        chainId: 1666700000,
        urls: {
          apiURL: "https://explorer.testnet.harmony.one/api",
          browserURL: "https://explorer.testnet.harmony.one"
        }
      }
    ]
  },
  mocha: {
    timeout: 60000 // 60 seconds
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    gasPrice: 1 // 1 gwei for Harmony
  }
};
