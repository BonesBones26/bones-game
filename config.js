window.BONES_CONFIG = {
  projectName: "BONES",
  ticker: "BONES",
  network: {
    name: "Robinhood Chain",
    chainId: 4663,
    chainIdHex: "0x1237",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    explorerUrl: "https://robinhoodchain.blockscout.com"
  },
  contracts: {
    bones: "TBA_AFTER_LAUNCH",
    wishbone: "0x77581054581B9c525E7dd7a0155DE43867532d03",
    skiBase: "0x768BE13e1680b5ebE0024C42c896E3dB59ec0149",
    airdrop: "TBA_AFTER_SNAPSHOT",
    founderVesting: "TBA_AFTER_LAUNCH"
  },
  wallets: {
    deployer: "0xe57D9bEd1D83BA599bC374a59BAd8DD7f31763E0",
    creatorRevenue: "0xBe0e91aA47Dfb17b3dd9Ab5CC0fe4518676B8F08",
    communityTreasury: "0x33640b51826CCcDCca5354bC980ABA80D6B61B0a",
    founderVesting: "TBA_AFTER_LAUNCH"
  },
  links: {
    ponsCreate: "https://www.ponsfamily.com/launchpad/create",
    ponsToken: "#",
    ponsDocs: "https://docs.ponsfamily.com/",
    twitter: "#",
    telegram: "#"
  },
  policy: {
    totalSupply: "1,000,000,000",
    creatorInitialTargetPercent: 5,
    creatorInitialTargetBones: "50,000,000",
    initialTarget: {
      founderVesting: { percent: 3, bones: "30,000,000" },
      wishboneAirdrop: { percent: 1, bones: "10,000,000" },
      skiAirdrop: { percent: 0.5, bones: "5,000,000" },
      playerRewards: { percent: 0.5, bones: "5,000,000" }
    },
    creatorFees: {
      founder: 40,
      wishbonePurchases: 40,
      operations: 20
    },
    vesting: {
      cliffDays: 90,
      monthlyReleases: 12
    }
  },
  dashboard: {
    status: "PRE-LAUNCH",
    creatorPurchase: "TBA",
    creatorFeesClaimed: "0",
    wishboneTreasury: "0",
    bonesActivity: "0"
  }
};
