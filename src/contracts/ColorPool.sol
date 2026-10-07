// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title ColorPool
/// @notice Color Token pool. Winners draw 1 COLOR out of the balance this contract keeps.
/// @dev Randomness is the main-chain block hash. On PSYROB (chain 87870) the Shanghai
///      block context sets PREVRANDAO to zero, so it is not entropy. BLOCKHASH of the
///      previous 256 blocks is the randomness the EVM actually exposes.
///
///      lock() records the guess in block N. The rolled pigment is
///      uint256(blockhash(N)) % 8, which does not exist during block N and can be
///      read from block N+1 through block N+256.
///
///      Pigment index: 0 vermilion, 1 marigold, 2 sap, 3 cerulean,
///      4 indigo, 5 orchid, 6 ivory, 7 lampblack.
contract ColorPool {
    string public constant name = "Color Token";
    string public constant symbol = "COLOR";
    uint8 public constant decimals = 0;
    uint8 public constant COLOR_COUNT = 8;

    uint256 public totalSupply;
    uint256 public paidOut;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public owner;

    struct OpenGuess {
        uint8 color;
        uint64 commitBlock;
        bool open;
    }

    mapping(address => OpenGuess) public guesses;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event GuessLocked(address indexed player, uint8 color, uint64 commitBlock);
    event RoundSettled(
        address indexed player,
        uint8 guess,
        uint8 rolled,
        bool matched,
        bool paid,
        bytes32 entropy
    );
    event PoolFilled(address indexed from, uint256 amount);

    error ColorOutOfRange();
    error GuessPending();
    error NoGuess();
    error TooSoon();
    error HashExpired();
    error NotOwner();
    error BadAmount();

    constructor(uint256 poolSize) {
        owner = msg.sender;
        if (poolSize > 1_000_000) revert BadAmount();
        if (poolSize > 0) _mint(address(this), poolSize);
    }

    function poolBalance() external view returns (uint256) {
        return balanceOf[address(this)];
    }

    /// @notice What the next settle() would roll, using the main-chain block hash.
    function preview(address player)
        external
        view
        returns (
            bool open,
            uint8 color,
            uint64 commitBlock,
            bool ready,
            bool expired,
            uint8 rolled,
            bytes32 entropy
        )
    {
        OpenGuess memory g = guesses[player];
        open = g.open;
        color = g.color;
        commitBlock = g.commitBlock;
        if (!open || block.number <= g.commitBlock) {
            return (open, color, commitBlock, false, false, 0, bytes32(0));
        }
        uint256 age = block.number - uint256(g.commitBlock);
        if (age > 256) {
            return (true, color, commitBlock, false, true, 0, bytes32(0));
        }
        entropy = blockhash(g.commitBlock);
        if (entropy == bytes32(0)) {
            return (true, color, commitBlock, false, true, 0, bytes32(0));
        }
        rolled = uint8(uint256(entropy) % COLOR_COUNT);
        ready = true;
    }

    function lock(uint8 color) external {
        if (color >= COLOR_COUNT) revert ColorOutOfRange();
        if (guesses[msg.sender].open) revert GuessPending();
        guesses[msg.sender] = OpenGuess(color, uint64(block.number), true);
        emit GuessLocked(msg.sender, color, uint64(block.number));
    }

    /// @notice Settle against blockhash(commitBlock). A match pays 1 COLOR from the pool.
    function settle() external {
        OpenGuess memory g = guesses[msg.sender];
        if (!g.open) revert NoGuess();
        if (block.number <= g.commitBlock) revert TooSoon();
        if (block.number - uint256(g.commitBlock) > 256) revert HashExpired();
        bytes32 entropy = blockhash(g.commitBlock);
        if (entropy == bytes32(0)) revert HashExpired();
        uint8 rolled = uint8(uint256(entropy) % COLOR_COUNT);
        delete guesses[msg.sender];
        bool matched = rolled == g.color;
        bool paid;
        if (matched && balanceOf[address(this)] > 0) {
            _transfer(address(this), msg.sender, 1);
            paidOut += 1;
            paid = true;
        }
        emit RoundSettled(msg.sender, g.color, rolled, matched, paid, entropy);
    }

    /// @notice Drop an open guess without drawing a token. Required after the hash expires.
    function abandon() external {
        if (!guesses[msg.sender].open) revert NoGuess();
        delete guesses[msg.sender];
    }

    /// @notice Mint more Color Tokens into the pool. Only the deployer.
    function fill(uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        if (amount == 0 || amount > 1_000_000) revert BadAmount();
        _mint(address(this), amount);
        emit PoolFilled(msg.sender, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert BadAmount();
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert BadAmount();
        uint256 bal = balanceOf[from];
        if (bal < amount) revert BadAmount();
        unchecked {
            balanceOf[from] = bal - amount;
        }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
