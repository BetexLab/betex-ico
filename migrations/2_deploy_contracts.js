const timestamp = require("unix-timestamp");
const BetexStorage = artifacts.require("BetexStorage.sol");

const BetexToken = artifacts.require("BetexToken.sol");
const BetexICO = artifacts.require("BetexICO.sol");


module.exports =  function(deployer, network, accounts) {

    const walletAddress = "0x268343557A5A08CECaC22930C00fe37c06e1d027";
    
    let wallet
    let storage;
    let token;
    let ico;
    let firstUnlockDate, secondUnlockDate;
    let startTime, endTime, bonusChangeTime;


    if (network === "mainnet") {
        firstUnlockDate = timestamp.fromDate('2018-04-16 12:00:00');
        secondUnlockDate = timestamp.fromDate('2018-10-16 12:00:00');

        wallet = walletAddress;

        startTime = timestamp.fromDate('2018-04-01 12:00:00');
        bonusChangeTime = timestamp.fromDate('2018-04-08 12:00:00');
        endTime = timestamp.fromDate('2018-04-15 12:00:00');
    } else {
        firstUnlockDate = timestamp.fromDate('2018-04-16 12:00:00');
        secondUnlockDate = timestamp.fromDate('2018-10-16 12:00:00');

        wallet = accounts[0];

        startTime = timestamp.fromDate('2018-04-01 12:00:00');
        bonusChangeTime = timestamp.fromDate('2018-04-08 12:00:00');
        endTime = timestamp.fromDate('2018-04-15 12:00:00');
    }    
        

    deployer.deploy(
        BetexToken, 
        firstUnlockDate,
        secondUnlockDate,
        { gas: 3500000}
    ).then(() => {
        return BetexToken.deployed();
    }).then(_token => {
        token = _token;
    }).then(() => {
        return deployer.deploy(
            BetexStorage,
            { gas: 4000000}
        )
    }).then(() => {
        return BetexStorage.deployed();
    }).then(_storage => {
        storage = _storage;
    }).then(() => {
        return deployer.deploy(
            BetexICO,
            startTime,
            bonusChangeTime,
            endTime,
            wallet,
            BetexToken.address,
            BetexStorage.address,
            { value: '1000000000000000000',
                gas: 6000000
            });
    }).then(() => {
        return BetexICO.deployed();
    }).then(_ico => {
        ico = _ico;
    }).then(() => {
        return token.setICO(BetexICO.address);
    }).then(() => {
        return storage.transferOwnership(BetexICO.address);
    }).then(() => {
        return ico.scheduleUnsoldAllocation();
    }).then(() => {
        return ico.allocatePreICOTokens({gas: 6500000});
    });
};
