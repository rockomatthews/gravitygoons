// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

interface IGravityGoonsCollection is IERC721 {
    function disciplineOf(uint256 tokenId) external view returns (uint8);
}

/// @title Gravity Goons Match Escrow
/// @notice Equal-stake Base USDC escrow. Deployment and activation remain gated by legal and independent security review.
contract GoonMatchEscrowV2 is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_HOUSE_FEE_BPS = 250;
    uint64 public constant DISPUTE_WINDOW = 10 minutes;
    bytes32 public constant TERMS_TYPEHASH = keccak256(
        "WagerTerms(bytes32 matchId,address playerA,address playerB,uint256 tokenA,uint256 tokenB,uint256 stake,uint64 scheduledStart,uint64 fundingDeadline,bytes32 rulesetHash,address settlementSigner,uint16 feeBps,address feeRecipient)"
    );
    bytes32 public constant RESULT_TYPEHASH = keccak256(
        "MatchResult(bytes32 matchId,bytes32 termsHash,address winner,bytes32 resultHash,uint64 deadline)"
    );
    bytes32 public constant VOID_TYPEHASH = keccak256(
        "MatchVoid(bytes32 matchId,bytes32 termsHash,bytes32 reasonHash,uint64 deadline)"
    );

    enum State { None, Created, PartiallyFunded, Locked, ResultProposed, Settled, Refunded, Voided, Disputed }

    struct WagerTerms {
        bytes32 matchId;
        address playerA;
        address playerB;
        uint256 tokenA;
        uint256 tokenB;
        uint256 stake;
        uint64 scheduledStart;
        uint64 fundingDeadline;
        bytes32 rulesetHash;
        address settlementSigner;
        uint16 feeBps;
        address feeRecipient;
    }

    struct EscrowMatch {
        bytes32 termsHash;
        address playerA;
        address playerB;
        uint128 stake;
        uint64 scheduledStart;
        uint64 fundingDeadline;
        uint64 disputeDeadline;
        uint16 feeBps;
        bool fundedA;
        bool fundedB;
        State state;
        address proposedWinner;
        address feeRecipient;
        address matchSettlementSigner;
        bytes32 resultHash;
    }

    IERC20 public immutable usdc;
    IGravityGoonsCollection public immutable collection;
    address public settlementSigner;
    address public feeRecipient;
    uint16 public houseFeeBps;
    mapping(bytes32 => EscrowMatch) private _matches;

    error InvalidAddress();
    error InvalidTerms();
    error InvalidStake();
    error InvalidSignature();
    error InvalidState();
    error NotPlayer();
    error NotTokenOwner();
    error DisciplineMismatch();
    error FundingExpired();
    error TooEarly();
    error FeeTooHigh();

    event MatchCreated(bytes32 indexed matchId, bytes32 indexed termsHash, address indexed playerA, address playerB, uint256 stake);
    event MatchFunded(bytes32 indexed matchId, address indexed player, bool fullyFunded);
    event ResultProposed(bytes32 indexed matchId, address indexed winner, bytes32 indexed resultHash, uint64 disputeDeadline);
    event MatchDisputed(bytes32 indexed matchId, address indexed player);
    event MatchVoided(bytes32 indexed matchId, bytes32 indexed reasonHash);
    event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 payout, uint256 fee);
    event MatchRefunded(bytes32 indexed matchId, bool voided);
    event SettlementSignerChanged(address indexed signer);
    event FeeConfigurationChanged(address indexed recipient, uint16 feeBps);

    constructor(address initialOwner, address usdcAddress, address collectionAddress, address initialSettlementSigner, address initialFeeRecipient)
        Ownable(initialOwner) EIP712("Gravity Goons Match Escrow", "1")
    {
        if (initialOwner == address(0) || usdcAddress == address(0) || collectionAddress == address(0) || initialSettlementSigner == address(0) || initialFeeRecipient == address(0)) revert InvalidAddress();
        usdc = IERC20(usdcAddress);
        collection = IGravityGoonsCollection(collectionAddress);
        settlementSigner = initialSettlementSigner;
        feeRecipient = initialFeeRecipient;
        houseFeeBps = 0;
        _pause();
    }

    function matchOf(bytes32 matchId) external view returns (EscrowMatch memory) { return _matches[matchId]; }

    function hashTerms(WagerTerms calldata terms) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            TERMS_TYPEHASH, terms.matchId, terms.playerA, terms.playerB, terms.tokenA, terms.tokenB,
            terms.stake, terms.scheduledStart, terms.fundingDeadline, terms.rulesetHash,
            terms.settlementSigner, terms.feeBps, terms.feeRecipient
        )));
    }

    function fund(WagerTerms calldata terms, address player, bytes calldata signature) external nonReentrant whenNotPaused {
        _validateTerms(terms);
        if (block.timestamp > terms.fundingDeadline) revert FundingExpired();
        if (player != terms.playerA && player != terms.playerB) revert NotPlayer();
        if (msg.sender != player) revert NotPlayer();
        bytes32 termsHash = hashTerms(terms);
        if (!_validSignature(player, termsHash, signature)) revert InvalidSignature();
        uint256 tokenId = player == terms.playerA ? terms.tokenA : terms.tokenB;
        if (collection.ownerOf(tokenId) != player) revert NotTokenOwner();
        if (collection.disciplineOf(terms.tokenA) != collection.disciplineOf(terms.tokenB)) revert DisciplineMismatch();

        EscrowMatch storage wager = _matches[terms.matchId];
        if (wager.state == State.None) {
            if (terms.settlementSigner != settlementSigner || terms.feeBps != houseFeeBps || terms.feeRecipient != feeRecipient) revert InvalidTerms();
            wager.termsHash = termsHash;
            wager.playerA = terms.playerA;
            wager.playerB = terms.playerB;
            wager.stake = uint128(terms.stake);
            wager.scheduledStart = terms.scheduledStart;
            wager.fundingDeadline = terms.fundingDeadline;
            wager.feeBps = terms.feeBps;
            wager.feeRecipient = terms.feeRecipient;
            wager.matchSettlementSigner = terms.settlementSigner;
            wager.state = State.Created;
            emit MatchCreated(terms.matchId, termsHash, terms.playerA, terms.playerB, terms.stake);
        } else if (wager.termsHash != termsHash || (wager.state != State.Created && wager.state != State.PartiallyFunded)) {
            revert InvalidState();
        }

        if (player == terms.playerA) {
            if (wager.fundedA) revert InvalidState();
            wager.fundedA = true;
        } else {
            if (wager.fundedB) revert InvalidState();
            wager.fundedB = true;
        }
        bool fullyFunded = wager.fundedA && wager.fundedB;
        wager.state = fullyFunded ? State.Locked : State.PartiallyFunded;
        usdc.safeTransferFrom(msg.sender, address(this), terms.stake);
        emit MatchFunded(terms.matchId, player, fullyFunded);
    }

    function proposeResult(bytes32 matchId, address winner, bytes32 resultHash, uint64 deadline, bytes calldata signature) external whenNotPaused {
        EscrowMatch storage wager = _matches[matchId];
        if (wager.state != State.Locked) revert InvalidState();
        if (resultHash == bytes32(0)) revert InvalidTerms();
        if (block.timestamp < wager.scheduledStart || block.timestamp > deadline) revert TooEarly();
        if (winner != wager.playerA && winner != wager.playerB) revert NotPlayer();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(RESULT_TYPEHASH, matchId, wager.termsHash, winner, resultHash, deadline)));
        if (!_validSignature(wager.matchSettlementSigner, digest, signature)) revert InvalidSignature();
        wager.proposedWinner = winner;
        wager.resultHash = resultHash;
        wager.disputeDeadline = uint64(block.timestamp + DISPUTE_WINDOW);
        wager.state = State.ResultProposed;
        emit ResultProposed(matchId, winner, resultHash, wager.disputeDeadline);
    }

    function dispute(bytes32 matchId) external {
        EscrowMatch storage wager = _matches[matchId];
        if (wager.state != State.ResultProposed || block.timestamp > wager.disputeDeadline) revert InvalidState();
        if (msg.sender != wager.playerA && msg.sender != wager.playerB) revert NotPlayer();
        wager.state = State.Disputed;
        emit MatchDisputed(matchId, msg.sender);
    }

    /// @notice Refunds a locked match after the authoritative server signs a void reason
    /// (for example, a verified player no-show). This avoids making players wait for a
    /// Safe transaction while keeping arbitrary callers unable to cancel live matches.
    function voidWithSignature(bytes32 matchId, bytes32 reasonHash, uint64 deadline, bytes calldata signature) external nonReentrant {
        EscrowMatch storage wager = _matches[matchId];
        if (wager.state != State.Locked) revert InvalidState();
        if (reasonHash == bytes32(0) || block.timestamp < wager.scheduledStart || block.timestamp > deadline) revert InvalidTerms();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(VOID_TYPEHASH, matchId, wager.termsHash, reasonHash, deadline)));
        if (!_validSignature(wager.matchSettlementSigner, digest, signature)) revert InvalidSignature();
        wager.resultHash = reasonHash;
        emit MatchVoided(matchId, reasonHash);
        _refund(matchId, wager, true);
    }

    function finalize(bytes32 matchId) external nonReentrant {
        EscrowMatch storage wager = _matches[matchId];
        if (wager.state != State.ResultProposed) revert InvalidState();
        if (block.timestamp <= wager.disputeDeadline) revert TooEarly();
        _settle(matchId, wager, wager.proposedWinner);
    }

    function resolveDispute(bytes32 matchId, address winner, bool refundPlayers) external onlyOwner nonReentrant {
        EscrowMatch storage wager = _matches[matchId];
        if (wager.state != State.Disputed) revert InvalidState();
        if (refundPlayers) _refund(matchId, wager, true);
        else {
            if (winner != wager.playerA && winner != wager.playerB) revert NotPlayer();
            _settle(matchId, wager, winner);
        }
    }

    function refundExpired(bytes32 matchId) external nonReentrant {
        EscrowMatch storage wager = _matches[matchId];
        if (wager.state != State.Created && wager.state != State.PartiallyFunded) revert InvalidState();
        if (block.timestamp <= wager.fundingDeadline) revert TooEarly();
        _refund(matchId, wager, false);
    }

    function voidAndRefund(bytes32 matchId) external onlyOwner nonReentrant {
        EscrowMatch storage wager = _matches[matchId];
        if (wager.state != State.Locked && wager.state != State.ResultProposed && wager.state != State.Disputed) revert InvalidState();
        _refund(matchId, wager, true);
    }

    function setSettlementSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert InvalidAddress();
        settlementSigner = signer;
        emit SettlementSignerChanged(signer);
    }

    function setFeeConfiguration(address recipient, uint16 feeBps) external onlyOwner {
        if (recipient == address(0)) revert InvalidAddress();
        if (feeBps > MAX_HOUSE_FEE_BPS) revert FeeTooHigh();
        feeRecipient = recipient;
        houseFeeBps = feeBps;
        emit FeeConfigurationChanged(recipient, feeBps);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _validateTerms(WagerTerms calldata terms) private view {
        if (terms.matchId == bytes32(0) || terms.playerA == address(0) || terms.playerB == address(0) || terms.playerA == terms.playerB || terms.tokenA == terms.tokenB || terms.rulesetHash == bytes32(0)) revert InvalidTerms();
        if (!_validStake(terms.stake) || terms.stake > type(uint128).max) revert InvalidStake();
        if (terms.fundingDeadline <= block.timestamp || terms.scheduledStart < terms.fundingDeadline || terms.scheduledStart > terms.fundingDeadline + 7 days) revert InvalidTerms();
        if (terms.settlementSigner == address(0) || terms.feeRecipient == address(0) || terms.feeBps > MAX_HOUSE_FEE_BPS) revert InvalidTerms();
    }

    function _validStake(uint256 stake) private pure returns (bool) {
        return stake == 1e6 || stake == 5e6 || stake == 10e6 || stake == 25e6;
    }

    function _validSignature(address signer, bytes32 digest, bytes calldata signature) private view returns (bool) {
        (address recovered, ECDSA.RecoverError error, bytes32 errorArgument) = ECDSA.tryRecover(digest, signature);
        if (error == ECDSA.RecoverError.NoError && errorArgument == bytes32(0) && recovered == signer) return true;
        if (signer.code.length == 0) return false;
        try IERC1271(signer).isValidSignature(digest, signature) returns (bytes4 magicValue) {
            return magicValue == IERC1271.isValidSignature.selector;
        } catch { return false; }
    }

    function _settle(bytes32 matchId, EscrowMatch storage wager, address winner) private {
        uint256 pool = uint256(wager.stake) * 2;
        uint256 fee = pool * wager.feeBps / 10_000;
        wager.state = State.Settled;
        if (fee != 0) usdc.safeTransfer(wager.feeRecipient, fee);
        usdc.safeTransfer(winner, pool - fee);
        emit MatchSettled(matchId, winner, pool - fee, fee);
    }

    function _refund(bytes32 matchId, EscrowMatch storage wager, bool voided) private {
        bool fundedA = wager.fundedA;
        bool fundedB = wager.fundedB;
        wager.state = voided ? State.Voided : State.Refunded;
        if (fundedA) usdc.safeTransfer(wager.playerA, wager.stake);
        if (fundedB) usdc.safeTransfer(wager.playerB, wager.stake);
        emit MatchRefunded(matchId, voided);
    }
}
