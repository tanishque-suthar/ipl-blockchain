// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MiniTicketERC721 is ERC721URIStorage, Ownable {
    struct TicketInfo {
        uint256 matchId;
        uint256 seatId;
    }

    uint256 public nextTokenId;

    mapping(uint256 => uint256) public matchPriceWei;
    mapping(bytes32 => bool) public seatTaken;
    mapping(uint256 => TicketInfo) private _ticketInfo;

    event MatchPriceSet(uint256 indexed matchId, uint256 priceWei);
    event TicketBought(uint256 indexed tokenId, uint256 indexed matchId, uint256 indexed seatId, address buyer);

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function setMatchPrice(uint256 matchId, uint256 priceWei) external onlyOwner {
        require(priceWei > 0, "Price must be > 0");
        matchPriceWei[matchId] = priceWei;
        emit MatchPriceSet(matchId, priceWei);
    }

    function buyTicket(
        uint256 matchId,
        uint256 seatId,
        string calldata tokenUri
    ) external payable returns (uint256 tokenId) {
        uint256 price = matchPriceWei[matchId];
        require(price > 0, "Match price not set");
        require(msg.value == price, "Incorrect ETH sent");

        bytes32 seatKey = keccak256(abi.encodePacked(matchId, seatId));
        require(!seatTaken[seatKey], "Seat already sold");

        seatTaken[seatKey] = true;
        nextTokenId += 1;
        tokenId = nextTokenId;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenUri);
        _ticketInfo[tokenId] = TicketInfo({matchId: matchId, seatId: seatId});

        emit TicketBought(tokenId, matchId, seatId, msg.sender);
    }

    function getTicketInfo(uint256 tokenId) external view returns (TicketInfo memory) {
        require(_exists(tokenId), "Token does not exist");
        return _ticketInfo[tokenId];
    }

    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "Nothing to withdraw");

        (bool ok, ) = owner().call{value: amount}("");
        require(ok, "Withdraw failed");
    }
}
