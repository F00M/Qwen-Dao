// Contract Addresses (Uniswap V3 Sepolia)
const CONTRACTS = {
    QWEN: "0x7ff367a947f0c01843732a74193022e2e9f261fa",
    WETH: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    Router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    QuoterV2: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
    Factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    PositionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
    
    // POOL ADDRESS
    QWEN_WETH_POOL: "0xb18831a4210340dc1483f738558825edff540574"
};

// Fee Tiers Uniswap V3
const FEE_TIERS = [100, 500, 3000, 10000];

// Token Decimals
const TOKEN_DECIMALS = {
    ETH: 18,
    WETH: 18,
    QWEN: 18
};

// Detected pool info
let DETECTED_POOL_ADDRESS = CONTRACTS.QWEN_WETH_POOL;
let DETECTED_FEE_TIER = 3000;
let POOL_EXISTS = true;

// Pool token order
let POOL_TOKEN0 = null;
let POOL_TOKEN1 = null;
let TOKEN_IN_IS_TOKEN0 = false;

// ABIs
const FACTORY_ABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)"
];

const POOL_ABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)",
    "function liquidity() view returns (uint128)",
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const QUOTER_ABI = [
    "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

const ROUTER_ABI = [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

// Helper function untuk get fee tier label
function getFeeTierLabel(fee) {
    const labels = {
        100: "0.01%",
        500: "0.05%",
        3000: "0.3%",
        10000: "1%"
    };
    return labels[fee] || "Unknown";
}
