const consts = {
    CKB: require('@nervosnetwork/ckb-sdk-core').default,
    CKBUtils: require('@nervosnetwork/ckb-sdk-utils'),
    UDTSwapTypeCodeHash : null,
    UDTSwapLockCodeHash : null,
    UDTSwapLiquidityUDTCodeHash : null,
    UDTSwapTypeDeps : {
        'txHash' : null,
        'index' : "0x0"
    },
    UDTSwapLockDeps : {
        'txHash' : null,
        'index' : "0x0"
    },
    UDTSwapLiquidityUDTDeps : {
        'txHash' : null,
        'index' : "0x0"
    },
    UDT1Owner : null,
    UDT2Owner : null,
    skTesting : null,

    testUDTType : {
        hashType: 'type',
        codeHash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
        args: null
    },
    testUDTDeps : {
        outPoint: {
            txHash: null,
            index: "0x0"
        },
        depType: "code"
    },
    //UDTswap's protection fee pkh
    feePkh : "0xa3f81ce386206baf6673217a4ddc70e07b26da14",
    nervosDefaultLockCodeHash : "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
    ckbTypeHash : "0x0000000000000000000000000000000000000000000000000000000000000000",
    ckbMinimum : BigInt(6100000000),
    udtMinimum : BigInt(1),
    feeAmount : BigInt(6100000000),
    txFeeMax : BigInt(10000),
    poolCellCKB : BigInt(30000000000),
    ckbLockCellMinimum : BigInt(30000000000),
    nodeUrl: 'http://localhost:8114',
    sk: null,
    fs: require('fs'),
    ckb: null,
    pk: null,
    pkh: null,
    addr: null,
    lockScript: null,
    lockHash: null,
};

module.exports = consts;