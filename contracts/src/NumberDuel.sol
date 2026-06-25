// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 surface we need from USDFC.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title NumberDuel
/// @notice Provably-fair 1v1 number duel settled in USDFC on Filecoin.
/// @dev The setter commits keccak256(abi.encodePacked(number, salt)) BEFORE the
///      guesser guesses. The commitment is stored immutably in contract state on
///      Filecoin, so the setter can never change their number after the fact and
///      the number itself stays hidden until reveal. USDFC is the stake and the
///      payout. Both Filecoin primitives (immutable commitment + USDFC payments)
///      are load-bearing.
contract NumberDuel {
    /// @notice The USDFC token used for stakes and payouts.
    IERC20 public immutable usdfc;

    /// @notice After a guess lands, the setter has this long to reveal before the
    ///         guesser can claim the pot. Stops a losing setter from stalling.
    uint256 public constant REVEAL_WINDOW = 1 days;

    enum Status {
        None,
        Open,
        Joined,
        Settled,
        Cancelled
    }

    struct Duel {
        address setter;
        address guesser;
        uint256 stake; // per-player; pot = 2 * stake
        bytes32 commit; // keccak256(abi.encodePacked(number, salt)) — sealed, immutable
        uint8 guess;
        uint8 minNumber; // inclusive
        uint8 maxNumber; // inclusive
        uint8 revealedNumber; // set on reveal; 0 if claimed unrevealed
        address winner; // set once settled
        uint64 createdAt;
        uint64 joinedAt;
        Status status;
    }

    uint256 public nextDuelId = 1;
    mapping(uint256 => Duel) public duels;

    // Lightweight reentrancy guard (no external deps).
    uint256 private _lock = 1;
    modifier nonReentrant() {
        require(_lock == 1, "reentrant");
        _lock = 2;
        _;
        _lock = 1;
    }

    event DuelCreated(
        uint256 indexed duelId,
        address indexed setter,
        uint256 stake,
        bytes32 commit,
        uint8 minNumber,
        uint8 maxNumber
    );
    event DuelJoined(uint256 indexed duelId, address indexed guesser, uint8 guess);
    event DuelRevealed(uint256 indexed duelId, uint8 number, address indexed winner, uint256 pot);
    event DuelCancelled(uint256 indexed duelId, address indexed setter, uint256 refund);

    constructor(address _usdfc) {
        require(_usdfc != address(0), "usdfc=0");
        usdfc = IERC20(_usdfc);
    }

    /// @notice Setter opens a duel: commit the sealed number and escrow the stake.
    /// @param commit keccak256(abi.encodePacked(uint8 number, bytes32 salt))
    /// @param stake  per-player USDFC stake (caller must approve first)
    /// @param minNumber inclusive lower bound of the guessing range
    /// @param maxNumber inclusive upper bound of the guessing range
    function createDuel(bytes32 commit, uint256 stake, uint8 minNumber, uint8 maxNumber)
        external
        nonReentrant
        returns (uint256 duelId)
    {
        require(stake > 0, "stake=0");
        require(commit != bytes32(0), "empty commit");
        require(maxNumber > minNumber, "bad range");

        duelId = nextDuelId++;
        duels[duelId] = Duel({
            setter: msg.sender,
            guesser: address(0),
            stake: stake,
            commit: commit,
            guess: 0,
            minNumber: minNumber,
            maxNumber: maxNumber,
            revealedNumber: 0,
            winner: address(0),
            createdAt: uint64(block.timestamp),
            joinedAt: 0,
            status: Status.Open
        });

        // Effects done before the external transfer.
        require(usdfc.transferFrom(msg.sender, address(this), stake), "stake transfer failed");
        emit DuelCreated(duelId, msg.sender, stake, commit, minNumber, maxNumber);
    }

    /// @notice Guesser matches the stake and submits one guess.
    function joinDuel(uint256 duelId, uint8 guess) external nonReentrant {
        Duel storage d = duels[duelId];
        require(d.status == Status.Open, "not open");
        require(msg.sender != d.setter, "setter cannot join");
        require(guess >= d.minNumber && guess <= d.maxNumber, "guess out of range");

        d.guesser = msg.sender;
        d.guess = guess;
        d.joinedAt = uint64(block.timestamp);
        d.status = Status.Joined;

        require(usdfc.transferFrom(msg.sender, address(this), d.stake), "stake transfer failed");
        emit DuelJoined(duelId, msg.sender, guess);
    }

    /// @notice Setter reveals; contract verifies against the sealed commitment and pays the winner.
    /// @dev A setter who committed an out-of-range number cannot reveal it (this
    ///      reverts), and cannot reveal any other number (commit mismatch). Such a
    ///      cheat simply cannot settle, and the guesser claims the pot via
    ///      claimUnrevealed once the reveal window passes.
    function reveal(uint256 duelId, uint8 number, bytes32 salt) external nonReentrant {
        Duel storage d = duels[duelId];
        require(d.status == Status.Joined, "not joined");
        require(msg.sender == d.setter, "only setter");
        require(number >= d.minNumber && number <= d.maxNumber, "number out of range");
        require(keccak256(abi.encodePacked(number, salt)) == d.commit, "commit mismatch");

        d.status = Status.Settled;
        d.revealedNumber = number;
        uint256 pot = d.stake * 2;
        address winner = (number == d.guess) ? d.guesser : d.setter;
        d.winner = winner;

        emit DuelRevealed(duelId, number, winner, pot);
        require(usdfc.transfer(winner, pot), "payout failed");
    }

    /// @notice If the setter never reveals within REVEAL_WINDOW, the guesser takes the pot.
    function claimUnrevealed(uint256 duelId) external nonReentrant {
        Duel storage d = duels[duelId];
        require(d.status == Status.Joined, "not joined");
        require(msg.sender == d.guesser, "only guesser");
        require(block.timestamp > uint256(d.joinedAt) + REVEAL_WINDOW, "reveal window open");

        d.status = Status.Settled;
        d.winner = d.guesser;
        uint256 pot = d.stake * 2;
        emit DuelRevealed(duelId, 0, d.guesser, pot);
        require(usdfc.transfer(d.guesser, pot), "payout failed");
    }

    /// @notice If nobody has joined yet, the setter can cancel and reclaim their stake.
    function cancelOpenDuel(uint256 duelId) external nonReentrant {
        Duel storage d = duels[duelId];
        require(d.status == Status.Open, "not open");
        require(msg.sender == d.setter, "only setter");

        d.status = Status.Cancelled;
        emit DuelCancelled(duelId, d.setter, d.stake);
        require(usdfc.transfer(d.setter, d.stake), "refund failed");
    }

    /// @notice Read a full duel struct (handy for the frontend).
    function getDuel(uint256 duelId) external view returns (Duel memory) {
        return duels[duelId];
    }
}
