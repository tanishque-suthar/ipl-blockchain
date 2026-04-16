const IPLTicket = artifacts.require("IPLTicket");

async function expectRevert(promise, expectedMessage) {
    try {
        await promise;
        assert.fail("Expected revert not received");
    } catch (error) {
        assert(
            error.message.includes("revert") && error.message.includes(expectedMessage),
            `Expected revert containing '${expectedMessage}', got '${error.message}'`
        );
    }
}

contract("IPLTicket", (accounts) => {
    const [deployer, alice, bob] = accounts;

    it("enforces whitelist-only primary mint and stores seat zone", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", deployer, 500);

        await ticket.setPrimaryMintOpen(true, { from: deployer });
        await ticket.setWhitelist([alice], true, { from: deployer });

        await ticket.mintPrimaryTicket(1, 101, 0, "ipfs://ticket-1", { from: alice });

        const owner = await ticket.ownerOf(1);
        assert.equal(owner, alice);

        const info = await ticket.getTicketInfo(1);
        assert.equal(info.matchId.toString(), "1");
        assert.equal(info.seatId.toString(), "101");
        assert.equal(info.seatZone.toString(), "0");

        const weight = await ticket.ticketRarityWeight(1);
        assert.equal(weight.toString(), "1");

        await expectRevert(
            ticket.mintPrimaryTicket(1, 102, 1, "ipfs://ticket-2", { from: bob }),
            "Address not whitelisted"
        );
    });

    it("prevents duplicate seat minting in the same match", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", deployer, 500);

        await ticket.setPrimaryMintOpen(true, { from: deployer });
        await ticket.setWhitelist([alice, bob], true, { from: deployer });

        await ticket.mintPrimaryTicket(2, 500, 2, "ipfs://seat-500", { from: alice });

        await expectRevert(
            ticket.mintPrimaryTicket(2, 500, 3, "ipfs://seat-500-dup", { from: bob }),
            "Seat already minted"
        );
    });

    it("returns 5 percent ERC2981 royalty", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", deployer, 500);

        await ticket.setPrimaryMintOpen(true, { from: deployer });
        await ticket.setWhitelist([alice], true, { from: deployer });
        await ticket.mintPrimaryTicket(3, 11, 3, "ipfs://ticket-legendary", { from: alice });

        const royalty = await ticket.royaltyInfo(1, web3.utils.toWei("1", "ether"));
        assert.equal(royalty[0], deployer);
        assert.equal(royalty[1].toString(), web3.utils.toWei("0.05", "ether"));
    });

    it("restricts secondary transfers to configured marketplace flow", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", deployer, 500);

        await ticket.setPrimaryMintOpen(true, { from: deployer });
        await ticket.setWhitelist([alice], true, { from: deployer });
        await ticket.mintPrimaryTicket(4, 12, 1, "ipfs://ticket-premium", { from: alice });

        await expectRevert(
            ticket.transferFrom(alice, bob, 1, { from: alice }),
            "Secondary sales via marketplace only"
        );

        await ticket.setMarketplace(deployer, false, { from: deployer });
        await ticket.transferFrom(alice, bob, 1, { from: alice });

        const owner = await ticket.ownerOf(1);
        assert.equal(owner, bob);
    });
});
