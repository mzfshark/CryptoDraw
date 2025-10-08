// Usage examples:
//   ROLE=OPERATOR CONTRACT=0x... TARGET=0x... npx hardhat run scripts/admin/grant-role.js --network harmony
//   npx hardhat run scripts/admin/grant-role.js --network harmony 0xContract 0xTarget OPERATOR

const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const args = process.argv.slice(2);

  const contractAddr = process.env.CONTRACT || args[0];
  const targetAddr = process.env.TARGET || args[1];
  const roleArg = (process.env.ROLE || args[2] || "").toUpperCase();

  if (!contractAddr || !ethers.utils.isAddress(contractAddr)) {
    console.error("❌ Informe o endereço do contrato CryptoDraw (CONTRACT ou arg[0])");
    process.exit(1);
  }
  if (!targetAddr || !ethers.utils.isAddress(targetAddr)) {
    console.error("❌ Informe o endereço alvo para receber a role (TARGET ou arg[1])");
    process.exit(1);
  }
  if (!roleArg) {
    console.error("❌ Informe a ROLE (OPERATOR | AGENT | DEFAULT_ADMIN | bytes32 hex)");
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log(`🔗 Network: ${hre.network.name} (${net.chainId})`);
  console.log("👤 Signer:", signer.address);

  const cd = await ethers.getContractAt("CryptoDraw", contractAddr, signer);

  // Resolve role
  let role;
  if (roleArg === "OPERATOR") role = await cd.OPERATOR_ROLE();
  else if (roleArg === "AGENT") role = await cd.AGENT_ROLE();
  else if (roleArg === "DEFAULT_ADMIN" || roleArg === "ADMIN") role = await cd.DEFAULT_ADMIN_ROLE();
  else if (ethers.utils.isHexString(roleArg)) role = roleArg;
  else {
    console.error("❌ ROLE inválida. Use OPERATOR, AGENT, DEFAULT_ADMIN ou um bytes32 em hex");
    process.exit(1);
  }

  // Check admin
  const DEFAULT_ADMIN_ROLE = await cd.DEFAULT_ADMIN_ROLE();
  const isAdmin = await cd.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  if (!isAdmin) {
    console.error("❌ O signer não possui DEFAULT_ADMIN_ROLE. Use uma carteira admin para conceder roles.");
    process.exit(1);
  }

  console.log(`🛡️  Granting role ${role} to ${targetAddr} on ${contractAddr} ...`);
  const tx = await cd.grantRole(role, targetAddr);
  console.log("⛽ tx:", tx.hash);
  await tx.wait(1);
  console.log("✅ Role concedida com sucesso");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
