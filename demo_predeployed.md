# Pre-Deployed Sepolia Demo (No Redeploy)

Use this flow when contracts are already deployed on Sepolia and you want to test them via Truffle Dashboard.

## 1) Start Dashboard and Console

In terminal 1:

npx truffle dashboard

Open:

http://localhost:24012

Connect MetaMask and select Sepolia.

In terminal 2 (project folder):

cd D:\projects\cbd78\IPL_Blockchain_System
npx truffle console --network dashboard

## 2) Attach to Existing Contracts by Address

me = (await web3.eth.getAccounts())[0]

TICKET_ADDR = "0x5accba2e80d701b4112fdadfc33d8cad36512af4"
REWARD_ADDR = "0x3a0e20b419448f78272b3f8a6362b4dbb95e6688"
GOV_ADDR = "0xbdab92ea135d564bd31c99cef860c017ef836418"
MARKET_ADDR = "0x5a7bf2162a28686fe60e6f72fd270c7a2b798678"

ticket = await IPLTicket.at(TICKET_ADDR)
reward = await IPLReward.at(REWARD_ADDR)
gov = await IPLGovernance.at(GOV_ADDR)
market = await IPLTicketMarketplace.at(MARKET_ADDR)

## 3) Sanity Checks (Network + Code Exists)

await web3.eth.getChainId()                    // Sepolia should be 11155111
(await web3.eth.getCode(TICKET_ADDR)).slice(0, 10)
(await web3.eth.getCode(REWARD_ADDR)).slice(0, 10)
(await web3.eth.getCode(GOV_ADDR)).slice(0, 10)
(await web3.eth.getCode(MARKET_ADDR)).slice(0, 10)

## 4) Permission Checks

ticketOwner = await ticket.owner()
rewardOwner = await reward.owner()
govOwner = await gov.owner()
marketOwner = await market.owner()

MINTER_ROLE = await reward.MINTER_ROLE()
PROPOSER_ROLE = await gov.PROPOSER_ROLE()

isTicketOwner = me.toLowerCase() === ticketOwner.toLowerCase()
isRewardOwner = me.toLowerCase() === rewardOwner.toLowerCase()
isGovOwner = me.toLowerCase() === govOwner.toLowerCase()
isMarketOwner = me.toLowerCase() === marketOwner.toLowerCase()

canMintReward = await reward.hasRole(MINTER_ROLE, me)
canPropose = await gov.hasRole(PROPOSER_ROLE, me)

({ isTicketOwner, isRewardOwner, isGovOwner, isMarketOwner, canMintReward, canPropose })

## Demo 1: Toggle Primary Mint (Owner only)

await ticket.primaryMintOpen()

if (isTicketOwner) {
  tx = await ticket.setPrimaryMintOpen(true, { from: me })
  tx.receipt.status
  await ticket.primaryMintOpen()
} else {
  "Skip: connected account is not IPLTicket owner"
}

## Demo 2: Mint Fan Voting Points (MINTER_ROLE required)

pointsId = await reward.FAN_VOTING_POINTS_ID()
await reward.balanceOf(me, pointsId)

if (canMintReward) {
  tx = await reward.mintFanVotingPoints(me, 100, "0x", { from: me })
  tx.receipt.status
  await reward.balanceOf(me, pointsId)
} else {
  "Skip: connected account does not have MINTER_ROLE"
}

## Demo 3: Admin Mint + Read NFT Details

if (isTicketOwner) {
  mintTx2 = await ticket.adminMintTicket(me, 2026010, 101, 1, "ipfs://demo-premium-seat", { from: me })
  tokenId3 = mintTx2.logs.find(l => l.event === "TicketMinted").args.tokenId.toString()
  tokenId3
} else {
  // Use an existing token ID owned by your connected account.
  tokenId3 = "PASTE_EXISTING_TOKEN_ID_OWNED_BY_ME"
  tokenId3
}

await ticket.getTicketInfo(tokenId3)
await ticket.ticketRarityWeight(tokenId3)
await ticket.tokenURI(tokenId3)

## Demo 4: Mint Digital Moment + Verify Provenance (MINTER_ROLE required)

if (isRewardOwner) {
  await reward.setURI("ipfs://ipl-demo/{id}.json", { from: me })
}

eventHash = web3.utils.keccak256("suryakumar-century")

if (canMintReward) {
  await reward.mintDigitalMoment(me, 99001, 1, 2026010, eventHash, "ipfs://moment-sky-2026", "0x", { from: me })
  await reward.balanceOf(me, 99001)
  await reward.getProvenance(99001)
} else {
  "Skip: connected account does not have MINTER_ROLE"
}

## Demo 5: Governance Proposal + Vote

if (canPropose) {
  propTx = await gov.createProposal("Stadium Song Vote", "Choose home entry anthem", 20, { from: me })
  proposalId = propTx.logs.find(l => l.event === "ProposalCreated").args.proposalId.toString()
  proposalId
} else {
  proposalId = "PASTE_EXISTING_ACTIVE_PROPOSAL_ID"
  proposalId
}

await gov.proposalState(proposalId)

// You must own tokenId3 to vote with it.
ownerOfTokenId3 = await ticket.ownerOf(tokenId3)
if (ownerOfTokenId3.toLowerCase() === me.toLowerCase()) {
  voteTx = await gov.castVote(proposalId, true, [tokenId3], { from: me })
  voteTx.receipt.status
  await gov.getProposal(proposalId)
} else {
  "Skip: connected account does not own tokenId3"
}

## Demo 6: Marketplace List + Cancel

// Required for createListing: you must own tokenId3.
ownerOfTokenId3 = await ticket.ownerOf(tokenId3)

if (isTicketOwner) {
  await ticket.setMarketplace(market.address, true, { from: me })
}

if (ownerOfTokenId3.toLowerCase() === me.toLowerCase()) {
  await ticket.approve(market.address, tokenId3, { from: me })
  expiry = Math.floor(Date.now() / 1000) + 3600
  await market.createListing(ticket.address, tokenId3, web3.utils.toWei("0.001", "ether"), expiry, { from: me })
  await market.listings(ticket.address, tokenId3)
  await market.cancelListing(ticket.address, tokenId3, { from: me })
} else {
  "Skip: connected account does not own tokenId3"
}

## Notes

- Do not run migrate if your goal is to test existing Sepolia deployments.
- Use .at(address) for pre-deployed contracts.
- Expect write calls to fail unless your account has the right owner/role permissions.
- For Sepolia, each write transaction needs test ETH and MetaMask approval.
