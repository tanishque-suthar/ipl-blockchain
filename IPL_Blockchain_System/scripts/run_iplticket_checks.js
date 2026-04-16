const IPLTicket = artifacts.require("IPLTicket");

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const owner = accounts[0];
        const seller = accounts[2];

        const ticket = await IPLTicket.deployed();

        console.log("IPLTicket address:", ticket.address);
        console.log("owner:", owner);
        console.log("seller:", seller);

        const primaryBefore = await ticket.primaryMintOpen();
        console.log("primaryMintOpen(before):", primaryBefore.toString());

        const openTx = await ticket.setPrimaryMintOpen(true, { from: owner });
        console.log("setPrimaryMintOpen tx:", openTx.tx);
        console.log("setPrimaryMintOpen status:", openTx.receipt.status);

        const whitelistTx = await ticket.setWhitelist([seller], true, { from: owner });
        console.log("setWhitelist tx:", whitelistTx.tx);
        console.log("setWhitelist status:", whitelistTx.receipt.status);

        const matchId = Date.now();
        const seatId = 101;
        const seatZone = 2; // VIP
        const tokenUri = "ipfs://ticket-check-vip";

        const mintTx = await ticket.mintPrimaryTicket(matchId, seatId, seatZone, tokenUri, {
            from: seller,
        });

        const mintEvent = mintTx.logs.find((l) => l.event === "TicketMinted");
        const tokenId = mintEvent.args.tokenId.toString();

        console.log("mintPrimaryTicket tx:", mintTx.tx);
        console.log("TicketMinted event tokenId:", tokenId);
        console.log("TicketMinted matchId:", mintEvent.args.matchId.toString());
        console.log("TicketMinted seatId:", mintEvent.args.seatId.toString());
        console.log("TicketMinted seatZone:", mintEvent.args.seatZone.toString());

        const info = await ticket.getTicketInfo(tokenId);
        console.log("getTicketInfo.matchId:", info.matchId.toString());
        console.log("getTicketInfo.seatId:", info.seatId.toString());
        console.log("getTicketInfo.seatZone:", info.seatZone.toString());

        const weight = await ticket.ticketRarityWeight(tokenId);
        console.log("ticketRarityWeight:", weight.toString());

        const uri = await ticket.tokenURI(tokenId);
        console.log("tokenURI:", uri);

        const ownerOf = await ticket.ownerOf(tokenId);
        console.log("ownerOf(tokenId):", ownerOf);

        callback();
    } catch (err) {
        callback(err);
    }
};
