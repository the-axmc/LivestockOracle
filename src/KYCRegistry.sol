// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Minimal interface used by other contracts (AnimalPassportRegistry, Lending, Oracle, etc.)
interface IKYCRegistry {
    function isKYCed(address user) external view returns (bool);

    function isBorrower(address user) external view returns (bool);
    function isBank(address user) external view returns (bool);
    function isCoop(address user) external view returns (bool);
    function isOracleBot(address user) external view returns (bool);
    function isGrantor(address user) external view returns (bool);
}

/// @notice Global KYC + role registry for the protocol.
/// - Admins (KYC_ADMIN_ROLE) manage flags.
/// - Other contracts query simple view functions.
/// - You can choose to require isKYCed(user) before setting sub-roles.
contract KYCRegistry is AccessControl, IKYCRegistry {
    bytes32 public constant KYC_ADMIN_ROLE = keccak256("KYC_ADMIN_ROLE");

    struct Flags {
        bool kyc; // globally KYCed / verified identity
        bool borrower; // allowed to borrow / be a collateral owner
        bool bank; // bank / liquidity provider
        bool coop; // cooperative / association
        bool oracleBot; // AI/oracle reporter
        bool grantor; // grant-giving institution
    }

    mapping(address => Flags) private _flags;

    event KYCStatusUpdated(address indexed user, bool kyc);
    event UserRolesUpdated(
        address indexed user,
        bool borrower,
        bool bank,
        bool coop,
        bool oracleBot,
        bool grantor
    );

    /// @param admin initial admin for DEFAULT_ADMIN_ROLE and KYC_ADMIN_ROLE.
    constructor(address admin) {
        require(admin != address(0), "ADMIN_ZERO");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(KYC_ADMIN_ROLE, admin);
    }

    // ========= INTERNAL HELPERS =========

    function _setKYC(address user, bool kyc_) internal {
        _flags[user].kyc = kyc_;
        emit KYCStatusUpdated(user, kyc_);
    }

    function _setRoles(
        address user,
        bool borrower,
        bool bank,
        bool coop,
        bool oracleBot,
        bool grantor
    ) internal {
        Flags storage f = _flags[user];
        f.borrower = borrower;
        f.bank = bank;
        f.coop = coop;
        f.oracleBot = oracleBot;
        f.grantor = grantor;

        emit UserRolesUpdated(user, borrower, bank, coop, oracleBot, grantor);
    }

    // ========= ADMIN FUNCTIONS =========

    /// @notice Set global KYC flag for a user.
    /// @dev Typically called after off-chain KYC is done.
    function setKYCStatus(
        address user,
        bool kyc_
    ) external onlyRole(KYC_ADMIN_ROLE) {
        require(user != address(0), "USER_ZERO");
        _setKYC(user, kyc_);
    }

    /// @notice Batch set all role flags for a user.
    /// @dev You may want to enforce that only KYCed users can be assigned roles.
    function setUserRoles(
        address user,
        bool borrower,
        bool bank,
        bool coop,
        bool oracleBot,
        bool grantor
    ) external onlyRole(KYC_ADMIN_ROLE) {
        require(user != address(0), "USER_ZERO");
        // Optional safety: require KYC before any role
        if (borrower || bank || coop || oracleBot || grantor) {
            require(_flags[user].kyc, "NOT_KYCED");
        }
        _setRoles(user, borrower, bank, coop, oracleBot, grantor);
    }

    /// @notice Convenience setters for single roles.
    function setBorrower(
        address user,
        bool allowed
    ) external onlyRole(KYC_ADMIN_ROLE) {
        require(user != address(0), "USER_ZERO");
        if (allowed) require(_flags[user].kyc, "NOT_KYCED");
        _flags[user].borrower = allowed;
        emit UserRolesUpdated(
            user,
            _flags[user].borrower,
            _flags[user].bank,
            _flags[user].coop,
            _flags[user].oracleBot,
            _flags[user].grantor
        );
    }

    function setBank(
        address user,
        bool allowed
    ) external onlyRole(KYC_ADMIN_ROLE) {
        require(user != address(0), "USER_ZERO");
        if (allowed) require(_flags[user].kyc, "NOT_KYCED");
        _flags[user].bank = allowed;
        emit UserRolesUpdated(
            user,
            _flags[user].borrower,
            _flags[user].bank,
            _flags[user].coop,
            _flags[user].oracleBot,
            _flags[user].grantor
        );
    }

    function setCoop(
        address user,
        bool allowed
    ) external onlyRole(KYC_ADMIN_ROLE) {
        require(user != address(0), "USER_ZERO");
        if (allowed) require(_flags[user].kyc, "NOT_KYCED");
        _flags[user].coop = allowed;
        emit UserRolesUpdated(
            user,
            _flags[user].borrower,
            _flags[user].bank,
            _flags[user].coop,
            _flags[user].oracleBot,
            _flags[user].grantor
        );
    }

    function setOracleBot(
        address user,
        bool allowed
    ) external onlyRole(KYC_ADMIN_ROLE) {
        require(user != address(0), "USER_ZERO");
        if (allowed) require(_flags[user].kyc, "NOT_KYCED");
        _flags[user].oracleBot = allowed;
        emit UserRolesUpdated(
            user,
            _flags[user].borrower,
            _flags[user].bank,
            _flags[user].coop,
            _flags[user].oracleBot,
            _flags[user].grantor
        );
    }

    function setGrantor(
        address user,
        bool allowed
    ) external onlyRole(KYC_ADMIN_ROLE) {
        require(user != address(0), "USER_ZERO");
        if (allowed) require(_flags[user].kyc, "NOT_KYCED");
        _flags[user].grantor = allowed;
        emit UserRolesUpdated(
            user,
            _flags[user].borrower,
            _flags[user].bank,
            _flags[user].coop,
            _flags[user].oracleBot,
            _flags[user].grantor
        );
    }

    // ========= VIEW FUNCTIONS (IKYCRegistry) =========

    function isKYCed(address user) public view override returns (bool) {
        return _flags[user].kyc;
    }

    function isBorrower(address user) public view override returns (bool) {
        return _flags[user].borrower;
    }

    function isBank(address user) public view override returns (bool) {
        return _flags[user].bank;
    }

    function isCoop(address user) public view override returns (bool) {
        return _flags[user].coop;
    }

    function isOracleBot(address user) public view override returns (bool) {
        return _flags[user].oracleBot;
    }

    function isGrantor(address user) public view override returns (bool) {
        return _flags[user].grantor;
    }

    // ========= OPTIONAL HELPERS =========

    /// @notice Return all flags for a user in a single call (useful for dashboards).
    function getFlags(
        address user
    )
        external
        view
        returns (
            bool kyc,
            bool borrower,
            bool bank,
            bool coop,
            bool oracleBot,
            bool grantor
        )
    {
        Flags memory f = _flags[user];
        return (f.kyc, f.borrower, f.bank, f.coop, f.oracleBot, f.grantor);
    }
}
