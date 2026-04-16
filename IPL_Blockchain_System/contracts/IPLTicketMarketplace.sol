// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IPLTicketMarketplace is IERC721Receiver, ReentrancyGuard, Ownable {
    struct Listing {
        address seller;
        uint256 price;
        uint256 expiresAt;
        bool active;
    }

    uint96 public constant MAX_BPS = 10_000;

    address public tdsTreasury;
    uint96 public tdsBps;

    mapping(address => mapping(uint256 => Listing)) public listings;

    event ListingCreated(
        address indexed ticketContract,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint256 expiresAt
    );
    event ListingCancelled(
        address indexed ticketContract,
        uint256 indexed tokenId,
        address indexed seller
    );
    event ListingPurchased(
        address indexed ticketContract,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price,
        uint256 sellerAmount,
        uint256 royaltyAmount,
        uint256 tdsAmount
    );

    constructor(address treasury, uint96 tdsBps_) {
        require(treasury != address(0), "Invalid treasury");
        require(tdsBps_ <= MAX_BPS, "TDS too high");

        tdsTreasury = treasury;
        tdsBps = tdsBps_;
    }

    function setTdsTreasury(address treasury) external onlyOwner {
        require(treasury != address(0), "Invalid treasury");
        tdsTreasury = treasury;
    }

    function setTdsBps(uint96 tdsBps_) external onlyOwner {
        require(tdsBps_ <= MAX_BPS, "TDS too high");
        tdsBps = tdsBps_;
    }

    function createListing(
        address ticketContract,
        uint256 tokenId,
        uint256 price,
        uint256 expiresAt
    ) external nonReentrant {
        require(price > 0, "Price must be > 0");
        require(expiresAt > block.timestamp, "Invalid expiry");

        Listing storage existing = listings[ticketContract][tokenId];
        require(!existing.active, "Listing already exists");

        IERC721 ticket = IERC721(ticketContract);
        require(ticket.ownerOf(tokenId) == msg.sender, "Not token owner");

        ticket.safeTransferFrom(msg.sender, address(this), tokenId);

        listings[ticketContract][tokenId] = Listing({
            seller: msg.sender,
            price: price,
            expiresAt: expiresAt,
            active: true
        });

        emit ListingCreated(
            ticketContract,
            tokenId,
            msg.sender,
            price,
            expiresAt
        );
    }

    function cancelListing(
        address ticketContract,
        uint256 tokenId
    ) external nonReentrant {
        Listing storage listing = listings[ticketContract][tokenId];
        require(listing.active, "Listing not active");
        require(
            msg.sender == listing.seller || msg.sender == owner(),
            "Not authorized"
        );

        address seller = listing.seller;
        listing.active = false;

        IERC721(ticketContract).safeTransferFrom(
            address(this),
            seller,
            tokenId
        );
        emit ListingCancelled(ticketContract, tokenId, seller);
    }

    function buyListing(
        address ticketContract,
        uint256 tokenId
    ) external payable nonReentrant {
        Listing storage listing = listings[ticketContract][tokenId];
        require(listing.active, "Listing not active");
        require(block.timestamp <= listing.expiresAt, "Listing expired");
        require(msg.value == listing.price, "Incorrect payment");

        listing.active = false;

        (address royaltyReceiver, uint256 royaltyAmount) = _getRoyaltyInfo(
            ticketContract,
            tokenId,
            msg.value
        );
        uint256 tdsAmount = (msg.value * tdsBps) / MAX_BPS;

        require(royaltyAmount + tdsAmount <= msg.value, "Invalid payout split");
        uint256 sellerAmount = msg.value - royaltyAmount - tdsAmount;

        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            _payout(royaltyReceiver, royaltyAmount);
        }

        if (tdsAmount > 0) {
            _payout(tdsTreasury, tdsAmount);
        }

        _payout(listing.seller, sellerAmount);
        IERC721(ticketContract).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit ListingPurchased(
            ticketContract,
            tokenId,
            msg.sender,
            msg.value,
            sellerAmount,
            royaltyAmount,
            tdsAmount
        );
    }

    function _getRoyaltyInfo(
        address ticketContract,
        uint256 tokenId,
        uint256 salePrice
    ) internal view returns (address receiver, uint256 royaltyAmount) {
        if (
            IERC165(ticketContract).supportsInterface(
                type(IERC2981).interfaceId
            )
        ) {
            return IERC2981(ticketContract).royaltyInfo(tokenId, salePrice);
        }

        return (address(0), 0);
    }

    function _payout(address receiver, uint256 amount) internal {
        (bool success, ) = receiver.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
