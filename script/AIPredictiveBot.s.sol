// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SpeciesOracle.sol";

/// @notice Simple deterministic bot that pushes pseudo-AI predictions to SpeciesOracle.
/// @dev Configure PRIVATE_KEY (reporter) and SPECIES_ORACLE (contract) when running.
contract AIPredictiveBot is Script {
    struct SpeciesConfig {
        uint256 id;
        uint256 basePriceUsd; // whole USD, converted to 8 decimals internally
        uint256 volatilityBps; // random price swing in basis points
        uint256 baseScore; // 0-100 scale baseline
        uint256 scoreSwing; // max +/- swing in score units
    }

    SpeciesConfig[] public speciesConfigs;

    constructor() {
        speciesConfigs.push(SpeciesConfig(1, 105, 1_000, 78, 10)); // cows
        speciesConfigs.push(SpeciesConfig(2, 65, 1_500, 72, 12)); // pigs
        speciesConfigs.push(SpeciesConfig(3, 45, 1_200, 70, 15)); // goats
        speciesConfigs.push(SpeciesConfig(4, 25, 2_000, 68, 18)); // chickens
    }

    function run() external {
        uint256 reporterKey = vm.envUint("PRIVATE_KEY");
        address oracleAddr = vm.envAddress("SPECIES_ORACLE");

        vm.startBroadcast(reporterKey);
        SpeciesOracle oracle = SpeciesOracle(oracleAddr);

        for (uint256 i = 0; i < speciesConfigs.length; i++) {
            SpeciesConfig memory cfg = speciesConfigs[i];
            (uint256 price, uint256 score) = _predict(cfg);
            oracle.postPriceWithScore(cfg.id, price, score);
            console2.log(
                "Posted prediction",
                cfg.id,
                price,
                score
            );
        }

        vm.stopBroadcast();
    }

    function _predict(
        SpeciesConfig memory cfg
    ) internal view returns (uint256 price, uint256 score) {
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(block.timestamp, block.number, cfg.id, msg.sender)
            )
        );

        // price in USD * 1e8 with +/- volatility
        uint256 basePrice = cfg.basePriceUsd * 1e8;
        int256 priceDrift = int256(seed % cfg.volatilityBps) -
            int256(cfg.volatilityBps / 2);
        price =
            (basePrice * uint256(int256(10_000) + priceDrift)) /
            10_000;

        // sentiment score 0-100 scaled by 1e2
        uint256 baseScore = cfg.baseScore * 1e2;
        uint256 swing = cfg.scoreSwing * 1e2;
        int256 scoreDrift = int256((seed >> 128) % swing) -
            int256(swing / 2);
        int256 rawScore = int256(baseScore) + scoreDrift;
        if (rawScore < 0) rawScore = 0;
        if (rawScore > int256(100 * 1e2)) rawScore = int256(100 * 1e2);
        score = uint256(rawScore);
    }
}
