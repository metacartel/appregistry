pragma solidity >0.5.6 <0.6.0;

import "./IERC20.sol";
import "./TCR.sol";

contract Registry {
    /****************
     GLOBAL CONSTANTS
     ****************/
    address public grantor; // the DAO providing the grant
    IERC20 public approvedToken; // token approved by the DAO
    TCR public tcrContract; // tcr contract reference
    uint public shares; // shares given by DAO
    uint public proposalIndex; // the DAO proposal index funding the initiative
    uint public votingDurationSecs; // duration in secs for voting
    uint public revealDurationSecs; // duration in secs to reveal votes
    address public bootstrapList; // members to bootstrap in to the tcr

    bool public didRagequit; // track rage quit status
    bool public didStart; // track TCR start

    string public name; // tcr token name
    string public symbol; // tcr token symbol
    uint8 public decimals; // number of decimals for the token

    uint fundingTotal; // funding total including DAO grant

    /******
     EVENTS
     ******/
    event Deployed(
        address grantor,
        address approvedToken,
        address bootstrapList,
        uint votingDurationSecs,
        uint revealDurationSecs,
        string name,
        string symbol,
        uint8 decimals
    );
    event Ragequit(
        address grantor,
        uint shares,
        uint amount
    );

    event TCRStart(
        address tcrContract,
        string name,
        string symbol,
        uint8 decimals,
        address bootstrapList
    );

    constructor(
        address _grantor,
        address _approvedToken,
        address _bootstrapList,
        uint _votingDurationSecs,
        uint _revealDurationSecs,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public {
        require(_grantor != address(0), "grantor can not be 0");
        require(_approvedToken != address(0), "approvedToken cannot be 0");
        require(_bootstrapList != address(0), "bootstrapList can not be 0");
        require(_votingDurationSecs > 0, "votingDurationSecs must be greater than 0");
        require(_revealDurationSecs > 0, "revealDurationSecs must be greater than 0");
        require(keccak256(abi.encodePacked((_name))) != keccak256(abi.encodePacked((""))), "name can not be empty");
        require(keccak256(abi.encodePacked((_symbol))) != keccak256(abi.encodePacked((""))), "symbol can not be empty");
        require(_decimals > 0, "decimals can not be zero");

        grantor = _grantor;
        approvedToken = IERC20(_approvedToken);
        bootstrapList = _bootstrapList;
        votingDurationSecs = _votingDurationSecs;
        revealDurationSecs = _revealDurationSecs;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;

        // emit Deployed(grantor, address(approvedToken), bootstrapList, votingDurationSecs, revealDurationSecs, name, symbol, decimals);
    }

    // submit grant for registry. get accepted into moloch
    // apply for members in moloch b4 registry bc summoner only has 1 share
    // summoner needs to submit proposals, otherwise guild bank doesnt have funds
    // summoner is the deployer. you need at least 1 share to vote.
    // member of dao must nominate new member
    // funds that 1 member puts into moloch can be sent to registry via ragequit

    // Moloch.ragequit requires cooldown period
    // anyone can send funds during this time, perhaps fuckin up the bonding curve
    // dao grant forcibly increased w/ WETH sent to TCR
    function ragequit(uint _shares) public returns(bool) {
        require(didRagequit == false, "can only ragequit once");
        require(_shares > 0, "shares must be greater than zero");

        uint balanceBeforeRagequit = approvedToken.balanceOf(address(this));
        grantor.call(abi.encodeWithSignature("ragequit(uint)", _shares));
        fundingTotal = approvedToken.balanceOf(address(this));

        require(fundingTotal > balanceBeforeRagequit, "token balance did not increase after ragequit");
        require(approvedToken.transfer(address(tcrContract), fundingTotal), "grant transfer to TCR failed");

        shares = _shares;
        didRagequit = true;

        // emit Ragequit(grantor, shares, fundingTotal);
        return didRagequit;
    }

    function start(address _token) public returns (bool) {
        require(didStart == false, "TCR already started");
        require(didRagequit == true, "need to ragequit before starting TCR");

        tcrContract.start(_token);
        didStart = true;

        // emit TCRStart(address(tcrContract), name, symbol, decimals, bootstrapList);
        return didStart;
    }
}