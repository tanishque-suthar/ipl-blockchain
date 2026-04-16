// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IIPLTicket.sol";

contract IPLGovernance is AccessControl, Ownable {
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    enum ProposalState {
        Pending,
        Active,
        Defeated,
        Succeeded
    }

    struct Proposal {
        uint256 id;
        string title;
        string description;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        bool finalized;
        bool passed;
    }

    IIPLTicket public immutable ticketContract;
    uint256 public defaultVotingBlocks;
    uint256 public minQuorumWeight;
    uint256 public nextProposalId;

    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => bool)) public hasAddressVoted;
    mapping(uint256 => mapping(uint256 => bool)) public isTokenUsed;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        uint256 startBlock,
        uint256 endBlock
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    event ProposalFinalized(
        uint256 indexed proposalId,
        bool passed,
        uint256 forVotes,
        uint256 againstVotes
    );

    constructor(
        address ticketContractAddress,
        uint256 defaultVotingBlocks_,
        uint256 minQuorumWeight_
    ) {
        require(ticketContractAddress != address(0), "Invalid ticket contract");
        require(defaultVotingBlocks_ > 0, "Voting blocks must be > 0");

        ticketContract = IIPLTicket(ticketContractAddress);
        defaultVotingBlocks = defaultVotingBlocks_;
        minQuorumWeight = minQuorumWeight_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER_ROLE, msg.sender);
    }

    function setDefaultVotingBlocks(uint256 blocks_) external onlyOwner {
        require(blocks_ > 0, "Voting blocks must be > 0");
        defaultVotingBlocks = blocks_;
    }

    function setMinQuorumWeight(uint256 quorumWeight) external onlyOwner {
        minQuorumWeight = quorumWeight;
    }

    function createProposal(
        string calldata title,
        string calldata description,
        uint256 votingBlocks
    ) external onlyRole(PROPOSER_ROLE) returns (uint256 proposalId) {
        uint256 duration = votingBlocks == 0
            ? defaultVotingBlocks
            : votingBlocks;
        require(duration > 0, "Voting duration must be > 0");

        proposalId = ++nextProposalId;
        uint256 start = block.number;
        uint256 end = block.number + duration;

        _proposals[proposalId] = Proposal({
            id: proposalId,
            title: title,
            description: description,
            startBlock: start,
            endBlock: end,
            forVotes: 0,
            againstVotes: 0,
            finalized: false,
            passed: false
        });

        emit ProposalCreated(proposalId, msg.sender, title, start, end);
    }

    function castVote(
        uint256 proposalId,
        bool support,
        uint256[] calldata tokenIds
    ) external {
        Proposal storage proposal = _proposals[proposalId];
        require(proposal.id != 0, "Proposal not found");
        require(
            block.number >= proposal.startBlock &&
                block.number <= proposal.endBlock,
            "Voting is closed"
        );
        require(!proposal.finalized, "Proposal already finalized");
        require(
            !hasAddressVoted[proposalId][msg.sender],
            "Address already voted"
        );
        require(tokenIds.length > 0, "No tokens provided");

        uint256 weight;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            require(
                ticketContract.ownerOf(tokenId) == msg.sender,
                "Not token owner"
            );
            require(!isTokenUsed[proposalId][tokenId], "Token already used");

            isTokenUsed[proposalId][tokenId] = true;
            weight += ticketContract.ticketRarityWeight(tokenId);
        }

        require(weight > 0, "No voting weight");
        hasAddressVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    function finalizeProposal(uint256 proposalId) external {
        Proposal storage proposal = _proposals[proposalId];
        require(proposal.id != 0, "Proposal not found");
        require(block.number > proposal.endBlock, "Voting still active");
        require(!proposal.finalized, "Already finalized");

        proposal.finalized = true;

        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        bool quorumMet = totalVotes >= minQuorumWeight;
        proposal.passed =
            quorumMet &&
            proposal.forVotes > proposal.againstVotes;

        emit ProposalFinalized(
            proposalId,
            proposal.passed,
            proposal.forVotes,
            proposal.againstVotes
        );
    }

    function proposalState(
        uint256 proposalId
    ) external view returns (ProposalState) {
        Proposal memory proposal = _proposals[proposalId];
        require(proposal.id != 0, "Proposal not found");

        if (!proposal.finalized && block.number < proposal.startBlock) {
            return ProposalState.Pending;
        }

        if (!proposal.finalized && block.number <= proposal.endBlock) {
            return ProposalState.Active;
        }

        if (proposal.passed) {
            return ProposalState.Succeeded;
        }

        return ProposalState.Defeated;
    }

    function getProposal(
        uint256 proposalId
    ) external view returns (Proposal memory) {
        Proposal memory proposal = _proposals[proposalId];
        require(proposal.id != 0, "Proposal not found");
        return proposal;
    }
}
