const HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = process.env.MNEMONIC || '';
const infuraId = process.env.INFURA_PROJECT_ID || '';

module.exports = {
    /**
     * Networks define how you connect to your ethereum client and let you set the
     * defaults web3 uses to send transactions. If you don't specify one truffle
     * will spin up a development blockchain for you on port 9545 when you
     * run `develop` or `test`. You can ask a truffle command to use a specific
     * network from the command line, e.g
     *
     * $ truffle test --network <network-name>
     */
    networks: {
        // Useful for testing. The `development` name is special - truffle uses it by default
        // if it's defined here and no other network is specified at the command line.
        // You should run a client (like ganache-cli, geth or parity) in a separate terminal
        // tab if you use this network and you must also set the `host`, `port` and `network_id`
        // options below to some value.
        //
        development: {
            host: '127.0.0.1', // Localhost (default: none)
            port: 8545, // Standard Ethereum port (default: none)
            network_id: 420, // Any network (default: none)
            gas: 7000000, // 7 MM
        },
        ganache: {
            host: '127.0.0.1',
            port: 7545,
            network_id: 5777,
        },
        mainnet: {
            provider: () =>
                new HDWalletProvider(mnemonic, `https://mainnet.infura.io/v3/${infuraId}`),
            network_id: 1,
            gas: 7000000, // 7 MM
            gasPrice: 10e9, // 10 Gwei
            confirmations: 2, // # of confs to wait between deployments. (default: 0)
            timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
        },
        rinkeby: {
            // TODO: check for valid `infuraId`?
            provider: () =>
                new HDWalletProvider(mnemonic, `https://rinkeby.infura.io/v3/${infuraId}`),
            network_id: 4,
            gas: 7000000, // 7 MM
            gasPrice: 10e9, // 10 Gwei
            confirmations: 2, // # of confs to wait between deployments. (default: 0)
            timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
            // skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
        },
    },
    mocha: {
        // timeout: 100000
    },
    compilers: {
        solc: {
            version: '0.5.11', // Fetch exact version from solc-bin (default: truffle's version)
            // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
            settings: {
                // See the solidity docs for advice about optimization and evmVersion
                optimizer: {
                    enabled: true,
                    runs: 200,
                },
                //  evmVersion: "byzantium"
            },
        },
    },
};
