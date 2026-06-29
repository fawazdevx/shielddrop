export const shieldDropFactoryAbi = [
  {
    type: "function",
    name: "createCampaign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "campaignUri", type: "string" },
      { name: "claimStart", type: "uint64" },
      { name: "claimEnd", type: "uint64" },
      { name: "tokenOpsOperator", type: "address" }
    ],
    outputs: [{ name: "campaign", type: "address" }]
  },
  {
    type: "event",
    name: "CampaignCreated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "campaign", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "campaignUri", type: "string", indexed: false }
    ]
  }
] as const;

export const shieldDropCampaignAbi = [
  {
    type: "function",
    name: "addRecipient",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "addRecipients",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "encryptedAmounts", type: "bytes32[]" },
      { name: "inputProof", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    name: "allocationOf",
    stateMutability: "view",
    inputs: [{ name: "recipient", type: "address" }],
    outputs: [{ name: "handle", type: "bytes32" }]
  },
  {
    type: "function",
    name: "campaignSummary",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "creator", type: "address" },
      { name: "token", type: "address" },
      { name: "claimStart", type: "uint64" },
      { name: "claimEnd", type: "uint64" },
      { name: "recipientCount", type: "uint256" },
      { name: "claimedCount", type: "uint256" },
      { name: "isPaused", type: "bool" },
      { name: "uri", type: "string" }
    ]
  },
  {
    type: "event",
    name: "RecipientRegistered",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "encryptedAllocation", type: "bytes32", indexed: false }
    ]
  },
  {
    type: "event",
    name: "AllocationClaimed",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "encryptedAllocation", type: "bytes32", indexed: false }
    ]
  }
] as const;

export const wrapperRegistryAbi = [
  {
    type: "function",
    name: "getConfidentialTokenAddress",
    stateMutability: "view",
    inputs: [{ name: "tokenAddress", type: "address" }],
    outputs: [
      { name: "isValid", type: "bool" },
      { name: "confidentialToken", type: "address" }
    ]
  },
  {
    type: "function",
    name: "getTokenConfidentialTokenPairsLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "length", type: "uint256" }]
  },
  {
    type: "function",
    name: "getTokenConfidentialTokenPair",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      {
        name: "pair",
        type: "tuple",
        components: [
          { name: "tokenAddress", type: "address" },
          { name: "confidentialTokenAddress", type: "address" },
          { name: "isValid", type: "bool" }
        ]
      }
    ]
  }
] as const;
