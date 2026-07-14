// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title  GameRegistry
/// @notice Authoritative, backend-attested record of two-player game sessions.
/// @dev    The backend signs an EIP-712 `Result` for each finished session; the
///         contract verifies the signature, applies both players' XP atomically,
///         and marks the session consumed. Either player or a backend relayer may
///         submit the signed payload.
contract GameRegistry is EIP712, Ownable2Step {
    using ECDSA for bytes32;

    /// @notice Session lifecycle. `None` = unseen, `Finalized` = applied.
    enum Status {
        None,
        Finalized
    }

    /// @notice Aggregate, on-chain player record. History lives in events.
    struct PlayerStats {
        uint256 totalXp; // monotonic; only ever increases
        uint64 sessionsPlayed;
    }

    /// @notice Full backend-attested result of one session.
    /// @dev    `xpA`/`xpB` are XP *deltas* (order-independent). Commitment and
    ///         seed fields are signed and emitted as provenance, never read.
    struct Result {
        bytes32 sessionId;
        bytes32 seedTxHash;
        address playerA;
        address playerB;
        uint128 xpA;
        uint128 xpB;
        uint8 result; // 0 = tie, 1 = A wins, 2 = B wins
        bytes32 deckCommitment;
        bytes32 handCommitmentA;
        bytes32 handCommitmentB;
        uint256 deadline;
    }

    address public signer;
    mapping(bytes32 => Status) public sessionStatus;
    mapping(address => PlayerStats) public stats;

    bytes32 private constant RESULT_TYPEHASH =
        keccak256(
            "Result(bytes32 sessionId,bytes32 seedTxHash,address playerA,address playerB,uint128 xpA,uint128 xpB,uint8 result,bytes32 deckCommitment,bytes32 handCommitmentA,bytes32 handCommitmentB,uint256 deadline)"
        );

    event SessionFinalized(
        bytes32 indexed sessionId,
        address indexed playerA,
        address indexed playerB,
        uint128 xpA,
        uint128 xpB,
        uint8 result,
        bytes32 seedTxHash,
        bytes32 deckCommitment,
        bytes32 handCommitmentA,
        bytes32 handCommitmentB
    );
    event SignerUpdated(address indexed newSigner);

    error SessionAlreadyFinalized();
    error DeadlinePassed();
    error InvalidSignature();
    error InvalidPlayers();
    error InvalidSigner();

    constructor(
        address _signer
    ) EIP712("GameRegistry", "1") Ownable(msg.sender) {
        signer = _signer;
    }

    /// @notice Rotate the backend signer (key rotation / compromise response).
    function setSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert InvalidSigner();
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    /// @notice Aggregate on-chain record for `player` (zeroed if never finalized).
    function getPlayerStats(
        address player
    ) external view returns (PlayerStats memory) {
        return stats[player];
    }

    /// @notice Verify the backend signature and apply a session's XP atomically.
    /// @dev    Callable by anyone. Idempotent: first valid call wins.
    function finalizeSession(Result calldata r, bytes calldata sig) external {
        if (sessionStatus[r.sessionId] == Status.Finalized) {
            revert SessionAlreadyFinalized();
        }
        if (block.timestamp > r.deadline) revert DeadlinePassed();
        if (
            r.playerA == address(0) ||
            r.playerB == address(0) ||
            r.playerA == r.playerB
        ) revert InvalidPlayers();

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    RESULT_TYPEHASH,
                    r.sessionId,
                    r.seedTxHash,
                    r.playerA,
                    r.playerB,
                    r.xpA,
                    r.xpB,
                    r.result,
                    r.deckCommitment,
                    r.handCommitmentA,
                    r.handCommitmentB,
                    r.deadline
                )
            )
        );
        if (digest.recover(sig) != signer) revert InvalidSignature();

        // ----- Effects (atomic) -----
        sessionStatus[r.sessionId] = Status.Finalized;

        PlayerStats storage a = stats[r.playerA];
        PlayerStats storage b = stats[r.playerB];
        a.totalXp += r.xpA;
        a.sessionsPlayed += 1;
        b.totalXp += r.xpB;
        b.sessionsPlayed += 1;

        emit SessionFinalized(
            r.sessionId,
            r.playerA,
            r.playerB,
            r.xpA,
            r.xpB,
            r.result,
            r.seedTxHash,
            r.deckCommitment,
            r.handCommitmentA,
            r.handCommitmentB
        );
    }
}
