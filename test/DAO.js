const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Governor", function () {
    async function deployTokensFixture() {
        const [owner, proposer, voter1, voter2, voter3] = await ethers.getSigners();

        const DAOToken = await ethers.getContractFactory("DAOToken");
        const token = await DAOToken.deploy(owner.address);
        console.log("DAOToken deployed to address:", token.address);

        const DAOGovernor = await ethers.getContractFactory("DAOGovernor");
        const governor = await DAOGovernor.deploy(token.address);
        console.log("Governor deployed to address:", governor.address);

        return {token, governor, owner, proposer, voter1, voter2, voter3}
    }
    async function mineBlocksFixture() {
        await ethers.provider.send("evm_mine");
        await ethers.provider.send("evm_mine");
        await ethers.provider.send("evm_mine");
        await ethers.provider.send("evm_mine");
        await ethers.provider.send("evm_mine");
    }
    it("Getting votes for account", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);

        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        
        expect(await token.getCurrentVotes(voter1.address)).to.equal(20);
        expect(await token.getCurrentVotes(owner.address)).to.equal(80);

        await expect(token.connect(voter1).transferFrom(voter1.address, voter2.address, 10))
        .to.be.revertedWith('ERC20: insufficient allowance');
    })
    it("Create proposal with valid params", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);

        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        await token.connect(owner).transfer(proposer.address, 1);

        // Создаем предложение
        const proposalCallData = governor.interface.encodeFunctionData("updateVotingPeriod", [2]);
        const targets = [governor.address];
        const values = [0];
        const proposalDesc = "Change voting period to 2";

        createdProposal = await governor.connect(proposer).createProposal(targets, values, [proposalCallData], proposalDesc);
        var createdProposalId =  await governor._proposalCount();

        expect(createdProposalId).to.equal(1);
        var proposal = await governor._proposals(createdProposalId);
        expect(proposal.id).to.equal(1);
        expect(proposal.description).to.equal(proposalDesc);

        expect(await governor.getProposalState(createdProposalId)).to.equal(1);
        
        expect(createdProposal).to.emit(governor, "ProposalCreated")
        .withArgs(1, proposer.address, targets, values, proposalCallData, await ethers.provider.getBlockNumber(), await ethers.provider.getBlockNumber() + await governor.getVotingPeriod(), proposalDesc)
    })
    it("Error when proposer has no tokens", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);

        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        expect(await token.getCurrentVotes(proposer.address)).to.equal(0);

        // Создаем предложение
        const proposalCallData = governor.interface.encodeFunctionData("updateVotingPeriod", [2]);
        const targets = [governor.address];
        const values = [0];
        const proposalDesc = "Change voting period to 2";

        proposalResult = governor.connect(proposer).createProposal(targets, values, [proposalCallData], proposalDesc);
        await expect(proposalResult).to.be.revertedWith('Proposer must have some dao tokens');
    
    })
    it("Vote for active proposal", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);

        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        await token.connect(owner).transfer(proposer.address, 1);

        // Создаем предложение
        const proposalCallData = governor.interface.encodeFunctionData("updateVotingPeriod", [2]);
        const targets = [governor.address];
        const values = [0];
        const proposalDesc = "Change voting period to 2";

        await governor.connect(proposer).createProposal(targets, values, [proposalCallData], proposalDesc);
        var createdProposalId =  await governor._proposalCount();
        await governor.connect(voter1).vote(createdProposalId, true);

        expect((await governor._proposals(createdProposalId)).forVotes).to.equal(20);
        expect((await governor.getProposalState(createdProposalId))).to.equal(1);

    })
    it("Vote for invalid proposal", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);

        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        await token.connect(owner).transfer(proposer.address, 1);

        voteResult = governor.connect(voter1).vote(1, true);

        await expect(voteResult).to.be.revertedWith('Invalid proposal id');
    })
    it("Error when voting second time", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);

        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        await token.connect(owner).transfer(proposer.address, 1);

        // Создаем предложение
        const proposalCallData = governor.interface.encodeFunctionData("updateVotingPeriod", [2]);
        const targets = [governor.address];
        const values = [0];
        const proposalDesc = "Change voting period to 2";

        await governor.connect(proposer).createProposal(targets, values, [proposalCallData], proposalDesc);
        var createdProposalId =  await governor._proposalCount();

        await governor.connect(voter1).vote(createdProposalId, true);
        expect((await governor._proposals(createdProposalId)).forVotes).to.equal(20);
        expect((await governor.getProposalState(createdProposalId))).to.equal(1);

        var votingResult = governor.connect(voter1).vote(createdProposalId, true);
        await expect(votingResult).to.be.revertedWith('Voter already voted');
    })
    it("Voting more for result", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);
    
        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        await token.connect(owner).transfer(proposer.address, 1);

        // Создаем предложение
        const proposalCallData = governor.interface.encodeFunctionData("updateVotingPeriod", [2]);
        const targets = [governor.address];
        const values = [0];
        const proposalDesc = "Change voting period to 2";

        await governor.connect(proposer).createProposal(targets, values, [proposalCallData], proposalDesc);
        var createdProposalId =  await governor._proposalCount();

        await governor.connect(voter1).vote(createdProposalId, true);
        await governor.connect(voter2).vote(createdProposalId, true);
        expect((await governor._proposals(createdProposalId)).forVotes).to.equal(20 + 31);

        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Active);
        await loadFixture(mineBlocksFixture);
        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Queued);
    })
    it("Voting no quorum result", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);
    
        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        await token.connect(owner).transfer(proposer.address, 1);

        // Создаем предложение
        const proposalCallData = governor.interface.encodeFunctionData("updateVotingPeriod", [2]);
        const targets = [governor.address];
        const values = [0];
        const proposalDesc = "Change voting period to 2";

        await governor.connect(proposer).createProposal(targets, values, [proposalCallData], proposalDesc);
        var createdProposalId =  await governor._proposalCount();

        await governor.connect(voter1).vote(createdProposalId, true);
        await governor.connect(voter3).vote(createdProposalId, true);
        expect((await governor._proposals(createdProposalId)).forVotes).to.equal(20 + 8);

        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Active);
        await loadFixture(mineBlocksFixture);
        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Defeated);
    })
    it("Voting more against result", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);
    
        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        await token.connect(owner).transfer(proposer.address, 10);

        // Создаем предложение
        const proposalCallData = governor.interface.encodeFunctionData("updateVotingPeriod", [2]);
        const targets = [governor.address];
        const values = [0];
        const proposalDesc = "Change voting period to 2";

        await governor.connect(proposer).createProposal(targets, values, [proposalCallData], proposalDesc);
        var createdProposalId =  await governor._proposalCount();

        await governor.connect(voter1).vote(createdProposalId, true);
        await governor.connect(voter3).vote(createdProposalId, true);
        await governor.connect(voter2).vote(createdProposalId, false);
        await governor.connect(proposer).vote(createdProposalId, false);

        expect((await governor._proposals(createdProposalId)).forVotes).to.equal(20 + 8);
        expect((await governor._proposals(createdProposalId)).againstVotes).to.equal(31 + 10);

        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Active);
        await loadFixture(mineBlocksFixture);
        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Defeated);
    })
    it("Queued proposal execution", async function () {
        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);
    
        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        await token.connect(owner).transfer(proposer.address, 10);

        // Создаем предложение
        const proposalCallData = governor.interface.encodeFunctionData("updateVotingPeriod", [2]);
        const targets = [governor.address];
        const values = [0];
        const proposalDesc = "Change voting period to 2";

        expect(await governor.getVotingPeriod()).to.equal(5);

        await governor.connect(proposer).createProposal(targets, values, [proposalCallData], proposalDesc);
        var createdProposalId =  await governor._proposalCount();

        await governor.connect(voter1).vote(createdProposalId, true);
        await governor.connect(voter2).vote(createdProposalId, true);

        expect((await governor._proposals(createdProposalId)).forVotes).to.equal(20 + 31);

        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Active);
        await loadFixture(mineBlocksFixture);
        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Queued);

        await governor.execute(createdProposalId);
        expect(await governor.getVotingPeriod()).to.equal(2);
        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Executed);
    }); 
    it("Invalid state proposal not execute", async function () {

        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);
    
        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);
        await token.connect(owner).transfer(voter2.address, 31);
        await token.connect(owner).transfer(voter3.address, 8);
        await token.connect(owner).transfer(proposer.address, 10);

        // Создаем предложение
        const proposalCallData = governor.interface.encodeFunctionData("updateVotingPeriod", [2]);
        const targets = [governor.address];
        const values = [0];
        const proposalDesc = "Change voting period to 2";

        await governor.connect(proposer).createProposal(targets, values, [proposalCallData], proposalDesc);
        var createdProposalId =  await governor._proposalCount();

        await governor.connect(voter1).vote(createdProposalId, true);
        await governor.connect(voter3).vote(createdProposalId, true);
        await governor.connect(voter2).vote(createdProposalId, false);
        await governor.connect(proposer).vote(createdProposalId, false);

        expect((await governor._proposals(createdProposalId)).forVotes).to.equal(20 + 8);
        expect((await governor._proposals(createdProposalId)).againstVotes).to.equal(31 + 10);

        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Active);
        await loadFixture(mineBlocksFixture);
        expect((await governor.getProposalState(createdProposalId))).to.equal(ProposalState.Defeated);

        var executionResult = governor.execute(createdProposalId);
        await expect(executionResult).to.be.revertedWith('Only queued proposals can be executed');
    });
    it("Voting period cant be changed from outside", async function () {

        const {token, governor, owner, proposer, voter1, voter2, voter3} = 
        await loadFixture(deployTokensFixture);
    
        // Распределяем токены
        await token.connect(owner).transfer(voter1.address, 20);

        var updateResult = governor.connect(voter1).updateVotingPeriod(5);
        await expect(updateResult).to.be.revertedWith('Caller is not the DAOGovernor');
    });
});

const ProposalState = {
    Undefined: 0,
    Active: 1,
    Defeated: 2,
    Queued: 3,
    Executed: 4
}