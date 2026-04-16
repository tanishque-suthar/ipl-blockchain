const IPLTicket = artifacts.require("IPLTicket");
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

contract("IPLGovernance", (accounts) => {
    const [owner, voter1, voter2] = accounts;

    it("applies weighted voting based on ticket zone rarity and finalizes advisory outcome", async () => {
        const ticket = await IPLTicket.new("IPL Fan Ticket", "IPLT", owner, 500, { from: owner });

        await ticket.setPrimaryMintOpen(true, { from: owner });
        await ticket.setWhitelist([voter1, voter2], true, { from: owner });

        await ticket.mintPrimaryTicket(20, 501, 0, "ipfs://general", { from: voter1 });
        await ticket.mintPrimaryTicket(20, 777, 3, "ipfs://legendary", { from: voter2 });

        const governance = await IPLGovernance.new(ticket.address, 5, 1, { from: owner });

        await governance.createProposal("Jersey Theme", "Choose retro theme", 5, { from: owner });

        await governance.castVote(1, true, [1], { from: voter1 });
        await governance.castVote(1, false, [2], { from: voter2 });

        await expectRevert(
            governance.castVote(1, true, [1], { from: voter1 }),
            "Address already voted"
        );

        await mineBlocks(6);
        await governance.finalizeProposal(1, { from: owner });

        const proposal = await governance.getProposal(1);
        assert.equal(proposal.forVotes.toString(), "1");
        assert.equal(proposal.againstVotes.toString(), "20");
        assert.equal(proposal.finalized, true);
        assert.equal(proposal.passed, false);
    });
});
