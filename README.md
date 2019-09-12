# MetaCartel Application Registry

Welcome to the MetaCartel App Registry.  The app registry is a token curated registry of Ethereum apps curated by the MetaCartel community.

Use Truffle to compile and test (test/tcr.js) contract

## Contracts

There are three contracts :
1. Registry contract
2. TCR contract
3. Bootstrap List contract

### Registry Contract
The Registry contract is the contract that applies for membership to the DAO. Once accepted in to the DAO, anyone can call the `ragequit` function to seed the contract with grant funds.

*Status : The contract needs to be audited and lacks proper unit tests.*

### TCR contract
The TCR contract is the heart of the app registry. It uses a commit/reveal scheme to add/remove ENS entries in to the registry. It uses a bonding curve to buy/sell TCR tokens.

*Status : bonding curve needs to be implemented. The contract needs to be audited and lacks proper unit tests.*

### Bootstrap List contract
The Bootstrap List contract holds a list of addresses that will have TCR Tokens airdropped once the TCR is started. The addresses in this bootstrap list is incomplete and needs to be vetted prior to deployment with the latest snapshot of members.

*Status : The contract needs to be audited and lacks proper unit tests.*

## TODO

1. The TCR bonding curve needs to be implemented buying/selling TCR tokens.
2. Unit tests need to verify failure scenarios and edge cases.
3. Bootstrap list needs to be finalized with snapshot of members that will be airdropped tokens.
4. The Registry contract that is used to apply for DAO membership needs to be tested with MetaCartel DAO contract implementation.
5. Contracts need to be audited.