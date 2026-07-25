// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @notice Append-only Sepolia equivalent of the HCS topic used by ColdProof.
 * The backend remains responsible for authenticating each device signature.
 */
contract ColdProofConsensus {
    address public owner;
    address public oracle;
    uint256 public sequence;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);
    event ReadingRecorded(
        uint256 indexed logSequence,
        string deviceId,
        uint32 sensorSequence,
        int32 temperatureMilliC,
        string unit,
        uint64 measuredAt,
        string publicKey,
        string signature,
        uint64 receivedAtMs,
        bytes32 readingHash
    );

    error Unauthorized();
    error InvalidAddress();
    error InvalidReading();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert Unauthorized();
        _;
    }

    constructor(address initialOracle) {
        if (initialOracle == address(0)) revert InvalidAddress();
        owner = msg.sender;
        oracle = initialOracle;
        emit OwnershipTransferred(address(0), msg.sender);
        emit OracleUpdated(address(0), initialOracle);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert InvalidAddress();
        emit OracleUpdated(oracle, newOracle);
        oracle = newOracle;
    }

    function recordReading(
        string calldata deviceId,
        uint32 sensorSequence,
        int32 temperatureMilliC,
        string calldata unit,
        uint64 measuredAt,
        string calldata publicKey,
        string calldata signature,
        uint64 receivedAtMs,
        bytes32 readingHash
    ) external onlyOracle {
        if (
            bytes(deviceId).length == 0 ||
            bytes(unit).length == 0 ||
            bytes(publicKey).length == 0 ||
            bytes(signature).length == 0 ||
            readingHash == bytes32(0)
        ) revert InvalidReading();

        uint256 nextSequence = ++sequence;
        emit ReadingRecorded(
            nextSequence,
            deviceId,
            sensorSequence,
            temperatureMilliC,
            unit,
            measuredAt,
            publicKey,
            signature,
            receivedAtMs,
            readingHash
        );
    }
}
