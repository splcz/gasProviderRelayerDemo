// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title USDCPaymaster
 * @notice 用于 ERC-2612 Permit 的中继合约
 * @dev 用户签署 Permit 授权给本合约，Relayer 调用本合约执行转账
 *      解决钱包提示 "untrusted EOA" 的问题
 */
interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);
}

contract USDCPaymaster is Ownable, ReentrancyGuard, Pausable {
    /// @notice USDC 合约地址
    IERC20Permit public immutable usdc;

    /// @notice 单笔转账最大金额 (默认 10,000 USDC)
    uint256 public maxTransferAmount = 10_000 * 1e6;

    /// @notice Permit 激活并转账事件
    event PermitAndTransfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice 配置更新事件
    event MaxTransferAmountUpdated(uint256 oldAmount, uint256 newAmount);

    /// @notice 构造函数
    /// @param _usdc USDC 合约地址
    /// @param _owner 合约 Owner (Relayer EOA)
    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20Permit(_usdc);
    }

    /**
     * @notice 激活 Permit 并立即转账 (一次交易完成两步)
     * @param owner 授权者地址 (用户)
     * @param to 接收地址
     * @param value 转账金额
     * @param deadline Permit 过期时间
     * @param v 签名参数
     * @param r 签名参数
     * @param s 签名参数
     */
    function permitAndTransfer(
        address owner,
        address to,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external onlyOwner nonReentrant whenNotPaused {
        require(owner != address(0), "Invalid owner");
        require(to != address(0), "Invalid recipient");
        require(value > 0, "Amount must be greater than 0");
        require(value <= maxTransferAmount, "Exceeds max transfer amount");
        require(block.timestamp <= deadline, "Permit expired");

        // 检查用户余额
        uint256 balance = usdc.balanceOf(owner);
        require(balance >= value, "Insufficient balance");

        // 激活 Permit (用户的签名授权给本合约)
        usdc.permit(owner, address(this), value, deadline, v, r, s);

        // 执行转账
        bool success = usdc.transferFrom(owner, to, value);
        require(success, "Transfer failed");

        emit PermitAndTransfer(owner, to, value, block.timestamp);
    }

    /**
     * @notice 仅激活 Permit (不转账，用于分步操作)
     * @param owner 授权者地址
     * @param value 授权金额
     * @param deadline 过期时间
     * @param v 签名参数
     * @param r 签名参数
     * @param s 签名参数
     */
    function activatePermit(
        address owner,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external onlyOwner nonReentrant whenNotPaused {
        require(owner != address(0), "Invalid owner");
        require(block.timestamp <= deadline, "Permit expired");

        usdc.permit(owner, address(this), value, deadline, v, r, s);
    }

    /**
     * @notice 在已有授权额度内转账
     * @param from 转出地址
     * @param to 接收地址
     * @param value 转账金额
     */
    function transfer(
        address from,
        address to,
        uint256 value
    ) external onlyOwner nonReentrant whenNotPaused {
        require(from != address(0), "Invalid from address");
        require(to != address(0), "Invalid recipient");
        require(value > 0, "Amount must be greater than 0");
        require(value <= maxTransferAmount, "Exceeds max transfer amount");

        // 检查授权额度
        uint256 allowance = usdc.allowance(from, address(this));
        require(allowance >= value, "Insufficient allowance");

        // 检查余额
        uint256 balance = usdc.balanceOf(from);
        require(balance >= value, "Insufficient balance");

        // 执行转账
        bool success = usdc.transferFrom(from, to, value);
        require(success, "Transfer failed");

        emit PermitAndTransfer(from, to, value, block.timestamp);
    }

    /**
     * @notice 查询用户授权给本合约的额度
     * @param owner 用户地址
     * @return 授权额度
     */
    function getAllowance(address owner) external view returns (uint256) {
        return usdc.allowance(owner, address(this));
    }

    /**
     * @notice 查询用户 USDC 余额
     * @param account 用户地址
     * @return 余额
     */
    function getBalance(address account) external view returns (uint256) {
        return usdc.balanceOf(account);
    }

    // ============ 管理功能 ============

    /**
     * @notice 设置单笔转账最大金额
     * @param _maxAmount 新的最大金额
     */
    function setMaxTransferAmount(uint256 _maxAmount) external onlyOwner {
        uint256 oldAmount = maxTransferAmount;
        maxTransferAmount = _maxAmount;
        emit MaxTransferAmountUpdated(oldAmount, _maxAmount);
    }

    /**
     * @notice 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}

