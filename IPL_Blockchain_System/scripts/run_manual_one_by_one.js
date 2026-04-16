const IPLTicket = artifacts.require("IPLTicket");
const IPLTicketMarketplace = artifacts.require("IPLTicketMarketplace");
const IPLReward = artifacts.require("IPLReward");
const IPLGovernance = artifacts.require("IPLGovernance");

function printHeader(title) {
    console.log("\n==================== " + title + " ====================");
}

function printStep(step, input, output) {
    console.log("\n[" + step + "] INPUT:", input);
    console.log("[" + step + "] OUTPUT:", output);
}

function findEvent(tx, eventName) {
    return tx.logs.find((log) => log.event === eventName);
}

function mineOneBlock() {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send(
            { jsonrpc: "2.0", method: "evm_mine", params: [], id: Date.now() },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(result);
            }
        );
    });
}

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const owner = accounts[0];
        const treasury = accounts[1];
        const seller = accounts[2];
        const buyer = accounts[3];
        const oracleUser = accounts[4];

        const ticket = await IPLTicket.deployed();
        const market = await IPLTicketMarketplace.deployed();
        const reward = await IPLReward.deployed();
        const governance = await IPLGovernance.deployed();

        printHeader("CONTRACT ADDRESSES");
        console.log("IPLTicket:", ticket.address);
        console.log("IPLTicketMarketplace:", market.address);
        console.log("IPLReward:", reward.address);
        console.log("IPLGovernance:", governance.address);

        printHeader("IPLTicket FUNCTIONS");

        let tx = await ticket.setPrimaryMintOpen(true, { from: owner });
        printStep("setPrimaryMintOpen", { status: true, from: owner }, { success: tx.receipt.status, events: tx.logs.map((l) => l.event) });

        tx = await ticket.setWhitelist([seller], true, { from: owner });
        printStep("setWhitelist", { accounts: [seller], status: true, from: owner }, { success: tx.receipt.status, whitelisted: await ticket.isWhitelisted(seller) });

        tx = await ticket.setMarketplace(market.address, true, { from: owner });
        printStep(
            "setMarketplace",
            { marketplaceAddress: market.address, onlyMarketplaceTransfers: true, from: owner },
            { success: tx.receipt.status, marketplace: await ticket.marketplace(), onlyMarketplaceTransfers: await ticket.marketplaceOnlyTransfers() }
        );

        tx = await ticket.setDefaultRoyalty(treasury, 500, { from: owner });
        const royaltyCheck = await ticket.royaltyInfo(1, web3.utils.toWei("1", "ether"));
        printStep(
            "setDefaultRoyalty",
            { receiver: treasury, royaltyBps: 500, from: owner },
            { success: tx.receipt.status, royaltyReceiver: royaltyCheck[0], royaltyAmountAt1Eth: royaltyCheck[1].toString() }
        );

        const matchId1 = 70001;
        const seatId1 = 10;
        const seatZone1 = 2;
        const tokenUri1 = "ipfs://manual-ticket-1";
        tx = await ticket.mintPrimaryTicket(matchId1, seatId1, seatZone1, tokenUri1, { from: seller });
        const minted1 = findEvent(tx, "TicketMinted");
        const tokenId1 = minted1.args.tokenId.toString();
        printStep(
            "mintPrimaryTicket",
            { matchId: matchId1, seatId: seatId1, seatZone: seatZone1, tokenUri: tokenUri1, from: seller },
            { success: tx.receipt.status, tokenId: tokenId1, event: minted1.event }
        );

        const matchId2 = 70002;
        const seatId2 = 20;
        const seatZone2 = 3;
        const tokenUri2 = "ipfs://manual-ticket-2";
        tx = await ticket.adminMintTicket(buyer, matchId2, seatId2, seatZone2, tokenUri2, { from: owner });
        const minted2 = findEvent(tx, "TicketMinted");
        const tokenId2 = minted2.args.tokenId.toString();
        printStep(
            "adminMintTicket",
            { to: buyer, matchId: matchId2, seatId: seatId2, seatZone: seatZone2, tokenUri: tokenUri2, from: owner },
            { success: tx.receipt.status, tokenId: tokenId2, owner: await ticket.ownerOf(tokenId2) }
        );

        const info1 = await ticket.getTicketInfo(tokenId1);
        const weight1 = await ticket.ticketRarityWeight(tokenId1);
        const uri1 = await ticket.tokenURI(tokenId1);
        printStep(
            "getTicketInfo/ticketRarityWeight/tokenURI",
            { tokenId: tokenId1 },
            {
                matchId: info1.matchId.toString(),
                seatId: info1.seatId.toString(),
                seatZone: info1.seatZone.toString(),
                weight: weight1.toString(),
                tokenURI: uri1,
            }
        );

        const supportsErc721 = await ticket.supportsInterface("0x80ac58cd");
        const supportsErc2981 = await ticket.supportsInterface("0x2a55205a");
        printStep(
            "supportsInterface",
            { interfaceIds: ["0x80ac58cd", "0x2a55205a"] },
            { supportsErc721, supportsErc2981 }
        );

        printHeader("IPLTicketMarketplace FUNCTIONS");

        tx = await market.setTdsTreasury(treasury, { from: owner });
        printStep("setTdsTreasury", { treasury, from: owner }, { success: tx.receipt.status, tdsTreasury: await market.tdsTreasury() });

        tx = await market.setTdsBps(100, { from: owner });
        printStep("setTdsBps", { tdsBps: 100, from: owner }, { success: tx.receipt.status, tdsBps: (await market.tdsBps()).toString() });

        tx = await ticket.approve(market.address, tokenId1, { from: seller });
        printStep("approve", { spender: market.address, tokenId: tokenId1, from: seller }, { success: tx.receipt.status });

        const salePrice = web3.utils.toWei("0.2", "ether");
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;
        tx = await market.createListing(ticket.address, tokenId1, salePrice, expiresAt, { from: seller });
        let listing = await market.listings(ticket.address, tokenId1);
        printStep(
            "createListing",
            { ticketContract: ticket.address, tokenId: tokenId1, price: salePrice, expiresAt, from: seller },
            {
                success: tx.receipt.status,
                event: findEvent(tx, "ListingCreated").event,
                listing: {
                    seller: listing.seller,
                    price: listing.price.toString(),
                    expiresAt: listing.expiresAt.toString(),
                    active: listing.active,
                },
            }
        );

        tx = await market.cancelListing(ticket.address, tokenId1, { from: seller });
        listing = await market.listings(ticket.address, tokenId1);
        printStep(
            "cancelListing",
            { ticketContract: ticket.address, tokenId: tokenId1, from: seller },
            { success: tx.receipt.status, event: findEvent(tx, "ListingCancelled").event, activeAfterCancel: listing.active, ownerAfterCancel: await ticket.ownerOf(tokenId1) }
        );

        await ticket.approve(market.address, tokenId1, { from: seller });
        await market.createListing(ticket.address, tokenId1, salePrice, Math.floor(Date.now() / 1000) + 3600, { from: seller });
        tx = await market.buyListing(ticket.address, tokenId1, { from: buyer, value: salePrice });
        const purchased = findEvent(tx, "ListingPurchased").args;
        printStep(
            "buyListing",
            { ticketContract: ticket.address, tokenId: tokenId1, from: buyer, value: salePrice },
            {
                success: tx.receipt.status,
                sellerAmount: purchased.sellerAmount.toString(),
                royaltyAmount: purchased.royaltyAmount.toString(),
                tdsAmount: purchased.tdsAmount.toString(),
                newOwner: await ticket.ownerOf(tokenId1),
            }
        );

        printHeader("IPLReward FUNCTIONS");

        tx = await reward.setURI("ipfs://manual-reward/{id}.json", { from: owner });
        printStep("setURI", { newUri: "ipfs://manual-reward/{id}.json", from: owner }, { success: tx.receipt.status, uriSample: await reward.uri(1) });

        const ORACLE_ROLE = await reward.ORACLE_ROLE();
        tx = await reward.grantRole(ORACLE_ROLE, oracleUser, { from: owner });
        printStep("grantRole(ORACLE_ROLE)", { role: ORACLE_ROLE, account: oracleUser, from: owner }, { success: tx.receipt.status });

        const eventHash1 = web3.utils.keccak256("manual-century");
        tx = await reward.mintDigitalMoment(buyer, 8001, 1, 70001, eventHash1, "ipfs://moment-8001", "0x", { from: owner });
        let provenance = await reward.getProvenance(8001);
        printStep(
            "mintDigitalMoment",
            { to: buyer, tokenId: 8001, amount: 1, matchId: 70001, eventHash: eventHash1, metadataRef: "ipfs://moment-8001", from: owner },
            {
                success: tx.receipt.status,
                events: tx.logs.map((l) => l.event),
                balance: (await reward.balanceOf(buyer, 8001)).toString(),
                provenance: {
                    matchId: provenance.matchId.toString(),
                    eventHash: provenance.eventHash,
                    metadataRef: provenance.metadataRef,
                    initialized: provenance.initialized,
                },
            }
        );

        const requestId = web3.utils.keccak256("manual-request");
        const eventHash2 = web3.utils.keccak256("manual-wicket");
        tx = await reward.oracleMintDigitalMoment(requestId, buyer, 8002, 1, 70001, eventHash2, "ipfs://moment-8002", "0x", { from: oracleUser });
        printStep(
            "oracleMintDigitalMoment",
            { requestId, to: buyer, tokenId: 8002, amount: 1, matchId: 70001, eventHash: eventHash2, metadataRef: "ipfs://moment-8002", from: oracleUser },
            { success: tx.receipt.status, event: findEvent(tx, "OracleMomentMinted").event, balance: (await reward.balanceOf(buyer, 8002)).toString() }
        );

        tx = await reward.mintFanVotingPoints(buyer, 500, "0x", { from: owner });
        const pointsId = (await reward.FAN_VOTING_POINTS_ID()).toString();
        printStep(
            "mintFanVotingPoints",
            { to: buyer, amount: 500, from: owner },
            { success: tx.receipt.status, pointsTokenId: pointsId, pointsBalance: (await reward.balanceOf(buyer, pointsId)).toString() }
        );

        const supportsErc1155 = await reward.supportsInterface("0xd9b67a26");
        const supportsAccessControl = await reward.supportsInterface("0x7965db0b");
        printStep(
            "supportsInterface",
            { interfaceIds: ["0xd9b67a26", "0x7965db0b"] },
            { supportsErc1155, supportsAccessControl }
        );

        printHeader("IPLGovernance FUNCTIONS");

        tx = await governance.setDefaultVotingBlocks(3, { from: owner });
        printStep("setDefaultVotingBlocks", { blocks: 3, from: owner }, { success: tx.receipt.status, defaultVotingBlocks: (await governance.defaultVotingBlocks()).toString() });

        tx = await governance.setMinQuorumWeight(1, { from: owner });
        printStep("setMinQuorumWeight", { quorumWeight: 1, from: owner }, { success: tx.receipt.status, minQuorumWeight: (await governance.minQuorumWeight()).toString() });

        tx = await governance.createProposal("Manual Proposal", "Function-by-function check", 3, { from: owner });
        const proposalId = findEvent(tx, "ProposalCreated").args.proposalId.toString();
        printStep("createProposal", { title: "Manual Proposal", description: "Function-by-function check", votingBlocks: 3, from: owner }, { success: tx.receipt.status, proposalId });

        const proposalBeforeVote = await governance.getProposal(proposalId);
        printStep(
            "getProposal(before vote)",
            { proposalId },
            {
                id: proposalBeforeVote.id.toString(),
                title: proposalBeforeVote.title,
                forVotes: proposalBeforeVote.forVotes.toString(),
                againstVotes: proposalBeforeVote.againstVotes.toString(),
                finalized: proposalBeforeVote.finalized,
                passed: proposalBeforeVote.passed,
            }
        );

        tx = await governance.castVote(proposalId, true, [tokenId1, tokenId2], { from: buyer });
        const voteEvent = findEvent(tx, "VoteCast").args;
        printStep(
            "castVote",
            { proposalId, support: true, tokenIds: [tokenId1, tokenId2], from: buyer },
            { success: tx.receipt.status, weight: voteEvent.weight.toString(), support: voteEvent.support }
        );

        const stateActive = await governance.proposalState(proposalId);
        printStep("proposalState(active)", { proposalId }, { state: stateActive.toString() });

        await mineOneBlock();
        await mineOneBlock();
        await mineOneBlock();
        await mineOneBlock();

        tx = await governance.finalizeProposal(proposalId, { from: owner });
        const finalizeEvent = findEvent(tx, "ProposalFinalized").args;
        printStep(
            "finalizeProposal",
            { proposalId, from: owner },
            {
                success: tx.receipt.status,
                passed: finalizeEvent.passed,
                forVotes: finalizeEvent.forVotes.toString(),
                againstVotes: finalizeEvent.againstVotes.toString(),
            }
        );

        const stateFinal = await governance.proposalState(proposalId);
        const proposalAfterFinalize = await governance.getProposal(proposalId);
        printStep(
            "proposalState/getProposal(after finalize)",
            { proposalId },
            {
                state: stateFinal.toString(),
                finalized: proposalAfterFinalize.finalized,
                passed: proposalAfterFinalize.passed,
                forVotes: proposalAfterFinalize.forVotes.toString(),
                againstVotes: proposalAfterFinalize.againstVotes.toString(),
            }
        );

        printHeader("DONE");
        console.log("All callable function paths were executed with explicit inputs and printed outputs.");

        callback();
    } catch (error) {
        callback(error);
    }
};
