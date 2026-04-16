// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IPLReward is ERC1155Supply, AccessControl, Ownable {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant FAN_VOTING_POINTS_ID = 1_000_000;

    struct ProvenanceRecord {
        uint256 matchId;
        bytes32 eventHash;
        string metadataRef;
        uint256 recordedAt;
        bool initialized;
    }

    mapping(uint256 => ProvenanceRecord) private _provenance;

    event DigitalMomentMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount
    );
    event OracleMomentMinted(
        bytes32 indexed requestId,
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount
    );
    event FanVotingPointsMinted(address indexed to, uint256 amount);
    event ProvenanceRecorded(
        uint256 indexed tokenId,
        uint256 indexed matchId,
        bytes32 indexed eventHash,
        string metadataRef
    );

    constructor(string memory baseUri) ERC1155(baseUri) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    function setURI(string calldata newUri) external onlyOwner {
        _setURI(newUri);
    }

    function mintDigitalMoment(
        address to,
        uint256 tokenId,
        uint256 amount,
        uint256 matchId,
        bytes32 eventHash,
        string calldata metadataRef,
        bytes calldata data
    ) external onlyRole(MINTER_ROLE) {
        require(tokenId != FAN_VOTING_POINTS_ID, "Reserved token id");

        _mint(to, tokenId, amount, data);
        _recordProvenance(tokenId, matchId, eventHash, metadataRef);

        emit DigitalMomentMinted(to, tokenId, amount);
    }

    function oracleMintDigitalMoment(
        bytes32 requestId,
        address to,
        uint256 tokenId,
        uint256 amount,
        uint256 matchId,
        bytes32 eventHash,
        string calldata metadataRef,
        bytes calldata data
    ) external onlyRole(ORACLE_ROLE) {
        require(tokenId != FAN_VOTING_POINTS_ID, "Reserved token id");

        _mint(to, tokenId, amount, data);
        _recordProvenance(tokenId, matchId, eventHash, metadataRef);

        emit OracleMomentMinted(requestId, to, tokenId, amount);
    }

    function mintFanVotingPoints(
        address to,
        uint256 amount,
        bytes calldata data
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, FAN_VOTING_POINTS_ID, amount, data);
        emit FanVotingPointsMinted(to, amount);
    }

    function getProvenance(
        uint256 tokenId
    ) external view returns (ProvenanceRecord memory) {
        return _provenance[tokenId];
    }

    function _recordProvenance(
        uint256 tokenId,
        uint256 matchId,
        bytes32 eventHash,
        string calldata metadataRef
    ) internal {
        ProvenanceRecord storage existing = _provenance[tokenId];

        if (!existing.initialized) {
            _provenance[tokenId] = ProvenanceRecord({
                matchId: matchId,
                eventHash: eventHash,
                metadataRef: metadataRef,
                recordedAt: block.timestamp,
                initialized: true
            });

            emit ProvenanceRecorded(tokenId, matchId, eventHash, metadataRef);
            return;
        }

        require(existing.matchId == matchId, "Provenance mismatch: match");
        require(existing.eventHash == eventHash, "Provenance mismatch: event");
        require(
            keccak256(bytes(existing.metadataRef)) ==
                keccak256(bytes(metadataRef)),
            "Provenance mismatch: metadata"
        );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
