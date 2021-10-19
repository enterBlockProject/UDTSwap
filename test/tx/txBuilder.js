var consts = require('../consts.js');
var cellBuilder = require('./cellBuilder.js');

const txBuilder = {
    /**
     * @dev get CKB and UDTs amount, type script hashs need for UDTswap transaction
     *
     * @param txIdx identifier of UDTswap transaction
     * @param udt1Amount first UDT amount for UDTswap transaction
     * @param udt2Amount second UDT amount for UDTswap transaction
     * @param liquidityUDTAmount liquidity UDT amount for UDTswap transaction
     * @param currentUDT1 first UDT data
     * @param currentUDT2 second UDT data
     * @param currentPool UDTswap pool data
     * @param isRev first UDT is used as input or not in swapping
     * @return CKB, UDTs amount and type script hashs need for UDTswap transaction
     **/
    getAmountsBeforeLiveCell: function(
        txIdx,
        udt1Amount,
        udt2Amount,
        liquidityUDTAmount,
        currentUDT1,
        currentUDT2,
        currentPool,
        isRev
    ) {
        let udtTypeHashs = currentUDT1.udtTypeHash + currentUDT2.udtTypeHash.substr(2);
        if(isRev) {
            udtTypeHashs = currentUDT2.udtTypeHash + currentUDT1.udtTypeHash.substr(2);
        }
        let poolLockHash = consts.ckb.utils.scriptToHash({
            hashType: "type",
            codeHash: consts.UDTSwapLockCodeHash,
            args: udtTypeHashs
        });
        let liquidityUDTTypeHash =
            currentPool===''
                ? null
                : consts.ckb.utils.scriptToHash({
                    hashType: "type",
                    codeHash: consts.UDTSwapLiquidityUDTCodeHash,
                    args: poolLockHash + currentPool.poolIdentifier.substr(2)
                });
        let udt1Actual = udt1Amount;
        let udt1TypeHash = currentUDT1.udtTypeHash;
        let udt2Actual = udt2Amount;
        let udt2TypeHash = currentUDT2.udtTypeHash;
        let liquidityUDTActual = liquidityUDTAmount;
        if(txIdx===0) {
            liquidityUDTTypeHash = null;
            liquidityUDTActual = BigInt(0);

            udt2TypeHash = null;
        } else if(txIdx===1) {
            liquidityUDTTypeHash = null;
        } else if(txIdx===2) {
            udt1TypeHash = null;
            udt2TypeHash = null;
        } else if(txIdx===3) {
            liquidityUDTActual = BigInt(0);
            liquidityUDTTypeHash = null;
            udt1Actual =
                BigInt(udt1TypeHash)===0n
                    ? consts.ckbLockCellMinimum
                    : consts.udtMinimum;
            udt2Actual =
                BigInt(udt2TypeHash)===0n
                    ? consts.ckbLockCellMinimum
                    : consts.udtMinimum;
        }
        return {
            udt1Actual: udt1Actual,
            udt1TypeHash: udt1TypeHash,
            udt2Actual: udt2Actual,
            udt2TypeHash: udt2TypeHash,
            liquidityUDTActual: liquidityUDTActual,
            liquidityUDTTypeHash: liquidityUDTTypeHash
        };
    },

    /**
     * @dev set CKB, UDTs inputs and actual amount need for UDTswap transaction with balance check
     *
     * @param txIdx identifier of UDTswap transaction
     * @param currentUDT1 first UDT data
     * @param currentUDT2 second UDT data
     * @param ckbInput CKB amount of input
     * @param ckbActual CKB amount need for UDTswap transaction
     * @param udt1Input first UDT amount of input
     * @param udt1Actual first UDT amount need for UDTswap transaction
     * @param udt2Input second UDT amount of input
     * @param udt2Actual second UDT amount need for UDTswap transaction
     * @param liquidityUDTInput liquidity UDT amount of input
     * @param liquidityUDTActual liquidity UDT amount need for UDTswap transaction
     * @param isRev first UDT is used as input or not in swapping
     * @return CKB, UDTs inputs, actual amount need for UDTswap transaction
     **/
    getAmountsAfterLiveCell: function(
        txIdx,
        currentUDT1,
        currentUDT2,
        ckbInput,
        ckbActual,
        udt1Input,
        udt1Actual,
        udt2Input,
        udt2Actual,
        liquidityUDTInput,
        liquidityUDTActual,
        isRev
    ) {
        let isError = false;
        if(
            (
                ckbActual !== 0n
                && ckbInput <= ckbActual
            ) || (
                txIdx!==2
                && udt1Input <= udt1Actual
            ) || (
                txIdx!==0
                && txIdx!==2
                && udt2Input <= udt2Actual
            ) || (
                txIdx!==1
                && liquidityUDTActual !== 0n
                && liquidityUDTInput <= liquidityUDTActual
            )
        ) {
            isError = true;
        }

        let udt1Amount =
            isRev ? {
                input: udt2Input,
                actual: udt2Actual
            } : {
                input: udt1Input,
                actual: udt1Actual
            };
        let udt2Amount =
            isRev ? {
                input: udt1Input,
                actual: udt1Actual
            } : {
                input: udt2Input,
                actual: udt2Actual
            };
        let udt1Info =
            isRev
                ? currentUDT2
                : currentUDT1;
        let udt2Info =
            isRev
                ? currentUDT1
                : currentUDT2;
        let liquidityUDTAmount = {
            input: liquidityUDTInput,
            actual: liquidityUDTActual
        };
        return {
            error: isError,
            udt1Amount: udt1Amount,
            udt2Amount: udt2Amount,
            udt1Info: udt1Info,
            udt2Info: udt2Info,
            liquidityUDTAmount: liquidityUDTAmount
        };
    },

    /**
     * @dev build and send UDTswap transaction
     *
     * txIdx
     * 0 : swapping
     * 1 : adding liquidity
     * 2 : removing liquidity
     * 3 : creating new pool
     *
     * @param txIdx identifier of UDTswap transaction
     * @param sk secret key of testing account
     * @param udt1AmountArr array of first UDT amount
     * @param udt2AmountArr array of second UDT amount
     * @param liquidityUDTAmountArr array of liquidity UDT amount
     * @param currentUDT1 array of first UDT data
     * @param currentUDT2 array of second UDT data
     * @param currentPool array of UDTswap pool data
     * @param isRev array of first UDT is used as input or not in swapping
     * @param toAddr address to send if receiver is not testing account
     * @return transaction hash of UDTswap, serialized first input
     **/
    sendTransaction: async function(
        txIdx,
        sk,
        udt1AmountArr,
        udt2AmountArr,
        liquidityUDTAmountArr,
        currentUDT1,
        currentUDT2,
        currentPool,
        isRev,
        toAddr
    ) {
        toAddr =
            toAddr === ''
                ? null
                : toAddr;

        let addr = consts.ckb.utils.privateKeyToAddress(
            sk,
            {
                prefix: 'ckt'
            });
        let pkh = `0x${consts.ckb.utils.blake160(
            consts.ckb.utils.privateKeyToPublicKey(sk), 
            'hex'
        )}`;
        let lockHash = consts.ckb.utils.scriptToHash({
            hashType: "type",
            codeHash: consts.nervosDefaultLockCodeHash,
            args: pkh
        });

        let liquidityUDTTypeHash;
        let ckbActual = BigInt(150000000000);
        let udt1Actual = [];
        let udt1TypeHash = [];
        let udt2Actual = [];
        let udt2TypeHash = [];
        let liquidityUDTActual;
        let poolCnt = currentUDT1.length;
        let i = 0;
        while(i<poolCnt) {
            let AmountsBeforeLiveCell = txBuilder.getAmountsBeforeLiveCell(
                txIdx,
                udt1AmountArr[i],
                udt2AmountArr[i],
                liquidityUDTAmountArr[i],
                currentUDT1[i],
                currentUDT2[i],
                currentPool[i],
                isRev[i]
            );
            udt1Actual.push(AmountsBeforeLiveCell.udt1Actual);
            udt2Actual.push(AmountsBeforeLiveCell.udt2Actual);
            udt1TypeHash.push(AmountsBeforeLiveCell.udt1TypeHash);
            udt2TypeHash.push(AmountsBeforeLiveCell.udt2TypeHash);
            liquidityUDTActual = AmountsBeforeLiveCell.liquidityUDTActual;
            liquidityUDTTypeHash = AmountsBeforeLiveCell.liquidityUDTTypeHash;
            i+=1;
        }

        let liveCellResult = await cellBuilder.getLiveCells(
            lockHash,
             BigInt(0),
            udt1TypeHash,
            udt2TypeHash,
            liquidityUDTTypeHash,
            ckbActual,
            udt1Actual,
            udt2Actual,
            liquidityUDTActual
        );

        let udt1Amount = [];
        let udt2Amount = [];
        let udt1Info = [];
        let udt2Info = [];
        let liquidityUDTAmount;
        i = 0;
        while(i<poolCnt) {
            let AmountsAfterLiveCell = txBuilder.getAmountsAfterLiveCell(
                txIdx,
                currentUDT1[i],
                currentUDT2[i],
                liveCellResult.ckbInput,
                ckbActual,
                liveCellResult.udt1Input[i],
                udt1Actual[i],
                liveCellResult.udt2Input[i],
                udt2Actual[i],
                liveCellResult.liquidityUDTInput,
                liquidityUDTActual,
                isRev[i]
            );
            if(AmountsAfterLiveCell.error) {
                break;
            }
            udt1Amount.push(AmountsAfterLiveCell.udt1Amount);
            udt2Amount.push(AmountsAfterLiveCell.udt2Amount);
            udt1Info.push(AmountsAfterLiveCell.udt1Info);
            udt2Info.push(AmountsAfterLiveCell.udt2Info);
            liquidityUDTAmount = AmountsAfterLiveCell.liquidityUDTAmount;
            i+=1;
        }
        if(i!==poolCnt) {
            return {
                TxHash: null,
                inputSerialized: null
            };
        }

        let rawTransaction = await cellBuilder.generateRawTx(
            liveCellResult.unspentCells,
            liveCellResult.ckbInput,
            addr,
            poolCnt
        );
        rawTransaction = cellBuilder.setFeeCell(rawTransaction);
        let inputSerialized = null;
        if(txIdx===3) {
            inputSerialized = cellBuilder.getSerializedFirstInput(
                rawTransaction,
                liveCellResult.ckbCellIndex
            );
        }

        i=0;
        while(i<poolCnt) {
            if(txIdx!==3) {
                rawTransaction = cellBuilder.setPoolCellsInput(
                    rawTransaction,
                    currentPool[i]
                );
            }
            rawTransaction = cellBuilder.setPoolCellsOutput(
                rawTransaction,
                txIdx,
                udt1Info[i],
                udt2Info[i],
                currentPool[i],
                inputSerialized
            );
            rawTransaction = cellBuilder.setResultOutputCells(
                rawTransaction,
                txIdx,
                udt1Info[i],
                udt2Info[i],
                currentPool[i],
                pkh,
                toAddr,
                isRev[i]
            );
            rawTransaction = cellBuilder.setResultDataAndCapacity(
                rawTransaction,
                txIdx,
                udt1Amount[i],
                udt2Amount[i],
                liquidityUDTAmount,
                udt1Info[i],
                udt2Info[i],
                currentPool[i],
                isRev[i]
            );
            rawTransaction = cellBuilder.setDeps(
                rawTransaction,
                txIdx,
                udt1Info[i],
                udt2Info[i]
            );
            i += 1;
        }
        let txHash = await cellBuilder.setTxFeeAndSign(
            rawTransaction,
            txIdx,
            udt1Info,
            udt2Info,
            currentPool,
            poolCnt,
            sk
        );

        return {
            TxHash: txHash,
            inputSerialized: inputSerialized
        };
    },
}

module.exports = txBuilder;
