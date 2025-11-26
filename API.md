# ERC-3009 Relayer API 文档

**Base URL:** `https://gas-provider-relayer.vercel.app`

---

## 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/relay` | 执行中继转账 |

---

## 1. 健康检查

检查服务状态和 Relayer 钱包余额。

### 请求

```http
GET https://gas-provider-relayer.vercel.app/health
```

### 响应

**成功 (200)**

```json
{
  "status": "ok",
  "relayer": "0x1234567890abcdef1234567890abcdef12345678",
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

**失败 (500)**

```json
{
  "error": "错误信息"
}
```

### cURL 示例

```bash
curl https://gas-provider-relayer.vercel.app/health
```

---

## 2. 中继转账

执行 ERC-3009 `transferWithAuthorization` 转账，由 Relayer 代付 Gas。

### 请求

```http
POST https://gas-provider-relayer.vercel.app/relay
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

| 字段 | 类型 | 描述 |
|------|------|------|
| success | boolean | 是否成功 |
| hash | string | 交易哈希 |
| blockNumber | string | 确认区块号 |
| gasUsed | string | 消耗的 Gas |

**失败 (400) - 参数错误**

```json
{
  "error": "缺少必要参数"
}
```

```json
{
  "error": "授权已被使用或已取消"
}
```

```json
{
  "error": "授权已过期"
}
```

```json
{
  "error": "授权尚未生效"
}
```

**失败 (500) - 服务器错误**

```json
{
  "error": "执行失败的错误信息",
  "details": "详细错误原因"
}
```

### cURL 示例

```bash
curl -X POST https://gas-provider-relayer.vercel.app/relay \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0xUserAddress000000000000000000000000000000",
    "to": "0xRecipientAddress0000000000000000000000000",
    "value": "1000000",
    "validAfter": "0",
    "validBefore": "1735689600",
    "nonce": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "v": 27,
    "r": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "s": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'
```

---

## 签名生成指南

客户端需要使用 EIP-712 标准生成签名。以下是使用 Viem 的示例：

### JavaScript / TypeScript 示例

```javascript
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { keccak256, toHex } from 'viem'

// USDC 合约信息
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

// EIP-712 Domain
const domain = {
  name: 'USD Coin',
  version: '2',
  chainId: 1,
  verifyingContract: USDC_ADDRESS
}

// EIP-712 Types
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

// 生成随机 nonce
function generateNonce() {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return toHex(randomBytes)
}

// 签名授权
async function signAuthorization(walletClient, params) {
  const { from, to, value } = params
  
  const nonce = generateNonce()
  const validAfter = 0n
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1小时后过期
  
  const message = {
    from,
    to,
    value: BigInt(value),
    validAfter,
    validBefore,
    nonce
  }
  
  const signature = await walletClient.signTypedData({
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message
  })
  
  // 解析签名
  const r = signature.slice(0, 66)
  const s = '0x' + signature.slice(66, 130)
  const v = parseInt(signature.slice(130, 132), 16)
  
  return {
    from,
    to,
    value: value.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
    v,
    r,
    s
  }
}

// 使用示例
async function main() {
  const account = privateKeyToAccount('0x你的私钥')
  
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http()
  })
  
  // 生成签名数据
  const authData = await signAuthorization(walletClient, {
    from: account.address,
    to: '0x接收地址',
    value: '1000000' // 1 USDC (6位小数)
  })
  
  // 发送到 Relayer
  const response = await fetch('https://gas-provider-relayer.vercel.app/relay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authData)
  })
  
  const result = await response.json()
  console.log('交易结果:', result)
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
| 400 | 参数错误 | 缺少参数、授权已使用、授权过期等 |
| 500 | 服务器错误 | RPC 错误、签名验证失败、Gas 不足等 |

---

## 注意事项

1. **签名有效期**: 建议设置合理的 `validBefore`，避免签名被长期滥用
2. **Nonce 唯一性**: 每个 nonce 只能使用一次，重复使用会失败
3. **金额精度**: USDC 使用 6 位小数，注意金额转换
4. **网络**: 当前仅支持以太坊主网 (chainId: 1)
5. **超时**: Serverless 环境有执行时间限制，交易确认可能超时

---

## 相关链接

- **服务地址**: https://gas-provider-relayer.vercel.app
- **USDC 合约**: [0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
- **ERC-3009 标准**: https://eips.ethereum.org/EIPS/eip-3009
- **EIP-712 标准**: https://eips.ethereum.org/EIPS/eip-712

