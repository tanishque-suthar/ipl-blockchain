const IPLTicket = artifacts.require("IPLTicket");
const IPLTicketMarketplace = artifacts.require("IPLTicketMarketplace");

module.exports = async function (deployer, _network, accounts) {
    const tdsTreasury = accounts[1] || accounts[0];
    const tdsBps = 100;

    await deployer.deploy(IPLTicketMarketplace, tdsTreasury, tdsBps);

    const ticket = await IPLTicket.deployed();
    const marketplace = await IPLTicketMarketplace.deployed();

    await ticket.setMarketplace(marketplace.address, true);
};
