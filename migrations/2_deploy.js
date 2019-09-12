const fs = require('fs')
const BigNumber = require('bignumber.js')

const SimpleToken = artifacts.require("SimpleToken");
const BootstrapList = artifacts.require("BootstrapList");
const Moloch = artifacts.require("Moloch");
const Registry = artifacts.require("Registry");

const CONF = require('./conf.json');

module.exports = (deployer, network, accounts) => {
    deployer.then(async () => {
        const simpleToken  = await deployer.deploy(SimpleToken);
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
            { gas: 6000000 }
        );

        const output = {
            moloch: moloch.address,
            approvedToken: simpleToken.address,
            boostrapList: bootstrapList.address,
            votingDuration: CONF.TCR_VOTING_DURATION_SECS,
            revealDuration: CONF.TCR_REVEAL_DURATION_SECS,
            tokenName: CONF.TCR_TOKEN_NAME,
            tokenSymbol: CONF.TCR_TOKEN_SYMBOL,
            tokenDecimals: CONF.TCR_TOKEN_DECIMALS
        }

        fs.writeFileSync('./output.json', JSON.stringify(output));
        
        // console.log(output);
        
        // const registry = await deployer.deploy(
        //     Registry,
        //     // moloch.address,
        //     // simpleToken.address,
        //     // bootstrapList.address,
        //     // CONF.TCR_VOTING_DURATION_SECS,
        //     // CONF.TCR_REVEAL_DURATION_SECS,
        //     // CONF.TCR_TOKEN_NAME,
        //     // CONF.TCR_TOKEN_SYMBOL,
        //     // CONF.TCR_TOKEN_DECIMALS,
        //     "0xC3e84f91d6bDeCAe376c17aaDcffCed19DC91Ec0",
        //     "0x6ea761067e787D43e0e82D2eb4b98c1e6899e4C3",
        //     "0x195A95671444D895261aA3DC9F9b9B95c648bB61",
        //     "60",
        //     "60",
        //     "TCRTOKEN",
        //     "TCR",
        //     "18",
        //     { gas: 6000000 }
        // );
    });
};
