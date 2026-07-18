// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IGravityGoonsProgressTarget {
    function ownerOf(uint256 tokenId) external view returns (address);
    function disciplineOf(uint256 tokenId) external view returns (uint8);
    function notifyMetadataUpdate(uint256 tokenId) external;
}

/// @title Gravity Goons Progress Registry
/// @notice Settles signed, monotonic progression that follows a Gravity Goons token.
contract GravityGoonsProgressRegistry is EIP712, Ownable2Step, ReentrancyGuard {
    uint256 public constant SIGNER_DELAY = 2 days;
    bytes32 public constant PROGRESS_TYPEHASH = keccak256(
        "ProgressClaim(uint256 tokenId,uint64 xp,uint32 level,uint64 trickBitmap,uint64 achievementBitmap,uint16 catalogVersion,uint8 discipline,uint32 nonce,uint64 deadline)"
    );

    struct Progress {
        uint64 xp;
        uint64 trickBitmap;
        uint64 achievementBitmap;
        uint32 level;
        uint32 nonce;
        uint16 catalogVersion;
    }

    struct ProgressClaim {
        uint256 tokenId;
        uint64 xp;
        uint32 level;
        uint64 trickBitmap;
        uint64 achievementBitmap;
        uint16 catalogVersion;
        uint8 discipline;
        uint32 nonce;
        uint64 deadline;
    }

    IGravityGoonsProgressTarget public collection;
    address public gameSigner;
    address public pendingGameSigner;
    uint64 public signerActivationTime;
    mapping(uint256 => Progress) private _progress;

    error CollectionAlreadySet();
    error CollectionNotSet();
    error InvalidAddress();
    error ClaimExpired();
    error InvalidSigner();
    error InvalidNonce();
    error WrongDiscipline();
    error NonMonotonicProgress();
    error SignerDelayActive();

    event CollectionSet(address indexed collection);
    event GameSignerProposed(address indexed signer, uint64 activateAfter);
    event GameSignerActivated(address indexed signer);
    event ProgressApplied(
        uint256 indexed tokenId,
        uint64 xp,
        uint32 level,
        uint64 trickBitmap,
        uint64 achievementBitmap,
        uint16 catalogVersion,
        uint32 nonce
    );

    constructor(address initialOwner, address initialGameSigner)
        EIP712("Gravity Goons Progress", "1")
        Ownable(initialOwner)
    {
        if (initialGameSigner == address(0)) revert InvalidAddress();
        gameSigner = initialGameSigner;
    }

    function setCollectionOnce(address collectionAddress) external onlyOwner {
        if (address(collection) != address(0)) revert CollectionAlreadySet();
        if (collectionAddress == address(0)) revert InvalidAddress();
        collection = IGravityGoonsProgressTarget(collectionAddress);
        emit CollectionSet(collectionAddress);
    }

    function progressOf(uint256 tokenId) external view returns (Progress memory) {
        return _progress[tokenId];
    }

    function applyProgress(ProgressClaim calldata claim, bytes calldata signature) external nonReentrant {
        if (address(collection) == address(0)) revert CollectionNotSet();
        if (block.timestamp > claim.deadline) revert ClaimExpired();
        Progress storage current = _progress[claim.tokenId];
        if (claim.nonce != current.nonce) revert InvalidNonce();
        if (claim.discipline != collection.disciplineOf(claim.tokenId)) revert WrongDiscipline();
        collection.ownerOf(claim.tokenId); // Reverts for a nonexistent token.

        bytes32 structHash = keccak256(abi.encode(
            PROGRESS_TYPEHASH,
            claim.tokenId,
            claim.xp,
            claim.level,
            claim.trickBitmap,
            claim.achievementBitmap,
            claim.catalogVersion,
            claim.discipline,
            claim.nonce,
            claim.deadline
        ));
        if (ECDSA.recover(_hashTypedDataV4(structHash), signature) != gameSigner) revert InvalidSigner();
        if (
            claim.xp < current.xp ||
            claim.level < current.level ||
            claim.catalogVersion < current.catalogVersion ||
            (claim.trickBitmap | current.trickBitmap) != claim.trickBitmap ||
            (claim.achievementBitmap | current.achievementBitmap) != claim.achievementBitmap
        ) revert NonMonotonicProgress();

        current.xp = claim.xp;
        current.level = claim.level;
        current.trickBitmap = claim.trickBitmap;
        current.achievementBitmap = claim.achievementBitmap;
        current.catalogVersion = claim.catalogVersion;
        unchecked { ++current.nonce; }

        emit ProgressApplied(
            claim.tokenId,
            claim.xp,
            claim.level,
            claim.trickBitmap,
            claim.achievementBitmap,
            claim.catalogVersion,
            current.nonce
        );
        collection.notifyMetadataUpdate(claim.tokenId);
    }

    function proposeGameSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert InvalidAddress();
        pendingGameSigner = signer;
        signerActivationTime = uint64(block.timestamp + SIGNER_DELAY);
        emit GameSignerProposed(signer, signerActivationTime);
    }

    function activateGameSigner() external onlyOwner {
        if (pendingGameSigner == address(0)) revert InvalidAddress();
        if (block.timestamp < signerActivationTime) revert SignerDelayActive();
        gameSigner = pendingGameSigner;
        pendingGameSigner = address(0);
        signerActivationTime = 0;
        emit GameSignerActivated(gameSigner);
    }
}
