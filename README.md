# ERC-3009 Gas Provider Relayer

一个基于 ERC-3009 标准的 Gas 代付中继服务，支持 USDC 的 `transferWithAuthorization` 无 Gas 转账。

## 概述

ERC-3009 允许用户通过签名授权，让第三方（Relayer）代为执行转账并支付 Gas 费用。用户无需持有 ETH 即可完成 USDC 转账。

### 工作流程

```
┌─────────┐     签名授权      ┌─────────┐    代付 Gas 执行    ┌──────────┐
│  用户   │ ───────────────> │ Relayer │ ────────────────> │ USDC合约 │
└─────────┘                  └─────────┘                   └──────────┘
```

1. 用户使用私钥签署 `TransferWithAuthorization` 授权
2. 将签名数据发送给 Relayer
3. Relayer 验证签名后，代付 Gas 执行链上转账

## 技术栈

- **Express.js** - Web 服务框架
- **Viem** - 以太坊交互库
- **dotenv** - 环境变量管理

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# Relayer 钱包私钥 (需要有 ETH 支付 Gas)
# ⚠️ 警告: 永远不要将真实私钥提交到 Git!
RELAYER_PRIVATE_KEY=0x你的私钥

# 以太坊 RPC 端点 (可选，默认使用公共 RPC)
RPC_URL=https://eth.llamarpc.com

# 服务端口 (可选，默认 3001)
PORT=3001
```

### 3. 启动服务

```bash
# 生产模式
npm start

# 开发模式 (自动重载)
npm run dev
```

## API 接口

### 健康检查

```http
GET /health
```

**响应示例:**

```json
{
  "status": "ok",
  "relayer": "0x...",
  "balance": "1000000000000000000",
  "balanceEth": 1.0
}
```

### 中继转账

```http
POST /relay
Content-Type: application/json
```

**请求参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| from | address | 转出地址 (授权人) |
| to | address | 接收地址 |
| value | uint256 | 转账金额 (最小单位) |
| validAfter | uint256 | 授权生效时间戳 |
| validBefore | uint256 | 授权过期时间戳 |
| nonce | bytes32 | 唯一 nonce 值 |
| v | uint8 | 签名参数 v |
| r | bytes32 | 签名参数 r |
| s | bytes32 | 签名参数 s |

**请求示例:**

```json
{
  "from": "0x用户地址",
  "to": "0x接收地址",
  "value": "1000000",
  "validAfter": "0",
  "validBefore": "1735689600",
  "nonce": "0x...",
  "v": 27,
  "r": "0x...",
  "s": "0x..."
}
```

**成功响应:**

```json
{
  "success": true,
  "hash": "0x交易哈希",
  "blockNumber": "12345678",
  "gasUsed": "65000"
}
```

## ERC-3009 签名生成

客户端需要按照 EIP-712 标准生成签名：

```javascript
const domain = {
  name: 'USD Coin',
  version: '2',
  chainId: 1,
  verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
}

const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
}

const message = {
  from: userAddress,
  to: recipientAddress,
  value: amount,
  validAfter: 0n,
  validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
  nonce: randomBytes32
}
```

## 注意事项

1. **私钥安全**: 永远不要将真实私钥提交到版本控制
2. **Relayer 余额**: 确保 Relayer 钱包有足够的 ETH 支付 Gas 费用
3. **RPC 端点**: 生产环境建议使用付费的 RPC 服务（Infura、Alchemy 等）
4. **费用模型**: 实际生产中应考虑向用户收取服务费以覆盖 Gas 成本

## 相关链接

- [ERC-3009 标准](https://eips.ethereum.org/EIPS/eip-3009)
- [USDC 合约](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
- [Viem 文档](https://viem.sh/)

## License

MIT

