// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice AI-fed price oracle for livestock species.
///  - price is in 8 decimals (USD * 1e8)
///  - reporters (AI bots) post prices
///  - guardian can "accept" a median price to anchor volatility
contract SpeciesOracle is AccessControl {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // Optional: canonical IDs for your main species
    uint256 public constant SPECIES_COW = 1;
    uint256 public constant SPECIES_PIG = 2;
    uint256 public constant SPECIES_GOAT = 3;
    uint256 public constant SPECIES_CHICKEN = 4;

    struct Observation {
        uint256 price; // 8 decimals, USD * 1e8
        uint64 timestamp; // unix seconds
        address reporter;
    }

    struct Config {
        uint64 heartbeat; // max allowed age of newest obs (seconds)
        uint256 maxDeviationBps; // max deviation vs lastAcceptedPrice (in bps)
        bool paused;
    }

    uint8 public constant RING = 5;

    mapping(uint256 => Observation[RING]) public obs;
    mapping(uint256 => uint8) public idx;
    mapping(uint256 => Config) public cfg;
    mapping(uint256 => uint256) public lastAcceptedPrice;

    event Report(uint256 indexed id, uint256 price, address reporter);
    event Paused(uint256 indexed id, bool paused);
    event Accepted(uint256 indexed id, uint256 price);
    event ConfigUpdated(
        uint256 indexed id,
        uint64 heartbeat,
        uint256 maxDeviationBps,
        bool paused
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);
    }

    function setConfig(
        uint256 id,
        uint64 heartbeat,
        uint256 maxDeviationBps,
        bool paused
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        cfg[id] = Config(heartbeat, maxDeviationBps, paused);
        emit ConfigUpdated(id, heartbeat, maxDeviationBps, paused);
        emit Paused(id, paused);
    }

    function grantReporter(address r) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(REPORTER_ROLE, r);
    }

    function postPrice(
        uint256 id,
        uint256 price
    ) external onlyRole(REPORTER_ROLE) {
        require(!cfg[id].paused, "PAUSED");
        uint8 i = idx[id];
        obs[id][i] = Observation(price, uint64(block.timestamp), msg.sender);
        idx[id] = (i + 1) % RING;
        emit Report(id, price, msg.sender);
    }

    function currentPrice(
        uint256 id
    ) public view returns (uint256 price, uint64 ts, bool valid) {
        uint256[] memory prices = new uint256[](RING);
        uint64 newest = 0;
        uint256 count;

        for (uint8 i = 0; i < RING; i++) {
            Observation memory o = obs[id][i];
            if (o.timestamp == 0) continue;
            prices[count++] = o.price;
            if (o.timestamp > newest) newest = o.timestamp;
        }

        // need at least 3 obs to take a median
        if (count < 3) return (0, newest, false);

        Config memory c = cfg[id];
        if (c.heartbeat == 0) return (0, newest, false);
        if (block.timestamp - newest > c.heartbeat) return (0, newest, false);

        _selectK(prices, count, (count - 1) / 2);
        uint256 med = prices[(count - 1) / 2];

        uint256 last = lastAcceptedPrice[id];
        if (last != 0) {
            uint256 diff = med > last ? med - last : last - med;
            // diff / last <= maxDeviationBps / 10_000
            if (diff * 10_000 > c.maxDeviationBps * last)
                return (last, newest, false);
        }

        return (med, newest, true);
    }

    function accept(uint256 id) external onlyRole(GUARDIAN_ROLE) {
        (uint256 p, , bool ok) = currentPrice(id);
        require(ok, "NOT_OK");
        lastAcceptedPrice[id] = p;
        emit Accepted(id, p);
    }

    // in-place quickselect on first n elements
    function _selectK(uint256[] memory a, uint256 n, uint256 k) internal pure {
        uint256 l = 0;
        uint256 r = n - 1;
        while (l < r) {
            uint256 x = a[k];
            uint256 i = l;
            uint256 j = r;
            while (i <= j) {
                while (a[i] < x) i++;
                while (x < a[j]) j--;
                if (i <= j) {
                    (a[i], a[j]) = (a[j], a[i]);
                    i++;
                    if (j > 0) j--;
                }
            }
            if (j < k) l = i;
            if (k < i) r = j;
        }
    }
}
