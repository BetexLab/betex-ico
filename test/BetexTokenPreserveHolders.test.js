const BetexToken = artifacts.require('BetexToken');
const BetexStorage = artifacts.require('BetexStorage');

const assertRevert = require('./helpers/assertRevert');
const expectThrow = require('./helpers/expectThrow');
const increaseTimeTo = require('./helpers/increaseTime');
const latestTime = require('./helpers/latestTime');
const ether = require('./helpers/ether');


contract('BetexToken Preserve Holders', ([owner, ico, guy1, guy2, guy3]) => {

    this.firstUnlockDate = 1520006800; 
    this.secondUnlockDate = 1539648000; 
    

    beforeEach(async () => {
        this.storage = await BetexStorage.new();
        this.token = await BetexToken.new(this.firstUnlockDate, this.secondUnlockDate);
        await this.token.setICO(ico);
    });


    it('should preserve receiver address during transfer more than 0.1 BTX', async() => {
        const holdersCountBefore = await this.token.getHoldersCount();

        await this.token.transfer( guy1, 100000000000000000, {from: ico});
        const holdersCountAfter = await this.token.getHoldersCount();

        assert.equal(holdersCountBefore.toNumber()+1, holdersCountAfter.toNumber());
    

    });

    it('should not preserve receiver address during transfer less than 0.1 BTX', async() => {
        const holdersCountBefore = await this.token.getHoldersCount();

        await this.token.transfer(guy2, 9999999999999999, {from: ico});
        const holdersCountAfter = await this.token.getHoldersCount();

        assert.equal(holdersCountBefore.toNumber(), holdersCountAfter.toNumber());
    });

    it('should remove sender address from holders if after transfer he has less than 0.1 BTX)', async() => {
        
        const amount = 1000000000000000000;
        await this.token.transfer(guy2, amount, {from: ico});
        const balance = await this.token.balanceOf(guy2);

        const holdersCountBefore = await this.token.getHoldersCount();

        await this.token.transfer(guy3, balance, {from: guy2});

        const balanceAft = await this.token.balanceOf(guy2);
        const holdersCountAfter = await this.token.getHoldersCount();

        assert.equal(holdersCountBefore.toNumber(), holdersCountAfter.toNumber());
    });

    
  
});