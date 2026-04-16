const IPLTicket = artifacts.require("IPLTicket");
const IPLTicketMarketplace = artifacts.require("IPLTicketMarketplace");

function toBN(value) {
    return web3.utils.toBN(value);
}

contract("IPLTicketMarketplace", (accounts) => {
    const [franchise, seller, buyer, tdsTreasury] = accounts;

    it("executes resale with royalty and TDS split", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", franchise, 500, { from: franchise });
        const market = await IPLTicketMarketplace.new(tdsTreasury, 100, { from: franchise });

        await ticket.setMarketplace(market.address, true, { from: franchise });
        await ticket.setPrimaryMintOpen(true, { from: franchise });
        await ticket.setWhitelist([seller], true, { from: franchise });

        await ticket.mintPrimaryTicket(10, 1, 2, "ipfs://ticket-vip", { from: seller });

        await ticket.approve(market.address, 1, { from: seller });

        const salePrice = web3.utils.toWei("1", "ether");
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;

        await market.createListing(ticket.address, 1, salePrice, expiresAt, { from: seller });

        const sellerBefore = toBN(await web3.eth.getBalance(seller));
        const royaltyBefore = toBN(await web3.eth.getBalance(franchise));
        const tdsBefore = toBN(await web3.eth.getBalance(tdsTreasury));

        await market.buyListing(ticket.address, 1, { from: buyer, value: salePrice });

        const sellerAfter = toBN(await web3.eth.getBalance(seller));
        const royaltyAfter = toBN(await web3.eth.getBalance(franchise));
        const tdsAfter = toBN(await web3.eth.getBalance(tdsTreasury));

        const royaltyExpected = toBN(web3.utils.toWei("0.05", "ether"));
        const tdsExpected = toBN(web3.utils.toWei("0.01", "ether"));
        const sellerExpected = toBN(web3.utils.toWei("0.94", "ether"));

        assert.equal(sellerAfter.sub(sellerBefore).toString(), sellerExpected.toString());
        assert.equal(royaltyAfter.sub(royaltyBefore).toString(), royaltyExpected.toString());
        assert.equal(tdsAfter.sub(tdsBefore).toString(), tdsExpected.toString());

        const owner = await ticket.ownerOf(1);
        assert.equal(owner, buyer);
    });
});
