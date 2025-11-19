// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {KYCRegistry} from "../src/KYCRegistry.sol";
import {SpeciesToken} from "../src/SpeciesToken.sol";
import {SpeciesOracle} from "../src/SpeciesOracle.sol";
import {AnimalPassportRegistry} from "../src/AnimalPassportRegistry.sol";
import {SpeciesLending} from "../src/SpeciesLending.sol";
import {CooperativeAttestor, IKYCRegistry as ICoopKYC} from "../src/CooperativeAttestor.sol";
import {GrantVoucherRegistry, IKYCRegistry as IGrantKYC} from "../src/GrantVoucherRegistry.sol";
import {GuaranteePool, IKYCRegistry as IGuaranteeKYC} from "../src/GuaranteePool.sol";

/// @notice Simple 6-decimal mock stablecoin for local deployments.
contract MockUSD6 is ERC20 {
    constructor(address initialHolder, uint256 initialSupply)
        ERC20("Mock USD Stablecoin", "mUSD")
    {
        _mint(initialHolder, initialSupply);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract DeployLivestockOracle is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address broadcastFrom = vm.addr(deployerKey);
        address admin = vm.envOr("ADMIN", broadcastFrom);

        // Optional overrides via env vars.
        string memory baseURI = vm.envOr(
            "SPECIES_TOKEN_URI",
            string("https://livestock.example/api/species/{id}.json")
        );
        address stableToken = vm.envOr("STABLE_TOKEN", address(0));
        uint256 mockStableSupply = vm.envOr(
            "MOCK_STABLE_SUPPLY",
            uint256(1_000_000 * 1e6)
        );

        vm.startBroadcast(deployerKey);

        IERC20 stable;
        if (stableToken == address(0)) {
            MockUSD6 mock = new MockUSD6(admin, mockStableSupply);
            stable = IERC20(address(mock));
            console2.log("MockUSD6 deployed:", address(mock));
        } else {
            stable = IERC20(stableToken);
        }

        KYCRegistry kyc = new KYCRegistry(admin);
        SpeciesToken speciesToken = new SpeciesToken(baseURI, admin);
        SpeciesOracle speciesOracle = new SpeciesOracle(admin);

        AnimalPassportRegistry passports = new AnimalPassportRegistry(
            kyc,
            speciesToken
        );

        CooperativeAttestor coopAttestor = new CooperativeAttestor(
            ICoopKYC(address(kyc)),
            admin
        );

        GrantVoucherRegistry grantVouchers = new GrantVoucherRegistry(
            IGrantKYC(address(kyc)),
            admin
        );

        SpeciesLending lending = new SpeciesLending(
            stable,
            speciesToken,
            speciesOracle,
            admin
        );

        GuaranteePool guaranteePool = new GuaranteePool(
            stable,
            IGuaranteeKYC(address(kyc)),
            admin
        );
        guaranteePool.setLendingContract(address(lending));

        // Give passports the ability to mint SpeciesToken units if desired.
        speciesToken.grantRole(speciesToken.MINTER_ROLE(), address(passports));
        speciesToken.grantRole(speciesToken.MINTER_ROLE(), admin);

        // Example oracle configs for the 4 canonical species.
        speciesOracle.setConfig(1, 1 days, 2_000, false); // cows
        speciesOracle.setConfig(2, 1 days, 2_000, false); // pigs
        speciesOracle.setConfig(3, 1 days, 2_000, false); // goats
        speciesOracle.setConfig(4, 1 days, 2_000, false); // chickens

        vm.stopBroadcast();

        console2.log("Deployer:", broadcastFrom);
        console2.log("Admin:", admin);
        console2.log("KYCRegistry:", address(kyc));
        console2.log("SpeciesToken:", address(speciesToken));
        console2.log("SpeciesOracle:", address(speciesOracle));
        console2.log("AnimalPassportRegistry:", address(passports));
        console2.log("CooperativeAttestor:", address(coopAttestor));
        console2.log("GrantVoucherRegistry:", address(grantVouchers));
        console2.log("SpeciesLending:", address(lending));
        console2.log("GuaranteePool:", address(guaranteePool));
        console2.log("Stable token:", address(stable));
    }
}
