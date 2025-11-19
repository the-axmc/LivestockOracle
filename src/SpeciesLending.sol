// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./SpeciesToken.sol";
import "./SpeciesOracle.sol";

contract SpeciesLending is Ownable, ERC1155Holder {
    struct Risk {
        uint16 ltvBps; // max borrow LTV (basis points)
        uint16 liqThresholdBps; // liquidation threshold (basis points)
        uint16 liqBonusBps; // liquidation bonus for liquidator (bps)
        uint256 cap; // optional cap on total collateral value for this species
    }

    IERC20 public immutable stable;
    SpeciesToken public immutable species;
    SpeciesOracle public immutable oracle;

    // user => speciesId => amount (18 decimals)
    mapping(address => mapping(uint256 => uint256)) public col;
    // user => debt in stable token (6 decimals expected here)
    mapping(address => uint256) public debt;
    // speciesId => risk parameters
    mapping(uint256 => Risk) public risk;

    // For now we explicitly support the 4 main species as collateral in `_values`
    uint256 private constant MAX_SPECIES_ID = 4;

    // -------- Events --------

    event RiskSet(
        uint256 indexed speciesId,
        uint16 ltvBps,
        uint16 liqThresholdBps,
        uint16 liqBonusBps,
        uint256 cap
    );

    event Deposited(
        address indexed user,
        uint256 indexed speciesId,
        uint256 amount
    );
    event Withdrawn(
        address indexed user,
        uint256 indexed speciesId,
        uint256 amount
    );
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(
        address indexed liquidator,
        address indexed user,
        uint256 indexed speciesId,
        uint256 repayAmount,
        uint256 seizedAmount
    );

    // -------- Constructor --------

    constructor(
        IERC20 _stable,
        SpeciesToken _species,
        SpeciesOracle _oracle,
        address owner_
    ) Ownable(owner_) {
        require(address(_stable) != address(0), "STABLE_ZERO");
        require(address(_species) != address(0), "SPECIES_ZERO");
        require(address(_oracle) != address(0), "ORACLE_ZERO");
        require(owner_ != address(0), "OWNER_ZERO");

        stable = _stable;
        species = _species;
        oracle = _oracle;
    }

    // -------- Admin config --------

    function setRisk(uint256 id, Risk calldata r) external onlyOwner {
        // sanity checks
        require(r.liqThresholdBps >= r.ltvBps, "BAD_CFG");
        require(r.liqBonusBps <= 5_000, "BONUS_TOO_HIGH"); // max 50% bonus, tweak as needed

        // ensure species exists in SpeciesToken
        (bool exists, , , ) = species.speciesInfo(id); // (exists, mintPaused, unitDecimals, name)
        require(exists, "INVALID_SPECIES");

        risk[id] = r;
        emit RiskSet(id, r.ltvBps, r.liqThresholdBps, r.liqBonusBps, r.cap);
    }

    // -------- User actions --------

    function deposit(uint256 id, uint256 amount) external {
        require(amount > 0, "AMOUNT_ZERO");
        species.safeTransferFrom(msg.sender, address(this), id, amount, "");
        col[msg.sender][id] += amount;
        emit Deposited(msg.sender, id, amount);
    }

    function withdraw(uint256 id, uint256 amount) external {
        require(amount > 0, "AMOUNT_ZERO");
        uint256 bal = col[msg.sender][id];
        require(bal >= amount, "INSUFFICIENT_COL");

        // update balance first
        col[msg.sender][id] = bal - amount;

        // must remain healthy after withdrawal
        require(_health(msg.sender) >= 1e18, "LOW_HF");

        species.safeTransferFrom(address(this), msg.sender, id, amount, "");
        emit Withdrawn(msg.sender, id, amount);
    }

    function borrow(uint256 amt6) external {
        require(amt6 > 0, "AMOUNT_ZERO");
        uint256 maxBorrow = _borrowable(msg.sender);
        require(maxBorrow >= amt6, "EXCEEDS_LTV");

        debt[msg.sender] += amt6;
        require(stable.transfer(msg.sender, amt6), "TRANSFER_FAIL");

        emit Borrowed(msg.sender, amt6);
    }

    function repay(uint256 amt6) external {
        require(amt6 > 0, "AMOUNT_ZERO");
        require(
            stable.transferFrom(msg.sender, address(this), amt6),
            "TRANSFER_FAIL"
        );

        uint256 d = debt[msg.sender];
        if (amt6 >= d) {
            debt[msg.sender] = 0;
            emit Repaid(msg.sender, d);
        } else {
            debt[msg.sender] = d - amt6;
            emit Repaid(msg.sender, amt6);
        }
    }

    // -------- Liquidation --------

    function liquidate(
        address user,
        uint256 speciesId,
        uint256 repayAmt6
    ) external {
        require(user != address(0), "USER_ZERO");
        require(repayAmt6 > 0, "AMOUNT_ZERO");

        // only allow liquidation if user is below 1.0 health factor
        require(_health(user) < 1e18, "HEALTHY");

        // pull stable from liquidator
        require(
            stable.transferFrom(msg.sender, address(this), repayAmt6),
            "TRANSFER_FAIL"
        );

        // price check
        (uint256 px8, , bool valid) = oracle.currentPrice(speciesId);
        require(valid && px8 > 0, "NO_PRICE");

        Risk memory r = risk[speciesId];

        // seize = repay * (1 + bonus) * 1e20 / (px8 * 10_000)
        // repay: 6d, px: 8d, seize: 18d
        uint256 seize = (repayAmt6 * (10_000 + r.liqBonusBps) * 1e20) /
            (px8 * 10_000);

        // clamp to user's collateral balance
        uint256 userBal = col[user][speciesId];
        if (seize > userBal) {
            seize = userBal;
        }
        require(seize > 0, "NOTHING_TO_SEIZE");

        // move collateral and reduce debt
        col[user][speciesId] = userBal - seize;
        species.safeTransferFrom(
            address(this),
            msg.sender,
            speciesId,
            seize,
            ""
        );

        uint256 d = debt[user];
        if (repayAmt6 >= d) {
            debt[user] = 0;
        } else {
            debt[user] = d - repayAmt6;
        }

        emit Liquidated(msg.sender, user, speciesId, repayAmt6, seize);
    }

    // -------- Views --------

    /// @notice External helper for UIs – how much a user can still borrow.
    function borrowable(address u) external view returns (uint256) {
        return _borrowable(u);
    }

    /// @notice External helper – current health factor (1e18 = 1.0).
    function health(address u) external view returns (uint256) {
        return _health(u);
    }

    function _borrowable(address u) internal view returns (uint256) {
        (uint256 borrowCap6, , ) = _values(u);
        uint256 d = debt[u];
        return borrowCap6 > d ? borrowCap6 - d : 0;
    }

    function _health(address u) internal view returns (uint256) {
        (, uint256 liqVal6, bool any) = _values(u);
        uint256 d = debt[u];
        if (!any || d == 0) return type(uint256).max;
        return (liqVal6 * 1e18) / d;
    }

    /// @dev Computes total borrow capacity and liquidation value in 6 decimals.
    ///      For now, loops over the 4 canonical species IDs.
    function _values(
        address u
    ) internal view returns (uint256 borrowCap6, uint256 liqVal6, bool any) {
        for (uint256 id = 1; id <= MAX_SPECIES_ID; id++) {
            uint256 amt = col[u][id];
            if (amt == 0) continue;

            (uint256 px8, , bool valid) = oracle.currentPrice(id);
            if (!valid || px8 == 0) continue;

            any = true;

            // USD value in 6 decimals:
            // amt(18d) * px(8d) = 26d; scale down to 6d => /1e20
            uint256 usd6 = (amt * px8) / 1e20;

            Risk memory r = risk[id];
            if (r.ltvBps > 0) {
                borrowCap6 += (usd6 * r.ltvBps) / 10_000;
            }
            if (r.liqThresholdBps > 0) {
                liqVal6 += (usd6 * r.liqThresholdBps) / 10_000;
            }
        }
    }
}
