// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

contract TokenVoting {
    enum Status { 
        PLANNED, 
        COMMIT, 
        REVEAL, 
        CLOSED 
    }

    struct Candidate {
        string name;
        uint256 voteCount;
    }

    address public owner;
    uint256 public constant TOTAL_POINTS = 100;
    Candidate[] public candidates;
    
    uint256 public startCommitTimestamp;
    uint256 public startRevealTimestamp;
    uint256 public closeTimestamp;
    uint256 public totalCommitted;
    uint256 public totalRevealed;

    mapping(address => bool) public isWhitelisted;
    mapping(address => bytes32) public committedHashes;
    mapping(address => bool) public hasRevealed;

    event VoterWhitelisted(address indexed voter);
    event VoteCommitted(address indexed voter, bytes32 voteHash);
    event VoteRevealed(address indexed voter, uint256[] distribution, string salt, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier inState(Status requiredStatus) {
        require(getCurrentStatus() == requiredStatus, "Function invalid in current state");
        _;
    }

    constructor(
        string[] memory _candidateNames,
        uint256 _startCommit,
        uint256 _startReveal,
        uint256 _close
    ) {
        require(_startCommit < _startReveal, "Commit must start before Reveal");
        require(_startReveal < _close, "Reveal must start before Close");
        
        owner = msg.sender;
        startCommitTimestamp = _startCommit;
        startRevealTimestamp = _startReveal;
        closeTimestamp = _close;

        for (uint256 i = 0; i < _candidateNames.length; i++) {
            candidates.push(Candidate({
                name: _candidateNames[i],
                voteCount: 0
            }));
        }
    }

    function getCurrentStatus() public view returns (Status) {
        if (block.timestamp < startCommitTimestamp) {
            return Status.PLANNED;
        } else if (block.timestamp < startRevealTimestamp) {
            return Status.COMMIT;
        } else if (block.timestamp < closeTimestamp) {
            return Status.REVEAL;
        } else {
            return Status.CLOSED;
        }
    }

    function batchWhitelist(address[] memory _voters) external onlyOwner inState(Status.PLANNED) {
        for (uint256 i = 0; i < _voters.length; i++) {
            if (!isWhitelisted[_voters[i]]) {
                isWhitelisted[_voters[i]] = true;
                emit VoterWhitelisted(_voters[i]);
            }
        }
    }

    function commitVote(bytes32 _secretHash) external inState(Status.COMMIT) {
        require(isWhitelisted[msg.sender], "Not whitelisted");
        require(committedHashes[msg.sender] == bytes32(0), "Vote already committed");

        committedHashes[msg.sender] = _secretHash;
        totalCommitted++;
        emit VoteCommitted(msg.sender, _secretHash);
    }

    function revealVote(uint256[] memory _votes, string memory _salt) external inState(Status.REVEAL) {
        require(isWhitelisted[msg.sender], "Not whitelisted");
        require(!hasRevealed[msg.sender], "Vote already revealed");
        require(committedHashes[msg.sender] != bytes32(0), "No vote to reveal");
        require(_votes.length == candidates.length, "Invalid vote length");

        bytes32 verificationHash = keccak256(abi.encodePacked(_votes, _salt));
        require(verificationHash == committedHashes[msg.sender], "Hash mismatch");

        uint256 sum = 0;
        for (uint256 i = 0; i < _votes.length; i++) {
            sum += _votes[i];
        }
        require(sum == TOTAL_POINTS, "Sum must be 100");

        for (uint256 i = 0; i < _votes.length; i++) {
            candidates[i].voteCount += _votes[i];
        }

        hasRevealed[msg.sender] = true;
        totalRevealed++;
        emit VoteRevealed(msg.sender, _votes, _salt, block.timestamp);
    }

    function getCandidates() external view returns (Candidate[] memory) {
        return candidates;
    }

    function getTotalCommitted() external view returns (uint256) {
        return totalCommitted;
    }

    function getTotalRevealed() external view returns (uint256) {
        return totalRevealed;
    }
}