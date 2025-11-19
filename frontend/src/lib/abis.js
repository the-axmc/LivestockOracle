export const kycRegistryAbi = [
    {
        type: "function",
        name: "setKYCStatus",
        stateMutability: "nonpayable",
        inputs: [
            { name: "user", type: "address" },
            { name: "kyc_", type: "bool" }
        ],
        outputs: []
    },
    {
        type: "function",
        name: "setUserRoles",
        stateMutability: "nonpayable",
        inputs: [
            { name: "user", type: "address" },
            { name: "borrower", type: "bool" },
            { name: "bank", type: "bool" },
            { name: "coop", type: "bool" },
            { name: "oracleBot", type: "bool" },
            { name: "grantor", type: "bool" }
        ],
        outputs: []
    },
    {
        type: "function",
        name: "getFlags",
        stateMutability: "view",
        inputs: [{ name: "user", type: "address" }],
        outputs: [
            { name: "kyc", type: "bool" },
            { name: "borrower", type: "bool" },
            { name: "bank", type: "bool" },
            { name: "coop", type: "bool" },
            { name: "oracleBot", type: "bool" },
            { name: "grantor", type: "bool" }
        ]
    }
];
export const animalPassportAbi = [
    {
        type: "function",
        name: "mintPassport",
        stateMutability: "nonpayable",
        inputs: [
            { name: "owner", type: "address" },
            { name: "speciesId", type: "uint256" },
            { name: "metadataHash", type: "bytes32" }
        ],
        outputs: [{ name: "id", type: "uint256" }]
    }
];
export const cooperativeAttestorAbi = [
    {
        type: "function",
        name: "setMembership",
        stateMutability: "nonpayable",
        inputs: [
            { name: "farmer", type: "address" },
            { name: "active", type: "bool" },
            { name: "deliveries6m", type: "uint64" },
            { name: "goodStanding", type: "bool" },
            { name: "rating", type: "uint8" }
        ],
        outputs: []
    }
];
export const grantVoucherAbi = [
    {
        type: "function",
        name: "mintVoucher",
        stateMutability: "nonpayable",
        inputs: [
            { name: "beneficiary", type: "address" },
            { name: "notionalAmount", type: "uint256" },
            { name: "expectedPayoutDate", type: "uint64" },
            { name: "grantRef", type: "bytes32" }
        ],
        outputs: [{ name: "tokenId", type: "uint256" }]
    },
    {
        type: "function",
        name: "getVoucher",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [
            {
                name: "data",
                type: "tuple",
                components: [
                    { name: "grantor", type: "address" },
                    { name: "beneficiary", type: "address" },
                    { name: "notionalAmount", type: "uint256" },
                    { name: "expectedPayoutDate", type: "uint64" },
                    { name: "grantRef", type: "bytes32" },
                    { name: "status", type: "uint8" }
                ]
            }
        ]
    }
];
export const speciesLendingAbi = [
    {
        type: "function",
        name: "deposit",
        stateMutability: "nonpayable",
        inputs: [
            { name: "speciesId", type: "uint256" },
            { name: "amount", type: "uint256" }
        ],
        outputs: []
    },
    {
        type: "function",
        name: "borrowable",
        stateMutability: "view",
        inputs: [{ name: "user", type: "address" }],
        outputs: [{ name: "amount", type: "uint256" }]
    },
    {
        type: "function",
        name: "borrow",
        stateMutability: "nonpayable",
        inputs: [{ name: "amount", type: "uint256" }],
        outputs: []
    },
    {
        type: "function",
        name: "health",
        stateMutability: "view",
        inputs: [{ name: "user", type: "address" }],
        outputs: [{ name: "factor", type: "uint256" }]
    }
];
export const guaranteePoolAbi = [
    {
        type: "function",
        name: "depositGrant",
        stateMutability: "nonpayable",
        inputs: [{ name: "amount", type: "uint256" }],
        outputs: []
    }
];
export const speciesTokenAbi = [
    {
        type: "function",
        name: "setSpeciesInfo",
        stateMutability: "nonpayable",
        inputs: [
            { name: "id", type: "uint256" },
            { name: "name_", type: "string" },
            { name: "unitDecimals", type: "uint8" },
            { name: "mintPaused", type: "bool" }
        ],
        outputs: []
    }
];
export const speciesOracleAbi = [
    {
        type: "function",
        name: "postPriceWithScore",
        stateMutability: "nonpayable",
        inputs: [
            { name: "id", type: "uint256" },
            { name: "price", type: "uint256" },
            { name: "score", type: "uint256" }
        ],
        outputs: []
    }
];
