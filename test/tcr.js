const { providers, utils } = require('ethers');

const DaoToken = artifacts.require('DaoToken.sol');
const Moloch = artifacts.require('Moloch.sol');
const BootstrapList = artifacts.require('BootstrapList.sol');
const Registry = artifacts.require('Registry.sol');
const TCR = artifacts.require('TCR.sol');
const TcrToken = artifacts.require('TCRToken.sol');

const votingDurationSecs = 60;
const revealDurationSecs = 60;

const bootstrapList = [
    '0x0ABa55c93cF7292f71067B0Ba0D8b464592895cA',
    '0x0EaBFFD8cE94ab2387fC44Ba32642aF0c58Af433',
    '0x2566190503393b80bdEd55228C61A175f40E4D42',
];

const entry = 'metacartel.eth';
const details = 'bootstrap ballot';

const provider = new providers.JsonRpcProvider('http://localhost:8545');

const timings = {
    ONE_PERIOD: 60,
    FOUR_PERIODS: 60 * 4,
    FIVE_PERIODS: 60 * 5,
};

async function moveForwardSecs(secs) {
    await provider.send('evm_increaseTime', [secs]);
    await provider.send('evm_mine', []);
    return true;
}

async function evmSnapshot() {
    return provider.send('evm_snapshot');
}

async function evmRevert(snapshotID) {
    await provider.send('evm_revert', [snapshotID]);
}

function logBaseUnits(name, baseUnits) {
    console.log(name, utils.formatUnits(baseUnits.toString(), 18));
}

function logEvent(name, res) {
    if (res.logs && res.logs.length) {
        console.log(name, res.logs[0].args);
    }
}

contract('TCR', ([creator, alice, bob]) => {
    let daoToken, dao, registry, tcr, tcrToken, snapshotId;

    beforeEach(async () => {
        daoToken = await DaoToken.deployed();
        dao = await Moloch.deployed();
        registry = await Registry.deployed();
        tcr = await TCR.deployed();
        tcrToken = await TcrToken.deployed();

        snapshotId = await evmSnapshot();
        // NOTE: these don't show up in the console with `truffle test --show-events` :(
        // await registry.ragequit();
        // await registry.start();
    });

    afterEach(async () => evmRevert(snapshotId));

    async function setupDaoMembership() {
        // Setup creator (proposer) for `transferFrom`
        const creatorBalance = await daoToken.balanceOf(creator);
        logBaseUnits('creator balance', creatorBalance);
        await daoToken.approve(dao.address, creatorBalance);

        // Proposal values
        // const tokenTribute = utils.parseUnits('10', 18);
        const tokenTribute = '333';
        const sharesRequested = '1';

        // Setup applicants (alice and registry) for `transferFrom`
        await daoToken.transfer(alice, tokenTribute);
        await daoToken.approve(dao.address, creatorBalance, { from: alice });
        await daoToken.transfer(registry.address, tokenTribute);
        // (registry's token approval happens in its constructor)

        // Applicant: Alice
        await dao.submitProposal(alice, tokenTribute, sharesRequested, details);

        // Process first proposal
        await moveForwardSecs(timings.FIVE_PERIODS);
        await dao.processProposal(0);

        const mem1 = await dao.members(alice);
        assert(mem1.exists, true, 'alice should have been added as a dao member');
        assert(mem1.delegateKey, alice, 'incorrect delegate key (alice)');
        assert(mem1.shares.toString(), sharesRequested, 'alice has the wrong amount of shares');

        // Applicant: Registry
        await dao.submitProposal(registry.address, tokenTribute, sharesRequested, details);

        // Process second proposal
        await moveForwardSecs(timings.FIVE_PERIODS);
        await dao.processProposal(1);

        const mem2 = await dao.members(registry.address);
        assert(mem2.exists, true, 'registry should have been added as a dao member');
        assert(mem2.delegateKey, registry.address, 'incorrect delegate key (registry)');
        assert(mem2.shares.toString(), sharesRequested, 'registry has the wrong amount of shares');
    }

    async function initTcr(shares) {
        const balR1 = await daoToken.balanceOf(registry.address);
        logBaseUnits('registry balance', balR1);
        const rq = await registry.ragequit(tcr.address, shares);
        logEvent('reg.ragequit', rq);
        const st = await registry.start(tcrToken.address);
        logEvent('reg.start', st);
        const bs = await tcr.bootstrap(bootstrapList.length);
        logEvent('tcr.bootstrap', bs);
    }

    // const balC1 = await daoToken.balanceOf(creator);
    // const balA1 = await daoToken.balanceOf(alice);
    // const balR1 = await daoToken.balanceOf(registry.address);
    // logBaseUnits('creator balance', balC1);
    // logBaseUnits('alice balance', balA1);
    // logBaseUnits('registry balance', balR1);

    it('verify dao membership setup', async () => {
        await setupDaoMembership();
        const totalSharesRequested = await dao.totalSharesRequested();
        assert(totalSharesRequested.toString(), '2', 'wrong number of total shares requested');

        const proposalQueueLength = await dao.getProposalQueueLength();
        assert(proposalQueueLength.toString(), '2', 'wrong length of proposal queue');
    });

    it('initialize Registry and TCR', async () => {
        await setupDaoMembership();
        const shares = '1';
        await initTcr(shares);
    });

    it('verify deployment parameters', async () => {
        const _owner = await tcr.owner();
        const _votingDurationSecs = await tcr.votingDurationSecs();
        const _revealDurationSecs = await tcr.votingDurationSecs();
        const _bootstrapList = await tcr.bootstrapList();
        const _startDate = await tcr.startDate();
        const _ready = await tcr.ready();
        const _memberIndex = await tcr.memberIndex();
        const _currentBallotIndex = await tcr.currentBallotIndex();
        const tcrOwner = Registry.address;
        assert.equal(_owner.toLowerCase(), tcrOwner.toLowerCase(), 'owner addresses do not match');
        assert.equal(_votingDurationSecs, votingDurationSecs, 'votingDurationSecs does not match');
        assert.equal(_revealDurationSecs, revealDurationSecs, 'revealDurationSecs does not match');
        assert.equal(_bootstrapList, BootstrapList.address, 'bootstrapList does not match');
        if (_memberIndex == 0) {
            assert.equal(_currentBallotIndex, 0, 'currentBallotIndex should be zero');
        } else {
            assert.notEqual(_currentBallotIndex, 0, 'currentBallotIndex should NOT be zero');
        }
        if (_startDate == 0) {
            assert.equal(_memberIndex, 0, 'memberIndex should not be zero');
            assert.equal(_ready, false, 'tcr should be in ready state');
        }
    });

    it('start TCR', async () => {
        await setupDaoMembership();
        const shares = '1';
        await initTcr(shares);

        const startDate = await tcr.startDate();

        if (startDate == 0) {
            const registry = await Registry.deployed();
            const shares = '1000000000000000000';
            await registry.ragequit(tcr.address, shares);
            await registry.start(daoToken.address);
        } else {
            const newStartDate = await tcr.startDate();
            assert.notEqual(newStartDate, 0, 'start date should not be zero');
        }

        const ready = await tcr.ready();

        const bootstrapBallot = await tcr.ballotQueue(0);
        const initialTally = await tcr.tallyQueue(0);
        const initialPoll = await tcr.pollQueue(0);
        const memberIndex = (await tcr.memberIndex()).toNumber();
        const newStartDate = await tcr.startDate();
        assert.notEqual(newStartDate.toNumber(), 0, 'startdate should not be zero');

        if (memberIndex != 0) {
            assert.equal(memberIndex, bootstrapList.length, 'member number is not same');
            assert.equal(ready, true, 'TCR should be ready');
        } else {
            assert.equal(ready, false, 'TCR should not be ready');
        }

        // ballot
        assert.equal(bootstrapBallot.action, 1, 'ballot action should be 1');
        assert.equal(
            bootstrapBallot.applicant.toLowerCase(),
            tcr.address.toLowerCase(),
            'applicant is not owner'
        );
        assert.equal(bootstrapBallot.entry, entry, 'entry does not match');
        assert.equal(bootstrapBallot.deposit, 1, 'ballot amount does not match');
        if (memberIndex == 0) {
            assert.equal(bootstrapBallot.processed, false, 'ballot should not be processed');
        } else {
            assert.equal(bootstrapBallot.processed, true, 'ballot should be processed');
        }
        assert.equal(
            bootstrapBallot.details,
            'bootstrap ballot',
            'bootstrap ballot does not match'
        );

        // tally
        assert.equal(initialTally.yesVotes, 1, 'yes votes should be 1');
        assert.equal(initialTally.noVotes, 0, 'no votes shoule be 0');
        assert.equal(initialTally.unrevealedAmountTotal, 0, 'unrevealedAmountTotal should be 0');

        // poll
        assert.notEqual(initialPoll.startTime, 0, 'poll start time should not be zero');
        assert.notEqual(initialPoll.endTime, 0, 'poll end time should not be zero');
        assert.notEqual(initialPoll.revealEndTime, 0, 'poll reveal time should not be zero');
    });

    it('bootstrap TCR', async () => {
        await setupDaoMembership();
        const shares = '1';
        await initTcr(shares);

        const memberIndex = await tcr.memberIndex();
        const bootstrapAddress = await tcr.bootstrapList();
        const bootstrapList = await BootstrapList.at(bootstrapAddress);
        const members = await bootstrapList.members();

        if (memberIndex == 0) {
            await tcr.bootstrap(members.length);
        }

        for (let x = 0; x < members.length; x++) {
            assert.equal(members[x], members[x], 'member does not match');
        }

        const newReady = await tcr.ready();
        assert.equal(newReady, true, 'ready should be true');

        const startDate = await tcr.startDate();
        assert.notEqual(startDate, 0, 'start date should not be zero');
    });

    it('process ballot', async () => {
        const votingDurationSecs = await tcr.votingDurationSecs();
        await moveForwardSecs(votingDurationSecs.toNumber());

        const currentBallotIndex = await tcr.currentBallotIndex();
        const ballotQueueLength = await tcr.ballotQueueLength();

        if (ballotQueueLength.toNumber() != currentBallotIndex.toNumber()) {
            const ballotQueue = await tcr.ballotQueue(currentBallotIndex);
            const pollQueue = await tcr.pollQueue(currentBallotIndex);

            assert.equal(ballotQueue.processed, false, 'ballot should not be processed');
            assert.notEqual(pollQueue.startTime, 0, 'tally start time should not be zero');
            await tcr.processBallot();
        }
    });

    it('claim ballot', async () => {
        await setupDaoMembership();
        const shares = '1';
        await initTcr(shares);

        const claimed = await tcr.didClaim(0, creator);
        const ballot = await tcr.ballotQueue(0);
        if (ballot.processed === true && claimed === false) {
            await tcr.claim(0);
        }
    });

    it('submit - add/remove', async () => {
        await setupDaoMembership();
        const shares = '1';
        await initTcr(shares);

        tcr.buy(1);

        const tokenAddress = await tcr.token();
        const token = await DaoToken.at(tokenAddress);
        await token.approve(tcr.address, 100000);

        const entry = await tcr.tcr('testing.eth');

        let action = 1;

        if (entry.valid == true) {
            action = 2;
        }

        await tcr.submit(action, 'testing.eth', 1, 'details', creator);

        const votingDurationSecs = await tcr.votingDurationSecs();
        const revealDurationSecs = await tcr.revealDurationSecs();
        await moveForwardSecs(votingDurationSecs.toNumber() + revealDurationSecs.toNumber() + 1);
        await tcr.processBallot();
    });

    it('submit - commit/reveal', async () => {
        tcr.buy(1);

        const tokenAddress = await tcr.token();
        const token = await DaoToken.at(tokenAddress);
        await token.approve(tcr.address, 100000);

        const currentBallotIndex = await tcr.currentBallotIndex();
        assert.strictEqual(currentBallotIndex.toNumber(), 1, 'wrong number of ballots in queue');

        const randomEnsEntry = 'test-' + Math.random().toString() + '.eth';

        // SUBMIT
        await tcr.submit(1, randomEnsEntry, 1, 'testing commit/reveal', creator);

        // COMMIT
        await tcr.buy(1, { from: alice });
        await token.approve(tcr.address, 100000, { from: alice });

        let signature = await web3.eth.sign('2', alice);
        const sig = signature.substr(2);
        const r = '0x' + sig.slice(0, 64);
        const s = '0x' + sig.slice(64, 128);
        const raw_v = '0x' + sig.slice(128, 130);
        let v = web3.utils.toDecimal(raw_v);
        if (v != 27 || v != 28) {
            v += 27;
        }

        await tcr.commit(1, v, r, s, { from: alice });

        // fast forward to reveal phase
        const votingDurationSecs = await tcr.votingDurationSecs();
        await moveForwardSecs(votingDurationSecs.toNumber() + 1);

        // REVEAL
        await tcr.reveal('2', { from: alice });
        const revealDurationSecs = await tcr.revealDurationSecs();
        await moveForwardSecs(revealDurationSecs.toNumber() + 1);

        await moveForwardSecs(timings.FIVE_PERIODS * 2);
        // PROCESS BALLOT
        await tcr.processBallot();

        // VERIFY ENS ENTRY
        const ensConfirmation = await tcr.tcr(randomEnsEntry);
        assert.equal(ensConfirmation.valid, true, 'ENS entry not found');
    });
});
