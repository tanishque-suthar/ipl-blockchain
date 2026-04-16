const IPLTicket = artifacts.require("IPLTicket");
const IPLTicketMarketplace = artifacts.require("IPLTicketMarketplace");
const IPLReward = artifacts.require("IPLReward");
const IPLGovernance = artifacts.require("IPLGovernance");

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

contract("IPL Integration", (accounts) => {
    const [franchise, seller, buyer, tdsTreasury, oracle] = accounts;

    it("runs mint -> resale -> oracle reward -> governance vote flow", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", franchise, 500, { from: franchise });
        const market = await IPLTicketMarketplace.new(tdsTreasury, 100, { from: franchise });
        const reward = await IPLReward.new("ipfs://rewards/{id}.json", { from: franchise });

        await ticket.setMarketplace(market.address, true, { from: franchise });
        await ticket.setPrimaryMintOpen(true, { from: franchise });
        await ticket.setWhitelist([seller], true, { from: franchise });

        await ticket.mintPrimaryTicket(90, 10, 1, "ipfs://ticket-90-10", { from: seller });
        await ticket.approve(market.address, 1, { from: seller });

        const salePrice = web3.utils.toWei("0.5", "ether");
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;
        await market.createListing(ticket.address, 1, salePrice, expiresAt, { from: seller });
        await market.buyListing(ticket.address, 1, { from: buyer, value: salePrice });

        const ORACLE_ROLE = await reward.ORACLE_ROLE();
        await reward.grantRole(ORACLE_ROLE, oracle, { from: franchise });

        await reward.oracleMintDigitalMoment(
            web3.utils.keccak256("e2e-req"),
            buyer,
            1001,
            1,
            90,
            web3.utils.keccak256("century"),
            "ipfs://moment-1001",
            "0x",
            { from: oracle }
        );

        const governance = await IPLGovernance.new(ticket.address, 3, 1, { from: franchise });
        await governance.createProposal("Stadium Music", "Select playlist A", 3, { from: franchise });
        await governance.castVote(1, true, [1], { from: buyer });

        await mineBlocks(4);
        await governance.finalizeProposal(1, { from: franchise });

        const proposal = await governance.getProposal(1);
        assert.equal(proposal.finalized, true);
        assert.equal(proposal.passed, true);
    });
});
