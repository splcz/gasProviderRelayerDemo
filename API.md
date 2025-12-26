# Gasless USDC Relayer API 文档

**Base URL:** `https://gas-provider-relayer.vercel.app`

---

## 接口列表

### 🔐 Permit2 接口（推荐）

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/permit2/transfer` | Permit2 签名转账（行业标准，已审计） |
| GET | `/permit2/allowance/:owner` | 查询用户对 Permit2 的授权额度 |

### 传统接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/relay` | ERC-3009 中继转账（单次授权） |
| POST | `/permit` | 激活 Permit 额度授权 |
| POST | `/transfer` | 额度内转账（transferFrom） |
| GET | `/allowance/:owner` | 查询剩余授权额度 |

---

## 三种授权模式对比

| | Permit2 (`/permit2/transfer`) | ERC-3009 (`/relay`) | ERC-2612 Permit |
|---|------------------------------|---------------------|-----------------|
| **推荐度** | ⭐⭐⭐⭐⭐ 首选 | ⭐⭐⭐ | ⭐⭐ |
| **安全性** | ✅ 已审计合约 | ✅ USDC 原生 | ⚠️ spender 警告 |
| **用户签名** | 每次 1 签名 | 每次 1 签名 | 1 签名 + 多次转账 |
| **前置条件** | approve Permit2（一次性） | 无 | 无 |
| **钱包兼容** | ✅ 无警告 | ✅ 无警告 | ⚠️ EOA 警告 |

---

# Permit2 接口（推荐）

Permit2 是 Uniswap 开发的行业标准合约，已通过多次安全审计，被 100+ 个 DeFi 协议使用。

**Permit2 合约地址**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`

---

## P1. Permit2 签名转账

使用 Permit2 签名执行转账，由 Relayer 代付 Gas。

### 前置条件

用户需要先授权 USDC 给 Permit2 合约（一次性链上操作）：
```javascript
// 用户调用 USDC.approve(Permit2地址, 金额)
await usdc.approve('0x000000000022D473030F116dDEE9F6B43aC78BA3', maxUint256)
```

### 请求

```http
POST /permit2/transfer
Content-Type: application/json
```

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| owner | address | ✅ | 转出地址（签名者） |
| to | address | ✅ | 接收地址 |
| amount | string | ✅ | 转账金额（USDC 最小单位） |
| nonce | string | ✅ | 唯一 nonce（从 0 开始递增） |
| deadline | string | ✅ | 签名过期时间（Unix 时间戳） |
| signature | bytes | ✅ | EIP-712 签名 |

### 请求示例

```json
{
  "owner": "0xUserAddress000000000000000000000000000000",
  "to": "0xRecipientAddress0000000000000000000000000",
  "amount": "1000000",
  "nonce": "0",
  "deadline": "1735689600",
  "signature": "0xabcdef..."
}
```

### 响应

**成功 (200)**

```json
{
  "success": true,
  "hash": "0x...",
  "blockNumber": "18500000",
  "gasUsed": "65000"
}
```

**失败 (400)**

```json
{
  "error": "用户未授权 USDC 给 Permit2 合约，或授权额度不足",
  "permit2Allowance": "0",
  "required": "1000000",
  "hint": "用户需要先调用 USDC.approve(Permit2地址, 金额)"
}
```

### cURL 示例

```bash
curl -X POST https://gas-provider-relayer.vercel.app/permit2/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "0xUserAddress...",
    "to": "0xRecipient...",
    "amount": "1000000",
    "nonce": "0",
    "deadline": "1735689600",
    "signature": "0x..."
  }'
```

---

## P2. 查询 Permit2 授权额度

查询用户是否已授权 USDC 给 Permit2 合约。

### 请求

```http
GET /permit2/allowance/:owner
```

### 响应

**成功 (200)**

```json
{
  "owner": "0xUserAddress...",
  "permit2": "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  "allowance": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
  "needsApproval": false
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| owner | string | 用户地址 |
| permit2 | string | Permit2 合约地址 |
| allowance | string | 授权额度 |
| needsApproval | boolean | 是否需要授权 |

### cURL 示例

```bash
curl https://gas-provider-relayer.vercel.app/permit2/allowance/0xUserAddress...
```

---

## Permit2 工作流程

```
┌──────────────────────────────────────────────────────────────────┐
│ 首次使用（一次性，用户付 Gas）                                      │
├──────────────────────────────────────────────────────────────────┤
│ 用户调用 USDC.approve(Permit2合约, 大额度)                         │
│ 例如: approve(0x000...BA3, MaxUint256)                           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 每次转账                                                          │
├──────────────────────────────────────────────────────────────────┤
│ 1. 用户签署 Permit2 签名（链下，0 Gas）                            │
│ 2. 调用 POST /permit2/transfer（Relayer 代付 Gas）                │
│ 3. 转账完成                                                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Permit2 签名示例

```javascript
import { createWalletClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

// Permit2 EIP-712 Domain
const permit2Domain = {
  name: 'Permit2',
  chainId: 1,
  verifyingContract: PERMIT2_ADDRESS
}

// Permit2 SignatureTransfer 类型
const permit2Types = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ]
}

// 签署 Permit2
async function signPermit2Transfer(walletClient, owner, to, amount, nonce, deadline) {
  const RELAYER_ADDRESS = '0x650629B1BE4A81a32018eCc4015f091fC3f25346'
  
  const message = {
    permitted: {
      token: USDC_ADDRESS,
      amount: BigInt(amount)
    },
    spender: RELAYER_ADDRESS,
    nonce: BigInt(nonce),
    deadline: BigInt(deadline)
  }

  const signature = await walletClient.signTypedData({
    domain: permit2Domain,
    types: permit2Types,
    primaryType: 'PermitTransferFrom',
    message
  })

  return {
    owner,
    to,
    amount: amount.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signature
  }
}

// 使用示例
const data = await signPermit2Transfer(
  walletClient,
  userAddress,
  recipientAddress,
  '1000000',      // 1 USDC
  '0',            // nonce（每次递增）
  Math.floor(Date.now() / 1000) + 3600  // 1小时后过期
)

// 发送到 Relayer
await fetch('https://gas-provider-relayer.vercel.app/permit2/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
```

---

# 传统接口

以下是传统的 ERC-3009 和 ERC-2612 接口，仍然可用但推荐使用 Permit2。

---

## 1. 健康检查

检查服务状态和 Relayer 钱包余额。

### 请求

```http
GET /health
```

### 响应

**成功 (200)**

```json
{
  "status": "ok",
  "relayer": "0x650629B1BE4A81a32018eCc4015f091fC3f25346",
  "balance": "1000000000000000000",
  "balanceEth": 1.0
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| status | string | 服务状态 |
| relayer | string | Relayer 钱包地址 |
| balance | string | ETH 余额 (wei) |
| balanceEth | number | ETH 余额 |

---

## 2. ERC-3009 中继转账

执行 ERC-3009 `transferWithAuthorization` 转账，由 Relayer 代付 Gas。

**特点**：每次转账需要用户签名一次。

### 请求

```http
POST /relay
Content-Type: application/json
```

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| from | address | ✅ | 转出地址（授权签名者） |
| to | address | ✅ | 接收地址 |
| value | string | ✅ | 转账金额（USDC 最小单位，6位小数） |
| validAfter | string | ✅ | 授权生效时间（Unix 时间戳） |
| validBefore | string | ✅ | 授权过期时间（Unix 时间戳） |
| nonce | bytes32 | ✅ | 唯一随机数（32字节十六进制） |
| v | number | ✅ | 签名参数 v（27 或 28） |
| r | bytes32 | ✅ | 签名参数 r |
| s | bytes32 | ✅ | 签名参数 s |

### 请求示例

```json
{
  "from": "0xUserAddress000000000000000000000000000000",
  "to": "0xRecipientAddress0000000000000000000000000",
  "value": "1000000",
  "validAfter": "0",
  "validBefore": "1735689600",
  "nonce": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "v": 27,
  "r": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "s": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

### 响应

**成功 (200)**

```json
{
  "success": true,
  "hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "blockNumber": "18500000",
  "gasUsed": "65000"
}
```

**失败 (400)**

```json
{
  "error": "授权已被使用或已取消"
}
```

### cURL 示例

```bash
curl -X POST https://gas-provider-relayer.vercel.app/relay \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0xUserAddress...",
    "to": "0xRecipient...",
    "value": "1000000",
    "validAfter": "0",
    "validBefore": "1735689600",
    "nonce": "0x...",
    "v": 27,
    "r": "0x...",
    "s": "0x..."
  }'
```

---

## 3. 激活 Permit 额度授权

执行 ERC-2612 `permit` 函数，激活用户的额度授权。

**特点**：用户签名一次，可在额度内多次转账。

### 请求

```http
POST /permit
Content-Type: application/json
```

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| owner | address | ✅ | 授权者地址（用户钱包） |
| spender | address | ✅ | 被授权者地址（通常是 Relayer） |
| value | string | ✅ | 授权额度（USDC 最小单位） |
| deadline | string | ✅ | 授权过期时间（Unix 时间戳） |
| v | number | ✅ | 签名参数 v |
| r | bytes32 | ✅ | 签名参数 r |
| s | bytes32 | ✅ | 签名参数 s |

### 请求示例

```json
{
  "owner": "0xUserAddress000000000000000000000000000000",
  "spender": "0x650629B1BE4A81a32018eCc4015f091fC3f25346",
  "value": "10000000",
  "deadline": "1735689600",
  "v": 28,
  "r": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "s": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

### 响应

**成功 (200)**

```json
{
  "success": true,
  "hash": "0x...",
  "blockNumber": "18500000",
  "gasUsed": "50000"
}
```

**失败 (400)**

```json
{
  "error": "Permit 已过期"
}
```

### cURL 示例

```bash
curl -X POST https://gas-provider-relayer.vercel.app/permit \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "0xUserAddress...",
    "spender": "0x650629B1BE4A81a32018eCc4015f091fC3f25346",
    "value": "10000000",
    "deadline": "1735689600",
    "v": 28,
    "r": "0x...",
    "s": "0x..."
  }'
```

---

## 4. 额度内转账

在已激活的额度内执行 `transferFrom` 转账。

**特点**：用户无需任何操作，由 Relayer 直接执行。

### 请求

```http
POST /transfer
Content-Type: application/json
```

### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| from | address | ✅ | 转出地址（已授权的用户） |
| to | address | ✅ | 接收地址 |
| value | string | ✅ | 转账金额（USDC 最小单位） |

### 请求示例

```json
{
  "from": "0xUserAddress000000000000000000000000000000",
  "to": "0xRecipientAddress0000000000000000000000000",
  "value": "1000000"
}
```

### 响应

**成功 (200)**

```json
{
  "success": true,
  "hash": "0x...",
  "blockNumber": "18500000",
  "gasUsed": "55000",
  "remainingAllowance": "9000000"
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| success | boolean | 是否成功 |
| hash | string | 交易哈希 |
| blockNumber | string | 确认区块号 |
| gasUsed | string | 消耗的 Gas |
| remainingAllowance | string | 剩余授权额度 |

**失败 (400)**

```json
{
  "error": "授权额度不足",
  "allowance": "500000",
  "required": "1000000"
}
```

```json
{
  "error": "用户 USDC 余额不足",
  "balance": "500000",
  "required": "1000000"
}
```

### cURL 示例

```bash
curl -X POST https://gas-provider-relayer.vercel.app/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0xUserAddress...",
    "to": "0xRecipient...",
    "value": "1000000"
  }'
```

---

## 5. 查询授权额度

查询用户授权给 Relayer 的剩余额度。

### 请求

```http
GET /allowance/:owner
```

### 路径参数

| 参数 | 类型 | 描述 |
|------|------|------|
| owner | address | 用户钱包地址 |

### 响应

**成功 (200)**

```json
{
  "owner": "0xUserAddress000000000000000000000000000000",
  "spender": "0x650629B1BE4A81a32018eCc4015f091fC3f25346",
  "allowance": "9000000"
}
```

### cURL 示例

```bash
curl https://gas-provider-relayer.vercel.app/allowance/0xUserAddress...
```

---

## Permit 工作流程

```
┌──────────────────────────────────────────────────────────────────┐
│ 步骤 1: 用户签署 Permit（链下，0 Gas）                            │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ 签署 ERC-2612 Permit                                        │  │
│ │ - owner: 用户地址                                           │  │
│ │ - spender: Relayer 地址                                     │  │
│ │ - value: 10 USDC (授权额度)                                 │  │
│ │ - deadline: 24小时后                                        │  │
│ └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 步骤 2: 调用 POST /permit 激活额度（Relayer 付 Gas）              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 步骤 3: 多次调用 POST /transfer（用户无需操作）                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ POST /transfer { from, to, value: "5000000" } → 转 5 USDC   │  │
│ │ POST /transfer { from, to, value: "3000000" } → 转 3 USDC   │  │
│ │ POST /transfer { from, to, value: "2000000" } → 转 2 USDC   │  │
│ │                                                             │  │
│ │ ✅ 用户全程只签名 1 次！                                     │  │
│ └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## EIP-712 签名示例

### Permit 签名 (ERC-2612)

```javascript
import { createWalletClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const RELAYER_ADDRESS = '0x650629B1BE4A81a32018eCc4015f091fC3f25346'

// EIP-712 Domain
const domain = {
  name: 'USD Coin',
  version: '2',
  chainId: 1,
  verifyingContract: USDC_ADDRESS
}

// Permit 类型
const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
}

// 签署 Permit
async function signPermit(walletClient, owner, value, nonce, deadline) {
  const message = {
    owner,
    spender: RELAYER_ADDRESS,
    value: BigInt(value),
    nonce: BigInt(nonce),
    deadline: BigInt(deadline)
  }

  const signature = await walletClient.signTypedData({
    domain,
    types: permitTypes,
    primaryType: 'Permit',
    message
  })

  // 解析签名
  const r = `0x${signature.slice(2, 66)}`
  const s = `0x${signature.slice(66, 130)}`
  const v = parseInt(signature.slice(130, 132), 16)

  return {
    owner,
    spender: RELAYER_ADDRESS,
    value: value.toString(),
    deadline: deadline.toString(),
    v, r, s
  }
}
```

### TransferWithAuthorization 签名 (ERC-3009)

```javascript
// ERC-3009 类型
const transferTypes = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
}

// 生成随机 nonce
function generateNonce() {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
```

---

## USDC 金额说明

USDC 使用 6 位小数：

| 实际金额 | value 参数值 |
|----------|-------------|
| 0.01 USDC | `10000` |
| 0.1 USDC | `100000` |
| 1 USDC | `1000000` |
| 10 USDC | `10000000` |
| 100 USDC | `100000000` |

---

## 错误码说明

| HTTP 状态码 | 错误类型 | 说明 |
|------------|---------|------|
| 200 | 成功 | 交易执行成功 |
| 400 | 参数错误 | 缺少参数、授权已使用、授权过期、额度不足等 |
| 500 | 服务器错误 | RPC 错误、签名验证失败、Gas 不足等 |

---

## 注意事项

1. **推荐 Permit2**: 行业标准，已审计，无钱包警告
2. **Permit2 前置条件**: 用户需先 approve USDC 给 Permit2 合约（一次性）
3. **Permit2 nonce**: 从 0 开始递增，每个地址独立计数
4. **金额精度**: USDC 使用 6 位小数
5. **网络**: 当前仅支持以太坊主网 (chainId: 1)
6. **Relayer 地址**: `0x650629B1BE4A81a32018eCc4015f091fC3f25346`

---

## 相关链接

- **服务地址**: https://gas-provider-relayer.vercel.app
- **Permit2 合约**: [0x000000000022D473030F116dDEE9F6B43aC78BA3](https://etherscan.io/address/0x000000000022D473030F116dDEE9F6B43aC78BA3)
- **Permit2 GitHub**: https://github.com/Uniswap/permit2
- **USDC 合约**: [0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
- **ERC-3009 标准**: https://eips.ethereum.org/EIPS/eip-3009
- **ERC-2612 (Permit)**: https://eips.ethereum.org/EIPS/eip-2612
- **EIP-712 标准**: https://eips.ethereum.org/EIPS/eip-712
