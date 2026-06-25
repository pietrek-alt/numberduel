// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NumberDuel} from "../src/NumberDuel.sol";
import {MockUSDFC} from "../src/mocks/MockUSDFC.sol";

contract NumberDuelTest is Test {
    NumberDuel duel;
    MockUSDFC usdfc;

    address setter = address(0xA11CE);
    address guesser = address(0xB0B);

    uint256 constant STAKE = 5e18; // 5 USDFC
    uint8 constant MIN = 1;
    uint8 constant MAX = 10;

    function setUp() public {
        usdfc = new MockUSDFC();
        duel = new NumberDuel(address(usdfc));

        usdfc.mint(setter, 100e18);
        usdfc.mint(guesser, 100e18);

        vm.prank(setter);
        usdfc.approve(address(duel), type(uint256).max);
        vm.prank(guesser);
        usdfc.approve(address(duel), type(uint256).max);
    }

    function _commit(uint8 number, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(number, salt));
    }

    function _open(uint8 number, bytes32 salt) internal returns (uint256 id) {
        vm.prank(setter);
        id = duel.createDuel(_commit(number, salt), STAKE, MIN, MAX);
    }

    function test_SetterWins_WrongGuess() public {
        bytes32 salt = keccak256("salt1");
        uint256 id = _open(7, salt);

        vm.prank(guesser);
        duel.joinDuel(id, 4); // wrong

        uint256 before = usdfc.balanceOf(setter);
        vm.prank(setter);
        duel.reveal(id, 7, salt);

        assertEq(usdfc.balanceOf(setter), before + 2 * STAKE, "setter takes pot");
        assertEq(usdfc.balanceOf(address(duel)), 0, "no funds stuck");
    }

    function test_GuesserWins_CorrectGuess() public {
        bytes32 salt = keccak256("salt2");
        uint256 id = _open(3, salt);

        vm.prank(guesser);
        duel.joinDuel(id, 3); // correct

        uint256 before = usdfc.balanceOf(guesser);
        vm.prank(setter);
        duel.reveal(id, 3, salt);

        assertEq(usdfc.balanceOf(guesser), before + 2 * STAKE, "guesser takes pot");
        assertEq(usdfc.balanceOf(address(duel)), 0, "no funds stuck");
    }

    function test_Revert_TamperedReveal() public {
        bytes32 salt = keccak256("salt3");
        uint256 id = _open(7, salt);
        vm.prank(guesser);
        duel.joinDuel(id, 7);

        // Setter tries to escape the loss by revealing a different number.
        vm.prank(setter);
        vm.expectRevert(bytes("commit mismatch"));
        duel.reveal(id, 8, salt);
    }

    function test_Revert_OutOfRangeReveal() public {
        bytes32 salt = keccak256("salt4");
        // Setter commits an out-of-range number (11) to make it unguessable.
        uint256 id = _open(11, salt);
        vm.prank(guesser);
        duel.joinDuel(id, 5);

        vm.prank(setter);
        vm.expectRevert(bytes("number out of range"));
        duel.reveal(id, 11, salt);
    }

    function test_ClaimUnrevealed_AfterTimeout() public {
        bytes32 salt = keccak256("salt5");
        uint256 id = _open(9, salt);
        vm.prank(guesser);
        duel.joinDuel(id, 2);

        // Setter never reveals. Before window: cannot claim.
        vm.prank(guesser);
        vm.expectRevert(bytes("reveal window open"));
        duel.claimUnrevealed(id);

        // After the window: guesser sweeps the pot.
        vm.warp(block.timestamp + duel.REVEAL_WINDOW() + 1);
        uint256 before = usdfc.balanceOf(guesser);
        vm.prank(guesser);
        duel.claimUnrevealed(id);
        assertEq(usdfc.balanceOf(guesser), before + 2 * STAKE, "guesser claims pot");
        assertEq(usdfc.balanceOf(address(duel)), 0, "no funds stuck");
    }

    function test_CancelOpenDuel_RefundsSetter() public {
        bytes32 salt = keccak256("salt6");
        uint256 id = _open(5, salt);

        uint256 before = usdfc.balanceOf(setter);
        vm.prank(setter);
        duel.cancelOpenDuel(id);
        assertEq(usdfc.balanceOf(setter), before + STAKE, "stake refunded");
        assertEq(usdfc.balanceOf(address(duel)), 0, "no funds stuck");
    }

    function test_Revert_SetterCannotJoinOwnDuel() public {
        bytes32 salt = keccak256("salt7");
        uint256 id = _open(5, salt);
        vm.prank(setter);
        vm.expectRevert(bytes("setter cannot join"));
        duel.joinDuel(id, 5);
    }

    function test_Revert_DoubleJoin() public {
        bytes32 salt = keccak256("salt8");
        uint256 id = _open(5, salt);
        vm.prank(guesser);
        duel.joinDuel(id, 5);

        address other = address(0xCAFE);
        usdfc.mint(other, 100e18);
        vm.prank(other);
        usdfc.approve(address(duel), type(uint256).max);
        vm.prank(other);
        vm.expectRevert(bytes("not open"));
        duel.joinDuel(id, 6);
    }

    function test_Revert_GuessOutOfRange() public {
        bytes32 salt = keccak256("salt9");
        uint256 id = _open(5, salt);
        vm.prank(guesser);
        vm.expectRevert(bytes("guess out of range"));
        duel.joinDuel(id, 11);
    }
}
