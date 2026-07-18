// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Impact Club
/// @notice Immediate-reveal, exact-token ERC-721 for selectable action-sports characters.
contract ImpactClub is ERC721, ERC2981, Ownable2Step, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 1_000;
    uint256 public constant PUBLIC_ALLOCATION = 950;
    uint256 public constant CREATOR_ALLOCATION = 50;
    uint256 public constant MAX_PER_WALLET = 5;
    uint256 public constant MINT_PRICE = 0.003 ether;
    bytes4 private constant ERC4906_INTERFACE_ID = 0x49064906;

    uint256 public publicMinted;
    uint256 public creatorMinted;
    bool public mintOpen;
    address public immutable progressRegistry;
    string private _metadataBaseURL;
    uint256[12] private _disciplineWords;
    mapping(address => uint256) public mintedByWallet;

    error MintClosed();
    error InvalidQuantity();
    error InvalidTokenId(uint256 tokenId);
    error TokenUnavailable(uint256 tokenId);
    error DuplicateTokenId(uint256 tokenId);
    error WalletLimitExceeded();
    error PublicAllocationExceeded();
    error CreatorAllocationExceeded();
    error IncorrectPayment();
    error UnauthorizedRegistry();
    error EmptyMetadataURL();
    error WithdrawalFailed();

    event MintOpenChanged(bool open);
    event MetadataUpdate(uint256 indexed tokenId);
    event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId);
    event ProceedsWithdrawn(address indexed recipient, uint256 amount);

    constructor(
        address initialOwner,
        address registry,
        string memory metadataBaseURL,
        uint256[12] memory disciplineWords
    ) ERC721("Impact Club", "IMPACT") Ownable(initialOwner) {
        if (bytes(metadataBaseURL).length == 0) revert EmptyMetadataURL();
        progressRegistry = registry;
        _metadataBaseURL = metadataBaseURL;
        _disciplineWords = disciplineWords;
        _setDefaultRoyalty(initialOwner, 500);
    }

    function mintSelected(uint16[] calldata tokenIds) external payable nonReentrant {
        if (!mintOpen) revert MintClosed();
        uint256 quantity = tokenIds.length;
        if (quantity == 0 || quantity > MAX_PER_WALLET) revert InvalidQuantity();
        if (mintedByWallet[msg.sender] + quantity > MAX_PER_WALLET) revert WalletLimitExceeded();
        if (publicMinted + quantity > PUBLIC_ALLOCATION) revert PublicAllocationExceeded();
        if (msg.value != MINT_PRICE * quantity) revert IncorrectPayment();
        _validateSelection(tokenIds);

        mintedByWallet[msg.sender] += quantity;
        publicMinted += quantity;
        for (uint256 i; i < quantity; ++i) _safeMint(msg.sender, tokenIds[i]);
    }

    function creatorMintSelected(address recipient, uint16[] calldata tokenIds) external onlyOwner {
        uint256 quantity = tokenIds.length;
        if (quantity == 0) revert InvalidQuantity();
        if (creatorMinted + quantity > CREATOR_ALLOCATION) revert CreatorAllocationExceeded();
        _validateSelection(tokenIds);
        creatorMinted += quantity;
        for (uint256 i; i < quantity; ++i) _safeMint(recipient, tokenIds[i]);
    }

    function _validateSelection(uint16[] calldata tokenIds) internal view {
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 tokenId = tokenIds[i];
            if (tokenId == 0 || tokenId > MAX_SUPPLY) revert InvalidTokenId(tokenId);
            if (_ownerOf(tokenId) != address(0)) revert TokenUnavailable(tokenId);
            for (uint256 j; j < i; ++j) {
                if (tokenIds[j] == tokenId) revert DuplicateTokenId(tokenId);
            }
        }
    }

    function setMintOpen(bool open) external onlyOwner {
        mintOpen = open;
        emit MintOpenChanged(open);
    }

    function isAvailable(uint256 tokenId) external view returns (bool) {
        return tokenId > 0 && tokenId <= MAX_SUPPLY && _ownerOf(tokenId) == address(0);
    }

    function availabilityWord(uint256 startTokenId) external view returns (uint256 word) {
        if (startTokenId == 0 || startTokenId > MAX_SUPPLY) revert InvalidTokenId(startTokenId);
        for (uint256 offset; offset < 256 && startTokenId + offset <= MAX_SUPPLY; ++offset) {
            if (_ownerOf(startTokenId + offset) == address(0)) word |= uint256(1) << offset;
        }
    }

    function disciplineOf(uint256 tokenId) public view returns (uint8) {
        if (tokenId == 0 || tokenId > MAX_SUPPLY) revert InvalidTokenId(tokenId);
        uint256 position = tokenId - 1;
        (uint256 wordIndex, uint256 slot) = (position / 85, position % 85);
        return uint8((_disciplineWords[wordIndex] >> (slot * 3)) & 7);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_metadataBaseURL, _paddedTokenId(tokenId));
    }

    function notifyMetadataUpdate(uint256 tokenId) external {
        if (msg.sender != progressRegistry) revert UnauthorizedRegistry();
        _requireOwned(tokenId);
        emit MetadataUpdate(tokenId);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        (bool success,) = payable(owner()).call{value: amount}("");
        if (!success) revert WithdrawalFailed();
        emit ProceedsWithdrawn(owner(), amount);
    }

    function totalMinted() external view returns (uint256) {
        return publicMinted + creatorMinted;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return interfaceId == ERC4906_INTERFACE_ID || super.supportsInterface(interfaceId);
    }

    function _paddedTokenId(uint256 tokenId) internal pure returns (string memory) {
        bytes memory output = new bytes(4);
        uint256 value = tokenId;
        for (uint256 i = 4; i > 0; --i) {
            output[i - 1] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(output);
    }
}

