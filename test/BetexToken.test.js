const BetexToken = artifacts.require('BetexToken');
const BetexStorage = artifacts.require('BetexStorage');

const assertRevert = require('./helpers/assertRevert');
const expectThrow = require('./helpers/expectThrow');
const increaseTimeTo = require('./helpers/increaseTime');
const latestTime = require('./helpers/latestTime');
const ether = require('./helpers/ether');


contract('BetexToken', ([owner, ico, randomGuy]) => {

    this.firstUnlockDate = 1523836800; 
    this.secondUnlockDate = 1539648000; 
    

    beforeEach(async () => {
        this.storage = await BetexStorage.new();
        this.token = await BetexToken.new(this.firstUnlockDate, this.secondUnlockDate);
        await this.token.setICO(ico);

    });


    it('should create contract with correct params', async() => {
        const firstUnlockDate = await this.token.firstUnlockTime.call()
        const secondUnlockDate = await this.token.secondUnlockTime.call();

        assert.equal(this.firstUnlockDate, firstUnlockDate.toNumber());
        assert.equal(this.secondUnlockDate, secondUnlockDate.toNumber());

    });

    it('should be able to allocate tokens', async() => {
        const totalTokens = await this.token.totalSupply();
        const totalTokensExp = await this.token.TOTAL_SUPPLY.call();

        const bountyAddress = await this.storage.BOUNTY_ADDRESS.call();
        const bountyTokens = await this.token.balanceOf(bountyAddress);
        const bountyTokensExp = await this.token.BOUNTY_SUPPLY.call();

        const reserveAddress = await this.storage.RESERVE_ADDRESS.call();
        const reserveTokens = await this.token.balanceOf(reserveAddress);
        const reserveTokensExp = await this.token.RESERVE_SUPPLY.call();

        const brokerReserveAddress = await this.storage.BROKER_RESERVE_ADDRESS.call();
        const brokerReserveTokens = await this.token.balanceOf(brokerReserveAddress);
        const brokerReserveTokensExp = await this.token.BROKER_RESERVE_SUPPLY.call();

        const teamAddress = await this.storage.TEAM_ADDRESS.call();
        const teamTokens = await this.token.balanceOf(teamAddress);
        const teamTokensExp = await this.token.TEAM_SUPPLY.call();

        assert.equal(totalTokens.toNumber(), totalTokensExp.toNumber());
        assert.equal(bountyTokens.toNumber(), bountyTokensExp.toNumber());
        assert.equal(reserveTokens.toNumber(), reserveTokensExp.toNumber());
        assert.equal(brokerReserveTokens.toNumber(), brokerReserveTokensExp.toNumber());
        assert.equal(teamTokens.toNumber(), teamTokensExp.toNumber());
    });

    it('should be able to allocate tokens to ICO contract', async () => {
        
        const icoAddress = await this.storage.icoAddress.call();
        const icoTokens = await this.token.balanceOf(icoAddress);
        const icoTokensExp = await this.token.SALE_SUPPLY.call();

        // we can allocate tokens only once
        await assertRevert(this.token.allocateIcoTokens());

        assert.equal(ico, icoAddress);
        assert.equal(icoTokens.toNumber(), icoTokensExp.toNumber());
    });

    it('should allow transfer tokens before firstUnlockDate for ico address', async () => {
        const tokenAmount = 100;
        await this.token.transfer(owner, tokenAmount, {from: ico});

        const tokenBalance = await this.token.balanceOf(owner);
        assert.equal(tokenAmount, tokenBalance.toNumber());
    });

      
    it('should not allow transfer tokens before first unlock date with transfer function', async () => {
        
        const tokenAmount = 100;
        await this.token.transfer(owner, tokenAmount, {from: ico});

        await assertRevert(this.token.transfer(ico, tokenAmount));
    });


    it('should not allow transfer tokens before first unlock date with transferFrom function', async () => {
        
        const tokenAmount = 100;
        await this.token.approve(owner, tokenAmount, {from: ico});

        await assertRevert(this.token.transferFrom(ico, randomGuy, tokenAmount));
    });

    it('should allow transfer tokens after first unlock date with transferFrom function', async () => {
        const tokenAmount = 100;
        await increaseTimeTo(this.firstUnlockDate + 10);  

        await this.token.approve(owner, tokenAmount, {from: ico});
        this.token.transferFrom(ico, randomGuy, tokenAmount);
    });

    it('should allow transfer tokens after first unlock date with transfer function', async () => {
        const tokenAmount = 100;
        
        await this.token.transfer(owner, tokenAmount, {from: ico});
        this.token.transfer(ico, tokenAmount);

    });
  
});