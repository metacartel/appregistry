const fs = require('fs');
const BigNumber = require('bignumber.js');
const { utils } = require('ethers');

const DaoToken = artifacts.require('DaoToken');
const TcrToken = artifacts.require('TCRToken');
const BootstrapList = artifacts.require('BootstrapList');
const Moloch = artifacts.require('Moloch');
const Registry = artifacts.require('Registry');
const TCR = artifacts.require('TCR');
const CONF = require('./conf.json');

module.exports = (deployer, network, accounts) => {
    const creator = accounts[0];

    deployer.then(async () => {
        // DAO Token, controlled by dao member "shares"
        // In real-life, daoToken would be wrapped ETH
        const daoToken = await deployer.deploy(
            DaoToken,
            'DaoToken',
            'DAOT',
            CONF.TCR_TOKEN_DECIMALS,
            creator
        );

        // Mint tokens -> creator
        const initialSupply = utils.parseUnits('420000000', 18); // 420 MM
        await daoToken.mint(creator, initialSupply);

        // Bootstrap TCR w/ listings
        const bootstrapList = await deployer.deploy(BootstrapList);

        // Metacartel DAO
        const moloch = await deployer.deploy(
            Moloch,
            creator,
            daoToken.address,
            CONF.PERIOD_DURATION,
            CONF.VOTING_PERIOD_LENGTH,
            CONF.GRACE_PERIOD_LENGTH,
            CONF.ABORT_WINDOW,
            utils.parseUnits(CONF.PROPOSAL_DEPOSIT.toString(), 18).toString(),
            CONF.DILUTION_BOUND,
            utils.parseUnits(CONF.PROCESSING_REWARD.toString(), 18).toString(),
            { gas: 7000000 }
        );

        // Acts as a broker for initializing the TCR
        // Applies to the DAO, gets membership, ragequits, seeds the TCR with those funds
        const registry = await deployer.deploy(
            Registry,
            moloch.address,
            daoToken.address,
            bootstrapList.address,
            CONF.TCR_VOTING_DURATION_SECS,
            CONF.TCR_REVEAL_DURATION_SECS,
            CONF.TCR_TOKEN_NAME,
            CONF.TCR_TOKEN_SYMBOL,
            CONF.TCR_TOKEN_DECIMALS
        );

        // TCR w/ token value determined by bonding curve
        const tcr = await deployer.deploy(
            TCR,
            registry.address,
            CONF.TCR_VOTING_DURATION_SECS,
            CONF.TCR_REVEAL_DURATION_SECS,
            bootstrapList.address
        );

        // TCR Token
        const tcrToken = await deployer.deploy(
            TcrToken,
            CONF.TCR_TOKEN_NAME,
            CONF.TCR_TOKEN_SYMBOL,
            CONF.TCR_TOKEN_DECIMALS,
            tcr.address
        );

        const output = {
            moloch: moloch.address,
            daoToken: daoToken.address,
            boostrapList: bootstrapList.address,
            registry: registry.address,
            tcrToken: tcrToken.address,
            tcr: tcr.address,
            votingDuration: CONF.TCR_VOTING_DURATION_SECS,
            revealDuration: CONF.TCR_REVEAL_DURATION_SECS,
            tokenName: CONF.TCR_TOKEN_NAME,
            tokenSymbol: CONF.TCR_TOKEN_SYMBOL,
            tokenDecimals: CONF.TCR_TOKEN_DECIMALS,
            creator: accounts[0],
            alice: accounts[1],
            bob: accounts[2],
        };

        fs.writeFileSync('./output.json', JSON.stringify(output));
        console.log(output);

        // const shares = '1';

        // const rageQuitTx = await registry.ragequit(shares);
        // console.log('rageQuitTx:', rageQuitTx);

        // const initTx = await registry.start(token.address);
        // console.log('initTx:', initTx);
    });
};
