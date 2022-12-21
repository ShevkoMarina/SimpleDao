// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;


import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "hardhat/console.sol";

interface IDaoToken {
    function getCurrentVotes(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract DAOGovernor {

    /// @dev Получить адрес ДАО
    function _governor() external view returns (address) {
        return address(this);
    }

    /// @dev Разрешаем выполнение методов только из контракта ДАО
    modifier onlyGovernor() {
        require(this._governor() == msg.sender, "Caller is not the DAOGovernor");
        _;
    }

    /// @notice Длительность голосования (в блоках)
    uint private _votingPeriod;

    /// @notice Изменить период голосования
    function updateVotingPeriod(uint _newValue) public onlyGovernor {
        _votingPeriod = _newValue;
    }

    /// @notice Получить период голосования
    function  getVotingPeriod() public view returns (uint) {
        return _votingPeriod;
    }

    /// @notice Числитель кворума
    uint private _quorumNumerator;

    /// @notice Изменить числитель кворума
    function updateQuorumNumerator(uint _newValue) public onlyGovernor {
        require(_newValue > 0 && _newValue <= 100, "Invalid quorum numerator");
        _quorumNumerator = _newValue;
    }

    /// @notice Получить кворум
    function getQuorum()
    public view returns (uint256) {
        return (daoToken.totalSupply() * _quorumNumerator) / 100;
    }

    event ProposalExecuted(uint id);

    event ProposalCreated(
        uint256 proposalId,
        address proposer,
        address[] targets,
        uint256[] values,
        bytes[] calldatas,
        uint256 startBlock,
        uint256 endBlock,
        string description
    );

    event VoteCast(address voter, uint proposalId, bool support, uint votes);

    constructor (address tokenAddress) {
        daoToken = IDaoToken(tokenAddress);
        _votingPeriod = 5;
        _quorumNumerator = 50;
    }

    /// @dev Предложение
    struct Proposal {
        uint id;
        address proposer;
        address[] targets;
        uint[] values;
        bytes[] calldatas;
        string description;
        uint startBlock;
        uint endBlock;
        uint forVotes;
        uint againstVotes;
        bool canceled;
        bool executed;
        mapping (address => VoteInfo) votes;
    }

    /// @dev Информация о голосе за предложение
    struct VoteInfo {
        bool hasVoted;

        bool support;

        uint256 votes;
    }

    enum ProposalState {
        Undefined,
        Active,
        Defeated,
        Queued,
        Executed
    }

    // @notice Предложения
    mapping(uint256 => Proposal) public _proposals;

    // @notice Количество предложений
    uint256 public _proposalCount;

    IDaoToken public daoToken;

    /**
    @notice Создать предложение
     */
    function createProposal (
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256 createdProposalId) {
        require(getVotes(msg.sender) > 0, "Proposer must have some dao tokens");

        require(targets.length == values.length, "Invalid proposal length");
        require(targets.length == calldatas.length, "Invalid proposal length");
        require(targets.length > 0, "Proposal is empty");
       
        _proposalCount++;
        uint256 proposalId = _proposalCount;
        Proposal storage newProposal = _proposals[proposalId];

        uint startBlock = block.number;
        uint endBlock = startBlock + _votingPeriod;

        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.calldatas = calldatas;
        newProposal.description = description;
        newProposal.forVotes = 0;
        newProposal.againstVotes = 0;
        newProposal.executed = false;
        newProposal.startBlock = startBlock;
        newProposal.endBlock = endBlock;

        emit ProposalCreated(newProposal.id, msg.sender, targets, values, calldatas, startBlock, endBlock, description);

        return newProposal.id;
    }

    /**
    @notice Получить статус предложения
     */
    function getProposalState(uint proposalId) public view returns (ProposalState state) {

        require(_proposalCount >= proposalId && proposalId > 0, "Invalid proposal id");

        Proposal storage proposal = _proposals[proposalId];
        
        if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (proposal.forVotes <= proposal.againstVotes || proposal.forVotes < getQuorum()) {
            return ProposalState.Defeated;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else {
            return ProposalState.Queued;
        }
    }

    /**
    @notice Получить голоса
     */
    function getVotes(
        address account
    ) internal view returns (uint256) {
        return daoToken.getCurrentVotes(account);
    }

    /**
    @notice Проголосовать
     */
    function vote (
        uint256 proposalId,
        bool support
    ) external returns (uint256 voteWeight) {
       
        address voter = msg.sender;
        Proposal storage proposal = _proposals[proposalId];
        require(getProposalState(proposalId) == ProposalState.Active, "Proposal state must be active");

        VoteInfo storage voteInfo = proposal.votes[voter];
        require(voteInfo.hasVoted == false, 'Voter already voted');

        uint256 weight = getVotes(voter);
        require(weight > 0, "Voter has no dao tokens");

        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }

        voteInfo.hasVoted = true;
        voteInfo.support = support;
        voteInfo.votes = weight;

        emit VoteCast(voter, proposalId, support, weight);

        return weight;
    }

    /**
    @notice Выполнить предложение
     */
    function execute(uint256 proposalId) public payable { 
        Proposal storage proposal = _proposals[proposalId];
        require(getProposalState(proposalId) == ProposalState.Queued, "Only queued proposals can be executed");

        for (uint256 i = 0; i < proposal.targets.length; ++i) {
            (bool success, bytes memory returndata) = proposal.targets[i].call{value: proposal.values[i]}(proposal.calldatas[i]);
        }

        proposal.executed = true;

        emit ProposalExecuted(proposalId);
    }
}