// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

interface IIPLTicket {
    function ownerOf(uint256 tokenId) external view returns (address);

    function ticketRarityWeight(
        uint256 tokenId
    ) external view returns (uint256);
}
