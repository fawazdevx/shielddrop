export const ZAMA_SEPOLIA = {
  chainId: 11155111,
  wrappersRegistry: "0x2f0750Bbb0A246059d80e94c454586a7F27a128e",
  wrappers: [
    {
      name: "Confidential USDC (Mock)",
      symbol: "cUSDCMock",
      confidentialToken: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
      underlyingToken: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF",
      publicMint: true,
      decimals: 6
    },
    {
      name: "Confidential USDT (Mock)",
      symbol: "cUSDTMock",
      confidentialToken: "0x4E7B06D78965594eB5EF5414c357ca21E1554491",
      underlyingToken: "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0",
      publicMint: true,
      decimals: 6
    },
    {
      name: "Confidential WETH (Mock)",
      symbol: "cWETHMock",
      confidentialToken: "0x46208622DA27d91db4f0393733C8BA082ed83158",
      underlyingToken: "0xff54739b16576FA5402F211D0b938469Ab9A5f3F",
      publicMint: true,
      decimals: 6
    },
    {
      name: "Confidential BRON (Mock)",
      symbol: "cBRONMock",
      confidentialToken: "0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891",
      underlyingToken: "0xFf021fB13cA64e5354c62c954b949a88cfDEb25E",
      publicMint: true,
      decimals: 6
    },
    {
      name: "Confidential ZAMA (Mock)",
      symbol: "cZAMAMock",
      confidentialToken: "0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB",
      underlyingToken: "0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57",
      publicMint: true,
      decimals: 6
    },
    {
      name: "Confidential tGBP (Mock)",
      symbol: "ctGBPMock",
      confidentialToken: "0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC",
      underlyingToken: "0x93c931278A2aad1916783F952f94276eA5111442",
      publicMint: true,
      decimals: 6
    },
    {
      name: "Confidential XAUt (Mock)",
      symbol: "cXAUtMock",
      confidentialToken: "0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7",
      underlyingToken: "0x24377AE4AA0C45ecEe71225007f17c5D423dd940",
      publicMint: true,
      decimals: 6
    },
    {
      name: "Confidential tGBP",
      symbol: "ctGBP",
      confidentialToken: "0x167DC962808B32CFFFc7e14B5018c0bE06A3A208",
      underlyingToken: "0xf6Ef9ADB61A48E29E36bc873070A46A3D2667ff3",
      publicMint: false,
      decimals: 6
    }
  ]
} as const;

export type ZamaWrapper = (typeof ZAMA_SEPOLIA.wrappers)[number];
