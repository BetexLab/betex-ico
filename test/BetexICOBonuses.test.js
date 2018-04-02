const BetexToken = artifacts.require('BetexToken');
const BetexICO = artifacts.require('BetexICO');
const BetexStorage = artifacts.require('BetexStorage');

const assertRevert = require('./helpers/assertRevert');
const expectThrow = require('./helpers/expectThrow');
const increaseTimeTo = require('./helpers/increaseTime');
const latestTime = require('./helpers/latestTime');
const ether = require('./helpers/ether');


// Note, to run this test on your local testrpc/ganache network you must specify custom 
// ether balance (more than 200 ETH) for genereted accounts[2] and account[3]
contract('BetexICO bonuses', ([owner, wallet, funder, anotherFunder]) => {

    this.startTime = 1522155720; 
    this.bonusTime = 1530999000;
    this.endTime = 1539999000; 

    const week = 7 * 24 * 60 * 60;

    this.firstUnlockDate = 1523836800; 
    this.secondUnlockDate = 1539648000; 


    const RATE_EXPONENT = 4;
    const TOKEN_PRICE = 3;
    const nullAcc = "0x0000000000000000000000000000000000000000";

    
    beforeEach(async () => {
        this.storage = await BetexStorage.new();
        this.token = await BetexToken.new(this.firstUnlockDate, this.secondUnlockDate);
        this.ico = await BetexICO.new(this.startTime, this.bonusTime, this.endTime, wallet, this.token.address, this.storage.address);
        await this.token.setICO(this.ico.address);
        await this.storage.transferOwnership(this.ico.address);
        await this.ico.sendTransaction({value: ether(1)});
    });

    it('should set bonuses during first bonus round for funding more than 100 ETH', async () => {

        const bonus = 20;
        const funds = ether(100);
        await this.ico.addToWhitelist(anotherFunder);
        const result = await this.ico.sendTransaction({from: anotherFunder, value: funds});
      
        let orderId;
        for (var i = 0; i < result.logs.length; i++) {
            var log = result.logs[i];
            if (log.event == "OrderEvent") {
                orderId = log.args.orderId;
                break;
            }
        }

        const order = await this.storage.orders.call(orderId);
        const _beneficiary = order[0];
        const _funds = order[1].toNumber();
        const _bonus = order[2].toNumber();
        
        assert.equal(_beneficiary, anotherFunder); //funder address match
        assert.equal(_funds, funds.toNumber()); //paid funds match
        assert.equal(_bonus, bonus); //bonus match
    });

    it('should set bonuses during first bonus round for funding more than 50 ETH', async () => { 

        const bonus = 10;
        
        const funds = ether(50);
        await this.ico.addToWhitelist(funder);
        const result = await this.ico.sendTransaction({from: funder, value: funds});
            
        let orderId;
        for (var i = 0; i < result.logs.length; i++) {
            var log = result.logs[i];
            if (log.event == "OrderEvent") {
                orderId = log.args.orderId;
                break;
            }
        }

        const order = await this.storage.orders.call(orderId);
        const _beneficiary = order[0];
        const _funds = order[1].toNumber();
        const _bonus = order[2].toNumber();
        
        assert.equal(_beneficiary, funder); //funder address match
        assert.equal(_funds, funds.toNumber()); //paid funds match
        assert.equal(_bonus, bonus); //bonus match
    });

    it('should set bonuses during second bonus round for funding more than 100 ETH', async () => {

        await increaseTimeTo(this.bonusTime, + 1);    
        const bonus = 10;
        const funds = ether(100);
        await this.ico.addToWhitelist(anotherFunder);
        const result = await this.ico.sendTransaction({from: anotherFunder, value: funds});
      
        let orderId;
        for (var i = 0; i < result.logs.length; i++) {
            var log = result.logs[i];
            if (log.event == "OrderEvent") {
                orderId = log.args.orderId;
                break;
            }
        }

        const order = await this.storage.orders.call(orderId);
        const _beneficiary = order[0];
        const _funds = order[1].toNumber();
        const _bonus = order[2].toNumber();
        
        assert.equal(_beneficiary, anotherFunder); //funder address match
        assert.equal(_funds, funds.toNumber()); //paid funds match
        assert.equal(_bonus, bonus); //bonus match
    });

    it('should set bonuses during second bonus round for funding more than 50 ETH', async () => { 
        const bonus = 5;

        const funds = ether(50);
        await this.ico.addToWhitelist(funder);
        const result = await this.ico.sendTransaction({from: funder, value: funds});
      
        let orderId;
        for (var i = 0; i < result.logs.length; i++) {
            var log = result.logs[i];
            if (log.event == "OrderEvent") {
                orderId = log.args.orderId;
                break;
            }
        }

        const order = await this.storage.orders.call(orderId);
        const _beneficiary = order[0];
        const _funds = order[1].toNumber();
        const _bonus = order[2].toNumber();
        
        assert.equal(_beneficiary, funder); //funder address match
        assert.equal(_funds, funds.toNumber()); //paid funds match
        assert.equal(_bonus, bonus); //bonus match
    });

});