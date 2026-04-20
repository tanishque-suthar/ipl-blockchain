// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MiniTicketBareBones {
    struct TicketInfo {
        uint256 matchId;
        uint256 seatId;
    }

    // State Variables
    address public owner;
    uint256 public nextTokenId;
    string public name;
    string public symbol;

    mapping(uint256 => uint256) public matchPriceWei;
    mapping(bytes32 => bool) public seatTaken;
    mapping(uint256 => TicketInfo) private _ticketInfo;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    // Events
    event MatchPriceSet(uint256 indexed matchId, uint256 priceWei);
    event TicketBought(uint256 indexed tokenId, uint256 indexed matchId, uint256 indexed seatId, address buyer);

    // Access Control
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(string memory name_, string memory symbol_) {
        owner = msg.sender;
        name = name_;
        symbol = symbol_;
    }

    function setMatchPrice(uint256 matchId, uint256 priceWei) external onlyOwner {
        require(priceWei > 0, "Price must be > 0");
        matchPriceWei[matchId] = priceWei;
        emit MatchPriceSet(matchId, priceWei);
    }

    function buyTicket(uint256 matchId, uint256 seatId) external payable returns (uint256 tokenId) {
        uint256 price = matchPriceWei[matchId];
        require(price > 0, "Match price not set");
        require(msg.value == price, "Incorrect ETH sent");

        bytes32 seatKey = keccak256(abi.encodePacked(matchId, seatId));
        require(!seatTaken[seatKey], "Seat already sold");

        seatTaken[seatKey] = true;
        nextTokenId += 1;
        tokenId = nextTokenId;

        // Simplified Minting
        _owners[tokenId] = msg.sender;
        _balances[msg.sender] += 1;
        _ticketInfo[tokenId] = TicketInfo({matchId: matchId, seatId: seatId});

        emit TicketBought(tokenId, matchId, seatId, msg.sender);
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        return tokenOwner;
    }

    function getTicketInfo(uint256 tokenId) external view returns (TicketInfo memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _ticketInfo[tokenId];
    }

    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "Nothing to withdraw");

        (bool ok, ) = owner.call{value: amount}("");
        require(ok, "Withdraw failed");
    }
}