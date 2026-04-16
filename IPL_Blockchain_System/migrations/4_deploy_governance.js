const IPLTicket = artifacts.require("IPLTicket");
const IPLGovernance = artifacts.require("IPLGovernance");

module.exports = async function (deployer) {
    const ticket = await IPLTicket.deployed();

    const defaultVotingBlocks = 20;
    const minQuorumWeight = 5;

    await deployer.deploy(
        IPLGovernance,
        ticket.address,
        defaultVotingBlocks,
        minQuorumWeight
    );
};
