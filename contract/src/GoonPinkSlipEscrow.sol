// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @title Gravity Goons Pink Slip Escrow
/// @notice Winner-takes-both NFT custody. Never deploy or enable without separate legal and independent security approval.
contract GoonPinkSlipEscrow is Ownable2Step, Pausable, ReentrancyGuard, EIP712, IERC721Receiver {
    uint64 public constant DISPUTE_WINDOW = 24 hours;
    bytes32 public constant TERMS_TYPEHASH = keccak256(
        "PinkSlipTerms(bytes32 matchId,address playerA,address playerB,uint256 tokenA,uint256 tokenB,bytes32 disciplineHash,uint64 scheduledStart,uint64 depositDeadline,bytes32 rulesetHash,address settlementSigner)"
    );
    bytes32 public constant RESULT_TYPEHASH = keccak256(
        "PinkSlipResult(bytes32 matchId,bytes32 termsHash,address winner,bytes32 resultHash,uint64 deadline)"
    );

    enum State { None, PartiallyDeposited, Locked, ResultProposed, Settled, Refunded, Voided, Disputed }

    struct PinkSlipTerms {
        bytes32 matchId;
        address playerA;
        address playerB;
        uint256 tokenA;
        uint256 tokenB;
        bytes32 disciplineHash;
        uint64 scheduledStart;
        uint64 depositDeadline;
        bytes32 rulesetHash;
        address settlementSigner;
    }

    struct PinkSlipMatch {
        bytes32 termsHash;
        address playerA;
        address playerB;
        uint256 tokenA;
        uint256 tokenB;
        uint64 scheduledStart;
        uint64 depositDeadline;
        uint64 disputeDeadline;
        bool depositedA;
        bool depositedB;
        State state;
        address proposedWinner;
        address matchSettlementSigner;
        bytes32 resultHash;
        bytes32 disciplineHash;
    }

    IERC721 public immutable collection;
    address public settlementSigner;
    mapping(bytes32 => PinkSlipMatch) private _matches;

    error InvalidAddress();
    error InvalidTerms();
    error InvalidSignature();
    error InvalidState();
    error NotPlayer();
    error NotTokenOwner();
    error DepositExpired();
    error TooEarly();
    error UnexpectedNFT();

    event PinkSlipCreated(bytes32 indexed matchId, bytes32 indexed termsHash, address indexed playerA, address playerB, uint256 tokenA, uint256 tokenB);
    event GoonDeposited(bytes32 indexed matchId, address indexed player, uint256 indexed tokenId, bool fullyDeposited);
    event ResultProposed(bytes32 indexed matchId, address indexed winner, bytes32 indexed resultHash, uint64 disputeDeadline);
    event MatchDisputed(bytes32 indexed matchId, address indexed player);
    event PinkSlipSettled(bytes32 indexed matchId, address indexed winner, uint256 tokenA, uint256 tokenB);
    event PinkSlipRefunded(bytes32 indexed matchId, bool voided);
    event SettlementSignerChanged(address indexed signer);

    constructor(address initialOwner, address collectionAddress, address initialSettlementSigner)
        Ownable(initialOwner) EIP712("Gravity Goons Pink Slip Escrow", "1")
    {
        if (initialOwner == address(0) || collectionAddress == address(0) || initialSettlementSigner == address(0)) revert InvalidAddress();
        collection = IERC721(collectionAddress);
        settlementSigner = initialSettlementSigner;
    }

    function matchOf(bytes32 matchId) external view returns (PinkSlipMatch memory) { return _matches[matchId]; }

    function hashTerms(PinkSlipTerms calldata terms) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            TERMS_TYPEHASH, terms.matchId, terms.playerA, terms.playerB, terms.tokenA, terms.tokenB,
            terms.disciplineHash, terms.scheduledStart, terms.depositDeadline, terms.rulesetHash, terms.settlementSigner
        )));
    }

    function deposit(PinkSlipTerms calldata terms, address player, bytes calldata signature) external nonReentrant whenNotPaused {
        _validateTerms(terms);
        if (block.timestamp > terms.depositDeadline) revert DepositExpired();
        if (player != terms.playerA && player != terms.playerB) revert NotPlayer();
        bytes32 termsHash = hashTerms(terms);
        if (!_validSignature(player, termsHash, signature)) revert InvalidSignature();
        uint256 tokenId = player == terms.playerA ? terms.tokenA : terms.tokenB;
        if (collection.ownerOf(tokenId) != player) revert NotTokenOwner();

        PinkSlipMatch storage pinkSlip = _matches[terms.matchId];
        if (pinkSlip.state == State.None) {
            if (terms.settlementSigner != settlementSigner) revert InvalidTerms();
            pinkSlip.termsHash = termsHash;
            pinkSlip.playerA = terms.playerA;
            pinkSlip.playerB = terms.playerB;
            pinkSlip.tokenA = terms.tokenA;
            pinkSlip.tokenB = terms.tokenB;
            pinkSlip.disciplineHash = terms.disciplineHash;
            pinkSlip.scheduledStart = terms.scheduledStart;
            pinkSlip.depositDeadline = terms.depositDeadline;
            pinkSlip.matchSettlementSigner = terms.settlementSigner;
            emit PinkSlipCreated(terms.matchId, termsHash, terms.playerA, terms.playerB, terms.tokenA, terms.tokenB);
        } else if (pinkSlip.termsHash != termsHash || pinkSlip.state != State.PartiallyDeposited) {
            revert InvalidState();
        }

        if (player == terms.playerA) {
            if (pinkSlip.depositedA) revert InvalidState();
            pinkSlip.depositedA = true;
        } else {
            if (pinkSlip.depositedB) revert InvalidState();
            pinkSlip.depositedB = true;
        }
        collection.safeTransferFrom(player, address(this), tokenId);
        bool fullyDeposited = pinkSlip.depositedA && pinkSlip.depositedB;
        pinkSlip.state = fullyDeposited ? State.Locked : State.PartiallyDeposited;
        emit GoonDeposited(terms.matchId, player, tokenId, fullyDeposited);
    }

    function proposeResult(bytes32 matchId, address winner, bytes32 resultHash, uint64 deadline, bytes calldata signature) external whenNotPaused {
        PinkSlipMatch storage pinkSlip = _matches[matchId];
        if (pinkSlip.state != State.Locked) revert InvalidState();
        if (block.timestamp < pinkSlip.scheduledStart || block.timestamp > deadline) revert TooEarly();
        if (winner != pinkSlip.playerA && winner != pinkSlip.playerB) revert NotPlayer();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(RESULT_TYPEHASH, matchId, pinkSlip.termsHash, winner, resultHash, deadline)));
        if (!_validSignature(pinkSlip.matchSettlementSigner, digest, signature)) revert InvalidSignature();
        pinkSlip.proposedWinner = winner;
        pinkSlip.resultHash = resultHash;
        pinkSlip.disputeDeadline = uint64(block.timestamp + DISPUTE_WINDOW);
        pinkSlip.state = State.ResultProposed;
        emit ResultProposed(matchId, winner, resultHash, pinkSlip.disputeDeadline);
    }

    function dispute(bytes32 matchId) external {
        PinkSlipMatch storage pinkSlip = _matches[matchId];
        if (pinkSlip.state != State.ResultProposed || block.timestamp > pinkSlip.disputeDeadline) revert InvalidState();
        if (msg.sender != pinkSlip.playerA && msg.sender != pinkSlip.playerB) revert NotPlayer();
        pinkSlip.state = State.Disputed;
        emit MatchDisputed(matchId, msg.sender);
    }

    function finalize(bytes32 matchId) external nonReentrant {
        PinkSlipMatch storage pinkSlip = _matches[matchId];
        if (pinkSlip.state != State.ResultProposed) revert InvalidState();
        if (block.timestamp <= pinkSlip.disputeDeadline) revert TooEarly();
        _settle(matchId, pinkSlip, pinkSlip.proposedWinner);
    }

    function resolveDispute(bytes32 matchId, address winner, bool refundPlayers) external onlyOwner nonReentrant {
        PinkSlipMatch storage pinkSlip = _matches[matchId];
        if (pinkSlip.state != State.Disputed) revert InvalidState();
        if (refundPlayers) _refund(matchId, pinkSlip, true);
        else {
            if (winner != pinkSlip.playerA && winner != pinkSlip.playerB) revert NotPlayer();
            _settle(matchId, pinkSlip, winner);
        }
    }

    function refundExpired(bytes32 matchId) external nonReentrant {
        PinkSlipMatch storage pinkSlip = _matches[matchId];
        if (pinkSlip.state != State.PartiallyDeposited || block.timestamp <= pinkSlip.depositDeadline) revert InvalidState();
        _refund(matchId, pinkSlip, false);
    }

    function voidAndRefund(bytes32 matchId) external onlyOwner nonReentrant {
        PinkSlipMatch storage pinkSlip = _matches[matchId];
        if (pinkSlip.state != State.Locked && pinkSlip.state != State.ResultProposed && pinkSlip.state != State.Disputed) revert InvalidState();
        _refund(matchId, pinkSlip, true);
    }

    function setSettlementSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert InvalidAddress();
        settlementSigner = signer;
        emit SettlementSignerChanged(signer);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function onERC721Received(address operator, address, uint256, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(collection) || operator != address(this)) revert UnexpectedNFT();
        return IERC721Receiver.onERC721Received.selector;
    }

    function _validateTerms(PinkSlipTerms calldata terms) private pure {
        if (terms.matchId == bytes32(0) || terms.rulesetHash == bytes32(0) || terms.disciplineHash == bytes32(0)) revert InvalidTerms();
        if (terms.playerA == address(0) || terms.playerB == address(0) || terms.playerA == terms.playerB) revert InvalidTerms();
        if (terms.tokenA == terms.tokenB || terms.scheduledStart <= terms.depositDeadline || terms.settlementSigner == address(0)) revert InvalidTerms();
    }

    function _validSignature(address signer, bytes32 digest, bytes calldata signature) private view returns (bool) {
        if (signer.code.length == 0) return ECDSA.recover(digest, signature) == signer;
        try IERC1271(signer).isValidSignature(digest, signature) returns (bytes4 magic) {
            return magic == IERC1271.isValidSignature.selector;
        } catch { return false; }
    }

    function _settle(bytes32 matchId, PinkSlipMatch storage pinkSlip, address winner) private {
        pinkSlip.state = State.Settled;
        collection.safeTransferFrom(address(this), winner, pinkSlip.tokenA);
        collection.safeTransferFrom(address(this), winner, pinkSlip.tokenB);
        emit PinkSlipSettled(matchId, winner, pinkSlip.tokenA, pinkSlip.tokenB);
    }

    function _refund(bytes32 matchId, PinkSlipMatch storage pinkSlip, bool voided) private {
        bool depositedA = pinkSlip.depositedA;
        bool depositedB = pinkSlip.depositedB;
        pinkSlip.state = voided ? State.Voided : State.Refunded;
        if (depositedA) collection.safeTransferFrom(address(this), pinkSlip.playerA, pinkSlip.tokenA);
        if (depositedB) collection.safeTransferFrom(address(this), pinkSlip.playerB, pinkSlip.tokenB);
        emit PinkSlipRefunded(matchId, voided);
    }
}
