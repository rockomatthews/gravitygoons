// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address recipient, uint256 amount) external { _mint(recipient, amount); }
}

contract MockGoonCollection is ERC721 {
    mapping(uint256 => uint8) public disciplineOf;
    constructor() ERC721("Mock Goons", "MGOON") {}
    function mint(address recipient, uint256 tokenId) external { _mint(recipient, tokenId); }
    function setDiscipline(uint256 tokenId, uint8 discipline) external { disciplineOf[tokenId] = discipline; }
}
