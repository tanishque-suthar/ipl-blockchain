const IPLTicket = artifacts.require("IPLTicket");
const IPLTicketMarketplace = artifacts.require("IPLTicketMarketplace");
const IPLReward = artifacts.require("IPLReward");
const IPLGovernance = artifacts.require("IPLGovernance");

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

async function mineBlocks(count) {
    for (let i = 0; i < count; i++) {
        await new Promise((resolve, reject) => {
            web3.currentProvider.send(
                {
                    jsonrpc: "2.0",
                    method: "evm_mine",
                    params: [],
                    id: Date.now() + i,
                },
                (err, res) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(res);
                }
            );
        });
    }
}

contract("Additional Function Paths", (accounts) => {
    const [owner, treasury, seller, buyer, outsider] = accounts;

    it("covers IPLTicket admin mint and royalty setter", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", owner, 500, { from: owner });

        await ticket.adminMintTicket(seller, 300, 7, 1, "ipfs://admin-mint", { from: owner });
        assert.equal(await ticket.ownerOf(1), seller);

        await ticket.setDefaultRoyalty(treasury, 250, { from: owner });
        const royalty = await ticket.royaltyInfo(1, web3.utils.toWei("1", "ether"));
        assert.equal(royalty[0], treasury);
        assert.equal(royalty[1].toString(), web3.utils.toWei("0.025", "ether"));

        await expectRevert(
            ticket.setDefaultRoyalty("0x0000000000000000000000000000000000000000", 100, { from: owner }),
            "Invalid royalty receiver"
        );
    });

    it("covers marketplace TDS config and cancel listing path", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", owner, 500, { from: owner });
        const market = await IPLTicketMarketplace.new(treasury, 100, { from: owner });

        await ticket.setMarketplace(market.address, true, { from: owner });
        await ticket.setPrimaryMintOpen(true, { from: owner });
        await ticket.setWhitelist([seller], true, { from: owner });
        await ticket.mintPrimaryTicket(301, 88, 0, "ipfs://cancel-flow", { from: seller });

        await market.setTdsTreasury(buyer, { from: owner });
        await market.setTdsBps(150, { from: owner });
        assert.equal(await market.tdsTreasury(), buyer);
        assert.equal((await market.tdsBps()).toString(), "150");

        await ticket.approve(market.address, 1, { from: seller });
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;
        await market.createListing(ticket.address, 1, web3.utils.toWei("0.1", "ether"), expiresAt, { from: seller });

        await market.cancelListing(ticket.address, 1, { from: seller });
        assert.equal(await ticket.ownerOf(1), seller);

        await expectRevert(
            market.setTdsBps(10001, { from: owner }),
            "TDS too high"
        );

        await expectRevert(
            market.cancelListing(ticket.address, 1, { from: outsider }),
            "Listing not active"
        );
    });

    it("covers reward URI setter and role enforcement", async () => {
        const reward = await IPLReward.new("ipfs://old/{id}.json", { from: owner });

        await reward.setURI("ipfs://new/{id}.json", { from: owner });
        const uri = await reward.uri(1234);
        assert.equal(uri, "ipfs://new/{id}.json");

        await expectRevert(
            reward.mintFanVotingPoints(buyer, 10, "0x", { from: outsider }),
            "AccessControl"
        );
    });

    it("covers governance setters and proposal state transitions", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", owner, 500, { from: owner });

        await ticket.setPrimaryMintOpen(true, { from: owner });
        await ticket.setWhitelist([seller], true, { from: owner });
        await ticket.mintPrimaryTicket(401, 9, 0, "ipfs://gov-ticket", { from: seller });

        const gov = await IPLGovernance.new(ticket.address, 5, 1, { from: owner });

        await gov.setDefaultVotingBlocks(3, { from: owner });
        await gov.setMinQuorumWeight(2, { from: owner });
        assert.equal((await gov.defaultVotingBlocks()).toString(), "3");
        assert.equal((await gov.minQuorumWeight()).toString(), "2");

        const createTx = await gov.createProposal("No quorum", "should fail quorum", 0, { from: owner });
        const proposalId = createTx.logs.find((l) => l.event === "ProposalCreated").args.proposalId.toString();

        const stateActive = await gov.proposalState(proposalId);
        assert.equal(stateActive.toString(), "1");

        await mineBlocks(4);
        await gov.finalizeProposal(proposalId, { from: owner });

        const stateFinal = await gov.proposalState(proposalId);
        assert.equal(stateFinal.toString(), "2");
    });
});
