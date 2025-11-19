// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Minimal interface for your existing KYCRegistry.
interface IKYCRegistry {
    function isKYCed(address user) external view returns (bool);
    function isBorrower(address user) external view returns (bool);
    function isCoop(address user) external view returns (bool);
}

/// @notice CooperativeAttestor
/// - Manages which addresses are recognized as cooperatives.
/// - Lets those coops issue on-chain attestations about farmers:
///   * membership active/inactive
///   * deliveries / volume over a period
///   * whether the farmer is in good standing
///   * an optional rating (0–100, or whatever scale you decide)
/// - AI / oracles can read this to feed credit scoring.
contract CooperativeAttestor is AccessControl {
    bytes32 public constant COOP_ROLE = keccak256("COOP_ROLE");
    bytes32 public constant COOP_ADMIN_ROLE = keccak256("COOP_ADMIN_ROLE");

    IKYCRegistry public immutable kyc;

    struct CoopMembership {
        bool active; // is the farmer currently a member?
        uint64 since; // unix time when membership started (or was first attested)
        uint64 lastUpdate; // unix time of last attestation update
        uint64 deliveries6m; // e.g. volume delivered over last 6 months (kg / liters / etc)
        bool goodStanding; // true if no known issues / arrears with the coop
        uint8 rating; // 0–100 or 0–10, up to you (generic reputation signal)
    }

    /// farmer => coop => membership data
    mapping(address => mapping(address => CoopMembership)) public memberships;

    event CoopRegistered(address indexed coop);
    event CoopRevoked(address indexed coop);
    event MembershipUpdated(
        address indexed farmer,
        address indexed coop,
        bool active,
        uint64 since,
        uint64 lastUpdate,
        uint64 deliveries6m,
        bool goodStanding,
        uint8 rating
    );

    /// @param _kyc The address of the KYCRegistry contract.
    /// @param admin The address that will control coop registration.
    constructor(IKYCRegistry _kyc, address admin) {
        require(address(_kyc) != address(0), "KYC_ZERO");
        require(admin != address(0), "ADMIN_ZERO");

        kyc = _kyc;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COOP_ADMIN_ROLE, admin);
    }

    // ============ Coop management ============

    /// @notice Register a KYCed cooperative so it can issue attestations.
    /// @dev Requires that KYCRegistry marks `coop` as a coop.
    function registerCoop(address coop) external onlyRole(COOP_ADMIN_ROLE) {
        require(coop != address(0), "COOP_ZERO");
        require(kyc.isCoop(coop), "NOT_KYC_COOP");
        _grantRole(COOP_ROLE, coop);
        emit CoopRegistered(coop);
    }

    /// @notice Revoke coop status; it will no longer be able to attest.
    function revokeCoop(address coop) external onlyRole(COOP_ADMIN_ROLE) {
        require(coop != address(0), "COOP_ZERO");
        _revokeRole(COOP_ROLE, coop);
        emit CoopRevoked(coop);
    }

    /// @notice Check if an address is currently an authorized coop here
    ///         (in addition to being KYCed as a coop in the KYCRegistry).
    function isAuthorizedCoop(address coop) public view returns (bool) {
        return hasRole(COOP_ROLE, coop);
    }

    // ============ Membership attestations ============

    /// @notice Create or update an attestation for a farmer.
    /// @dev Only callable by an authorized coop (COOP_ROLE).
    ///      Farmer must be KYCed (optionally: isBorrower).
    ///
    /// @param farmer Farmer address being attested.
    /// @param active Whether membership is currently active.
    /// @param deliveries6m Volume delivered over last 6 months (unit decided off-chain).
    /// @param goodStanding True if coop considers farmer in good standing.
    /// @param rating Generic score (0–100 or similar).
    function setMembership(
        address farmer,
        bool active,
        uint64 deliveries6m,
        bool goodStanding,
        uint8 rating
    ) external onlyRole(COOP_ROLE) {
        require(farmer != address(0), "FARMER_ZERO");
        require(kyc.isKYCed(farmer), "FARMER_NOT_KYCED");
        // Optional: enforce that the farmer is actually allowed to borrow
        // require(kyc.isBorrower(farmer), "NOT_BORROWER");

        address coop = msg.sender;
        CoopMembership storage m = memberships[farmer][coop];

        uint64 nowTs = uint64(block.timestamp);

        if (m.since == 0) {
            // New membership record
            m.since = nowTs;
        }

        m.active = active;
        m.lastUpdate = nowTs;
        m.deliveries6m = deliveries6m;
        m.goodStanding = goodStanding;
        m.rating = rating;

        emit MembershipUpdated(
            farmer,
            coop,
            m.active,
            m.since,
            m.lastUpdate,
            m.deliveries6m,
            m.goodStanding,
            m.rating
        );
    }

    // ============ View helpers ============

    /// @notice Get membership data for a (farmer, coop) pair.
    function getMembership(
        address farmer,
        address coop
    ) external view returns (CoopMembership memory) {
        return memberships[farmer][coop];
    }

    /// @notice Convenience: check if a farmer is in good standing
    ///         with a specific coop (and membership is active).
    function isFarmerInGoodStanding(
        address farmer,
        address coop
    ) external view returns (bool) {
        CoopMembership memory m = memberships[farmer][coop];
        return m.active && m.goodStanding;
    }
}
