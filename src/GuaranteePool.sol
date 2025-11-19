// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal interface for your existing KYCRegistry contract.
interface IKYCRegistry {
    function isKYCed(address user) external view returns (bool);
    function isGrantor(address user) external view returns (bool);
}

/// @notice Minimal interface marker for the lending contract.
/// @dev Not strictly necessary to define functions here for the pool logic,
///      but keeps the type explicit.
interface ISpeciesLending {
    // You can add view helpers if you want, but the pool
    // only needs the address for now.
}

/// @notice GuaranteePool
/// - Holds grant capital (stablecoin) that acts as a first-loss buffer
///   for a portfolio of loans in the lending protocol.
/// - Grantors deposit capital (must be KYCed + isGrantor in KYCRegistry).
/// - Lending contract registers loans with a guarantee amount per loan.
/// - On default, lending contract calls coverLoss(loanId, lossAmount),
///   and the pool pays out up to the remaining guarantee for that loan.
contract GuaranteePool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");

    IERC20 public immutable stable;
    IKYCRegistry public immutable kyc;
    ISpeciesLending public lending; // lending contract allowed to use the pool

    struct LoanGuarantee {
        uint256 originalGuarantee;   // initial committed guarantee
        uint256 remainingGuarantee;  // remaining guarantee not yet used
        bool active;                 // true if loan still has an active guarantee
    }

    /// @dev loanId => guarantee info
    mapping(uint256 => LoanGuarantee) public loanGuarantees;

    /// @dev Total guarantee still reserved for active loans (sum of remainingGuarantee)
    uint256 public totalCommitted;

    /// @dev Cumulative amount paid out to cover losses
    uint256 public totalPaidOut;

    event LendingContractUpdated(address indexed oldLending, address indexed newLending);

    event GrantDeposited(address indexed grantor, uint256 amount);
    event GrantWithdrawn(address indexed to, uint256 amount);

    event LoanRegistered(uint256 indexed loanId, uint256 guaranteeAmount);
    event LoanGuaranteeUpdated(uint256 indexed loanId, uint256 remainingGuarantee);
    event LossCovered(uint256 indexed loanId, uint256 paidAmount, uint256 remainingGuarantee);

    /// @param _stable The ERC20 stable asset used by the lending protocol.
    /// @param _kyc Address of the KYCRegistry contract.
    /// @param admin Admin address for roles.
    constructor(
        IERC20 _stable,
        IKYCRegistry _kyc,
        address admin
    ) {
        require(address(_stable) != address(0), "STABLE_ZERO");
        require(address(_kyc) != address(0), "KYC_ZERO");
        require(admin != address(0), "ADMIN_ZERO");

        stable = _stable;
        kyc = _kyc;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(POOL_ADMIN_ROLE, admin);
    }

    // =========================
    //   Modifiers & internal
    // =========================

    modifier onlyLending() {
        require(msg.sender == address(lending), "NOT_LENDING");
        _;
    }

    /// @notice Set the lending contract that can register loans and call coverLoss.
    /// @dev Only callable by POOL_ADMIN_ROLE.
    function setLendingContract(address _lending) external onlyRole(POOL_ADMIN_ROLE) {
        require(_lending != address(0), "LENDING_ZERO");
        emit LendingContractUpdated(address(lending), _lending);
        lending = ISpeciesLending(_lending);
    }

    // =========================
    //   Grantor interactions
    // =========================

    /// @notice Deposit grant capital into the pool.
    /// @dev Sender must be a KYCed grantor in KYCRegistry.
    function depositGrant(uint256 amount) external nonReentrant {
        require(amount > 0, "AMOUNT_ZERO");
        require(kyc.isKYCed(msg.sender), "NOT_KYCED");
        require(kyc.isGrantor(msg.sender), "NOT_GRANTOR");

        stable.safeTransferFrom(msg.sender, address(this), amount);
        emit GrantDeposited(msg.sender, amount);
    }

    /// @notice Withdraw uncommitted (unused) capital from the pool.
    /// @dev Only POOL_ADMIN_ROLE can withdraw, and only up to the uncommitted amount.
    function withdrawUncommitted(address to, uint256 amount)
        external
        onlyRole(POOL_ADMIN_ROLE)
        nonReentrant
    {
        require(to != address(0), "TO_ZERO");
        require(amount > 0, "AMOUNT_ZERO");

        uint256 uncommitted = uncommittedBalance();
        require(amount <= uncommitted, "EXCEEDS_UNCOMMITTED");

        stable.safeTransfer(to, amount);
        emit GrantWithdrawn(to, amount);
    }

    // =========================
    //   Lending interactions
    // =========================

    /// @notice Register a loan with a specific guarantee amount.
    /// @dev Called by the lending contract at origination.
    ///      The pool must have enough uncommitted capital to reserve this guarantee.
    function registerLoan(uint256 loanId, uint256 guaranteeAmount)
        external
        onlyLending
    {
        require(loanId != 0, "LOAN_ZERO");
        require(guaranteeAmount > 0, "GUARANTEE_ZERO");

        LoanGuarantee storage g = loanGuarantees[loanId];
        require(g.originalGuarantee == 0, "ALREADY_REGISTERED");

        // Ensure there is enough uncommitted capital to back this guarantee.
        uint256 uncommitted = uncommittedBalance();
        require(guaranteeAmount <= uncommitted, "INSUFFICIENT_POOL");

        g.originalGuarantee = guaranteeAmount;
        g.remainingGuarantee = guaranteeAmount;
        g.active = true;

        totalCommitted += guaranteeAmount;

        emit LoanRegistered(loanId, guaranteeAmount);
        emit LoanGuaranteeUpdated(loanId, guaranteeAmount);
    }

    /// @notice Cover a loss for a given loan up to the remaining guarantee.
    /// @dev Called by the lending contract when a default is realized
    ///      and all collateral liquidation is already taken into account.
    ///
    /// @param loanId The loan identifier known to the lending contract.
    /// @param lossAmount The loss amount (in stable tokens) to cover.
    /// @return paidAmount The actual amount paid by the pool (<= lossAmount).
    function coverLoss(uint256 loanId, uint256 lossAmount)
        external
        onlyLending
        nonReentrant
        returns (uint256 paidAmount)
    {
        require(lossAmount > 0, "LOSS_ZERO");

        LoanGuarantee storage g = loanGuarantees[loanId];
        require(g.active, "NO_GUARANTEE");

        uint256 remaining = g.remainingGuarantee;
        if (remaining == 0) {
            return 0; // nothing left to cover
        }

        paidAmount = lossAmount;
        if (paidAmount > remaining) {
            paidAmount = remaining;
        }

        // Update state
        g.remainingGuarantee = remaining - paidAmount;
        totalCommitted -= paidAmount;
        totalPaidOut += paidAmount;

        if (g.remainingGuarantee == 0) {
            g.active = false;
        }

        emit LossCovered(loanId, paidAmount, g.remainingGuarantee);
        emit LoanGuaranteeUpdated(loanId, g.remainingGuarantee);

        // Transfer funds to the lending contract (or wherever it expects).
        stable.safeTransfer(msg.sender, paidAmount);
    }

    /// @notice Manually deactivate a loan's guarantee without paying anything.
    /// @dev Useful for admin / risk mgmt if loan is fully repaid or cancelled off-chain.
    function deactivateLoan(uint256 loanId) external onlyLending {
        LoanGuarantee storage g = loanGuarantees[loanId];
        if (!g.active) return;

        totalCommitted -= g.remainingGuarantee;
        g.remainingGuarantee = 0;
        g.active = false;

        emit LoanGuaranteeUpdated(loanId, 0);
    }

    // =========================
    //   View helpers
    // =========================

    /// @notice Total pool balance (all tokens currently held).
    function poolBalance() public view returns (uint256) {
        return stable.balanceOf(address(this));
    }

    /// @notice Amount of capital that is *not* currently reserved as guarantee.
    function uncommittedBalance() public view returns (uint256) {
        uint256 bal = poolBalance();
        if (bal <= totalCommitted) return 0;
        return bal - totalCommitted;
    }

    /// @notice Get guarantee details for a loan.
    function getLoanGuarantee(uint256 loanId)
        external
        view
        returns (
            uint256 originalGuarantee,
            uint256 remainingGuarantee,
            bool active
        )
    {
        LoanGuarantee memory g = loanGuarantees[loanId];
        return (g.originalGuarantee, g.remainingGuarantee, g.active);
    }
}