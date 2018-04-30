import ether from '../helpers/ether';

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const MintedCrowdsale = artifacts.require('MintedCrowdsaleImpl');
const RBACMintableToken = artifacts.require('RBACMintableToken');

const ROLE_MINTER = 'minter';

contract('MintedCrowdsale using RBACMintableToken', function ([_, investor, wallet, purchaser]) {
  const rate = new BigNumber(1000);
  const value = ether(5);

  const expectedTokenAmount = rate.mul(value);

  beforeEach(async function () {
    this.token = await RBACMintableToken.new();
    this.crowdsale = await MintedCrowdsale.new(rate, wallet, this.token.address);
    await this.token.adminAddRole(this.crowdsale.address, ROLE_MINTER);
  });

  describe('accepting payments', function () {
    it('should have minter role on token', async function () {
      const isMinter = await this.token.hasRole(this.crowdsale.address, ROLE_MINTER);
      isMinter.should.equal(true);
    });

    it('should accept payments', async function () {
      await this.crowdsale.send(value).should.be.fulfilled;
      await this.crowdsale.buyTokens(investor, { value: value, from: purchaser }).should.be.fulfilled;
    });
  });

  describe('high-level purchase', function () {
    it('should log purchase', async function () {
      const { logs } = await this.crowdsale.sendTransaction({ value: value, from: investor });
      const event = logs.find(e => e.event === 'TokenPurchase');
      should.exist(event);
      event.args.purchaser.should.equal(investor);
      event.args.beneficiary.should.equal(investor);
      event.args.value.should.be.bignumber.equal(value);
      event.args.amount.should.be.bignumber.equal(expectedTokenAmount);
    });

    it('should assign tokens to sender', async function () {
      await this.crowdsale.sendTransaction({ value: value, from: investor });
      let balance = await this.token.balanceOf(investor);
      balance.should.be.bignumber.equal(expectedTokenAmount);
    });

    it('should forward funds to wallet', async function () {
      const pre = web3.eth.getBalance(wallet);
      await this.crowdsale.sendTransaction({ value, from: investor });
      const post = web3.eth.getBalance(wallet);
      post.minus(pre).should.be.bignumber.equal(value);
    });
  });
});
