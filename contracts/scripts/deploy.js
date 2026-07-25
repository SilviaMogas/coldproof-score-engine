import hre from "hardhat";

const oracle = process.env.ORACLE_ADDRESS;
if (!oracle) {
  throw new Error("ORACLE_ADDRESS is required");
}

const escrow = await hre.ethers.deployContract("ColdProofEscrow", [oracle]);
await escrow.waitForDeployment();

const address = await escrow.getAddress();
const deploymentTx = escrow.deploymentTransaction();
console.log(
  JSON.stringify(
    {
      network: hre.network.name,
      chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
      address,
      deploymentTransaction: deploymentTx?.hash ?? null,
      deploymentBlock: deploymentTx
        ? (await deploymentTx.wait())?.blockNumber ?? null
        : null,
      oracle,
    },
    null,
    2
  )
);
