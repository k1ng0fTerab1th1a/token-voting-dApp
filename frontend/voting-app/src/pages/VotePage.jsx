import React, { useState } from 'react';
import { BrowserProvider, Contract, solidityPackedKeccak256 } from 'ethers';
import { Link } from 'react-router-dom';
import TokenVotingArtifact from '../contracts/TokenVoting.json'; 

import '../App.css';
import '../styles/VotePage.css';

const STATUS_NAMES = ["PLANNED", "COMMIT", "REVEAL", "CLOSED"];

const VotePage = () => {
  const [contractAddress, setContractAddress] = useState("");
  const [contract, setContract] = useState(null);
  const [status, setStatus] = useState(null);
  const [candidates, setCandidates] = useState([]);

  const [stats, setStats] = useState({ committed: 0, revealed: 0 });
  const [timestamps, setTimestamps] = useState({ startCommit: 0, startReveal: 0, close: 0 });
  
  const [votes, setVotes] = useState({});
  const [totalPoints, setTotalPoints] = useState(0);
  
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [localSecret, setLocalSecret] = useState(null);

  const formatDate = (unixTs) => {
    if (!unixTs) return "N/A";
    return new Date(Number(unixTs) * 1000).toLocaleString();
  };

  const getReadableError = (error) => {
    let reason = error.reason || error.shortMessage;

    if (!reason && error.info && error.info.error) {
      reason = error.info.error.message;
    }

    if (!reason) reason = error.message || "Unknown error";

    return reason
      .replace("execution reverted: ", "")
      .replace("VM Exception while processing transaction: revert ", "")
      .replace("Error: ", "");
  };

  const loadContractData = async () => {
    if (!contractAddress) return;
    setMsg("Loading contract...");
    setIsLoading(true);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const votingContract = new Contract(contractAddress, TokenVotingArtifact.abi, signer);

      setContract(votingContract);

      const currentStatus = await votingContract.getCurrentStatus();
      setStatus(Number(currentStatus));

      const candidatesStruct = await votingContract.getCandidates();
      const names = candidatesStruct.map(c => c.name);
      setCandidates(names);

      const initialVotes = {};
      names.forEach(name => initialVotes[name] = 0);
      setVotes(initialVotes);

      const tCommitted = await votingContract.totalCommitted();
      const tRevealed = await votingContract.totalRevealed();
      
      const tsStartCommit = await votingContract.startCommitTimestamp();
      const tsStartReveal = await votingContract.startRevealTimestamp();
      const tsClose = await votingContract.closeTimestamp();

      setStats({
        committed: Number(tCommitted),
        revealed: Number(tRevealed)
      });

      setTimestamps({
        startCommit: tsStartCommit,
        startReveal: tsStartReveal,
        close: tsClose
      });

      const userAddress = await signer.getAddress();
      const storageKey = `vote_${contractAddress}_${userAddress}`;
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setLocalSecret(parsed);
        setMsg("Found your saved vote locally!");
      } else {
        setLocalSecret(null);
        setMsg("");
      }

    } catch (error) {
      console.error(error);
      setMsg("Error loading contract. Check address.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoteChange = (name, value) => {
    const val = parseInt(value) || 0;
    const newVotes = { ...votes, [name]: val };
    setVotes(newVotes);
    
    const sum = Object.values(newVotes).reduce((a, b) => a + b, 0);
    setTotalPoints(sum);
  };

  const handleCommit = async () => {
    if (totalPoints !== 100) { alert("Total points must be exactly 100!"); return; }

    try {
      setIsLoading(true);
      setMsg("Checking validity...");

      const voteArray = candidates.map(name => votes[name]);
      const salt = Math.random().toString(36).substring(2, 15);
      const hash = solidityPackedKeccak256(["uint256[]", "string"], [voteArray, salt]);

      try {
        await contract.commitVote.staticCall(hash);
      } catch (checkError) {
        console.log("Check failed:", checkError);
        
        let reason = checkError.reason || checkError.shortMessage || "Transaction invalid";
        
        if (reason.includes("Not whitelisted")) reason = "You are not in the Whitelist!";
        if (reason.includes("Wrong phase")) reason = "Voting is not in Commit phase!";
        
        throw new Error(reason);
      }

      setMsg("Sending transaction...");
      const tx = await contract.commitVote(hash);
      
      setMsg("Waiting for confirmation...");
      await tx.wait();

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const storageKey = `vote_${contractAddress}_${userAddress}`;
      
      const secretData = { voteArray, salt };
      localStorage.setItem(storageKey, JSON.stringify(secretData));
      setLocalSecret(secretData);
      
      setMsg("Success! Vote Committed.");
      
      const newCount = await contract.totalCommitted();
      setStats(prev => ({ ...prev, committed: Number(newCount) }));

    } catch (error) {
      console.error(error);
      const message = error.reason || error.message || "Unknown error";
      const cleanMsg = message.replace('execution reverted: ', '');
      setMsg(`Error: ${cleanMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReveal = async () => {
    if (!localSecret) {
      alert("No local vote found to reveal! Did you commit from this browser?");
      return;
    }

    try {
      setIsLoading(true);
      setMsg("Revealing Vote...");

      const { voteArray, salt } = localSecret;

      try {
        await contract.revealVote.staticCall(voteArray, salt);
      } catch (simError) {
        console.log("Reveal Check Failed:", simError);
        const reason = getReadableError(simError);
        
        if (reason.includes("Wrong phase")) throw new Error("It's not Reveal phase yet!");
        if (reason.includes("Already revealed")) throw new Error("You have already revealed this vote.");
        if (reason.includes("Hash mismatch")) throw new Error("Data corruption: Your saved vote doesn't match the blockchain commit.");
        
        throw new Error(reason);
      }

      console.log("Revealing:", { voteArray, salt });

      const tx = await contract.revealVote(voteArray, salt);
      setMsg("Reveal transaction sent...");
      await tx.wait();

      setMsg("Success! Your vote is now counted.");

    } catch (error) {
      console.error(error);
      setMsg("Error: " + (error.reason || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="voting-container">
      <h2 className="page-title">Voting Interface</h2>

      <div className="contract-input-group">
        <input 
          className="input-field"
          placeholder="Enter Contract Address (0x...)"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
        <button 
            className="btn-primary" 
            style={{ width: "150px" }}
            onClick={loadContractData}
            disabled={isLoading}
        >
            Load
        </button>
      </div>

      {status !== null && (
        <>
            <div className={`phase-indicator phase-${status}`}>
                Current Phase: {STATUS_NAMES[status]}
            </div>

            <div className="info-panel">
                <div className="info-row">
                    <span className="info-label">Statistics:</span>
                    <span>
                        Committed: <span className="stat-badge">{stats.committed}</span>
                        &nbsp;&nbsp;
                        Revealed: <span className="stat-badge">{stats.revealed}</span>
                    </span>
                </div>
                <hr style={{borderColor: '#cce5ff', margin: '10px 0'}}/>
                
                <div className="info-row">
                    <span className="info-label">Commit Phase:</span>
                    <span>{formatDate(timestamps.startCommit)} - {formatDate(timestamps.startReveal)}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Reveal Phase:</span>
                    <span>{formatDate(timestamps.startReveal)} - {formatDate(timestamps.close)}</span>
                </div>
            </div>

            {msg && <p className="status-msg status-info">{msg}</p>}

            {status === 1 && (
                <div>
                    {candidates.map(name => (
                        <div key={name} className="candidate-row">
                            <span className="candidate-name">{name}</span>
                            <input 
                                type="number"
                                className="points-input"
                                value={votes[name]}
                                onChange={(e) => handleVoteChange(name, e.target.value)}
                                min={0} max={100}
                            />
                        </div>
                    ))}

                    <div className={`points-summary ${totalPoints === 100 ? "sum-valid" : "sum-invalid"}`}>
                        Total: {totalPoints} / 100
                    </div>

                    <button 
                        className="action-btn"
                        onClick={handleCommit}
                        disabled={(isLoading || totalPoints !== 100) && !localSecret}
                    >
                        {isLoading ? "Processing..." : "Commit Vote"}
                    </button>
                    
                    {localSecret && (
                        <div className="stored-data-box">
                            You have already saved a vote locally.
                        </div>
                    )}
                </div>
            )}

            {status === 2 && (
                <div>
                    <div style={{ textAlign: "center", marginBottom: "20px" }}>
                        <p>The voting phase is over. It's time to open the cards.</p>
                    </div>

                    {localSecret ? (
                        <div className="stored-data-box" style={{ marginBottom: "20px" }}>
                            <strong>Found Secret Data:</strong>
                            <br/>
                            Votes: {JSON.stringify(localSecret.voteArray)}
                            <br/>
                            Salt: {localSecret.salt}
                        </div>
                    ) : (
                        <div className="status-msg status-error">
                            No local secret found for this contract. Cannot reveal.
                        </div>
                    )}

                    <button 
                        className="action-btn reveal-btn"
                        onClick={handleReveal}
                        disabled={isLoading || !localSecret}
                    >
                        {isLoading ? "Processing..." : "Reveal My Vote"}
                    </button>
                </div>
            )}

            {(status === 2 || status === 3) && (
                <div style={{textAlign: "center", marginTop: "30px", borderTop: "1px solid #eee", paddingTop: "20px"}}>
                    <p>Want to see the analytics?</p>
                    <Link to={`/results/${contractAddress}`} className="results-link-btn">
                        View Real-Time Results
                    </Link>
                </div>
            )}

            {status === 0 && <p style={{textAlign: "center"}}>Wait for the Commit phase to start.</p>}
            {status === 3 && <p style={{textAlign: "center"}}>Voting is closed. Check the Results page.</p>}
        </>
      )}
    </div>
  );
};

export default VotePage;