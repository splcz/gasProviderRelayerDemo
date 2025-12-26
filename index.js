import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

const app = express()
app.use(cors())
app.use(express.json())

// USDC 合约配置
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

// Paymaster 合约配置
// Sepolia: 0x217fe9B8129b830D50Bcd51b0eD831E61f6b571e
// Mainnet: 部署后更新
const PAYMASTER_ADDRESS = process.env.PAYMASTER_ADDRESS || '0x217fe9B8129b830D50Bcd51b0eD831E61f6b571e'

// Paymaster 合约 ABI
const PAYMASTER_ABI = [
  {
    name: 'permitAndTransfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'activatePermit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getAllowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
]

const USDC_ABI = [
  // ERC-3009: transferWithAuthorization
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'authorizationState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  // ERC-2612: permit
  {
    name: 'permit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  // ERC-20: allowance
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ERC-20: transferFrom
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  // ERC-20: balanceOf
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
]

// 环境变量
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY
const RPC_URL = process.env.RPC_URL || 'https://eth.llamarpc.com'

// 延迟初始化客户端（用于 Serverless 环境）
let relayerAccount = null
let publicClient = null
let walletClient = null

function initClients() {
  if (!RELAYER_PRIVATE_KEY) {
    throw new Error('RELAYER_PRIVATE_KEY 环境变量未设置')
  }
  
  if (!relayerAccount) {
    relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY)
    console.log(`✅ Relayer 地址: ${relayerAccount.address}`)
  }
  
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: mainnet,
      transport: http(RPC_URL),
    })
  }
  
  if (!walletClient) {
    walletClient = createWalletClient({
      account: relayerAccount,
      chain: mainnet,
      transport: http(RPC_URL),
    })
  }
  
  return { relayerAccount, publicClient, walletClient }
}

// 健康检查
app.get('/health', async (req, res) => {
  try {
    const { relayerAccount, publicClient } = initClients()
    const balance = await publicClient.getBalance({ address: relayerAccount.address })
    res.json({
      status: 'ok',
      relayer: relayerAccount.address,
      paymaster: PAYMASTER_ADDRESS,
      balance: balance.toString(),
      balanceEth: Number(balance) / 1e18,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 执行 transferWithAuthorization
app.post('/relay', async (req, res) => {
  try {
    const { publicClient, walletClient } = initClients()
    const { from, to, value, validAfter, validBefore, nonce, v, r, s } = req.body

    // 参数验证
    if (!from || !to || !value || !nonce || !v || !r || !s) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    console.log('\n📨 收到中继请求:')
    console.log(`   From: ${from}`)
    console.log(`   To: ${to}`)
    console.log(`   Value: ${value}`)
    console.log(`   Nonce: ${nonce}`)

    // 检查授权是否已被使用
    const isUsed = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'authorizationState',
      args: [from, nonce],
    })

    if (isUsed) {
      return res.status(400).json({ error: '授权已被使用或已取消' })
    }

    // 检查有效期
    const now = Math.floor(Date.now() / 1000)
    if (BigInt(validBefore) < BigInt(now)) {
      return res.status(400).json({ error: '授权已过期' })
    }
    if (BigInt(validAfter) > BigInt(now)) {
      return res.status(400).json({ error: '授权尚未生效' })
    }

    // 执行转账
    console.log('⏳ 正在提交交易...')
    
    const hash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        from,
        to,
        BigInt(value),
        BigInt(validAfter),
        BigInt(validBefore),
        nonce,
        v,
        r,
        s,
      ],
    })

    console.log(`✅ 交易已提交: ${hash}`)

    // 等待交易确认（设置超时以适应 Serverless 环境）
    console.log('⏳ 等待交易确认...')
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      timeout: 45_000, // 45秒超时，适应 Vercel 限制
    })
    
    console.log(`✅ 交易已确认! 区块: ${receipt.blockNumber}`)

    res.json({
      success: true,
      hash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
    })

  } catch (error) {
    console.error('❌ 中继失败:', error.message)
    res.status(500).json({ 
      error: error.message || '中继服务执行失败',
      details: error.shortMessage || error.cause?.message,
    })
  }
})

// 执行 permit - 激活额度授权 (通过 Paymaster 合约)
app.post('/permit', async (req, res) => {
  try {
    const { publicClient, walletClient } = initClients()
    const { owner, value, deadline, v, r, s } = req.body

    // 参数验证 (spender 不再需要，固定为 Paymaster 合约)
    if (!owner || !value || !deadline || v === undefined || !r || !s) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    console.log('\n📨 收到 permit 请求:')
    console.log(`   Owner: ${owner}`)
    console.log(`   Spender: ${PAYMASTER_ADDRESS} (Paymaster 合约)`)
    console.log(`   Value: ${value}`)
    console.log(`   Deadline: ${deadline}`)

    // 检查 deadline
    const now = Math.floor(Date.now() / 1000)
    if (BigInt(deadline) < BigInt(now)) {
      return res.status(400).json({ error: 'Permit 已过期' })
    }

    // 通过 Paymaster 合约激活 permit
    console.log('⏳ 正在通过 Paymaster 合约提交 permit 交易...')
    
    const hash = await walletClient.writeContract({
      address: PAYMASTER_ADDRESS,
      abi: PAYMASTER_ABI,
      functionName: 'activatePermit',
      args: [
        owner,
        BigInt(value),
        BigInt(deadline),
        v,
        r,
        s,
      ],
    })

    console.log(`✅ Permit 交易已提交: ${hash}`)

    // 等待交易确认
    console.log('⏳ 等待交易确认...')
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      timeout: 45_000,
    })
    
    console.log(`✅ Permit 已确认! 区块: ${receipt.blockNumber}`)

    res.json({
      success: true,
      hash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
    })

  } catch (error) {
    console.error('❌ Permit 失败:', error.message)
    res.status(500).json({ 
      error: error.message || 'Permit 执行失败',
      details: error.shortMessage || error.cause?.message,
    })
  }
})

// 执行 transfer - 在已授权额度内转账 (通过 Paymaster 合约)
app.post('/transfer', async (req, res) => {
  try {
    const { publicClient, walletClient } = initClients()
    const { from, to, value } = req.body

    // 参数验证
    if (!from || !to || !value) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    console.log('\n📨 收到 transfer 请求:')
    console.log(`   From: ${from}`)
    console.log(`   To: ${to}`)
    console.log(`   Value: ${value}`)

    // 检查 allowance (授权给 Paymaster 合约)
    const allowance = await publicClient.readContract({
      address: PAYMASTER_ADDRESS,
      abi: PAYMASTER_ABI,
      functionName: 'getAllowance',
      args: [from],
    })

    console.log(`   Allowance (to Paymaster): ${allowance}`)

    if (BigInt(allowance) < BigInt(value)) {
      return res.status(400).json({ 
        error: '授权额度不足',
        allowance: allowance.toString(),
        required: value,
      })
    }

    // 检查用户余额
    const balance = await publicClient.readContract({
      address: PAYMASTER_ADDRESS,
      abi: PAYMASTER_ABI,
      functionName: 'getBalance',
      args: [from],
    })

    if (BigInt(balance) < BigInt(value)) {
      return res.status(400).json({ 
        error: '用户 USDC 余额不足',
        balance: balance.toString(),
        required: value,
      })
    }

    // 通过 Paymaster 合约执行 transfer
    console.log('⏳ 正在通过 Paymaster 合约提交 transfer 交易...')
    
    const hash = await walletClient.writeContract({
      address: PAYMASTER_ADDRESS,
      abi: PAYMASTER_ABI,
      functionName: 'transfer',
      args: [
        from,
        to,
        BigInt(value),
      ],
    })

    console.log(`✅ Transfer 交易已提交: ${hash}`)

    // 等待交易确认
    console.log('⏳ 等待交易确认...')
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      timeout: 45_000,
    })
    
    console.log(`✅ Transfer 已确认! 区块: ${receipt.blockNumber}`)

    // 查询剩余 allowance
    const remainingAllowance = await publicClient.readContract({
      address: PAYMASTER_ADDRESS,
      abi: PAYMASTER_ABI,
      functionName: 'getAllowance',
      args: [from],
    })

    res.json({
      success: true,
      hash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      remainingAllowance: remainingAllowance.toString(),
    })

  } catch (error) {
    console.error('❌ Transfer 失败:', error.message)
    res.status(500).json({ 
      error: error.message || 'Transfer 执行失败',
      details: error.shortMessage || error.cause?.message,
    })
  }
})

// 查询 allowance (授权给 Paymaster 合约的额度)
app.get('/allowance/:owner', async (req, res) => {
  try {
    const { publicClient } = initClients()
    const { owner } = req.params

    const allowance = await publicClient.readContract({
      address: PAYMASTER_ADDRESS,
      abi: PAYMASTER_ABI,
      functionName: 'getAllowance',
      args: [owner],
    })

    res.json({
      owner,
      spender: PAYMASTER_ADDRESS,
      allowance: allowance.toString(),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 本地开发时启动服务器
// Vercel 环境下不需要 listen，直接导出 app
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    console.log(`\n🚀 中继服务已启动: http://localhost:${PORT}`)
    console.log(`   健康检查: http://localhost:${PORT}/health`)
    console.log(`   ERC-3009 中继: POST http://localhost:${PORT}/relay`)
    console.log(`   Permit 激活: POST http://localhost:${PORT}/permit`)
    console.log(`   额度内转账: POST http://localhost:${PORT}/transfer`)
    console.log(`   查询额度: GET http://localhost:${PORT}/allowance/:owner`)
    console.log('\n⚠️  确保 Relayer 钱包有足够的 ETH 支付 Gas!')
  })
}

// 导出 app 供 Vercel 使用
export default app

