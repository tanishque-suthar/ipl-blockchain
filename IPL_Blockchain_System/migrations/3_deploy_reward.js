const IPLReward = artifacts.require("IPLReward");

module.exports = async function (deployer) {
    await deployer.deploy(IPLReward, "ipfs://ipl-rewards/{id}.json");
};
