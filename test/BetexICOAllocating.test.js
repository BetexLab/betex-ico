const BetexToken = artifacts.require('BetexToken');
const BetexICO = artifacts.require('BetexICO');
const BetexStorage = artifacts.require('BetexStorage');
const assertRevert = require('./helpers/assertRevert');
const expectThrow = require('./helpers/expectThrow');
const increaseTimeTo = require('./helpers/increaseTime');
const latestTime = require('./helpers/latestTime');
const ether = require('./helpers/ether');


contract('BetexICO allocating', ([owner, wallet, funder1, funder2, funder3, funder4, funder5, bounty, reserve, broker, team]) => {

    this.startTime = 1522155720; 

    this.endTime = 1539999000; 

    this.firstUnlockDate = 1523836800; 
    this.bonusTime = 1522355720;   
    this.secondUnlockDate = 1539648000; 


    const RATE_EXPONENT = 4;
    const TOKEN_PRICE = 3;
    const nullAcc = "0x0000000000000000000000000000000000000000";
    const oraclizeTimeout = 60000;

    
    beforeEach(async () => {
        this.storage = await BetexStorage.new();
        this.token = await BetexToken.new(this.firstUnlockDate, this.secondUnlockDate, this.storage.address);
        this.ico = await BetexICO.new();
        await this.storage.setBetexICO(this.ico.address);
        await this.storage.transferOwnership(this.ico.address);
        await this.ico.init(this.startTime, this.bonusTime, this.endTime, wallet, this.token.address, this.storage.address);
        await this.token.allocateServiceTokens();
        await this.token.allocateIcoTokens();
        await this.ico.sendTransaction({value: ether(1)});
      });


    it('should allocate unsold tokens after sale', async  () => { 
        
        const funds = ether(10);
        await this.ico.addToWhitelist(funder1);
        await this.ico.addToWhitelist(funder2);
        await this.ico.addToWhitelist(funder3);
        await this.ico.addToWhitelist(funder4);
        await this.ico.addToWhitelist(funder5);


        const result = await this.ico.sendTransaction({from: funder1, value: funds});
        await this.ico.sendTransaction({from: funder2, value: funds});
        await this.ico.sendTransaction({from: funder3, value: funds});
        await this.ico.sendTransaction({from: funder4, value: funds});
        await this.ico.sendTransaction({from: funder5, value: funds});
      
        //we can allocate tokens only after ico ends
        await assertRevert(this.ico.allocateUnsoldTokens());
      
        let orderId;
        for (var i = 0; i < result.logs.length; i++) {
            var log = result.logs[i];
            if (log.event == "OrderEvent") {
                orderId = log.args.orderId;
                break;
            }
        }

        await setTimeout( async() => {
            const order = await this.storage.orders.call(orderId);
            const rate = order[3];
            await increaseTimeTo(this.endTime + 1);
            await this.ico.allocateUnsoldTokens();
            
            const tokensRequested = new web3.BigNumber(rate).mul(funds).div(TOKEN_PRICE).div(10 ** RATE_EXPONENT);
            const totalTokens = await this.ico.TOKENS_HARD_CAP.call();
            const sold = await this.ico.sold.call();
            const unsold = totalTokens.sub(sold);
            const coeff = totalTokens.div(tokensRequested);
            const tokensToAllocate = unsold.div(coeff);

            const balanceExp = tokensToAllocate.add(tokensRequested);
            console.log(balanceExp.toNumber());
           
            const funder1Balance = await this.token.balanceOf(funder1);
            const funder2Balance = await this.token.balanceOf(funder2);
            const funder3Balance = await this.token.balanceOf(funder3);
            const funder4Balance = await this.token.balanceOf(funder4);
            const funder5Balance = await this.token.balanceOf(funder5);
            console.log(funder1Balance.toNumber());
            assert.equal(balanceExp.toNumber(), funder1Balance.toNumber());
            assert.equal(balanceExp.toNumber(), funder2Balance.toNumber());
            assert.equal(balanceExp.toNumber(), funder3Balance.toNumber());
            assert.equal(balanceExp.toNumber(), funder4Balance.toNumber());
            assert.equal(balanceExp.toNumber(), funder5Balance.toNumber());
        }, oraclizeTimeout);
        

    });


});