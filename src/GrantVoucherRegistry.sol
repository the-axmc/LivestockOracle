// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Minimal interface to your existing KYCRegistry.
interface IKYCRegistry {
    function isKYCed(address user) external view returns (bool);
    function isGrantor(address user) external view returns (bool);
    function isBorrower(address user) external view returns (bool);
}

/// @notice GrantVoucherRegistry
/// - Tokenizes future grants as ERC721 vouchers.
/// - Each voucher represents a commitment from a KYCed grantor
///   to a beneficiary (farmer), with a notional amount & expected payout date.
/// - Status is updated as the grant moves from Pending → Funded → Paid/Cancelled.
/// - The lending protocol can later read these vouchers as "soft collateral".
contract GrantVoucherRegistry is ERC721, AccessControl {
    bytes32 public constant VOUCHER_ADMIN_ROLE =
        keccak256("VOUCHER_ADMIN_ROLE");

    IKYCRegistry public immutable kyc;

    enum Status {
        Pending, // created but not yet fully funded / confirmed
        Funded, // grant funds are set aside / ready to disburse
        Cancelled, // grant was cancelled
        Paid // grant has been paid out (to farmer / lending protocol)
    }

    struct GrantVoucherData {
        address grantor; // entity providing the grant
        address beneficiary; // farmer / protocol user
        uint256 notionalAmount; // agreed grant amount (units decided off-chain)
        uint64 expectedPayoutDate; // unix timestamp (approx. payout)
        bytes32 grantRef; // external reference (off-chain grant id, hash, etc.)
        Status status;
    }

    // tokenId => voucher data
    mapping(uint256 => GrantVoucherData) private _vouchers;
    uint256 public nextId;

    event VoucherMinted(
        uint256 indexed tokenId,
        address indexed grantor,
        address indexed beneficiary,
        uint256 notionalAmount,
        uint64 expectedPayoutDate,
        bytes32 grantRef
    );

    event VoucherStatusUpdated(
        uint256 indexed tokenId,
        Status oldStatus,
        Status newStatus
    );

    /// @param _kyc Address of KYCRegistry.
    /// @param admin Initial admin for DEFAULT_ADMIN_ROLE and VOUCHER_ADMIN_ROLE.
    constructor(
        IKYCRegistry _kyc,
        address admin
    ) ERC721("GrantVoucher", "GVOUCHER") {
        require(address(_kyc) != address(0), "KYC_ZERO");
        require(admin != address(0), "ADMIN_ZERO");

        kyc = _kyc;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VOUCHER_ADMIN_ROLE, admin);
    }

    // ========= Modifiers & internal helpers =========

    modifier onlyGrantorOrAdmin(uint256 tokenId) {
        GrantVoucherData memory v = _vouchers[tokenId];
        require(v.grantor != address(0), "VOUCHER_NOT_FOUND");
        require(
            msg.sender == v.grantor || hasRole(VOUCHER_ADMIN_ROLE, msg.sender),
            "NOT_GRANTOR_OR_ADMIN"
        );
        _;
    }

    // ========= Core functions =========

    /// @notice Mint a new grant voucher NFT to a beneficiary.
    /// @dev Caller must be a KYCed grantor in the KYCRegistry.
    ///
    /// @param beneficiary Farmer / protocol user who will receive the grant.
    /// @param notionalAmount Grant size (units defined off-chain; could be token units or fiat-equivalent).
    /// @param expectedPayoutDate Estimated payout timestamp.
    /// @param grantRef External identifier or hash for the grant agreement.
    ///
    /// @return tokenId Newly created voucher id.
    function mintVoucher(
        address beneficiary,
        uint256 notionalAmount,
        uint64 expectedPayoutDate,
        bytes32 grantRef
    ) external returns (uint256 tokenId) {
        require(beneficiary != address(0), "BENEF_ZERO");
        require(notionalAmount > 0, "AMOUNT_ZERO");
        require(kyc.isKYCed(msg.sender), "GRANTOR_NOT_KYCED");
        require(kyc.isGrantor(msg.sender), "NOT_GRANTOR");
        // Optional safety: require borrower flag for beneficiary
        require(kyc.isKYCed(beneficiary), "BENEF_NOT_KYCED");
        // require(kyc.isBorrower(beneficiary), "BENEF_NOT_BORROWER");

        tokenId = ++nextId;

        _safeMint(beneficiary, tokenId);

        _vouchers[tokenId] = GrantVoucherData({
            grantor: msg.sender,
            beneficiary: beneficiary,
            notionalAmount: notionalAmount,
            expectedPayoutDate: expectedPayoutDate,
            grantRef: grantRef,
            status: Status.Pending
        });

        emit VoucherMinted(
            tokenId,
            msg.sender,
            beneficiary,
            notionalAmount,
            expectedPayoutDate,
            grantRef
        );
    }

    /// @notice Mark a voucher as "Funded" (grant capital set aside / confirmed).
    /// @dev Only the original grantor or an admin can call this.
    function markFunded(uint256 tokenId) external onlyGrantorOrAdmin(tokenId) {
        GrantVoucherData storage v = _vouchers[tokenId];
        require(v.status == Status.Pending, "BAD_STATUS");
        _setStatus(tokenId, Status.Funded);
    }

    /// @notice Mark a voucher as "Cancelled".
    /// @dev Only the original grantor or an admin can call this.
    function markCancelled(
        uint256 tokenId
    ) external onlyGrantorOrAdmin(tokenId) {
        GrantVoucherData storage v = _vouchers[tokenId];
        require(
            v.status == Status.Pending || v.status == Status.Funded,
            "BAD_STATUS"
        );
        _setStatus(tokenId, Status.Cancelled);
    }

    /// @notice Mark a voucher as "Paid".
    /// @dev Only the original grantor or an admin can call this.
    ///      This does not move funds itself; your escrow / pool should handle that.
    function markPaid(uint256 tokenId) external onlyGrantorOrAdmin(tokenId) {
        GrantVoucherData storage v = _vouchers[tokenId];
        require(v.status == Status.Funded, "BAD_STATUS");
        _setStatus(tokenId, Status.Paid);
    }

    function _setStatus(uint256 tokenId, Status newStatus) internal {
        GrantVoucherData storage v = _vouchers[tokenId];
        Status old = v.status;
        v.status = newStatus;
        emit VoucherStatusUpdated(tokenId, old, newStatus);
    }

    // ========= Views =========

    /// @notice Get the full voucher data for a given token id.
    function getVoucher(
        uint256 tokenId
    ) external view returns (GrantVoucherData memory) {
        require(_ownerOf(tokenId) != address(0), "VOUCHER_NOT_FOUND");
        return _vouchers[tokenId];
    }

    /// @notice Convenience getters for frontends / AI agents.

    function grantorOf(uint256 tokenId) external view returns (address) {
        require(_ownerOf(tokenId) != address(0), "VOUCHER_NOT_FOUND");
        return _vouchers[tokenId].grantor;
    }

    function beneficiaryOf(uint256 tokenId) external view returns (address) {
        require(_ownerOf(tokenId) != address(0), "VOUCHER_NOT_FOUND");
        return _vouchers[tokenId].beneficiary;
    }

    function statusOf(uint256 tokenId) external view returns (Status) {
        require(_ownerOf(tokenId) != address(0), "VOUCHER_NOT_FOUND");
        return _vouchers[tokenId].status;
    }

    // ========= Admin helpers =========

    /// @notice Admin can change the beneficiary (e.g. in case of migration),
    ///         but only if voucher is not yet Paid or Cancelled.
    function adminUpdateBeneficiary(
        uint256 tokenId,
        address newBeneficiary
    ) external onlyRole(VOUCHER_ADMIN_ROLE) {
        require(_ownerOf(tokenId) != address(0), "VOUCHER_NOT_FOUND");
        require(newBeneficiary != address(0), "BENEF_ZERO");
        GrantVoucherData storage v = _vouchers[tokenId];
        require(
            v.status == Status.Pending || v.status == Status.Funded,
            "IMMUTABLE_STATUS"
        );

        v.beneficiary = newBeneficiary;
        // Note: ownership of the NFT itself should also reflect this change:
        _transfer(ownerOf(tokenId), newBeneficiary, tokenId);
    }

    // ========= ERC165 =========

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
