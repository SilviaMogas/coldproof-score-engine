import hre from "hardhat";

const oracle = process.env.ORACLE_ADDRESS;
if (!oracle) throw new Error("ORACLE_ADDRESS is required");

const consensus = await hre.ethers.deployContract("ColdProofConsensus", [oracle]);
await consensus.waitForDeployment();
const transaction = consensus.deploymentTransaction();
const receipt = transaction ? await transaction.wait() : null;

console.log(
  JSON.stringify(
    {
      network: hre.network.name,
      chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
      address: await consensus.getAddress(),
      deploymentTransaction: transaction?.hash ?? null,
      deploymentBlock: receipt?.blockNumber ?? null,
      oracle,
    },
    null,
    2
  )
);
