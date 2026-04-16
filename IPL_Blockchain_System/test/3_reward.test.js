const IPLReward = artifacts.require("IPLReward");

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

contract("IPLReward", (accounts) => {
    const [admin, oracle, fan] = accounts;

    it("mints digital moments and records immutable provenance", async () => {
        const reward = await IPLReward.new("ipfs://ipl/{id}.json", { from: admin });

        await reward.mintDigitalMoment(
            fan,
            11,
            1,
            2026,
            web3.utils.keccak256("century"),
            "ipfs://moment-11",
            "0x",
            { from: admin }
        );

        const balance = await reward.balanceOf(fan, 11);
        assert.equal(balance.toString(), "1");

        const provenance = await reward.getProvenance(11);
        assert.equal(provenance.matchId.toString(), "2026");
        assert.equal(provenance.metadataRef, "ipfs://moment-11");

        await expectRevert(
            reward.mintDigitalMoment(
                fan,
                11,
                1,
                2027,
                web3.utils.keccak256("wicket"),
                "ipfs://moment-11-alt",
                "0x",
                { from: admin }
            ),
            "Provenance mismatch: match"
        );
    });

    it("allows role-based oracle callback minting", async () => {
        const reward = await IPLReward.new("ipfs://ipl/{id}.json", { from: admin });
        const ORACLE_ROLE = await reward.ORACLE_ROLE();

        await reward.grantRole(ORACLE_ROLE, oracle, { from: admin });

        await reward.oracleMintDigitalMoment(
            web3.utils.keccak256("req-1"),
            fan,
            55,
            1,
            2026,
            web3.utils.keccak256("wicket"),
            "ipfs://moment-55",
            "0x",
            { from: oracle }
        );

        const balance = await reward.balanceOf(fan, 55);
        assert.equal(balance.toString(), "1");
    });

    it("mints fan voting points as fungible token", async () => {
        const reward = await IPLReward.new("ipfs://ipl/{id}.json", { from: admin });
        const pointsId = await reward.FAN_VOTING_POINTS_ID();

        await reward.mintFanVotingPoints(fan, 1000, "0x", { from: admin });

        const balance = await reward.balanceOf(fan, pointsId);
        assert.equal(balance.toString(), "1000");
    });
});
