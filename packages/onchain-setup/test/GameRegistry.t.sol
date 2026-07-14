// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {GameRegistry} from "../src/GameRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract GameRegistryTest is Test {
    GameRegistry internal registry;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal playerA = makeAddr("playerA");
    address internal playerB = makeAddr("playerB");

    // Backend signer keypair; the private key is what authorizes results.
    address internal signer;
    uint256 internal signerKey;

    bytes32 internal constant RESULT_TYPEHASH = keccak256(
        "Result(bytes32 sessionId,bytes32 seedTxHash,address playerA,address playerB,uint128 xpA,uint128 xpB,uint8 result,bytes32 deckCommitment,bytes32 handCommitmentA,bytes32 handCommitmentB,uint256 deadline)"
    );

    // Mirror of the contract event, for expectEmit.
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

    function setUp() public {
        (signer, signerKey) = makeAddrAndKey("signer");
        vm.prank(owner);
        registry = new GameRegistry(signer);
    }

    // ----- helpers -----

    /// @dev A fully-populated, valid result for the canonical two players.
    function _sampleResult() internal view returns (GameRegistry.Result memory r) {
        r = GameRegistry.Result({
            sessionId: keccak256("session-1"),
            seedTxHash: keccak256("seed-tx"),
            playerA: playerA,
            playerB: playerB,
            xpA: 100,
            xpB: 40,
            result: 1, // A wins
            deckCommitment: keccak256("deck"),
            handCommitmentA: keccak256("handA"),
            handCommitmentB: keccak256("handB"),
            deadline: block.timestamp + 1 hours
        });
    }

    /// @dev Recompute the EIP-712 domain separator the way OZ's EIP712 does.
    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("GameRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(registry)
            )
        );
    }

    function _digest(GameRegistry.Result memory r) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
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
        );
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    /// @dev Sign `r` with an arbitrary key.
    function _sign(GameRegistry.Result memory r, uint256 key) internal view returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, _digest(r));
        return abi.encodePacked(rr, s, v);
    }

    /// @dev Sign `r` with the registered backend signer.
    function _signValid(GameRegistry.Result memory r) internal view returns (bytes memory) {
        return _sign(r, signerKey);
    }

    // ----- construction / getters -----

    function test_Constructor_SetsSignerAndOwner() public view {
        assertEq(registry.signer(), signer);
        assertEq(registry.owner(), owner);
    }

    function test_GetPlayerStats_ZeroedForUnknownPlayer() public {
        GameRegistry.PlayerStats memory s = registry.getPlayerStats(makeAddr("nobody"));
        assertEq(s.totalXp, 0);
        assertEq(s.sessionsPlayed, 0);
    }

    // ----- setSigner -----

    function test_SetSigner_UpdatesAndEmits() public {
        address newSigner = makeAddr("newSigner");
        vm.expectEmit(true, false, false, true, address(registry));
        emit SignerUpdated(newSigner);
        vm.prank(owner);
        registry.setSigner(newSigner);
        assertEq(registry.signer(), newSigner);
    }

    function test_SetSigner_RevertsForZeroAddress() public {
        vm.expectRevert(GameRegistry.InvalidSigner.selector);
        vm.prank(owner);
        registry.setSigner(address(0));
    }

    function test_SetSigner_RevertsForNonOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, relayer));
        vm.prank(relayer);
        registry.setSigner(relayer);
    }

    function test_SetSigner_NewSignerCanAuthorize_OldCannot() public {
        (address newSigner, uint256 newKey) = makeAddrAndKey("newSigner");
        vm.prank(owner);
        registry.setSigner(newSigner);

        GameRegistry.Result memory r = _sampleResult();

        // Old signer's signature is now rejected.
        vm.expectRevert(GameRegistry.InvalidSignature.selector);
        registry.finalizeSession(r, _signValid(r));

        // New signer's signature is accepted.
        registry.finalizeSession(r, _sign(r, newKey));
        assertEq(registry.getPlayerStats(playerA).sessionsPlayed, 1);
    }

    // ----- finalizeSession: happy path -----

    function test_FinalizeSession_AppliesXpAndMarksFinalized() public {
        GameRegistry.Result memory r = _sampleResult();

        vm.expectEmit(true, true, true, true, address(registry));
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

        // Anyone may relay the signed payload.
        vm.prank(relayer);
        registry.finalizeSession(r, _signValid(r));

        assertEq(uint8(registry.sessionStatus(r.sessionId)), uint8(GameRegistry.Status.Finalized));

        GameRegistry.PlayerStats memory a = registry.getPlayerStats(playerA);
        GameRegistry.PlayerStats memory b = registry.getPlayerStats(playerB);
        assertEq(a.totalXp, r.xpA);
        assertEq(a.sessionsPlayed, 1);
        assertEq(b.totalXp, r.xpB);
        assertEq(b.sessionsPlayed, 1);
    }

    function test_FinalizeSession_AccumulatesAcrossSessions() public {
        GameRegistry.Result memory r1 = _sampleResult();
        registry.finalizeSession(r1, _signValid(r1));

        GameRegistry.Result memory r2 = _sampleResult();
        r2.sessionId = keccak256("session-2");
        r2.xpA = 25;
        r2.xpB = 75;
        r2.result = 2; // B wins
        registry.finalizeSession(r2, _signValid(r2));

        GameRegistry.PlayerStats memory a = registry.getPlayerStats(playerA);
        GameRegistry.PlayerStats memory b = registry.getPlayerStats(playerB);
        assertEq(a.totalXp, uint256(r1.xpA) + r2.xpA);
        assertEq(a.sessionsPlayed, 2);
        assertEq(b.totalXp, uint256(r1.xpB) + r2.xpB);
        assertEq(b.sessionsPlayed, 2);
    }

    // ----- finalizeSession: reverts -----

    function test_FinalizeSession_RevertsWhenAlreadyFinalized() public {
        GameRegistry.Result memory r = _sampleResult();
        bytes memory sig = _signValid(r);
        registry.finalizeSession(r, sig);

        vm.expectRevert(GameRegistry.SessionAlreadyFinalized.selector);
        registry.finalizeSession(r, sig);
    }

    function test_FinalizeSession_RevertsAfterDeadline() public {
        GameRegistry.Result memory r = _sampleResult();
        bytes memory sig = _signValid(r);

        vm.warp(r.deadline + 1);
        vm.expectRevert(GameRegistry.DeadlinePassed.selector);
        registry.finalizeSession(r, sig);
    }

    function test_FinalizeSession_AllowsExactlyAtDeadline() public {
        GameRegistry.Result memory r = _sampleResult();
        bytes memory sig = _signValid(r);

        vm.warp(r.deadline); // revert condition is block.timestamp > deadline (strict)
        registry.finalizeSession(r, sig);
        assertEq(registry.getPlayerStats(playerA).sessionsPlayed, 1);
    }

    function test_FinalizeSession_RevertsForZeroPlayerA() public {
        GameRegistry.Result memory r = _sampleResult();
        r.playerA = address(0);
        vm.expectRevert(GameRegistry.InvalidPlayers.selector);
        registry.finalizeSession(r, _signValid(r));
    }

    function test_FinalizeSession_RevertsForZeroPlayerB() public {
        GameRegistry.Result memory r = _sampleResult();
        r.playerB = address(0);
        vm.expectRevert(GameRegistry.InvalidPlayers.selector);
        registry.finalizeSession(r, _signValid(r));
    }

    function test_FinalizeSession_RevertsForIdenticalPlayers() public {
        GameRegistry.Result memory r = _sampleResult();
        r.playerB = r.playerA;
        vm.expectRevert(GameRegistry.InvalidPlayers.selector);
        registry.finalizeSession(r, _signValid(r));
    }

    function test_FinalizeSession_RevertsForWrongSigner() public {
        (, uint256 wrongKey) = makeAddrAndKey("attacker");
        GameRegistry.Result memory r = _sampleResult();
        vm.expectRevert(GameRegistry.InvalidSignature.selector);
        registry.finalizeSession(r, _sign(r, wrongKey));
    }

    function test_FinalizeSession_RevertsForTamperedPayload() public {
        GameRegistry.Result memory r = _sampleResult();
        bytes memory sig = _signValid(r);

        // Inflate XP after signing: the recovered signer no longer matches.
        r.xpA = 1_000_000;
        vm.expectRevert(GameRegistry.InvalidSignature.selector);
        registry.finalizeSession(r, sig);
    }

    // ----- fuzz -----

    function testFuzz_FinalizeSession_AppliesArbitraryXp(uint128 xpA, uint128 xpB) public {
        GameRegistry.Result memory r = _sampleResult();
        r.xpA = xpA;
        r.xpB = xpB;

        registry.finalizeSession(r, _signValid(r));

        assertEq(registry.getPlayerStats(playerA).totalXp, xpA);
        assertEq(registry.getPlayerStats(playerB).totalXp, xpB);
    }
}
