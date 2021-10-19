const assert = require('assert');

const txBuilder = require('./tx/txBuilder.js');
const utils = require('./utils.js');
const consts = require('./consts.js');

describe('#UDTSwap test', function() {
    let ckbAsUDT = {
        args: "0x",
        codeHash: consts.ckbTypeHash,
        dataWithoutAmount: "",
        hashType: "type",
        udtDepsDepType: "code",
        udtDepsTxHash: "0x",
        udtDepsTxIndex: null,
        udtTypeHash: consts.ckbTypeHash,
    };

    let currentUDT1 = {
        args: null,
        codeHash: null,
        dataWithoutAmount: "",
        hashType: "type",
        udtDepsDepType: "code",
        udtDepsTxHash: null,
        udtDepsTxIndex: "0x0",
        udtTypeHash: null,
    };

    let currentUDT2 = {
        args: null,
        codeHash: null,
        dataWithoutAmount: "",
        hashType: "type",
        udtDepsDepType: "code",
        udtDepsTxHash: null,
        udtDepsTxIndex: "0x0",
        udtTypeHash: null,
    };

    let currentPoolCKB = {
        liveTxHash: null,
        liveTxIndex: 0,
        totalLiquidity: null,
        poolIdentifier: null,
        udt1ActualReserve: null,
        udt1Reserve: null,
        udt1TypeHash: null,
        udt2ActualReserve: null,
        udt2Reserve: null,
        udt2TypeHash: null,
    };

    let currentPool = {
        liveTxHash: null,
        liveTxIndex: 0,
        totalLiquidity: null,
        poolIdentifier: null,
        udt1ActualReserve: null,
        udt1Reserve: null,
        udt1TypeHash: null,
        udt2ActualReserve: null,
        udt2Reserve: null,
        udt2TypeHash: null,
    };

    let udt1Amount = null;
    let udt2Amount = null;
    let liquidityUDTAmount = null;
    let secretKey = consts.skTesting;
    let toAddr = null;
    let isRev = false;

    let udt1AmountArr = [];
    let udt2AmountArr = [];
    let liquidityUDTAmountArr = [];
    let currentUDT1Arr = [];
    let currentUDT2Arr = [];
    let currentPoolArr = [];
    let isRevArr = [];

    let maxtime = 90*1000;

    function addPool(
        udt1Amount,
        udt2Amount,
        liquidityUDTAmount,
        CurrentUDT1,
        CurrentUDT2,
        CurrentPool,
        isRev
    ) {
        udt1AmountArr.push(udt1Amount);
        udt2AmountArr.push(udt2Amount);
        liquidityUDTAmountArr.push(liquidityUDTAmount);
        currentUDT1Arr.push(CurrentUDT1);
        currentUDT2Arr.push(CurrentUDT2);
        currentPoolArr.push(CurrentPool);
        isRevArr.push(isRev);
    }

    async function sendTransaction(idx) {
        return await txBuilder.sendTransaction(
            idx,
            secretKey,
            udt1AmountArr,
            udt2AmountArr,
            liquidityUDTAmountArr,
            currentUDT1Arr,
            currentUDT2Arr,
            currentPoolArr,
            isRevArr,
            toAddr
        );
    }

    function getTransactionRes(transaction, idx) {
        const outputsData = transaction.outputsData;
        const UDTSwapCellOutputData = outputsData[idx];

        const afterUDT1Reserve = BigInt(utils.changeEndianness(
            UDTSwapCellOutputData.substr(0, 34)
        ));
        const afterUDT2Reserve = BigInt(utils.changeEndianness(
            '0x'+UDTSwapCellOutputData.substr(34, 32)
        ));
        const afterTotalLiquidity = BigInt(utils.changeEndianness(
            '0x'+UDTSwapCellOutputData.substr(66)
        ));

        return {
            udt1Reserve: afterUDT1Reserve,
            udt2Reserve: afterUDT2Reserve,
            totalLiquidity: afterTotalLiquidity
        }
    }

    async function checkAmounts(CurrentPool, txHash, idx) {
        let confirmed;
        while(true) {
            confirmed = await consts.ckb.rpc.getLiveCell({
                txHash,
                index: "0x0"
            }, false);
            if(confirmed.status === 'live') break;
            await utils.sleep(1000);
        }

        let txRes = await consts.ckb.rpc.getTransaction(txHash);
        let poolAmounts = getTransactionRes(txRes.transaction, idx);
        assert.strictEqual(
            String(CurrentPool.udt1Reserve),
            String(poolAmounts.udt1Reserve)
        );
        assert.strictEqual(
            String(CurrentPool.udt2Reserve),
            String(poolAmounts.udt2Reserve)
        );
        assert.strictEqual(
            String(CurrentPool.totalLiquidity),
            String(poolAmounts.totalLiquidity)
        );
    }

    before(function() {
        consts.ckb = new consts.CKB(consts.nodeUrl);

        let obj = consts.fs.readFileSync(__dirname + '/../consts.json', 'utf8');
        obj = JSON.parse(obj);
        consts.UDTSwapTypeCodeHash = consts.ckb.utils.scriptToHash(obj.scripts[0]);
        consts.UDTSwapLockCodeHash = consts.ckb.utils.scriptToHash(obj.scripts[1]);
        consts.UDTSwapLiquidityUDTCodeHash = consts.ckb.utils.scriptToHash(obj.scripts[2]);
        consts.testUDTType.args = obj.scripts[3].args;

        consts.UDTSwapTypeDeps.txHash = obj.deps[0];
        consts.UDTSwapLockDeps.txHash = obj.deps[1];
        consts.UDTSwapLiquidityUDTDeps.txHash = obj.deps[2];
        consts.testUDTDeps.outPoint.txHash = obj.deps[3];

        let pk = consts.ckb.utils.privateKeyToPublicKey(consts.UDT1Owner);
        let pkh = `0x${consts.ckb.utils.blake160(pk, 'hex')}`;
        let lockScript = {
            hashType: 'type',
            codeHash: consts.nervosDefaultLockCodeHash,
            args: pkh,
        };
        let lockHash = consts.ckb.utils.scriptToHash(lockScript);

        currentUDT1.args = lockHash;
        currentUDT1.codeHash = consts.ckb.utils.scriptToHash(consts.testUDTType);
        currentUDT1.udtDepsTxHash = consts.testUDTDeps.outPoint.txHash;
        currentUDT1.udtTypeHash = consts.ckb.utils.scriptToHash({
            hashType: currentUDT1.hashType,
            codeHash: currentUDT1.codeHash,
            args: currentUDT1.args,
        });



        pk = consts.ckb.utils.privateKeyToPublicKey(consts.UDT2Owner);
        pkh = `0x${consts.ckb.utils.blake160(pk, 'hex')}`;
        lockScript = {
            hashType: 'type',
            codeHash: consts.nervosDefaultLockCodeHash,
            args: pkh,
        };
        lockHash = consts.ckb.utils.scriptToHash(lockScript);

        currentUDT2.args = lockHash;
        currentUDT2.codeHash = consts.ckb.utils.scriptToHash(consts.testUDTType);
        currentUDT2.udtDepsTxHash = consts.testUDTDeps.outPoint.txHash;
        currentUDT2.udtTypeHash = consts.ckb.utils.scriptToHash({
            hashType: currentUDT2.hashType,
            codeHash: currentUDT2.codeHash,
            args: currentUDT2.args,
        });

        if(BigInt(currentUDT1.udtTypeHash)>=BigInt(currentUDT2.udtTypeHash)) {
            let temp = currentUDT1;
            currentUDT1 = currentUDT2;
            currentUDT2 = temp;
        }
    });

    afterEach(async function() {
        udt1Amount = null;
        udt2Amount = null;
        liquidityUDTAmount = null;
        toAddr = null;
        isRev = false;

        udt1AmountArr = [];
        udt2AmountArr = [];
        liquidityUDTAmountArr = [];
        currentUDT1Arr = [];
        currentUDT2Arr = [];
        currentPoolArr = [];
        isRevArr = [];
    });

    it('# UDT / UDT Pool creation', async function() {
        this.timeout(maxtime);

        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            currentUDT1,
            currentUDT2,
            '',
            isRev
        );

        let result = await sendTransaction(3);
        currentPool.poolIdentifier = result.inputSerialized;
        currentPool.liveTxHash = result.TxHash;
        currentPool.totalLiquidity = BigInt(0);
        currentPool.udt1TypeHash = currentUDT1.udtTypeHash;
        currentPool.udt2TypeHash = currentUDT2.udtTypeHash;
        currentPool.udt1Reserve = BigInt(consts.udtMinimum);
        currentPool.udt2Reserve = BigInt(consts.udtMinimum);
        currentPool.udt1ActualReserve = BigInt(0);
        currentPool.udt2ActualReserve = BigInt(0);

        await checkAmounts(
            currentPool,
            result.TxHash,
            0
        );
    });

    it('# UDT / UDT Pool add liquidity initial', async function() {
        this.timeout(maxtime);

        udt1Amount = BigInt(100000000);
        udt2Amount = BigInt(500000000);
        liquidityUDTAmount = BigInt(100000000);
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            currentUDT1,
            currentUDT2,
            currentPool,
            isRev
        );

        let result = await sendTransaction(1);
        currentPool.liveTxHash = result.TxHash;
        currentPool.totalLiquidity = liquidityUDTAmount;
        currentPool.udt1ActualReserve = udt1Amount;
        currentPool.udt2ActualReserve = udt2Amount;
        currentPool.udt1Reserve = currentPool.udt1Reserve + udt1Amount;
        currentPool.udt2Reserve = currentPool.udt2Reserve + udt2Amount;

        await checkAmounts(
            currentPool,
            result.TxHash,
            0
        );
    });

    it('# UDT / UDT Pool add liquidity', async function() {
        this.timeout(maxtime);

        udt1Amount = BigInt(100000000);
        let liquidity = utils.calculateAddLiquidityUDT2Amount(
            currentPool,
            udt1Amount
        );
        udt2Amount = liquidity.udt2Amount;
        liquidityUDTAmount = liquidity.userLiquidity;
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            currentUDT1,
            currentUDT2,
            currentPool,
            isRev
        );

        let result = await sendTransaction(1);
        currentPool.liveTxHash = result.TxHash;
        currentPool.totalLiquidity = currentPool.totalLiquidity + liquidityUDTAmount;
        currentPool.udt1ActualReserve = currentPool.udt1ActualReserve+ udt1Amount;
        currentPool.udt2ActualReserve = currentPool.udt2ActualReserve + udt2Amount;
        currentPool.udt1Reserve = currentPool.udt1Reserve + udt1Amount;
        currentPool.udt2Reserve = currentPool.udt2Reserve + udt2Amount;

        await checkAmounts(
            currentPool,
            result.TxHash,
            0
        );
    });

    it('# UDT / UDT Pool swap', async function() {
        this.timeout(maxtime);

        udt1Amount = BigInt(1234567);
        udt2Amount = utils.SwapOutput(
            currentPool,
            udt1Amount,
            isRev
        );
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            currentUDT1,
            currentUDT2,
            currentPool,
            isRev
        );

        let result = await sendTransaction(0);
        currentPool.liveTxHash = result.TxHash;
        currentPool.udt1ActualReserve = currentPool.udt1ActualReserve + udt1Amount;
        currentPool.udt2ActualReserve = currentPool.udt2ActualReserve- udt2Amount;
        currentPool.udt1Reserve = currentPool.udt1Reserve + udt1Amount;
        currentPool.udt2Reserve = currentPool.udt2Reserve - udt2Amount;

        await checkAmounts(
            currentPool,
            result.TxHash,
            0
        );
    });

    it('# UDT / UDT Pool swap reverse', async function() {
        this.timeout(maxtime);
        
        isRev = true;
        udt1Amount = BigInt(1234567);
        udt2Amount = utils.SwapOutput(
            currentPool,
            udt1Amount,
            isRev
        );
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            currentUDT2,
            currentUDT1,
            currentPool,
            isRev
        );

        let result = await sendTransaction(0);
        currentPool.liveTxHash = result.TxHash;
        currentPool.udt1ActualReserve = currentPool.udt1ActualReserve - udt2Amount;
        currentPool.udt2ActualReserve = currentPool.udt2ActualReserve + udt1Amount;
        currentPool.udt1Reserve = currentPool.udt1Reserve - udt2Amount;
        currentPool.udt2Reserve = currentPool.udt2Reserve + udt1Amount;

        await checkAmounts(
            currentPool,
            result.TxHash,
            0
        );
    });

    it('# UDT / UDT Pool remove liquidity', async function() {
        this.timeout(maxtime);

        liquidityUDTAmount = BigInt(1234567);
        let liquidity = utils.calculateRemoveLiquidityAmount(
            currentPool,
            liquidityUDTAmount
        );
        udt1Amount = liquidity.udt1Amount;
        udt2Amount = liquidity.udt2Amount;
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            currentUDT1,
            currentUDT2,
            currentPool,
            isRev
        );

        let result = await sendTransaction(2);
        currentPool.liveTxHash = result.TxHash;
        currentPool.totalLiquidity = currentPool.totalLiquidity - liquidityUDTAmount;
        currentPool.udt1ActualReserve = currentPool.udt1ActualReserve - udt1Amount;
        currentPool.udt2ActualReserve = currentPool.udt2ActualReserve - udt2Amount;
        currentPool.udt1Reserve = currentPool.udt1Reserve - udt1Amount;
        currentPool.udt2Reserve = currentPool.udt2Reserve - udt2Amount;

        await checkAmounts(
            currentPool,
            result.TxHash,
            0
        );
    });

    it('# CKB / UDT Pool creation', async function() {
        this.timeout(maxtime);

        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            ckbAsUDT,
            currentUDT2,
            '',
            isRev
        );

        let result = await sendTransaction(3);
        currentPoolCKB.poolIdentifier = result.inputSerialized;
        currentPoolCKB.liveTxHash = result.TxHash;
        currentPoolCKB.totalLiquidity = BigInt(0);
        currentPoolCKB.udt1TypeHash = ckbAsUDT.udtTypeHash;
        currentPoolCKB.udt2TypeHash = currentUDT2.udtTypeHash;
        currentPoolCKB.udt1Reserve = BigInt(consts.ckbLockCellMinimum);
        currentPoolCKB.udt2Reserve = BigInt(consts.udtMinimum);
        currentPoolCKB.udt1ActualReserve = BigInt(0);
        currentPoolCKB.udt2ActualReserve = BigInt(0);

        await checkAmounts(
            currentPoolCKB,
            result.TxHash,
            0
        );
    });

    it('# CKB / UDT Pool add liquidity initial', async function() {
        this.timeout(maxtime);

        udt1Amount = BigInt(100000000000);
        udt2Amount = BigInt(500000000);
        liquidityUDTAmount = BigInt(100000000000);
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            ckbAsUDT,
            currentUDT2,
            currentPoolCKB,
            isRev
        );

        let result = await sendTransaction(1);
        currentPoolCKB.liveTxHash = result.TxHash;
        currentPoolCKB.totalLiquidity = liquidityUDTAmount;
        currentPoolCKB.udt1ActualReserve = udt1Amount;
        currentPoolCKB.udt2ActualReserve = udt2Amount;
        currentPoolCKB.udt1Reserve = currentPoolCKB.udt1Reserve + udt1Amount;
        currentPoolCKB.udt2Reserve = currentPoolCKB.udt2Reserve + udt2Amount;

        await checkAmounts(
            currentPoolCKB,
            result.TxHash,
            0
        );
    });

    it('# CKB / UDT Pool add liquidity', async function() {
        this.timeout(maxtime);

        udt1Amount = BigInt(100000000);
        let liquidity = utils.calculateAddLiquidityUDT2Amount(
            currentPoolCKB,
            udt1Amount
        );
        udt2Amount = liquidity.udt2Amount;
        liquidityUDTAmount = liquidity.userLiquidity;
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            ckbAsUDT,
            currentUDT2,
            currentPoolCKB,
            isRev
        );

        let result = await sendTransaction(1);
        currentPoolCKB.liveTxHash = result.TxHash;
        currentPoolCKB.totalLiquidity = currentPoolCKB.totalLiquidity + liquidityUDTAmount;
        currentPoolCKB.udt1ActualReserve = currentPoolCKB.udt1ActualReserve + udt1Amount;
        currentPoolCKB.udt2ActualReserve = currentPoolCKB.udt2ActualReserve + udt2Amount;
        currentPoolCKB.udt1Reserve = currentPoolCKB.udt1Reserve + udt1Amount;
        currentPoolCKB.udt2Reserve = currentPoolCKB.udt2Reserve + udt2Amount;

        await checkAmounts(
            currentPoolCKB,
            result.TxHash,
            0
        );
    });

    it('# CKB / UDT Pool swap', async function() {
        this.timeout(maxtime);

        udt1Amount = BigInt(1234567);
        udt2Amount = utils.SwapOutput(
            currentPoolCKB,
            udt1Amount,
            isRev
        );
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            ckbAsUDT,
            currentUDT2,
            currentPoolCKB,
            isRev
        );

        let result = await sendTransaction(0);
        currentPoolCKB.liveTxHash = result.TxHash;
        currentPoolCKB.udt1ActualReserve = currentPoolCKB.udt1ActualReserve + udt1Amount;
        currentPoolCKB.udt2ActualReserve = currentPoolCKB.udt2ActualReserve - udt2Amount;
        currentPoolCKB.udt1Reserve = currentPoolCKB.udt1Reserve + udt1Amount;
        currentPoolCKB.udt2Reserve = currentPoolCKB.udt2Reserve - udt2Amount;

        await checkAmounts(
            currentPoolCKB,
            result.TxHash,
            0
        );
    });

    it('# CKB / UDT Pool swap reverse', async function() {
        this.timeout(maxtime);

        isRev = true;
        udt1Amount = BigInt(200000000);
        udt2Amount = utils.SwapOutput(
            currentPoolCKB,
            udt1Amount,
            isRev
        );
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            currentUDT2,
            ckbAsUDT,
            currentPoolCKB,
            isRev
        );

        let result = await sendTransaction(0);
        currentPoolCKB.liveTxHash = result.TxHash;
        currentPoolCKB.udt1ActualReserve = currentPoolCKB.udt1ActualReserve - udt2Amount;
        currentPoolCKB.udt2ActualReserve = currentPoolCKB.udt2ActualReserve + udt1Amount;
        currentPoolCKB.udt1Reserve = currentPoolCKB.udt1Reserve - udt2Amount;
        currentPoolCKB.udt2Reserve = currentPoolCKB.udt2Reserve + udt1Amount;

        await checkAmounts(
            currentPoolCKB,
            result.TxHash,
            0
        );
    });

    it('# CKB / UDT Pool remove liquidity', async function() {
        this.timeout(maxtime);

        liquidityUDTAmount = BigInt(50000000000);
        let liquidity = utils.calculateRemoveLiquidityAmount(
            currentPoolCKB,
            liquidityUDTAmount
        );
        udt1Amount = liquidity.udt1Amount;
        udt2Amount = liquidity.udt2Amount;
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            ckbAsUDT,
            currentUDT2,
            currentPoolCKB,
            isRev
        );

        let result = await sendTransaction(2);
        currentPoolCKB.liveTxHash = result.TxHash;
        currentPoolCKB.totalLiquidity = currentPoolCKB.totalLiquidity - liquidityUDTAmount;
        currentPoolCKB.udt1ActualReserve = currentPoolCKB.udt1ActualReserve - udt1Amount;
        currentPoolCKB.udt2ActualReserve = currentPoolCKB.udt2ActualReserve - udt2Amount;
        currentPoolCKB.udt1Reserve = currentPoolCKB.udt1Reserve - udt1Amount;
        currentPoolCKB.udt2Reserve = currentPoolCKB.udt2Reserve - udt2Amount;

        await checkAmounts(
            currentPoolCKB,
            result.TxHash,
            0
        );
    });

    it('# Multiple Pool swap', async function() {
        this.timeout(maxtime);

        udt1Amount = BigInt(1234567);
        udt2Amount = utils.SwapOutput(
            currentPoolCKB,
            udt1Amount,
            isRev
        );

        let firstPoolUDT1Amount = udt1Amount;
        let firstPoolUDT2Amount = udt2Amount;

        addPool(
            firstPoolUDT1Amount,
            firstPoolUDT2Amount,
            liquidityUDTAmount,
            ckbAsUDT,
            currentUDT2,
            currentPoolCKB,
            isRev
        );

        isRev = true;
        udt1Amount = BigInt(1234567);
        udt2Amount = utils.SwapOutput(
            currentPool,
            udt1Amount,
            isRev
        );
        addPool(
            udt1Amount,
            udt2Amount,
            liquidityUDTAmount,
            currentUDT2,
            currentUDT1,
            currentPool,
            isRev
        );

        let result = await sendTransaction(0);
        currentPoolCKB.liveTxHash = result.TxHash;
        currentPool.liveTxHash = result.TxHash;

        currentPoolCKB.udt1ActualReserve = currentPoolCKB.udt1ActualReserve + firstPoolUDT1Amount;
        currentPoolCKB.udt2ActualReserve = currentPoolCKB.udt2ActualReserve - firstPoolUDT2Amount;
        currentPoolCKB.udt1Reserve = currentPoolCKB.udt1Reserve + firstPoolUDT1Amount;
        currentPoolCKB.udt2Reserve = currentPoolCKB.udt2Reserve - firstPoolUDT2Amount;

        currentPool.udt1ActualReserve = currentPool.udt1ActualReserve - udt2Amount;
        currentPool.udt2ActualReserve = currentPool.udt2ActualReserve + udt1Amount;
        currentPool.udt1Reserve = currentPool.udt1Reserve - udt2Amount;
        currentPool.udt2Reserve = currentPool.udt2Reserve + udt1Amount;

        await checkAmounts(
            currentPoolCKB,
            result.TxHash,
            3
        );
        await checkAmounts(
            currentPool,
            result.TxHash,
            0
        );
    });
});