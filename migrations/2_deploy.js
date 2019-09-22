const fs = require('fs');
const BigNumber = require('bignumber.js');

const SimpleToken = artifacts.require('ERC20');
const BootstrapList = artifacts.require('BootstrapList');
const Moloch = artifacts.require('Moloch');
const Registry = artifacts.require('Registry');
const TCR = artifacts.require('TCR');
const Token = artifacts.require('ERC20Detailed');
const CONF = require('./conf.json');

module.exports = (deployer, network, accounts) => {
    deployer.then(async () => {
        const simpleToken = await deployer.deploy(SimpleToken);
        const bootstrapList = await deployer.deploy(BootstrapList);

        const moloch = await deployer.deploy(
            Moloch,
            accounts[0],
            simpleToken.address,
            CONF.PERIOD_DURATION,
            CONF.VOTING_PERIOD_LENGTH,
            CONF.GRACE_PERIOD_LENGTH,
            CONF.ABORT_WINDOW,
            new BigNumber(CONF.PROPOSAL_DEPOSIT),
            CONF.DILUTION_BOUND,
            new BigNumber(CONF.PROCESSING_REWARD),
            { gas: 7000000 }
        );

        const registry = await deployer.deploy(
            Registry,
            moloch.address,
            simpleToken.address,
            bootstrapList.address,
            CONF.TCR_VOTING_DURATION_SECS,
            CONF.TCR_REVEAL_DURATION_SECS,
            CONF.TCR_TOKEN_NAME,
            CONF.TCR_TOKEN_SYMBOL,
            CONF.TCR_TOKEN_DECIMALS
        );

        const tcr = await deployer.deploy(
            TCR,
            registry.address,
            CONF.TCR_VOTING_DURATION_SECS,
            CONF.TCR_REVEAL_DURATION_SECS,
            bootstrapList.address
        );

        const token = await deployer.deploy(
            Token,
            CONF.TCR_TOKEN_NAME,
            CONF.TCR_TOKEN_SYMBOL,
            CONF.TCR_TOKEN_DECIMALS,
            tcr.address
        );

        const output = {
            moloch: moloch.address,
            approvedToken: simpleToken.address,
            boostrapList: bootstrapList.address,
            tcrToken: token.address,
            votingDuration: CONF.TCR_VOTING_DURATION_SECS,
            revealDuration: CONF.TCR_REVEAL_DURATION_SECS,
            tokenName: CONF.TCR_TOKEN_NAME,
            tokenSymbol: CONF.TCR_TOKEN_SYMBOL,
            tokenDecimals: CONF.TCR_TOKEN_DECIMALS,
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
