const BetexToken = artifacts.require('BetexToken');
const BetexICO = artifacts.require('BetexICO');
const BetexStorage = artifacts.require('BetexStorage');

const assertRevert = require('./helpers/assertRevert');
const expectThrow = require('./helpers/expectThrow');
const increaseTimeTo = require('./helpers/increaseTime');
const latestTime = require('./helpers/latestTime');
const ether = require('./helpers/ether');


contract('BetexICO', ([owner, wallet, funder, anotherFunder, bounty, reserve, broker, team]) => {

    this.startTime = 1522155720; 

    this.endTime = 1539999000; 

    this.firstUnlockDate = 1523836800; 
    this.bonusTime = 1522355720;   
    this.secondUnlockDate = 1539648000; 


    const RATE_EXPONENT = 4;
    const TOKEN_PRICE = 3;
    const nullAcc = "0x0000000000000000000000000000000000000000";
    const oraclizeTimeout = 20000;

    
    beforeEach(async () => {
        this.storage = await BetexStorage.new();
        this.token = await BetexToken.new(this.firstUnlockDate, this.secondUnlockDate);
        this.ico = await BetexICO.new(this.startTime, this.bonusTime, this.endTime, wallet, this.token.address, this.storage.address);
        await this.token.setICO(this.ico.address);
        await this.storage.transferOwnership(this.ico.address);
        await this.ico.sendTransaction({value: ether(1)});
      });


    it('should create contract with correct params', async() => {
        const _token = await this.ico.token.call();
        const _wallet = await this.ico.wallet.call();
        const _storage = await this.ico.betexStorage.call();

        assert.equal(this.token.address, _token);
        assert.equal(wallet, _wallet);
        assert.equal(this.storage.address, _storage);
    });

    it('should not allow fund ico if the funder is not in the whitelist', async() => {
        const funds = ether(0.1);
        await assertRevert(this.ico.sendTransaction({from: funder, value: funds}));
    });


    it('should be able to add addresses in the whitelist', async () => {
        //revert for null account address
        await assertRevert(this.ico.addToWhitelist(nullAcc));
        
        // revert non-autorized call
        await assertRevert(this.ico.addToWhitelist(funder, {from: funder}));

        await this.ico.addToWhitelist(funder);
        const isInWhitelist = await this.storage.whitelist.call(funder);

        assert.equal(true, isInWhitelist);
    });
    
    it('should accept ether to contract and transfer tokens', async () => {
        const funds = ether(40);
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

        assert.equal(_beneficiary, funder); //funder address match
        assert.equal(_funds, funds.toNumber()); //paid funds match

        await setTimeout( async() => {
            const order = await this.storage.orders.call(orderId);
            const rate = order[3];
            const tokensRequested = new web3.BigNumber(rate).mul(_funds).div(TOKEN_PRICE).div(10 ** RATE_EXPONENT);
            const tokenReceived = await this.token.balanceOf(funder);
            console.log(tokenReceived.toNumber());
            assert.equal(tokenReceived.toNumber(), tokensRequested.toNumber());
        }, oraclizeTimeout);
    });

});