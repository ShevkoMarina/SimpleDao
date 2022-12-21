// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DAOToken is ERC20 {

  constructor(address account) ERC20("DAOToken", "DAO") {
    _mint(account, 100);
  }

  function getCurrentVotes(address account) external view returns (uint256 votes) {
      return balanceOf(account);
  }
}