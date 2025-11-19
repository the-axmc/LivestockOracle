// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SpeciesOracle.sol";

contract DeploySpeciesOracle is Script {
    function run() external {
        // Read deployer from PRIVATE_KEY
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        // admin = deployer address
        address admin = vm.addr(pk);

        SpeciesOracle oracle = new SpeciesOracle(admin);

        vm.stopBroadcast();

        console2.log("SpeciesOracle deployed at:", address(oracle));
    }
}
