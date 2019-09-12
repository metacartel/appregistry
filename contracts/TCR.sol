pragma solidity >0.5.6 <0.6.0;

    import "./BootstrapList.sol";
    import "./ERC20Detailed.sol";
    import "./SafeMath.sol";

    contract TCR {
        using SafeMath for uint256;
        /****************
         GLOBAL CONSTANTS
         ****************/
        address public owner;               // Registry contract
        string public name;                 // TCR token name
        string public symbol;               // TCR token symbol
        uint8 public decimals;              // TCR token decimals
        BootstrapList public bootstrapList; // distribution list used
        address[] public bootstrapMembers;  // initial members
        ERC20Detailed public token;         // TCR token
        uint public startDate;              // start date of the TCR
        bool public ready;                  // true only after all tokens have been airdropped
        uint public votingDurationSecs;     // poll time length in secs
        uint public revealDurationSecs;     // reveal time length in secs
        uint public memberIndex;            // tracks bootstrap airdop process
        uint public currentBallotIndex;     // tracks current ballot

        uint public debugPollEndTime;
        uint public debugNow;

        /******
         EVENTS
         ******/
        event Deployed(
            address owner,
            uint votingDurationSecs,
            uint revealDurationSecs,
            string name,
            string symbol,
            uint8 decimals,
            address bootstrapList
        );

        event Started(
            uint startDate
        );

        event Bootstrap(
            uint processCount,
            uint previousIndex,
            uint updatedIndex,
            bool ready
        );

        event Buy(
            address buyer,
            uint amount,
            uint price
        );

        event Sell(
            address seller,
            uint amount,
            uint price
        );

        event Submit(
            BallotType action,
            string entry,
            uint amount,
            string details,
            uint currentPollId,
            uint pollId
        );

        event Commit(
            address voter,
            uint amount,
            uint pollId
        );

        event Reveal(
            address voter,
            Vote vote,
            uint amount,
            uint pollId
        );

        event Processed(
            uint pollId
        );

        event Claim(
            address voter,
            uint pollId,
            uint amount
        );

        enum Vote {
            Null,   // default value, counted as abstention
            Yes,    // depending on action, can affirm/object adding/removing
            No      // entry from registry, a tie sides with affirmation
        }

        enum BallotType {
            Null,   // default value, counted as no action
            Add,    // add entry action
            Remove  // remove entry action
        }

        struct Submission {
            Vote vote;      // either Yes or No
            uint amount;    // amount deposited for vote
            uint8 v;        // signature v
            bytes32 r;      // signature r
            bytes32 s;      // signature s
            bool claimed;   // winning submission rewards should only be claimed once
        }

        struct Tally {
            uint yesVotes;              // number of yes votes
            uint noVotes;               // number of no votes
            uint unrevealedAmountTotal; // voters that did not reveal vote in time
        }

        struct Ballot {
            BallotType action;          // add or remove action
            address applicant;          // applicant submitting ballot
            string ens;                 // entry in to registry
            uint deposit;                // vote deposit
            bool processed;             // ballot should only be processed once
            string details;             // arbitrary details regarding ballot
            mapping (
                address => Submission
            ) votesByVoter;             // track voters
        }

        struct Poll {
            uint startTime;     // poll start time
            uint endTime;       // poll end time (also starts reveal period)
            uint revealEndTime; // poll reveal end time
        }

        struct Registry {
            address applicant;  // applicant that submitted entry
            bool valid;         // valid ens entry
            string details;     // arbitrary string data
        }

        Tally[] public tallyQueue;      // divided in to several
        Ballot[] public ballotQueue;    // queues to avoid
        Poll[] public pollQueue;        // stack too deep errors

        mapping (string => Registry) public tcr;   // TCR

        modifier onlyOwner {
            require(msg.sender == owner, "only owner can call this method");
            _;
        }

        modifier isReady {
            require(ready, "not ready");
            _;
        }

        constructor(
            address _owner,
            uint _votingDurationSecs,
            uint _revealDurationSecs,
            string memory _name,
            string memory _symbol,
            uint8 _decimals,
            address _bootstrapList
        ) public {
            require(_owner != address(0), "_owner can not be 0");
            require(_votingDurationSecs > 0, "_votingDurationSecs must be greater than 0");

            owner = _owner;
            votingDurationSecs = _votingDurationSecs;
            revealDurationSecs = _revealDurationSecs;
            name = _name;
            symbol = _symbol;
            decimals = _decimals;

            bootstrapList = BootstrapList(_bootstrapList);

            // launch TCR token contract
            token = new ERC20Detailed(name, symbol, decimals);
            require(token.mint(address(this), 1), "error in minting process");

            emit Deployed(owner, votingDurationSecs, revealDurationSecs, name, symbol, decimals, address(bootstrapList));
        }

        function start() public onlyOwner returns(bool) {
           require(startDate == 0, "TCR already started");
            string memory entry = bootstrapList.entry();

            // bootstrap ballot submission to avoid future bootstrap checks
            Ballot memory bootstrapBallot = Ballot(
                BallotType.Add,
                address(this),
                entry,
                1,
                false,
                "bootstrap ballot"
            );

            Tally memory bootstrapTally = Tally(
                1,
                0,
                0
            );

            Poll memory bootstrapPoll = Poll(
                now,
                now,
                now
            );

            Submission memory bootstrapSubmission = Submission(
                Vote.Yes,
                1,
                27,
                0x21b421d70b3be0506646b92001839c3b004a6025263e4431ccce57e27e2d0db0,
                0x305e31624e6947c4c507f879d18ef7d3f5a77f2fa6bc73bf5ed654842c44df3e,
                false
            );

            ballotQueue.push(bootstrapBallot);
            tallyQueue.push(bootstrapTally);
            pollQueue.push(bootstrapPoll);

            ballotQueue[0].votesByVoter[owner] = bootstrapSubmission;
            startDate = now;

            emit Started(startDate);

            return true;
        }

        function bootstrap(uint _numberOfMembersToBootstrap) public returns (uint index) {
            require(startDate > 0, "contract has not yet started");
            require(ready == false, "bootstrap process already complete");

            address[] memory members = bootstrapList.members();

            uint count;
            uint previousIndex = memberIndex;

            if (_numberOfMembersToBootstrap.add(memberIndex) > members.length) {
                count = members.length;
            } else {
                count = _numberOfMembersToBootstrap + memberIndex;
            }

            // mint and transfer tokens to members
            for (uint i = memberIndex; i < count; i++) {
                require(token.mint(members[i], 1), "error in minting process");
                bootstrapMembers.push(members[i]);
            }
            memberIndex = count;

            if(memberIndex == members.length) {
                ready = true;
            }

            emit Bootstrap(_numberOfMembersToBootstrap, previousIndex, count, ready);

            return count;
        }

        function buy(uint _buyAmount) public isReady {
            /*
            TODO : mint based on bonding curve
            */

            // TODO : REMOVE - testing function remove
            require(token.mint(msg.sender, _buyAmount), "error in minting process");


            uint price;

            emit Buy(msg.sender, _buyAmount, price);
        }

        function sell(uint _sellAmount) public isReady {
            /*
            TODO : burn based on bonding curve
            */
            uint price;

            emit Sell(msg.sender, _sellAmount, price);
        }

        function submit(
            BallotType _action,
            string  memory _ensSubmission,
            uint _submissionAmount,
            string memory _details
            )
            public isReady returns (uint) {

            uint startTime;
            uint endTime;
            uint revealEndTime;

            uint yesVote;
            uint noVote;

            require(_action == BallotType.Add || _action == BallotType.Remove,"invalid ballot action");
            if (_action == BallotType.Add) {
                require(tcr[_ensSubmission].valid == false, "submission already exists");
                yesVote = 1;
            }
            if (_action == BallotType.Remove) {
                require(tcr[_ensSubmission].valid == true, "submission does not exist");
                noVote = 1;
            }
            require(_submissionAmount > 0, "deposit error");
            require(token.transferFrom(msg.sender, address(this), _submissionAmount), "deposit token transfer failed when adding to registry");

            // set parameters to begin new poll immediately
            // if submission will be at the head of the queue
            if (currentBallotIndex == ballotQueue.length) {
                startTime = now;
                endTime = now.add(votingDurationSecs);
                revealEndTime = now.add(votingDurationSecs).add(revealDurationSecs);
            }

            Ballot memory newBallotAdd = Ballot(
                _action,
                msg.sender,
                _ensSubmission,
                _submissionAmount,
                false,
                _details
            );

            Tally memory newTallyAdd = Tally (
                yesVote,
                noVote,
                _submissionAmount
            );

            Poll memory newPollAdd = Poll(
                startTime,
                endTime,
                revealEndTime
            );

            ballotQueue.push(newBallotAdd);
            tallyQueue.push(newTallyAdd);
            pollQueue.push(newPollAdd);

            emit Submit(_action, _ensSubmission, _submissionAmount, _details, currentBallotIndex, ballotQueue.length.sub(1));

            return ballotQueue.length.sub(1);
        }

        function commit(uint _voteAmount, uint8 _v, bytes32 _r, bytes32 _s) public isReady returns (bool) {
            Ballot storage ballot = ballotQueue[currentBallotIndex];
            Tally storage tally = tallyQueue[currentBallotIndex];
            Poll storage poll = pollQueue[currentBallotIndex];

            require(ballot.deposit <= _voteAmount, "insufficient deposit amount");
            require(token.transferFrom(msg.sender, address(this), _voteAmount), "deposit token transfer failed");
            require(_v != uint8(0), "invalid v");
            require(_r != bytes32(0), "invalid r");
            require(_s != bytes32(0), "invalid s");
            require(poll.endTime > now, "poll no longer open");

            debugPollEndTime = poll.endTime;
            debugNow = now;

            Submission memory submission = Submission(
                Vote.Null,
                _voteAmount,
                _v,
                _r,
                _s,
                false
            );
            
            ballot.votesByVoter[msg.sender] = submission;
            tally.unrevealedAmountTotal = tally.unrevealedAmountTotal.add(_voteAmount);

            emit Commit(msg.sender, _voteAmount, currentBallotIndex);

            return true;
        }

        function reveal(string memory _vote) public isReady returns(bool) {
            Ballot storage ballot = ballotQueue[currentBallotIndex];
            Tally storage tally = tallyQueue[currentBallotIndex];
            Poll storage poll = pollQueue[currentBallotIndex];
            Submission storage submission = ballot.votesByVoter[msg.sender];
            // revealSubmission = submission;   // DEBUG ONLY

            address signer = verify(_vote, submission.v, submission.r, submission.s);

            require(poll.endTime < now && now < poll.revealEndTime, "poll not in reveal phase");
            require(submission.vote == Vote.Null, "vote already revealed");
            require(signer == msg.sender, "signature does not match");
            require(keccak256(abi.encode(_vote)) == keccak256(abi.encode("1")) || 
                keccak256(abi.encode(_vote)) == keccak256(abi.encode("2")), 
                "invalid vote"
            );

            if (keccak256(abi.encode(_vote)) == keccak256(abi.encode("1"))) {
                submission.vote = Vote.Yes;
                tally.yesVotes = tally.yesVotes.add(submission.amount);
            } else {
                submission.vote = Vote.No;
                tally.noVotes = tally.noVotes.add(submission.amount);
            }

            tally.unrevealedAmountTotal = tally.unrevealedAmountTotal.sub(submission.amount);
            // emit Reveal(msg.sender, submission.vote, submission.amount, currentBallotIndex);

            return true;
        }

        function processBallot() public isReady returns (bool) {
            Ballot storage currentBallot = ballotQueue[currentBallotIndex];
            Poll storage currentPoll = pollQueue[currentBallotIndex];
            Tally storage currentTally = tallyQueue[currentBallotIndex];

            require(currentBallot.action != BallotType.Null, "no ballot to process");
            require(currentPoll.startTime > 0 && now > currentPoll.revealEndTime, "ballot in progress");
            require(currentBallot.processed == false, "ballot already processed");

            currentBallot.processed = true;
            currentBallotIndex = currentBallotIndex.add(1);

            // TODO : tally votes and either add or remove from registry
            if (currentTally.yesVotes >= currentTally.noVotes) {
                if (currentBallot.action == BallotType.Add) {
                    Registry memory addToRegistry = Registry(
                        currentBallot.applicant,
                        true,
                        currentBallot.details
                    );
                    tcr[currentBallot.ens] = addToRegistry;
                }
                if (currentBallot.action == BallotType.Remove) {
                    Registry memory removeFromRegistry = Registry(
                        currentBallot.applicant,
                        false,
                        currentBallot.details
                    );
                    tcr[currentBallot.ens] = removeFromRegistry;
                }
            }

            emit Processed(currentBallotIndex);

            // start next ballot in queue
            if (currentBallotIndex < ballotQueue.length) {
                Poll memory startPoll = Poll(
                    now,
                    now.add(votingDurationSecs),
                    now.add(votingDurationSecs).add(revealDurationSecs)
                );
                pollQueue[currentBallotIndex] = startPoll;
            }
            return true;
        }

        function claim(uint _pollId) public isReady returns(bool) {
            Ballot storage claimBallot = ballotQueue[_pollId];
            Tally storage claimTally = tallyQueue[_pollId];
            require(claimBallot.processed == true, "poll has not yet been processed");
            require(claimBallot.votesByVoter[msg.sender].claimed != true, "already claimed");
            require(claimBallot.votesByVoter[msg.sender].amount > 0, "vote not registered");
            require(claimBallot.votesByVoter[msg.sender].vote == Vote.Yes ||
                    claimBallot.votesByVoter[msg.sender].vote == Vote.No, "failed to reveal");

            uint proportionalShare;

            if (claimTally.yesVotes >= claimTally.noVotes) {
                require(claimBallot.votesByVoter[msg.sender].vote == Vote.Yes, "Withdrawal is for winners but you voted no");
                if (claimTally.yesVotes >= claimTally.unrevealedAmountTotal) {
                    proportionalShare = claimTally.unrevealedAmountTotal.div(claimTally.yesVotes);
                } else {
                    proportionalShare = 0;
                }
            } else {
                require(claimBallot.votesByVoter[msg.sender].vote == Vote.No, "Withdrawal is for winners but you voted yes");
                if (claimTally.noVotes >= claimTally.unrevealedAmountTotal) {
                    proportionalShare = claimTally.unrevealedAmountTotal.div(claimTally.noVotes);
                } else {
                    proportionalShare = 0;
                }
            }

            uint claimTotal = claimBallot.votesByVoter[msg.sender].amount.add(proportionalShare);
            require(token.transfer(msg.sender, claimTotal), "claim transfer failed");

            claimBallot.votesByVoter[msg.sender].claimed = true;

            emit Claim(msg.sender, _pollId, claimTotal);

            return true;
        }

        function memberListLength() public view returns(uint) {
            return bootstrapMembers.length;
        }

        function ballotQueueLength() public view returns(uint) {
            return ballotQueue.length;
        }

        function didClaim(uint _pollId, address _voter) public view returns(bool) {
            return ballotQueue[_pollId].votesByVoter[_voter].claimed;
        }

        function verify(string memory _message, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address voter) {
            string memory header = "\x19Ethereum Signed Message:\n000000";

            uint256 lengthOffset;
            uint256 length;
            assembly {
                length := mload(_message)
                lengthOffset := add(header, 57)
            }
            require(length <= 999999);
            uint256 lengthLength = 0;
            uint256 divisor = 100000;

            while (divisor != 0) {
                uint256 digit = length / divisor;
                if (digit == 0) {
                    if (lengthLength == 0) {
                        divisor /= 10;
                        continue;
                    }
                }

                lengthLength++;
                length -= digit * divisor;
                divisor /= 10;
                digit += 0x30;
                lengthOffset++;

                assembly {
                    mstore8(lengthOffset, digit)
                }
            }

            if (lengthLength == 0) {
                lengthLength = 1 + 0x19 + 1;
            } else {
                lengthLength += 1 + 0x19;
            }
            assembly {
                mstore(header, lengthLength)
            }

            bytes32 check = keccak256(abi.encodePacked(header, _message));

            return ecrecover(check, _v, _r, _s);
        }
    }