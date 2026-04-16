npx truffle console --network dashboard
me = (await web3.eth.getAccounts())[0]
ticket = await IPLTicket.deployed()
reward = await IPLReward.deployed()

#Demo 1 (toggle primary mint):
5. await ticket.primaryMintOpen()
6. await ticket.setPrimaryMintOpen(true, { from: me })
7. await ticket.primaryMintOpen()

#Demo 2 (mint fan points):
8. pointsId = await reward.FAN_VOTING_POINTS_ID()
9. await reward.balanceOf(me, pointsId)
10. await reward.mintFanVotingPoints(me, 100, "0x", { from: me })
11. await reward.balanceOf(me, pointsId)


#Demo 3 (admin mint + read NFT details)
mintTx2 = await ticket.adminMintTicket(me, 2026010, 101, 1, "ipfs://demo-premium-seat", { from: me })
tokenId3 = mintTx2.logs.find(l => l.event === "TicketMinted").args.tokenId.toString()
await ticket.getTicketInfo(tokenId3)
await ticket.ticketRarityWeight(tokenId3)
await ticket.tokenURI(tokenId3)


#Demo 4 (mint digital moment + verify provenance)
await reward.setURI("ipfs://ipl-demo/{id}.json", { from: me })
eventHash = web3.utils.keccak256("suryakumar-century")
await reward.mintDigitalMoment(me, 99001, 1, 2026010, eventHash, "ipfs://moment-sky-2026", "0x", { from: me })
await reward.balanceOf(me, 99001)
await reward.getProvenance(99001)


#Demo 5 (governance proposal + vote using your NFT)
gov = await IPLGovernance.deployed()
propTx = await gov.createProposal("Stadium Song Vote", "Choose home entry anthem", 20, { from: me })
proposalId = propTx.logs.find(l => l.event === "ProposalCreated").args.proposalId.toString()
await gov.proposalState(proposalId)
await gov.castVote(proposalId, true, [tokenId3], { from: me })
await gov.getProposal(proposalId)


#Demo 6 (marketplace list + cancel, single wallet demo)
market = await IPLTicketMarketplace.deployed()
await ticket.setMarketplace(market.address, true, { from: me })
await ticket.approve(market.address, tokenId3, { from: me })
expiry = Math.floor(Date.now() / 1000) + 3600
await market.createListing(ticket.address, tokenId3, web3.utils.toWei("0.001", "ether"), expiry, { from: me })
await market.listings(ticket.address, tokenId3)
await market.cancelListing(ticket.address, tokenId3, { from: me })