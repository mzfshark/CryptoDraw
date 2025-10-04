// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title BandStaleMock
 * @dev Mock do StdReference do Band que permite configurar timestamps antigos
 *      para exercitar o branch de staleness no PriceOracle (cfg.source == BAND).
 */
contract BandStaleMock {
    struct ReferenceData {
        uint256 rate;
        uint256 lastUpdatedBase;
        uint256 lastUpdatedQuote;
    }

    uint256 public price;
    uint256 public lastUpdatedBase;
    uint256 public lastUpdatedQuote;

    constructor() {
        price = 1e18; // $1 por padrão
        // timestamps antigos para forçar staleness com maxPriceAge padrão (3600)
        lastUpdatedBase = block.timestamp - 2 days;
        lastUpdatedQuote = block.timestamp - 2 days;
    }

    function setPrice(uint256 p) external {
        price = p;
    }

    function setTimes(uint256 base, uint256 quote) external {
        lastUpdatedBase = base;
        lastUpdatedQuote = quote;
    }

    function getReferenceData(string calldata /* base */, string calldata /* quote */)
        external
        view
        returns (ReferenceData memory)
    {
        return ReferenceData({rate: price, lastUpdatedBase: lastUpdatedBase, lastUpdatedQuote: lastUpdatedQuote});
    }
}
