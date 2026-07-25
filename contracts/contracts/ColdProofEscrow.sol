// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ColdProofEscrow
 * @notice Holds ETH for a cold-chain delivery and settles it from authenticated
 * sensor readings submitted by a trusted oracle.
 *
 * The device signature is verified by the ColdProof backend. The oracle writes
 * the verified reading hash and normalized temperature on-chain. Every state
 * transition emits an event designed for indexing by The Graph.
 */
contract ColdProofEscrow {
    enum Status {
        None,
        Funded,
        InTransit,
        Released,
        Refunded
    }

    struct Delivery {
        address payable payer;
        address payable payee;
        bytes32 deviceIdHash;
        int32 minTemperatureMilliC;
        int32 maxTemperatureMilliC;
        uint32 requiredReadings;
        uint32 compliantReadings;
        uint32 violations;
        uint64 deadline;
        uint256 amount;
        Status status;
    }

    address public owner;
    address public oracle;
    uint256 private unlocked = 1;

    mapping(bytes32 => Delivery) public deliveries;
    mapping(bytes32 => mapping(uint32 => bool)) public sequenceRecorded;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event OracleUpdated(
        address indexed previousOracle,
        address indexed newOracle
    );
    event DeliveryFunded(
        bytes32 indexed deliveryId,
        address indexed payer,
        address indexed payee,
        bytes32 deviceIdHash,
        int32 minTemperatureMilliC,
        int32 maxTemperatureMilliC,
        uint32 requiredReadings,
        uint64 deadline,
        uint256 amount
    );
    event DeliveryStarted(bytes32 indexed deliveryId, uint64 startedAt);
    event ReadingRecorded(
        bytes32 indexed deliveryId,
        bytes32 indexed deviceIdHash,
        uint32 indexed sequence,
        int32 temperatureMilliC,
        uint64 measuredAt,
        bytes32 readingHash,
        bool compliant
    );
    event DeliveryReleased(
        bytes32 indexed deliveryId,
        address indexed payee,
        uint256 amount,
        uint32 compliantReadings
    );
    event DeliveryRefunded(
        bytes32 indexed deliveryId,
        address indexed payer,
        uint256 amount,
        uint32 violations,
        bool expired
    );

    error Unauthorized();
    error InvalidAddress();
    error InvalidDelivery();
    error InvalidRules();
    error InvalidStatus(Status expected, Status actual);
    error DuplicateSequence();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error ConditionsNotMet();
    error TransferFailed();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (unlocked != 1) revert Reentrancy();
        unlocked = 2;
        _;
        unlocked = 1;
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

    function fundDelivery(
        bytes32 deliveryId,
        address payable payee,
        bytes32 deviceIdHash,
        int32 minTemperatureMilliC,
        int32 maxTemperatureMilliC,
        uint32 requiredReadings,
        uint64 deadline
    ) external payable {
        if (
            deliveryId == bytes32(0) ||
            deviceIdHash == bytes32(0) ||
            msg.value == 0
        ) revert InvalidDelivery();
        if (payee == address(0) || payee == msg.sender) revert InvalidAddress();
        if (
            minTemperatureMilliC > maxTemperatureMilliC ||
            requiredReadings == 0 ||
            deadline <= block.timestamp
        ) revert InvalidRules();
        if (deliveries[deliveryId].status != Status.None) {
            revert InvalidStatus(Status.None, deliveries[deliveryId].status);
        }

        deliveries[deliveryId] = Delivery({
            payer: payable(msg.sender),
            payee: payee,
            deviceIdHash: deviceIdHash,
            minTemperatureMilliC: minTemperatureMilliC,
            maxTemperatureMilliC: maxTemperatureMilliC,
            requiredReadings: requiredReadings,
            compliantReadings: 0,
            violations: 0,
            deadline: deadline,
            amount: msg.value,
            status: Status.Funded
        });

        emit DeliveryFunded(
            deliveryId,
            msg.sender,
            payee,
            deviceIdHash,
            minTemperatureMilliC,
            maxTemperatureMilliC,
            requiredReadings,
            deadline,
            msg.value
        );
    }

    function startDelivery(bytes32 deliveryId) external {
        Delivery storage delivery = deliveries[deliveryId];
        if (msg.sender != delivery.payer && msg.sender != oracle) {
            revert Unauthorized();
        }
        if (delivery.status != Status.Funded) {
            revert InvalidStatus(Status.Funded, delivery.status);
        }
        if (block.timestamp >= delivery.deadline) revert DeadlinePassed();

        delivery.status = Status.InTransit;
        emit DeliveryStarted(deliveryId, uint64(block.timestamp));
    }

    function recordReading(
        bytes32 deliveryId,
        uint32 sequence,
        int32 temperatureMilliC,
        uint64 measuredAt,
        bytes32 readingHash
    ) external onlyOracle {
        Delivery storage delivery = deliveries[deliveryId];
        if (delivery.status != Status.InTransit) {
            revert InvalidStatus(Status.InTransit, delivery.status);
        }
        if (block.timestamp > delivery.deadline) revert DeadlinePassed();
        if (readingHash == bytes32(0)) revert InvalidDelivery();
        if (sequenceRecorded[deliveryId][sequence]) revert DuplicateSequence();

        sequenceRecorded[deliveryId][sequence] = true;
        bool compliant =
            temperatureMilliC >= delivery.minTemperatureMilliC &&
            temperatureMilliC <= delivery.maxTemperatureMilliC;
        if (compliant) {
            delivery.compliantReadings++;
        } else {
            delivery.violations++;
        }

        emit ReadingRecorded(
            deliveryId,
            delivery.deviceIdHash,
            sequence,
            temperatureMilliC,
            measuredAt,
            readingHash,
            compliant
        );
    }

    function release(bytes32 deliveryId) external onlyOracle nonReentrant {
        Delivery storage delivery = deliveries[deliveryId];
        if (delivery.status != Status.InTransit) {
            revert InvalidStatus(Status.InTransit, delivery.status);
        }
        if (
            delivery.violations != 0 ||
            delivery.compliantReadings < delivery.requiredReadings
        ) revert ConditionsNotMet();

        uint256 amount = delivery.amount;
        address payable payee = delivery.payee;
        delivery.amount = 0;
        delivery.status = Status.Released;

        (bool sent, ) = payee.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit DeliveryReleased(
            deliveryId,
            payee,
            amount,
            delivery.compliantReadings
        );
    }

    function refund(bytes32 deliveryId)
        external
        onlyOracle
        nonReentrant
    {
        Delivery storage delivery = deliveries[deliveryId];
        if (delivery.status != Status.InTransit) {
            revert InvalidStatus(Status.InTransit, delivery.status);
        }
        _refund(deliveryId, delivery, false);
    }

    function refundExpired(bytes32 deliveryId) external nonReentrant {
        Delivery storage delivery = deliveries[deliveryId];
        if (
            delivery.status != Status.Funded &&
            delivery.status != Status.InTransit
        ) revert InvalidDelivery();
        if (block.timestamp <= delivery.deadline) revert DeadlineNotPassed();
        _refund(deliveryId, delivery, true);
    }

    function _refund(
        bytes32 deliveryId,
        Delivery storage delivery,
        bool expired
    ) private {
        uint256 amount = delivery.amount;
        address payable payer = delivery.payer;
        uint32 violations = delivery.violations;
        delivery.amount = 0;
        delivery.status = Status.Refunded;

        (bool sent, ) = payer.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit DeliveryRefunded(
            deliveryId,
            payer,
            amount,
            violations,
            expired
        );
    }
}
