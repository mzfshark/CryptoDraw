// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IAgentProxy {
    function withdrawCommission() external;
}

// This contract cannot receive ETH (no payable receive/fallback),
// so any attempt to transfer ETH to it will revert.
contract RevertingAgent {
    function triggerWithdraw(address agentProxy) external {
        IAgentProxy(agentProxy).withdrawCommission();
    }
}
