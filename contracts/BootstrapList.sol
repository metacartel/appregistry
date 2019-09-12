pragma solidity >0.5.6 <0.6.0;

contract BootstrapList {
    address[] private _members;
    string private _entry = "metacartel.eth";

    constructor() public {
        // on-chain verification of DAO _members
        _members.push(0x0ABa55c93cF7292f71067B0Ba0D8b464592895cA);
        _members.push(0x0EaBFFD8cE94ab2387fC44Ba32642aF0c58Af433);
        _members.push(0x2566190503393b80bdEd55228C61A175f40E4D42);
    }

    function members() public view returns(address[] memory) {
        return _members;
    }
    function entry() public view returns(string memory) {
        return _entry;
    }
}