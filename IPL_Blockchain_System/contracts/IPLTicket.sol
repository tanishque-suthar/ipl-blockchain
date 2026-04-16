// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IPLTicket is ERC721, ERC2981, Ownable {
    enum SeatZone {
        GENERAL,
        PREMIUM,
        VIP,
        LEGENDARY
    }

    struct TicketInfo {
        uint256 matchId;
        uint256 seatId;
        SeatZone seatZone;
    }

    uint96 public constant MAX_BPS = 10_000;

    bool public primaryMintOpen;
    bool public marketplaceOnlyTransfers;
    address public marketplace;

    uint256 private _nextTokenId;
    mapping(uint256 => string) private _tokenUris;
    mapping(uint256 => TicketInfo) private _ticketInfo;
    mapping(bytes32 => bool) private _seatTaken;
    mapping(address => bool) public isWhitelisted;
    mapping(uint256 => mapping(address => bool)) public hasMintedInMatch;

    event PrimaryMintStatusUpdated(bool isOpen);
    event MarketplaceUpdated(
        address indexed marketplaceAddress,
        bool onlyMarketplaceTransfers
    );
    event WhitelistUpdated(address indexed account, bool status);
    event TicketMinted(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 indexed matchId,
        uint256 seatId,
        SeatZone seatZone
    );

    constructor(
        string memory name_,
        string memory symbol_,
        address royaltyReceiver,
        uint96 royaltyBps
    ) ERC721(name_, symbol_) {
        require(royaltyReceiver != address(0), "Invalid royalty receiver");
        require(royaltyBps <= MAX_BPS, "Royalty too high");

        _setDefaultRoyalty(royaltyReceiver, royaltyBps);
        marketplaceOnlyTransfers = true;
    }

    function setPrimaryMintOpen(bool status) external onlyOwner {
        primaryMintOpen = status;
        emit PrimaryMintStatusUpdated(status);
    }

    function setWhitelist(
        address[] calldata accounts,
        bool status
    ) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            isWhitelisted[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }

    function setMarketplace(
        address marketplaceAddress,
        bool onlyMarketplaceTransfers
    ) external onlyOwner {
        marketplace = marketplaceAddress;
        marketplaceOnlyTransfers = onlyMarketplaceTransfers;
        emit MarketplaceUpdated(marketplaceAddress, onlyMarketplaceTransfers);
    }

    function setDefaultRoyalty(
        address receiver,
        uint96 royaltyBps
    ) external onlyOwner {
        require(receiver != address(0), "Invalid royalty receiver");
        require(royaltyBps <= MAX_BPS, "Royalty too high");
        _setDefaultRoyalty(receiver, royaltyBps);
    }

    function mintPrimaryTicket(
        uint256 matchId,
        uint256 seatId,
        SeatZone seatZone,
        string calldata tokenUri
    ) external returns (uint256 tokenId) {
        require(primaryMintOpen, "Primary mint closed");
        require(isWhitelisted[msg.sender], "Address not whitelisted");
        require(
            !hasMintedInMatch[matchId][msg.sender],
            "Already minted in this match"
        );

        tokenId = _mintTicket(msg.sender, matchId, seatId, seatZone, tokenUri);
        hasMintedInMatch[matchId][msg.sender] = true;
    }

    function adminMintTicket(
        address to,
        uint256 matchId,
        uint256 seatId,
        SeatZone seatZone,
        string calldata tokenUri
    ) external onlyOwner returns (uint256 tokenId) {
        tokenId = _mintTicket(to, matchId, seatId, seatZone, tokenUri);
    }

    function getTicketInfo(
        uint256 tokenId
    ) external view returns (TicketInfo memory) {
        require(_exists(tokenId), "Token does not exist");
        return _ticketInfo[tokenId];
    }

    function ticketRarityWeight(uint256 tokenId) public view returns (uint256) {
        require(_exists(tokenId), "Token does not exist");
        SeatZone seatZone = _ticketInfo[tokenId].seatZone;

        if (seatZone == SeatZone.GENERAL) {
            return 1;
        }
        if (seatZone == SeatZone.PREMIUM) {
            return 5;
        }
        if (seatZone == SeatZone.VIP) {
            return 10;
        }

        return 20;
    }

    function _mintTicket(
        address to,
        uint256 matchId,
        uint256 seatId,
        SeatZone seatZone,
        string calldata tokenUri
    ) internal returns (uint256 tokenId) {
        require(to != address(0), "Invalid recipient");

        bytes32 seatKey = keccak256(abi.encodePacked(matchId, seatId));
        require(!_seatTaken[seatKey], "Seat already minted");

        _nextTokenId += 1;
        tokenId = _nextTokenId;

        _safeMint(to, tokenId);
        _tokenUris[tokenId] = tokenUri;

        _ticketInfo[tokenId] = TicketInfo({
            matchId: matchId,
            seatId: seatId,
            seatZone: seatZone
        });
        _seatTaken[seatKey] = true;

        emit TicketMinted(tokenId, to, matchId, seatId, seatZone);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        if (
            marketplaceOnlyTransfers && from != address(0) && to != address(0)
        ) {
            bool isMarketplaceFlow = (marketplace != address(0)) &&
                (msg.sender == marketplace || to == marketplace);
            require(isMarketplaceFlow, "Secondary sales via marketplace only");
        }

        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721) returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _tokenUris[tokenId];
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
