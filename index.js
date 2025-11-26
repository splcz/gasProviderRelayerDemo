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
const USDC_ABI = [
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
]

// 检查必要的环境变量
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY
const RPC_URL = process.env.RPC_URL || 'https://eth.llamarpc.com'

if (!RELAYER_PRIVATE_KEY) {
  console.error('❌ 错误: 请在 .env 文件中设置 RELAYER_PRIVATE_KEY')
  console.error('   格式: RELAYER_PRIVATE_KEY=0x...')
  process.exit(1)
}

// 创建 Relayer 账户
const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY)
console.log(`✅ Relayer 地址: ${relayerAccount.address}`)

// 创建客户端
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
})

const walletClient = createWalletClient({
  account: relayerAccount,
  chain: mainnet,
  transport: http(RPC_URL),
})

// 健康检查
app.get('/health', async (req, res) => {
  try {
    const balance = await publicClient.getBalance({ address: relayerAccount.address })
    res.json({
      status: 'ok',
      relayer: relayerAccount.address,
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

    // 等待交易确认
    console.log('⏳ 等待交易确认...')
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    
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

// 启动服务器
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`\n🚀 中继服务已启动: http://localhost:${PORT}`)
  console.log(`   健康检查: http://localhost:${PORT}/health`)
  console.log(`   中继接口: POST http://localhost:${PORT}/relay`)
  console.log('\n⚠️  确保 Relayer 钱包有足够的 ETH 支付 Gas!')
})

