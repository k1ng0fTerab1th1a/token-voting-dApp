import React, { useState } from 'react';
import { BrowserProvider, ContractFactory, Contract } from 'ethers';
import TokenVotingArtifact from '../contracts/TokenVoting.json';

import '../App.css';
import '../styles/DeployPage.css';

const DeployPage = () => {
  const [candidates, setCandidates] = useState("");
  const [plannedDuration, setPlannedDuration] = useState(5);
  const [commitDuration, setCommitDuration] = useState(5);
  const [revealDuration, setRevealDuration] = useState(5);
  
  const [status, setStatus] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState(null);

  const [whitelistInput, setWhitelistInput] = useState("");
  const [isWhitelisting, setIsWhitelisting] = useState(false);
  const [whitelistStatus, setWhitelistStatus] = useState("");

  const getStatusClass = (msg) => {
    if (!msg) return "";
    if (msg.includes("Error")) return "status-error";
    if (msg.includes("Success")) return "status-success";
    return "status-info";
  };

  const handleDeploy = async () => {
    setDeployedAddress(null);
    setIsDeploying(true);
    setStatus("Connecting to Wallet...");

    if (!window.ethereum) {
      alert("Please install MetaMask!");
      setIsDeploying(false);
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      setStatus("Preparing Transaction...");

      const candidateArray = candidates.split(',').map(name => name.trim());
      const now = Math.floor(Date.now() / 1000);
      const startCommit = now + (plannedDuration * 60);
      const startReveal = startCommit + (commitDuration * 60);
      const closeTime = startReveal + (revealDuration * 60);

      const factory = new ContractFactory(
        TokenVotingArtifact.abi,
        TokenVotingArtifact.bytecode,
        signer
      );

      setStatus("Waiting for User Signature...");

      const contract = await factory.deploy(
        candidateArray,
        startCommit,
        startReveal,
        closeTime
      );

      setStatus("Transaction sent! Waiting for confirmation...");

      await contract.waitForDeployment();
      const address = await contract.getAddress();
      
      setDeployedAddress(address);
      setStatus(`Success! Deployed at: ${address}`);

    } catch (error) {
      console.error(error);
      const message = error.reason || error.message || "Unknown error occurred";
      setStatus(`Error: ${message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleWhitelist = async () => {
    if (!deployedAddress) return;
    
    setIsWhitelisting(true);
    setWhitelistStatus("Processing Whitelist...");

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(
        deployedAddress, 
        TokenVotingArtifact.abi, 
        signer
      );

      const addresses = whitelistInput
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr !== "");

      if (addresses.length === 0) throw new Error("No valid addresses entered");

      console.log("Whitelisting:", addresses);

      const tx = await contract.batchWhitelist(addresses);
      setWhitelistStatus("Transaction sent... Waiting for block.");
      await tx.wait();

      setWhitelistStatus(`Success! Added ${addresses.length} voters.`);
      setWhitelistInput(""); 

    } catch (error) {
      console.error(error);
      setWhitelistStatus(`Error: ${error.reason || error.message}`);
    } finally {
      setIsWhitelisting(false);
    }
  };

  return (
    <div className="main-container">
      <h2 className="page-title">Deploy Voting Contract</h2>
      
      <div className="form-group">
        <label className="label-text">Candidates (comma separated):</label>
        <input 
          type="text" 
          className="input-field"
          value={candidates} 
          onChange={(e) => setCandidates(e.target.value)}
          placeholder="e.g. Science, Sports, Arts"
          disabled={isDeploying || deployedAddress}
        />
      </div>

      <div className="form-group deploy-row">
        <div className="deploy-col">
          <label className="label-text">Setup Time (min):</label>
          <input 
            type="number" 
            className="input-field"
            value={plannedDuration} 
            onChange={(e) => setPlannedDuration(Number(e.target.value))}
            min={1}
            disabled={isDeploying || deployedAddress}
            title="Time to whitelist voters before voting starts"
          />
        </div>
        
        <div className="deploy-col">
          <label className="label-text">Commit Phase (min):</label>
          <input 
            type="number" 
            className="input-field"
            value={commitDuration} 
            onChange={(e) => setCommitDuration(Number(e.target.value))}
            min={1}
            disabled={isDeploying || deployedAddress}
          />
        </div>

        <div className="deploy-col">
          <label className="label-text">Reveal Phase (min):</label>
          <input 
            type="number" 
            className="input-field"
            value={revealDuration} 
            onChange={(e) => setRevealDuration(Number(e.target.value))}
            min={1}
            disabled={isDeploying || deployedAddress}
          />
        </div>
      </div>

      {!deployedAddress && (
        <button 
            className="btn-primary"
            onClick={handleDeploy}
            disabled={isDeploying}
        >
            {isDeploying ? "Deploying..." : "Deploy Smart Contract"}
        </button>
      )}

      {status && !deployedAddress && (
        <p className={`status-msg ${getStatusClass(status)}`}>
          {status}
        </p>
      )}

      {deployedAddress && (
        <div className="card">
          <h4 className="success-title">Contract Active</h4>
          <p className="address-label">Address:</p>
          <code className="code-box">
            {deployedAddress}
          </code>

          <div className="admin-section">
            <h4 className="admin-title">Admin Panel: Whitelist</h4>
            
            <div className="form-group">
                <label className="label-text">Voter Addresses (One per line):</label>
                <textarea 
                    className="input-field whitelist-textarea"
                    placeholder={"0x123...\n0x456...\n0x789..."}
                    value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                />
            </div>

            <button 
                className="btn-secondary" 
                onClick={handleWhitelist}
                disabled={isWhitelisting}
            >
                {isWhitelisting ? "Adding..." : "Add to Whitelist"}
            </button>

            {whitelistStatus && (
                <p className={`status-msg ${getStatusClass(whitelistStatus)}`}>
                  {whitelistStatus}
                </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeployPage;