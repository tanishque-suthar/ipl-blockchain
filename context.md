The proposed project is a decentralized digital infrastructure designed to resolve systemic inefficiencies within professional sports franchises, with a specific focus on the IPL 2026 ecosystem.

1. Ticket Contract (ERC-721)
This contract focuses on resolving Scalping & Fraud. Each ticket is a unique Non-Fungible Token (NFT) that represents a specific match and seat.
Secondary Market Control: Implements the 5% secondary market royalty that automatically returns to the franchise upon resale.
Transfer Restrictions: Can include logic to prevent automated bots from bulk-buying, ensuring "genuine fans" can attend.
Regulatory Compliance: Automates the 1% TDS deduction required for Indian regulatory standards during a trade.
2. Reward Contract (ERC-1155)
This contract handles Asset Authenticity and the creation of Digital Match Collectibles. The ERC-1155 standard is ideal here because it can manage both limited edition "Digital Moments" and fungible "Fan Voting Points".
Oracle Integration: Uses Chainlink Oracles to trigger the minting of "Digital Moments" when specific match events (like a century or wicket) occur.
Provenance: Provides an immutable record for match-worn gear and memorabilia, protecting fans from counterfeit products.
Gasless Transactions: Designed to work with Account Abstraction (ERC-4337) so fans can claim rewards without needing to manage a crypto wallet or pay gas fees directly.
3. Governance Contract
This contract transitions fans from passive consumers to active stakeholders.
Weighted Voting: Implements logic where the influence of a vote is determined by the rarity of the fan's NFTs (e.g., Common 1x vs. Legendary 20x).
Fan-Driven Decisions: Allows fans to vote on non-critical decisions, such as jersey designs or stadium music, fostering club ownership.
Transparency: Provides a "mathematically verifiable" record of all fan-driven decisions to restore trust in sports management.