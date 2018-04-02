pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/HasNoContracts.sol";
import "zeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "./BetexToken.sol";
import "./usingOraclize.sol";
import "./BetexStorage.sol";


/**
 * @title BetexICO
 */
contract BetexICO is usingOraclize, HasNoContracts {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    // Betex token
    BetexToken public token;

    // Betex storage
    BetexStorage public betexStorage;

    // ico start timestamp
    uint256 public startTime;

    // bonus change timestamp  
    uint256 public bonusChangeTime;

    // ico end timestamp
    uint256 public endTime;

    // wallet address to trasfer funding to
    address public wallet;

    // tokens sold
    uint256 public sold;

    // wei raised
    uint256 public raised;

    // unsold tokens amount
    uint256 public unsoldTokensAmount;

    // how many tokens are sold before unsold allocation started
    uint256 public soldBeforeUnsoldAllocation;

    // counter for funders, who got unsold tokens allocated
    uint256 public unsoldAllocationCount;

    // are preICO tokens allocated
    bool public preICOTokensAllocated;

    // is unsold tokens allocation scheduled
    bool public unsoldAllocatonScheduled;

    // eth/usd rate url
    string public ethRateURL = "json(https://api.coinmarketcap.com/v1/ticker/ethereum/).0.price_usd";

    // oraclize gas limit
    uint256 public oraclizeGasLimit = 200000;

    // unsold tokens allocation oraclize gas limit
    uint256 public unsoldAllocationOraclizeGasLimit = 2500000;

    // three hours delay (from the ico end time) for unsold tokens allocation
    uint256 public unsoldAllocationDelay = 10800;

    // addresses authorized to refill the contract (for oraclize queries)
    mapping (address => bool) public refillers;

    // minimum funding amount
    uint256 public constant MIN_FUNDING_AMOUNT = 0.5 ether;

    // rate exponent
    uint256 public constant RATE_EXPONENT = 4;

    // token price, usd
    uint256 public constant TOKEN_PRICE = 3;

    // size of unsold tokens allocation bunch
    uint256 public constant UNSOLD_ALLOCATION_SIZE = 50; 

    // unsold allocation exponent
    uint256 public constant UNSOLD_ALLOCATION_EXPONENT = 10;

    /**
     * event for add to whitelist logging
     * @param funder funder address
     */
    event WhitelistAddEvent(address indexed funder);

    /**
     * event for funding order logging
     * @param funder funder who has done the order
     * @param orderId oraclize orderId
     * @param funds paid wei amount
     */
    event OrderEvent(address indexed funder, bytes32 indexed orderId, uint256 funds);

    /**
     * event for token purchase logging
     * @param funder funder who paid for the tokens
     * @param orderId oraclize orderId
     * @param tokens amount of tokens purchased
     */
    event TokenPurchaseEvent(address indexed funder, bytes32 indexed orderId, uint256 tokens);

    /**
     * event for unsold tokens allocation logging
     * @param funder funder token holders
     * @param tokens amount of tokens purchased
     */
    event UnsoldTokensAllocationEvent(address indexed funder, uint256 tokens);


    /**
     * @dev Constructor
     * @param _startTime start time timestamp
     * @param _bonusChangeTime bonus change timestamp
     * @param _endTime end time timestamp
     * @param _wallet wallet address to transfer funding to
     * @param _token Betex token address
     * @param _betexStorage BetexStorage contract address
     */
    function BetexICO (
        uint256 _startTime,
        uint256 _bonusChangeTime,
        uint256 _endTime,
        address _wallet, 
        address _token,
        address _betexStorage
    ) 
        public 
        payable
    {
        require(_startTime < _endTime);
        require(_bonusChangeTime > _startTime && _bonusChangeTime < _endTime);

        require(_wallet != address(0));
        require(_token != address(0));
        require(_betexStorage != address(0));

        startTime = _startTime;
        bonusChangeTime = _bonusChangeTime;
        endTime = _endTime;
        wallet = _wallet;

        token = BetexToken(_token);
        betexStorage = BetexStorage(_betexStorage);
    }

    // fallback function, used to buy tokens and refill the contract for oraclize
    function () public payable {
        address _sender = msg.sender;
        uint256 _funds = msg.value;

        if (betexStorage.isWhitelisted(_sender)) {
            buyTokens(_sender, _funds);
        } else if (!refillers[_sender] && !(owner == _sender)) {
            revert();
        }
    }

    /**
     * @dev Get current rate from oraclize and transfer tokens or start unsold tokens allocation
     * @param _orderId oraclize order id
     * @param _result current eth/usd rate
     */
    function __callback(bytes32 _orderId, string _result) public {  // solium-disable-line mixedcase
        require(msg.sender == oraclize_cbAddress());

        // check if it's an order for aftersale token allocation
        if (betexStorage.unsoldAllocationOrders(_orderId)) {
            if (!allUnsoldTokensAllocated()) {
                allocateUnsoldTokens();
                if (!allUnsoldTokensAllocated()) {
                    bytes32 orderId = oraclize_query("URL", ethRateURL, unsoldAllocationOraclizeGasLimit);
                    betexStorage.addUnsoldAllocationOrder(orderId);
                }
            }
        } else {
            uint256 _rate = parseInt(_result, RATE_EXPONENT);

            address _beneficiary;
            uint256 _funds;
            uint256 _bonus;

            (_beneficiary, _funds, _bonus) = betexStorage.getOrder(_orderId);

            uint256 _sum = _funds.mul(_rate).div(10 ** RATE_EXPONENT);
            uint256 _tokens = _sum.div(TOKEN_PRICE);

            uint256 _bonusTokens = _tokens.mul(_bonus).div(100);
            _tokens = _tokens.add(_bonusTokens);

            if (sold.add(_tokens) > token.SALE_SUPPLY()) {
                _tokens = token.SALE_SUPPLY().sub(sold);
            }

            betexStorage.setRateForOrder(_orderId, _rate);

            token.transfer(_beneficiary, _tokens);
            sold = sold.add(_tokens);
            emit TokenPurchaseEvent(_beneficiary, _orderId, _tokens);
        }
    }

    // schedule unsold tokens allocation using oraclize
    function scheduleUnsoldAllocation() public {
        require(!unsoldAllocatonScheduled);

        // query for unsold tokens allocation with delay from the ico end time
        bytes32 _orderId = oraclize_query(endTime.add(unsoldAllocationDelay), "URL", ethRateURL, unsoldAllocationOraclizeGasLimit); // solium-disable-line arg-overflow
        betexStorage.addUnsoldAllocationOrder(_orderId); 

        unsoldAllocatonScheduled = true;
    }

    /**
     * @dev Allocate unsold tokens (for bunch of funders)
     */
    function allocateUnsoldTokens() public {
        require(now > endTime.add(unsoldAllocationDelay)); // solium-disable-line security/no-block-members
        require(!allUnsoldTokensAllocated());

        // save unsold and sold amounts
        if (unsoldAllocationCount == 0) {
            unsoldTokensAmount = token.SALE_SUPPLY().sub(sold);
            soldBeforeUnsoldAllocation = sold;
        }

        for (uint256 i = 0; i < UNSOLD_ALLOCATION_SIZE && !allUnsoldTokensAllocated(); i = i.add(1)) {
            address _funder = betexStorage.funders(unsoldAllocationCount);
            uint256 _funderTokens = token.balanceOf(_funder);

            if (_funderTokens != 0) {
                uint256 _share = _funderTokens.mul(10 ** UNSOLD_ALLOCATION_EXPONENT).div(soldBeforeUnsoldAllocation);
                uint256 _tokensToAllocate = unsoldTokensAmount.mul(_share).div(10 ** UNSOLD_ALLOCATION_EXPONENT);

                token.transfer(_funder, _tokensToAllocate); 
                emit UnsoldTokensAllocationEvent(_funder, _tokensToAllocate);
                sold = sold.add(_tokensToAllocate);
            }

            unsoldAllocationCount = unsoldAllocationCount.add(1);
        }

        if (allUnsoldTokensAllocated()) {
            if (sold < token.SALE_SUPPLY()) {
                uint256 _change = token.SALE_SUPPLY().sub(sold);
                address _reserveAddress = token.RESERVE_ADDRESS();
                token.transfer(_reserveAddress, _change);
                sold = sold.add(_change);
            }
        }           
    }

    // allocate preICO tokens
    function allocatePreICOTokens() public {
        require(!preICOTokensAllocated);

        for (uint256 i = 0; i < betexStorage.getPreICOFundersCount(); i++) {
            address _funder = betexStorage.preICOFunders(i);
            uint256 _tokens = betexStorage.preICOBalances(_funder);

            token.transfer(_funder, _tokens);
            sold = sold.add(_tokens);

            betexStorage.addFunder(_funder);
        }
        
        preICOTokensAllocated = true;
    }

    /**
     * @dev Whitelist funder's address
     * @param _funder funder's address
     */
    function addToWhitelist(address _funder) onlyOwner public {
        require(_funder != address(0));
        betexStorage.addToWhitelist(_funder);

        emit WhitelistAddEvent(_funder);
    }

    /**
     * @dev Set oraclize gas limit
     * @param _gasLimit a new oraclize gas limit
     */
    function setOraclizeGasLimit(uint256 _gasLimit) onlyOwner public {
        require(_gasLimit > 0);
        oraclizeGasLimit = _gasLimit;
    }

    /**
     * @dev Set oraclize gas price
     * @param _gasPrice a new oraclize gas price
     */
    function setOraclizeGasPrice(uint256 _gasPrice) onlyOwner public {
        require(_gasPrice > 0);
        oraclize_setCustomGasPrice(_gasPrice);
    }

    /**
     * @dev Add a refiller
     * @param _refiller address that authorized to refill the contract
     */
    function addRefiller(address _refiller) onlyOwner public {
        require(_refiller != address(0));
        refillers[_refiller] = true;
    }

    /**
     * @dev Withdraw ether from contract
     * @param _amount amount to withdraw
     */
    function withdrawEther(uint256 _amount) onlyOwner public {
        require(address(this).balance >= _amount);
        owner.transfer(_amount);
    }

    /**
     * @dev Makes order for tokens purchase
     * @param _funder funder who paid for the tokens
     * @param _funds amount of the funds
     */
    function buyTokens(address _funder, uint256 _funds) internal {
        require(liveBetexICO());
        require(_funds >= MIN_FUNDING_AMOUNT);
        require(oraclize_getPrice("URL") <= address(this).balance);
        
        bytes32 _orderId = oraclize_query("URL", ethRateURL, oraclizeGasLimit);
        uint256 _bonus = betexStorage.getBonus(_funds, bonusChangeTime);
        betexStorage.addOrder(_orderId, _funder, _funds, _bonus); // solium-disable-line arg-overflow

        wallet.transfer(_funds);
        raised = raised.add(_funds);

        betexStorage.addFunder(_funder);

        emit OrderEvent(_funder, _orderId, _funds);
    }

    // @return true if all unsold tokens are allocated
    function allUnsoldTokensAllocated() internal view returns (bool) {
        return unsoldAllocationCount == betexStorage.getFundersCount();
    }

    // @return true if the ICO is alive
    function liveBetexICO() internal view returns (bool) {
        return now >= startTime && now <= endTime && sold < token.SALE_SUPPLY(); // solium-disable-line security/no-block-members
    }
    
}
