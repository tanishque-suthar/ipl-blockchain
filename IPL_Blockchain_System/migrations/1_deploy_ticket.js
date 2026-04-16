const IPLTicket = artifacts.require("IPLTicket");

module.exports = async function (deployer, _network, accounts) {
    const royaltyReceiver = accounts[0];
    const royaltyBps = 500;

    await deployer.deploy(
        IPLTicket,
        "IPL Fan Ticket",
        "IPLT",
        royaltyReceiver,
        royaltyBps
    );
};
