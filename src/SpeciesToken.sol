// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SpeciesToken is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant SPECIES_ADMIN = keccak256("SPECIES_ADMIN");
    bytes32 public constant URI_ADMIN_ROLE = keccak256("URI_ADMIN_ROLE");

    // Canonical IDs for initial species
    uint256 public constant SPECIES_COW = 1;
    uint256 public constant SPECIES_PIG = 2;
    uint256 public constant SPECIES_GOAT = 3;
    uint256 public constant SPECIES_CHICKEN = 4;

    struct SpeciesInfo {
        bool exists;
        bool mintPaused;
        uint8 unitDecimals; // how many decimals per "unit" of animal
        string name; // e.g. "Cow"
    }

    mapping(uint256 => SpeciesInfo) public speciesInfo;
    uint256 public nextSpeciesId;

    event SpeciesRegistered(
        uint256 indexed id,
        string name,
        uint8 unitDecimals,
        bool mintPaused
    );

    event SpeciesUpdated(
        uint256 indexed id,
        string name,
        uint8 unitDecimals,
        bool mintPaused
    );

    event MintPaused(uint256 indexed id, bool mintPaused);
    event BaseURIUpdated(string newURI);

    constructor(string memory baseURI, address admin) ERC1155(baseURI) {
        require(admin != address(0), "ADMIN_ZERO");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(SPECIES_ADMIN, admin);
        _grantRole(URI_ADMIN_ROLE, admin);

        // Initialize base species
        _registerSpecies(SPECIES_COW, "Cow", 0, false);
        _registerSpecies(SPECIES_PIG, "Pig", 0, false);
        _registerSpecies(SPECIES_GOAT, "Goat", 0, false);
        _registerSpecies(SPECIES_CHICKEN, "Chicken", 0, false);

        nextSpeciesId = 5;
    }

    function _registerSpecies(
        uint256 id,
        string memory name,
        uint8 unitDecimals,
        bool mintPaused
    ) internal {
        require(!speciesInfo[id].exists, "SPECIES_EXISTS");

        speciesInfo[id] = SpeciesInfo({
            exists: true,
            mintPaused: mintPaused,
            unitDecimals: unitDecimals,
            name: name
        });

        emit SpeciesRegistered(id, name, unitDecimals, mintPaused);
    }

    /// @notice Register or update a species with a specific id.
    /// @dev If the species doesn't exist it will be created; otherwise updated.
    function setSpeciesInfo(
        uint256 id,
        string memory name,
        uint8 unitDecimals,
        bool mintPaused
    ) external onlyRole(SPECIES_ADMIN) {
        if (!speciesInfo[id].exists) {
            _registerSpecies(id, name, unitDecimals, mintPaused);
            if (id >= nextSpeciesId) {
                nextSpeciesId = id + 1;
            }
        } else {
            SpeciesInfo storage info = speciesInfo[id];
            info.unitDecimals = unitDecimals;
            info.mintPaused = mintPaused;
            info.name = name;
            emit SpeciesUpdated(id, name, unitDecimals, mintPaused);
        }
    }

    /// @notice Auto-assign an id for new species added in the future.
    function registerNewSpecies(
        string calldata name,
        uint8 unitDecimals,
        bool mintPaused
    ) external onlyRole(SPECIES_ADMIN) returns (uint256 id) {
        id = nextSpeciesId++;
        _registerSpecies(id, name, unitDecimals, mintPaused);
    }

    modifier onlyExistingSpecies(uint256 id) {
        require(speciesInfo[id].exists, "INVALID_SPECIES");
        _;
    }

    /// @notice Mint species tokens (fungible units of a species).
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external onlyRole(MINTER_ROLE) onlyExistingSpecies(id) {
        require(!speciesInfo[id].mintPaused, "MINT_PAUSED");
        _mint(to, id, amount, data);
    }

    /// @notice Burn species tokens from an address.
    function burn(address from, uint256 id, uint256 amount) external {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "NOT_AUTH"
        );
        _burn(from, id, amount);
    }

    /// @notice Pause / unpause minting for a given species.
    function setMintPaused(
        uint256 id,
        bool paused
    ) external onlyRole(PAUSER_ROLE) onlyExistingSpecies(id) {
        speciesInfo[id].mintPaused = paused;
        emit MintPaused(id, paused);
    }

    /// @notice Update the base URI for all token types.
    function setURI(string memory newuri) external onlyRole(URI_ADMIN_ROLE) {
        _setURI(newuri);
        emit BaseURIUpdated(newuri);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
