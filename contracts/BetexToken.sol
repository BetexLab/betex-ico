pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/ownership/NoOwner.sol";
import "zeppelin-solidity/contracts/token/ERC20/StandardToken.sol";


/**
 * @title BetexToken
 */
contract BetexToken is StandardToken, NoOwner {

    string public constant name = "Betex Token"; // solium-disable-line uppercase
    string public constant symbol = "BETEX"; // solium-disable-line uppercase
    uint8 public constant decimals = 18; // solium-disable-line uppercase

    // transfer unlock time (except team and broker recipients)
    uint256 public firstUnlockTime;

    // transfer unlock time for the team and broker recipients
    uint256 public secondUnlockTime; 

    // addresses locked till second unlock time
    mapping (address => bool) public blockedTillSecondUnlock;

    // token holders
    address[] public holders;

    // holder number
    mapping (address => uint256) public holderNumber;

    // ICO address
    address public icoAddress;

    // supply constants
    uint256 public constant TOTAL_SUPPLY = 10000000 * (10 ** uint256(decimals));
    uint256 public constant SALE_SUPPLY = 5000000 * (10 ** uint256(decimals));

    // funds supply constants
    uint256 public constant BOUNTY_SUPPLY = 200000 * (10 ** uint256(decimals));
    uint256 public constant RESERVE_SUPPLY = 800000 * (10 ** uint256(decimals));
    uint256 public constant BROKER_RESERVE_SUPPLY = 1000000 * (10 ** uint256(decimals));
    uint256 public constant TEAM_SUPPLY = 3000000 * (10 ** uint256(decimals));

    // funds addresses constants
    address public constant BOUNTY_ADDRESS = 0x48c15e5A9343E3220cdD8127620AE286A204448a;
    address public constant RESERVE_ADDRESS = 0xC8fE659AaeF73b6e41DEe427c989150e3eDAf57D;
    address public constant BROKER_RESERVE_ADDRESS = 0x8697d46171aBCaD2dC5A4061b8C35f909a402417;
    address public constant TEAM_ADDRESS = 0x1761988F02C75E7c3432fa31d179cad6C5843F24;

    // min tokens to be a holder, 0.1
    uint256 public constant MIN_HOLDER_TOKENS = 10 ** uint256(decimals - 1);
    
    /**
     * @dev Constructor
     * @param _firstUnlockTime first unlock time
     * @param _secondUnlockTime second unlock time
     */
    function BetexToken
    (
        uint256 _firstUnlockTime, 
        uint256 _secondUnlockTime
    )
        public 
    {        
        require(_secondUnlockTime > firstUnlockTime);

        firstUnlockTime = _firstUnlockTime;
        secondUnlockTime = _secondUnlockTime;

        // Allocate tokens to the bounty fund
        balances[BOUNTY_ADDRESS] = BOUNTY_SUPPLY;
        holders.push(BOUNTY_ADDRESS);
        emit Transfer(0x0, BOUNTY_ADDRESS, BOUNTY_SUPPLY);

        // Allocate tokens to the reserve fund
        balances[RESERVE_ADDRESS] = RESERVE_SUPPLY;
        holders.push(RESERVE_ADDRESS);
        emit Transfer(0x0, RESERVE_ADDRESS, RESERVE_SUPPLY);

        // Allocate tokens to the broker reserve fund
        balances[BROKER_RESERVE_ADDRESS] = BROKER_RESERVE_SUPPLY;
        holders.push(BROKER_RESERVE_ADDRESS);
        emit Transfer(0x0, BROKER_RESERVE_ADDRESS, BROKER_RESERVE_SUPPLY);

        // Allocate tokens to the team fund
        balances[TEAM_ADDRESS] = TEAM_SUPPLY;
        holders.push(TEAM_ADDRESS);
        emit Transfer(0x0, TEAM_ADDRESS, TEAM_SUPPLY);

        totalSupply_ = TOTAL_SUPPLY.sub(SALE_SUPPLY);
    }

    /**
     * @dev set ICO address and allocate sale supply to it
     */
    function setICO(address _icoAddress) public onlyOwner {
        require(_icoAddress != address(0));
        require(icoAddress == address(0));
        require(totalSupply_ == TOTAL_SUPPLY.sub(SALE_SUPPLY));
        
        // Allocate tokens to the ico contract
        balances[_icoAddress] = SALE_SUPPLY;
        emit Transfer(0x0, _icoAddress, SALE_SUPPLY);

        icoAddress = _icoAddress;
        totalSupply_ = TOTAL_SUPPLY;
    }
    
    // standard transfer function with timelocks
    function transfer(address _to, uint256 _value) public returns (bool) {
        require(transferAllowed(msg.sender));
        enforceSecondLock(msg.sender, _to);
        preserveHolders(msg.sender, _to, _value);
        return super.transfer(_to, _value);
    }

    // standard transferFrom function with timelocks
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(transferAllowed(msg.sender));
        enforceSecondLock(msg.sender, _to);
        preserveHolders(_from, _to, _value);
        return super.transferFrom(_from, _to, _value);
    }

    // get holders count
    function getHoldersCount() public view returns (uint256) {
        return holders.length;
    }

    // enforce second lock on receiver
    function enforceSecondLock(address _from, address _to) internal {
        if (now < secondUnlockTime) { // solium-disable-line security/no-block-members
            if (_from == TEAM_ADDRESS || _from == BROKER_RESERVE_ADDRESS) {
                require(balances[_to] == uint256(0) || blockedTillSecondUnlock[_to]);
                blockedTillSecondUnlock[_to] = true;
            }
        }
    }

    // preserve holders list
    function preserveHolders(address _from, address _to, uint256 _value) internal {
        if (balances[_from].sub(_value) < MIN_HOLDER_TOKENS) 
            removeHolder(_from);
        if (balances[_to].add(_value) >= MIN_HOLDER_TOKENS) 
            addHolder(_to);   
    }

    // remove holder from the holders list
    function removeHolder(address _holder) internal {
        uint256 _number = holderNumber[_holder];

        if (_number == 0 || holders.length == 0 || _number > holders.length)
            return;

        uint256 _index = _number.sub(1);
        uint256 _lastIndex = holders.length.sub(1);
        address _lastHolder = holders[_lastIndex];

        if (_index != _lastIndex) {
            holders[_index] = _lastHolder;
            holderNumber[_lastHolder] = _number;
        }

        holderNumber[_holder] = 0;
        holders.length = _lastIndex;
    } 

    // add holder to the holders list
    function addHolder(address _holder) internal {
        if (holderNumber[_holder] == 0) {
            holders.push(_holder);
            holderNumber[_holder] = holders.length;
        }
    }

    // @return true if transfer operation is allowed
    function transferAllowed(address _sender) internal view returns(bool) {
        if (now > secondUnlockTime || _sender == icoAddress) // solium-disable-line security/no-block-members
            return true;
        if (now < firstUnlockTime) // solium-disable-line security/no-block-members
            return false;
        if (blockedTillSecondUnlock[_sender])
            return false;
        return true;
    }

}
