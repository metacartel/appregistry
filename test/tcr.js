const tcrAddress = "0x63b5c7A53AfCc7e2a884B72E64B7532c271AA499";

const owner = "0x7554b09f032bbcc33a2269129189a90afdd0c0dc";
const bootstrapList = "0x61D13c7DEB3A93c4F5b65eba7e0EBc1BD6A14Fe4";


const TCR = artifacts.require("TCR.sol");
const ERC20Detailed = artifacts.require("ERC20Detailed.sol");
const BootstrapList = artifacts.require("BootstrapList.sol");

const votingDurationSecs = 60;
const revealDurationSecs = 60;
const name = "TCRToken";
const symbol = "TCR";
const decimals = 18;

const members = [
    "0x0ABa55c93cF7292f71067B0Ba0D8b464592895cA",
    "0x0EaBFFD8cE94ab2387fC44Ba32642aF0c58Af433",
    "0x2566190503393b80bdEd55228C61A175f40E4D42"
]

const ens = "metacartel.eth";
const details = "bootstrap ballot";


const HttpProvider = require(`ethjs-provider-http`)
const EthRPC = require(`ethjs-rpc`)
const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'))
const Web3 = require(`web3`);
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));


async function moveForwardSecs(secs) {
    await ethRPC.sendAsync({
      jsonrpc:'2.0', method: `evm_increaseTime`,
      params: [secs],
      id: 0
    }, (err)=> {`error increasing time`});
    const start = Date.now();
    while (Date.now() < start + 300) {}
    await ethRPC.sendAsync({method: `evm_mine`}, (err)=> {});
    while (Date.now() < start + 300) {}
    return true
  }

contract("TCR", accounts => {
    it('verify deployment parameters', async () => {
        const tcr = await TCR.at(tcrAddress);
        const _owner = await tcr.owner();
        const _votingDurationSecs = await tcr.votingDurationSecs();
        const _revealDurationSecs = await tcr.votingDurationSecs();
        const _name = await tcr.name();
        const _symbol = await tcr.symbol();
        const _decimals = await tcr.decimals();
        const _bootstrapList = await tcr.bootstrapList();
        const _startDate = await tcr.startDate();
        const _ready = await tcr.ready();
        const _memberIndex = await tcr.memberIndex();
        const _currentBallotIndex = await tcr.currentBallotIndex();

        assert.equal(_owner.toLowerCase(), owner.toLowerCase(), "owner addresses do not match");
        assert.equal(_votingDurationSecs, votingDurationSecs, "votingDurationSecs does not match");
        assert.equal(_revealDurationSecs, revealDurationSecs, "revealDurationSecs does not match");
        assert.equal(_name, name, "name does not match");
        assert.equal(_symbol, symbol, "symbol does not match");
        assert.equal(_decimals, decimals, "decimals does not match");
        assert.equal(_bootstrapList.toLowerCase(), bootstrapList.toLowerCase(), "bootstrapList does not match");
        assert.equal(_decimals, decimals, "decimals does not match");
        
        if (_memberIndex == 0) {
            assert.equal(_currentBallotIndex, 0, "currentBallotIndex should be zero");
        } else {
            assert.notEqual(_currentBallotIndex, 0, "currentBallotIndex should NOT be zero");
        }
        
        if (_startDate == 0) {
            assert.equal(_memberIndex, 0, "memberIndex should not be zero");
            assert.equal(_ready, false, "tcr should be in ready state");
        }
    });

    it('start TCR', async () => {
        const tcr = await TCR.at(tcrAddress);
        const startDate = await tcr.startDate();

        if (startDate == 0) {
            await tcr.start();
        } else {
            const newStartDate = await tcr.startDate();
            assert.notEqual(newStartDate, 0, "start date should not be zero");
        }
        
        const ready = await tcr.ready();

        const ballotQueue = await tcr.ballotQueue(0);
        const tallyQueue = await tcr.tallyQueue(0);
        const pollQueue = await tcr.pollQueue(0);
        const memberIndex = await tcr.memberIndex();
        const newStartDate = await tcr.startDate();
        assert.notEqual(newStartDate, 0, "startdate should not be zero");

        if (memberIndex != 0) {
            assert.equal(memberIndex, members.length, "member number is not same");
            assert.equal(ready, true, "TCR should be ready");
        } else {
            assert.equal(ready, false, "TCR should not be ready");
        }
        

        // ballot
        assert.equal(ballotQueue.action, 1, "ballot action should be 1");
        assert.equal(ballotQueue.applicant.toLowerCase(), tcrAddress.toLowerCase(), "applicant is not owner");
        assert.equal(ballotQueue.ens, ens, "ens does not match");
        assert.equal(ballotQueue.deposit, 1, "ballot amount does not match");
        if (memberIndex == 0) {
            assert.equal(ballotQueue.processed, false, "ballot should not be processed");
        } else {
            assert.equal(ballotQueue.processed, true, "ballot should be processed");
        }
        assert.equal(ballotQueue.details, "bootstrap ballot", "bootstrap ballot does not match");

        // tally
        assert.equal(tallyQueue.yesVotes, 1, "yes votes should be 1");
        assert.equal(tallyQueue.noVotes, 0, "no votes shoule be 0");
        assert.equal(tallyQueue.unrevealedAmountTotal, 0, "unrevealedAmountTotal should be 0");

        // poll
        assert.notEqual(pollQueue.startTime, 0, "poll start time should not be zero");
        assert.notEqual(pollQueue.endTime, 0, "poll end time should not be zero");
        assert.notEqual(pollQueue.revealEndTime, 0, "poll reveal time should not be zero");
    });

    it('bootstrap TCR', async () => {
        const tcr = await TCR.at(tcrAddress);
        const memberIndex = await tcr.memberIndex();
        const bootstrapAddress = await tcr.bootstrapList();
        const bootstrapList = await BootstrapList.at(bootstrapAddress);
        const members = await bootstrapList.members();

        if (memberIndex == 0) {
            await tcr.bootstrap(members.length);
        }

        for (let x = 0; x < members.length; x++) {
            assert.equal(members[x], members[x], "member does not match");
        }

        const newReady = await tcr.ready();
        assert.equal(newReady, true, "ready should be true");
        
        const startDate = await tcr.startDate();
        assert.notEqual(startDate, 0, "start date should not be zero");
    });

    it('process ballot', async () => {
        const tcr = await TCR.at(tcrAddress);
        const votingDurationSecs = await tcr.votingDurationSecs();
        await moveForwardSecs(votingDurationSecs.toNumber());

        const currentBallotIndex = await tcr.currentBallotIndex();
        const ballotQueueLength = await tcr.ballotQueueLength();

        if (ballotQueueLength.toNumber() != currentBallotIndex.toNumber()) {
            const ballotQueue = await tcr.ballotQueue(currentBallotIndex);
            const pollQueue = await tcr.pollQueue(currentBallotIndex);

            assert.equal(ballotQueue.processed, false, "ballot should not be processed");
            assert.notEqual(pollQueue.startTime, 0, "tally start time should not be zero");
            await tcr.processBallot();
        }
    });   
    
    it('claim ballot', async () => {
        const tcr = await TCR.at(tcrAddress);
        const claimed = await tcr.didClaim(0, owner);
        if (claimed == false) {
            await tcr.claim(0);
        }
    });

    it('submit - add/remove', async () => {
        const tcr = await TCR.at(tcrAddress);
        tcr.buy(1);

        const tokenAddress = await tcr.token();
        const token = await ERC20Detailed.at(tokenAddress);
        await token.approve(tcrAddress, 100000);
        
        const entry = await tcr.tcr("testing.eth");

        let action = 1;

        if (entry.valid == true) {
            action = 2;
        }

        await tcr.submit(action, "testing.eth", 1, "details");

        const votingDurationSecs = await tcr.votingDurationSecs();
        const revealDurationSecs = await tcr.revealDurationSecs();
        await moveForwardSecs(votingDurationSecs.toNumber() + revealDurationSecs.toNumber() + 1);
        await tcr.processBallot();
    });

    it('submit - commit/reveal', async () => {
        const tcr = await TCR.at(tcrAddress);
        tcr.buy(1);

        const tokenAddress = await tcr.token();
        const token = await ERC20Detailed.at(tokenAddress);
        await token.approve(tcrAddress, 100000);

        const currentBallotIndex = await tcr.currentBallotIndex();
        const index = currentBallotIndex.toNumber();
        const randomEnsEntry =  "test-" + Math.random().toString() + ".eth";

        // SUBMIT
        await tcr.submit(1,randomEnsEntry, 1, "testing commit/reveal");

        // COMMIT
        await tcr.buy(1, {from: accounts[1]});
        await token.approve(tcrAddress, 100000, {from: accounts[1]});

        let signature = await web3.eth.sign("2", accounts[1]);
        const sig = signature.substr(2);
        const r = '0x' + sig.slice(0, 64)
        const s = '0x' + sig.slice(64, 128)
        const raw_v = '0x' + sig.slice(128, 130)
        let v = web3.utils.toDecimal(raw_v)
        if(v != 27 || v != 28) {
          v += 27
        }

        await tcr.commit(1, v, r, s, {from:accounts[1]});

        // fast forward to reveal phase
        const votingDurationSecs = await tcr.votingDurationSecs();
        await moveForwardSecs(votingDurationSecs.toNumber() + 1);

        // REVEAL
        await tcr.reveal("2", {from:accounts[1]});
        const revealDurationSecs = await tcr.revealDurationSecs();
        await moveForwardSecs(revealDurationSecs.toNumber() + 1);

        // PROCESS BALLOT
        await tcr.processBallot();

        // VERIFY ENS ENTRY
        const ensConfirmation = await tcr.tcr(randomEnsEntry);
        assert.equal(ensConfirmation.valid, true, "ENS entry not found");
    });

});
