# 环境变量配置

在 `server` 目录下创建 `.env` 文件：

```bash
cd server
touch .env
```

然后添加以下内容：

```
# Relayer 钱包私钥 (需要有 ETH 支付 Gas)
# ⚠️ 警告: 永远不要将真实私钥提交到 Git!
RELAYER_PRIVATE_KEY=0x你的私钥

# Paymaster 合约地址 (部署后填写)
# 用于 ERC-2612 Permit 授权，解决钱包 "untrusted EOA" 警告
PAYMASTER_ADDRESS=0x部署后的合约地址

# 以太坊 RPC 端点 (可选，默认使用公共 RPC)
# 推荐使用 Infura/Alchemy 等付费服务以获得更好的稳定性
RPC_URL=https://eth.llamarpc.com

# 服务端口 (可选，默认 3001)
PORT=3001

# Etherscan API Key (可选，用于合约验证)
ETHERSCAN_API_KEY=你的Etherscan_API_Key
```

## 注意事项

1. **私钥安全**: 永远不要将包含真实私钥的 `.env` 文件提交到版本控制
2. **Relayer 余额**: 确保 Relayer 钱包有足够的 ETH 支付 Gas 费用
3. **RPC 端点**: 生产环境建议使用付费的 RPC 服务（Infura、Alchemy 等）

