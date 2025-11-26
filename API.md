# Gasless USDC Relayer API 文档

**Base URL:** `https://gas-provider-relayer.vercel.app`

---

## 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/relay` | ERC-3009 中继转账（单次授权） |
| POST | `/permit` | 激活 Permit 额度授权 |
| POST | `/transfer` | 额度内转账（transferFrom） |
| GET | `/allowance/:owner` | 查询剩余授权额度 |

---

## 两种授权模式对比

| | ERC-3009 (`/relay`) | Permit (`/permit` + `/transfer`) |
|---|---------------------|----------------------------------|
| 用户签名次数 | 每次转账签 1 次 | 只签 1 次 |
| 额度内多次转账 | ❌ 不支持 | ✅ 支持 |
| 适用场景 | 单次转账 | 订阅、分期付款等 |

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

1. **Permit nonce**: Permit 使用递增的 nonce（每个地址一个计数器），与 ERC-3009 的随机 nonce 不同
2. **签名有效期**: 建议设置合理的 `deadline`/`validBefore`
3. **金额精度**: USDC 使用 6 位小数
4. **网络**: 当前仅支持以太坊主网 (chainId: 1)
5. **Relayer 地址**: `0x650629B1BE4A81a32018eCc4015f091fC3f25346`

---

## 相关链接

- **服务地址**: https://gas-provider-relayer.vercel.app
- **USDC 合约**: [0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
- **ERC-3009 标准**: https://eips.ethereum.org/EIPS/eip-3009
- **ERC-2612 (Permit)**: https://eips.ethereum.org/EIPS/eip-2612
- **EIP-712 标准**: https://eips.ethereum.org/EIPS/eip-712
