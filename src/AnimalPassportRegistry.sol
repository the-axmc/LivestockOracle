import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AnimalPassportRegistry is ERC721, AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    IKYCRegistry public kyc;
    SpeciesToken public speciesToken;

    struct AnimalData {
        uint256 speciesId; // link to SpeciesToken id
        bytes32 metadataHash; // zk / off-chain data
        uint256 lastValuation; // 18 decimals, stablecoin units
        uint64 lastValuationTs;
        bool isCollateralised; // if locked for a loan
    }

    mapping(uint256 => AnimalData) public animals;
    uint256 public nextId;

    constructor(
        IKYCRegistry _kyc,
        SpeciesToken _speciesToken
    ) ERC721("AnimalPassport", "ANIMALPASS") {
        kyc = _kyc;
        speciesToken = _speciesToken;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
    }

    function mintPassport(
        address owner,
        uint256 speciesId,
        bytes32 metadataHash
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256 id) {
        require(kyc.isKYCed(owner), "OWNER_NOT_KYCED");
        id = ++nextId;
        _safeMint(owner, id);
        animals[id] = AnimalData({
            speciesId: speciesId,
            metadataHash: metadataHash,
            lastValuation: 0,
            lastValuationTs: 0,
            isCollateralised: false
        });

        // Optionally: auto-mint one unit of SpeciesToken to the owner
        // speciesToken.mint(owner, speciesId, ONE_UNIT(speciesId), "");
    }

    function updateValuation(
        uint256 id,
        uint256 newVal
    ) external onlyRole(REGISTRAR_ROLE) {
        animals[id].lastValuation = newVal;
        animals[id].lastValuationTs = uint64(block.timestamp);
    }

    function setCollateralStatus(
        uint256 id,
        bool locked
    ) external onlyRole(REGISTRAR_ROLE) {
        animals[id].isCollateralised = locked;
    }
}
