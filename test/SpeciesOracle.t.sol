// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SpeciesOracle.sol";

contract SpeciesOracleTest is Test {
    SpeciesOracle oracle;
    address admin = address(0xA11CE);
    address reporter = address(0xBEEF);

    function setUp() public {
        oracle = new SpeciesOracle(admin);

        // prank as admin to config and grant reporter
        vm.startPrank(admin);
        oracle.setConfig(1, 3600, 2_000, false); // heartbeat 1h, maxDeviation 20%
        oracle.grantReporter(reporter);
        vm.stopPrank();
    }

    function testPostAndReadPrice() public {
        vm.startPrank(reporter);
        oracle.postPrice(1, 100e8);
        oracle.postPrice(1, 101e8);
        oracle.postPrice(1, 99e8);
        vm.stopPrank();

        (uint256 price, , bool valid) = oracle.currentPrice(1);
        assertTrue(valid);
        assertEq(price, 100e8); // median of [99,100,101]
    }

    function testPostPriceWithScore() public {
        vm.startPrank(reporter);
        oracle.postPriceWithScore(1, 100e8, 7_500); // 75.00
        oracle.postPriceWithScore(1, 99e8, 7_200);
        oracle.postPriceWithScore(1, 101e8, 7_800);
        vm.stopPrank();

        (uint256 score, , bool validScore) = oracle.currentScore(1);
        assertTrue(validScore);
        assertEq(score, 7_500); // median of [7200,7500,7800]
    }
}
