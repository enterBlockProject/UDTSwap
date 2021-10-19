var consts = require('../consts.js');
var utils = require('../utils.js');

const cellBuilder = {
  getLiveCellsOnly: async function(fromBlock, lockHash) {
    let unspentCells = await consts.ckb.loadCells({
      lockHash,
      start: BigInt(fromBlock),
    });
    return {
      unspentCells: unspentCells
    };
  },

  /**
   * @dev get live cells to make UDTswap transaction
   *
   * search cells with lock script hash
   * and calculate CKB amount, first UDT amount, second UDT amount, liquidity UDT amount
   * that will be used for input
   *
   * @param lockHash lock script hash of testing account
   * @param fromBlock start block to search for live cells
   * @param udt1TypeHash first UDT type script hash
   * @param udt2TypeHash second UDT type script hash
   * @param liquidityUDTTypeHash liquidity UDT type script hash
   * @param ckbAmount CKB amount need to make transaction
   * @param udt1Amount first UDT amount need to make transaction
   * @param udt2Amount second UDT amount need to make transaction
   * @param liquidityUDTAmount liquidity UDT amount need to make transaction
   * @return CKB, first UDT, second UDT, liquidity UDT amount, cell datas to use for input
   **/
  getLiveCells: async function(
    lockHash,
    fromBlock,
    udt1TypeHash,
    udt2TypeHash,
    liquidityUDTTypeHash,
    ckbAmount,
    udt1Amount,
    udt2Amount,
    liquidityUDTAmount
  ) {
    //get all live cells
    let getLiveCellsRes = await cellBuilder.getLiveCellsOnly(
        fromBlock,
        lockHash
    );
    let unspentCells = getLiveCellsRes.unspentCells;

    let scriptChk = new Map();
    let temp;
    let addAmount;
    let j = 0;

    //initialize to check amounts
    while(j<udt1TypeHash.length) {
      temp = scriptChk.get(udt1TypeHash[j]);
      addAmount =
          udt1TypeHash[j] === consts.ckbTypeHash
              ? consts.ckbMinimum
              : consts.udtMinimum;
      if(temp !== undefined) {
        temp.cap += udt1Amount[j] + addAmount;
        temp.cnt += 1;
        scriptChk.set(
            udt1TypeHash[j],
            temp
        );
      } else {
        scriptChk.set(
            udt1TypeHash[j],
            {
              cap: udt1Amount[j] + addAmount,
              cur: BigInt(0),
              cnt: 1
            });
      }

      temp = scriptChk.get(udt2TypeHash[j]);
      addAmount =
          udt2TypeHash[j] === consts.ckbTypeHash
              ? consts.ckbMinimum
              : consts.udtMinimum;
      if(temp !== undefined) {
        temp.cap += udt2Amount[j] + addAmount;
        temp.cnt += 1;
        scriptChk.set(
            udt2TypeHash[j],
            temp
        );
      } else {
        scriptChk.set(
            udt2TypeHash[j],
            {
              cap: udt2Amount[j] + addAmount,
              cur: BigInt(0),
              cnt: 1
            });
      }
      j+=1;
    }

    temp = scriptChk.get(consts.ckbTypeHash);
    if(temp !== undefined) {
      ckbAmount += temp.cap;
    }


    let currentCKBAmount = BigInt(0);
    let currentUDT1Amount = [];
    let currentUDT2Amount = [];
    let currentLiquidityUDTAmount = BigInt(0);
    let ckbCellIndex = -1;
    let liquidityUDTIndex = -1;

    let ret = [];
    //check for all live cells
    for(let i=0; i<unspentCells.length; i++) {
      const udtTypeHash =
          unspentCells[i].type == null
              ? ''
              : consts.ckb.utils.scriptToHash(unspentCells[i].type);
      const ckbCapacity = BigInt(unspentCells[i].capacity);
      temp = scriptChk.get(udtTypeHash);
      //for CKBs
      if(unspentCells[i].type == null) {
        if(currentCKBAmount <= ckbAmount) {
          currentCKBAmount += ckbCapacity;
        } else {
          continue;
        }
        if(ckbCellIndex===-1) {
          ckbCellIndex = ret.length;
        }
        ret.push(unspentCells[i]);
        //for UDTs
      } else if(temp !== undefined || udtTypeHash === liquidityUDTTypeHash) {
        const cellInfo = await consts.ckb.rpc.getLiveCell({
            txHash: unspentCells[i].outPoint.txHash,
            index: unspentCells[i].outPoint.index
          }, true);
        const udtCapacity = BigInt(utils.changeEndianness(
            cellInfo.cell.data.content.substr(0, 34)
        ));

        if (temp !== undefined) {
          if (temp.cur <= temp.cap) {
            temp.cur += udtCapacity;
            scriptChk.set(
                udtTypeHash,
                temp
            );
          } else {
            continue;
          }
          //for liquidity UDT
        } else if (udtTypeHash === liquidityUDTTypeHash) {
          if (currentLiquidityUDTAmount <= liquidityUDTAmount) {
            currentLiquidityUDTAmount += udtCapacity;
            liquidityUDTIndex = ret.length;
          } else {
            continue;
          }
        }
        currentCKBAmount += ckbCapacity;
        ret.push(unspentCells[i]);
      }
    }
    //remember index for CKB cell
    if (liquidityUDTIndex !== -1) {
      temp = ret[0];
      ret[0] = ret[liquidityUDTIndex];
      ret[liquidityUDTIndex] = temp;
      if (ckbCellIndex === 0) {
        ckbCellIndex = liquidityUDTIndex;
      }
    }

    j = 0;
    //set change amount for CKB, UDTs
    while(j<udt1TypeHash.length) {
      if(udt1TypeHash[j] === consts.ckbTypeHash) {
        currentUDT1Amount[j] = udt1Amount[j] + consts.ckbMinimum;
      } else {
        temp = scriptChk.get(udt1TypeHash[j]);
        currentUDT1Amount[j] = udt1Amount[j] + consts.udtMinimum;
        if(temp.cnt === 1) currentUDT1Amount[j] = temp.cur;
        temp.cur -= currentUDT1Amount[j];
        temp.cnt -= 1;
        scriptChk.set(
            udt1TypeHash[j],
            temp
        );
      }

      if(udt2TypeHash[j] === consts.ckbTypeHash) {
        currentUDT2Amount[j] = udt2Amount[j] + consts.ckbMinimum;
      } else {
        temp = scriptChk.get(udt2TypeHash[j]);
        currentUDT2Amount[j] = udt2Amount[j] + consts.udtMinimum;
        if(temp.cnt === 1) currentUDT2Amount[j] = temp.cur;
        temp.cur -= currentUDT2Amount[j];
        temp.cnt -= 1;
        scriptChk.set(
            udt2TypeHash[j],
            temp
        );
      }
      j+=1;
    }

    return {
      unspentCells: ret,
      ckbInput: currentCKBAmount,
      udt1Input: currentUDT1Amount,
      udt2Input: currentUDT2Amount,
      liquidityUDTInput: currentLiquidityUDTAmount,
      ckbCellIndex: ckbCellIndex,
    };
  },

  /**
   * @dev generate raw UDTswap transaction
   *
   * @param unspentCells live cells to use for UDTswap transaction
   * @param ckbAmount CKB amount to make transaction for UDTswap
   * @param addr address of testing account
   * @param poolCnt count of pools to swap
   * @return raw transaction of UDTswap
   **/
  generateRawTx: async function (
    unspentCells,
    ckbAmount,
    addr,
    poolCnt
  ) {
    const secp256k1Dep = await consts.ckb.loadSecp256k1Dep();

    return consts.ckb.generateRawTransaction({
      fromAddress: addr,
      toAddress: addr,
      capacity:
          ckbAmount
          - consts.feeAmount
          * BigInt(poolCnt)
          - consts.txFeeMax,
      fee: consts.txFeeMax,
      safeMode: false,
      cells: unspentCells,
      deps: secp256k1Dep,
    })
  },

  /**
   * @dev set protection fee cell of raw transaction
   *
   * @param rawTransaction raw transaction of UDTswap
   * @return raw transaction with protection fee cell
   **/
  setFeeCell: function(
    rawTransaction
  ) {
    let temp = rawTransaction.outputs[0];
    rawTransaction.outputs[0] = rawTransaction.outputs[1];
    rawTransaction.outputs[1] = temp;

    rawTransaction.outputs[0].lock.args = consts.feePkh;

    return rawTransaction;
  },

  /**
   * @dev get raw transaction's first input serialized
   *
   * @param rawTransaction raw transaction of UDTswap
   * @param ckbCellIndex CKB live cell index
   * @return serialized first input of raw transaction
   **/
  getSerializedFirstInput: function (
    rawTransaction,
    ckbCellIndex
  ) {
    //swap first input to CKB cell without type script
    let temp = rawTransaction.inputs[0];
    rawTransaction.inputs[0] = rawTransaction.inputs[ckbCellIndex];
    rawTransaction.inputs[ckbCellIndex] = temp;

    let outpointStruct = new Map([
        ['txHash', rawTransaction.inputs[0].previousOutput.txHash],
      ['index', consts.ckb.utils.toHexInLittleEndian(rawTransaction.inputs[0].previousOutput.index)]
    ]);
    let serializedOutpoint = consts.ckb.utils.serializeStruct(outpointStruct);
    let serializedSince = consts.ckb.utils.toHexInLittleEndian(
        rawTransaction.inputs[0].since,
        8
    );
    let inputStruct = new Map([
        ['since', serializedSince],
      ['previousOutput', serializedOutpoint]
    ]);
    return consts.ckb.utils.serializeStruct(inputStruct);
  },

  /**
   * @dev set inputs of UDTswap pool to raw transaction
   *
   * @param rawTransaction raw transaction of UDTswap
   * @param poolInfo UDTswap pool data
   * @return raw transaction with inputs of UDTswap pool
   **/
  setPoolCellsInput: function(
    rawTransaction,
    poolInfo
  ) {
    rawTransaction.inputs.unshift(
      {
        previousOutput: {
          txHash: poolInfo.liveTxHash,
          index: utils.bnToHexNoLeadingZero(
              BigInt(poolInfo.liveTxIndex)
          ),
        },
        since: '0x0'
      },
      {
        previousOutput: {
          txHash: poolInfo.liveTxHash,
          index: utils.bnToHexNoLeadingZero(
              BigInt(poolInfo.liveTxIndex)
              + BigInt(1)
          ),
        },
        since: '0x0'
      },
      {
        previousOutput: {
          txHash: poolInfo.liveTxHash,
          index: utils.bnToHexNoLeadingZero(
              BigInt(poolInfo.liveTxIndex)
              + BigInt(2)
          ),
        },
        since: '0x0'
      },
    );
    return rawTransaction;
  },

  /**
   * @dev set outputs of UDTswap pool to raw transaction
   *
   * @param rawTransaction raw transaction of UDTswap
   * @param txIdx identifier of UDTswap transaction
   * @param udt1Info first UDT data
   * @param udt2Info second UDT data
   * @param poolInfo UDTswap pool data
   * @param inputSerialized serialized first input of raw transaction
   * @return raw transaction with outputs of UDTswap pool
   **/
  setPoolCellsOutput: function(
    rawTransaction,
    txIdx,
    udt1Info,
    udt2Info,
    poolInfo,
    inputSerialized
  ) {
    rawTransaction.outputs.unshift(
      {
        capacity: utils.bnToHexNoLeadingZero(consts.poolCellCKB),
        lock: {
          hashType: "type",
          codeHash: consts.UDTSwapLockCodeHash,
          args: udt1Info.udtTypeHash + udt2Info.udtTypeHash.substr(2, 64),
        },
        type: {
          hashType: "type",
          codeHash: consts.UDTSwapTypeCodeHash,
          args:
          //on pool creation, args is serialized first input
              txIdx===3
                  ? inputSerialized
                  : poolInfo.poolIdentifier,
        },
      },
      {
        capacity: utils.bnToHexNoLeadingZero(
            BigInt(15800000000)
            + BigInt((udt1Info.args.length + udt1Info.dataWithoutAmount.length) / 2)
            * BigInt(100000000)
        ),
        lock: {
          hashType: "type",
          codeHash: consts.UDTSwapLockCodeHash,
          args: udt1Info.udtTypeHash + udt2Info.udtTypeHash.substr(2, 64),
        },
      },
      {
        capacity: utils.bnToHexNoLeadingZero(
            BigInt(15800000000)
            + BigInt((udt2Info.args.length + udt2Info.dataWithoutAmount.length) / 2)
            * BigInt(100000000)
        ),
        lock: {
          hashType: "type",
          codeHash: consts.UDTSwapLockCodeHash,
          args: udt1Info.udtTypeHash + udt2Info.udtTypeHash.substr(2, 64),
        },
      },
    );

    //on pool creation, capacity is set to minimum pool capacity depending on pair of token is CKB or UDT
    if(txIdx===3) {
      rawTransaction.outputs[1].capacity =
          BigInt(udt1Info.udtTypeHash)===0n
              ? utils.bnToHexNoLeadingZero(consts.ckbLockCellMinimum)
              : rawTransaction.outputs[1].capacity;
      rawTransaction.outputs[2].capacity =
          BigInt(udt2Info.udtTypeHash)===0n
              ? utils.bnToHexNoLeadingZero(consts.ckbLockCellMinimum)
              : rawTransaction.outputs[2].capacity;
    }

    if(BigInt(udt1Info.udtTypeHash)!==0n) {
      rawTransaction.outputs[1].type = {
        hashType: udt1Info.hashType,
        codeHash: udt1Info.codeHash,
        args: udt1Info.args,
      };
    }

    if(BigInt(udt2Info.udtTypeHash)!==0n) {
      rawTransaction.outputs[2].type = {
        hashType: udt2Info.hashType,
        codeHash: udt2Info.codeHash,
        args: udt2Info.args,
      };
    }

    rawTransaction.outputsData.unshift("0x", "0x", "0x");

    return rawTransaction;
  },

  /**
   * @dev set outputs of UDTswap transaction result to raw transaction
   *
   * @param rawTransaction raw transaction of UDTswap
   * @param txIdx identifier of UDTswap transaction
   * @param udt1Info first UDT data
   * @param udt2Info second UDT data
   * @param poolInfo UDTswap pool data
   * @param pkh pkh of sender
   * @param toAddr address of receiver
   * @param reversed first UDT is input or second UDT is input when swapping
   * @return raw transaction with results of UDTswap transaction
   **/
  setResultOutputCells: function(
    rawTransaction,
    txIdx,
    udt1Info,
    udt2Info,
    poolInfo,
    pkh,
    toAddr,
    reversed
  ) {
    let topkh =
        toAddr == null
            ? null
            : '0x'+consts.ckb.utils.parseAddress(toAddr, 'hex').substring(6);

    let outputUDT1Cap = utils.bnToHexNoLeadingZero(
        BigInt(11000000000)
        + BigInt((udt1Info.args.length + udt1Info.dataWithoutAmount.length) / 2)
        * BigInt(100000000)
    );
    let outputUDT2Cap = utils.bnToHexNoLeadingZero(
        BigInt(11000000000)
        + BigInt((udt2Info.args.length + udt2Info.dataWithoutAmount.length) / 2)
        * BigInt(100000000)
    );

    rawTransaction.outputs.push(
      {
        capacity: outputUDT1Cap,
        lock: {
          hashType: "type",
          codeHash: consts.nervosDefaultLockCodeHash,
          args:
              topkh == null
                  ? pkh
                  : (
                      reversed
                          ? topkh
                          : pkh
                  )
        },
      },
      {
        capacity: outputUDT2Cap,
        lock: {
          hashType: "type",
          codeHash: consts.nervosDefaultLockCodeHash,
          args:
              topkh==null
                  ? pkh
                  : (
                      reversed
                          ? pkh
                          : topkh
                  )
        },
      },
    );

    let isAddOrRemove = 0;

    //when current transaction is adding or removing liquidity
    if(
        txIdx===1
        || txIdx===2
    ) {
      let liquidityUDTCap = utils.bnToHexNoLeadingZero(BigInt(19000000000));

      let UDTSwaplockHash = consts.ckb.utils.scriptToHash({
        hashType: "type",
        codeHash: consts.UDTSwapLockCodeHash,
        args: udt1Info.udtTypeHash + udt2Info.udtTypeHash.substr(2, 64),
      });

      rawTransaction.outputs.push(
        {
          capacity: liquidityUDTCap,
          lock: {
            hashType: "type",
            codeHash: consts.nervosDefaultLockCodeHash,
            args: pkh,
          },
          type: {
            hashType: "type",
            codeHash: consts.UDTSwapLiquidityUDTCodeHash,
            args: UDTSwaplockHash + poolInfo.poolIdentifier.substr(2),
          },
        },
      );
      isAddOrRemove = 1;
    }

    if(BigInt(udt1Info.udtTypeHash)!==0n) {
      rawTransaction.outputs[rawTransaction.outputs.length - 2 - isAddOrRemove].type = {
        hashType: udt1Info.hashType,
        codeHash: udt1Info.codeHash,
        args: udt1Info.args,
      };
    }

    if(BigInt(udt2Info.udtTypeHash)!==0n) {
      rawTransaction.outputs[rawTransaction.outputs.length - 1 - isAddOrRemove].type = {
        hashType: udt2Info.hashType,
        codeHash: udt2Info.codeHash,
        args: udt2Info.args,
      };
    }

    return rawTransaction;
  },

  /**
   * @dev set outputs data and capacity of UDTswap transaction result and UDTswap pool to raw transaction
   *
   * sets capacity, output datas based on
   * results of swapping, adding liquidity, removing liquidity, creating pool.
   *
   * @param rawTransaction raw transaction of UDTswap
   * @param txIdx identifier of UDTswap transaction
   * @param udt1Amount first UDT amount input, actual amount need to use or receive
   * @param udt2Amount second UDT amount input, actual amount need to use or receive
   * @param liquidityUDTAmount liquidity UDT amount input, actual amount need to use or receive
   * @param udt1Info first UDT data
   * @param udt2Info second UDT data
   * @param poolInfo UDTswap pool data
   * @param reversed first UDT is input or second UDT is input when swapping
   * @return raw transaction with results, UDTswap pool data and capacity changed of UDTswap transaction
   **/
  setResultDataAndCapacity: function (
    rawTransaction,
    txIdx,
    udt1Amount,
    udt2Amount,
    liquidityUDTAmount,
    udt1Info,
    udt2Info,
    poolInfo,
    reversed
  ) {

    let udt1ReserveAfter;
    let udt2ReserveAfter;
    let udt1ReserveAfterBn;
    let udt2ReserveAfterBn;
    let totalLiquidityAfter = '';
    let udt1AmountAfter = '';
    let udt2AmountAfter = '';
    let udt1Change = udt1Amount.input - udt1Amount.actual;
    let udt2Change = udt2Amount.input - udt2Amount.actual;
    let udt1IsCKB = BigInt(udt1Info.udtTypeHash) === BigInt(0);
    let udt2IsCKB = BigInt(udt2Info.udtTypeHash) === BigInt(0);

    //when transaction is for swapping
    if(txIdx===0) {
      udt1AmountAfter = utils.toUDTData(udt1Amount.actual);
      udt2AmountAfter = utils.toUDTData(udt2Amount.actual);
      totalLiquidityAfter = utils.toUDTData(poolInfo.totalLiquidity);

      let outputsLen = rawTransaction.outputs.length;

      //when transaction is swapping first UDT output, second UDT input
      if(reversed) {
        udt1ReserveAfterBn = poolInfo.udt1Reserve - udt1Amount.actual;
        udt2ReserveAfterBn = poolInfo.udt2Reserve + udt2Amount.actual;
        udt1ReserveAfter = utils.toUDTData(udt1ReserveAfterBn);
        udt2ReserveAfter = utils.toUDTData(udt2ReserveAfterBn);

        rawTransaction.outputs[outputsLen - 2].capacity =
            udt1IsCKB
                ? utils.bnToHexNoLeadingZero(udt1Amount.actual)
                : rawTransaction.outputs[outputsLen - 2].capacity;
        rawTransaction.outputs[outputsLen - 1].capacity =
            udt2IsCKB
                ? utils.bnToHexNoLeadingZero(udt2Change)
                : rawTransaction.outputs[outputsLen - 1].capacity;

        rawTransaction.outputsData.push(
            udt1IsCKB
                ? "0x"
                : udt1AmountAfter + udt1Info.dataWithoutAmount
        );
        rawTransaction.outputsData.push(
            udt2IsCKB
                ? "0x"
                : utils.toUDTData(udt2Change) + udt2Info.dataWithoutAmount
        );
      }

      //when transaction is swapping first UDT input, second UDT output
      if(!reversed) {
        udt1ReserveAfterBn = poolInfo.udt1Reserve + udt1Amount.actual;
        udt2ReserveAfterBn = poolInfo.udt2Reserve - udt2Amount.actual;
        udt1ReserveAfter = utils.toUDTData(udt1ReserveAfterBn);
        udt2ReserveAfter = utils.toUDTData(udt2ReserveAfterBn);

        rawTransaction.outputs[outputsLen - 2].capacity =
            udt1IsCKB
                ? utils.bnToHexNoLeadingZero(udt1Change)
                : rawTransaction.outputs[outputsLen - 2].capacity;
        rawTransaction.outputs[outputsLen - 1].capacity =
            udt2IsCKB
                ? utils.bnToHexNoLeadingZero(udt2Amount.actual)
                : rawTransaction.outputs[outputsLen - 1].capacity;

        rawTransaction.outputsData.push(
            udt1IsCKB
                ? "0x"
                : utils.toUDTData(udt1Change) + udt1Info.dataWithoutAmount
        );
        rawTransaction.outputsData.push(
            udt2IsCKB
                ? "0x"
                : udt2AmountAfter + udt2Info.dataWithoutAmount
        );
      }

      rawTransaction.outputs[1].capacity =
          udt1IsCKB
              ? utils.bnToHexNoLeadingZero(udt1ReserveAfterBn)
              : rawTransaction.outputs[1].capacity;
      rawTransaction.outputs[2].capacity =
          udt2IsCKB
              ? utils.bnToHexNoLeadingZero(udt2ReserveAfterBn)
              : rawTransaction.outputs[2].capacity;

      //when transaction is for adding liquidity
    } else if(txIdx===1) {
      totalLiquidityAfter = utils.toUDTData(poolInfo.totalLiquidity + liquidityUDTAmount.actual);

      udt1ReserveAfterBn = poolInfo.udt1Reserve + udt1Amount.actual;
      udt2ReserveAfterBn = poolInfo.udt2Reserve + udt2Amount.actual;
      udt1ReserveAfter = utils.toUDTData(udt1ReserveAfterBn);
      udt2ReserveAfter = utils.toUDTData(udt2ReserveAfterBn);

      rawTransaction.outputs[5].capacity =
          udt1IsCKB
              ? utils.bnToHexNoLeadingZero(udt1Change)
              : rawTransaction.outputs[5].capacity;
      rawTransaction.outputs[6].capacity =
          udt2IsCKB
              ? utils.bnToHexNoLeadingZero(udt2Change)
              : rawTransaction.outputs[6].capacity;

      rawTransaction.outputsData.push(
          udt1IsCKB
              ? "0x"
              : utils.toUDTData(udt1Change) + udt1Info.dataWithoutAmount);
      rawTransaction.outputsData.push(
          udt2IsCKB
              ? "0x"
              : utils.toUDTData(udt2Change) + udt2Info.dataWithoutAmount);
      rawTransaction.outputsData.push(
          utils.toUDTData(liquidityUDTAmount.actual)
      );

      rawTransaction.outputs[1].capacity =
          udt1IsCKB
              ? utils.bnToHexNoLeadingZero(udt1ReserveAfterBn)
              : rawTransaction.outputs[1].capacity;
      rawTransaction.outputs[2].capacity =
          udt2IsCKB
              ? utils.bnToHexNoLeadingZero(udt2ReserveAfterBn)
              : rawTransaction.outputs[2].capacity;


      //when adding liquidity, liquidity UDT cell should be right after pool cells, protection fee cell.
      let temp = rawTransaction.outputs[4];
      rawTransaction.outputs[4] = rawTransaction.outputs[7];
      rawTransaction.outputs[7] = temp;

      temp = rawTransaction.outputsData[4];
      rawTransaction.outputsData[4] = rawTransaction.outputsData[7];
      rawTransaction.outputsData[7] = temp;

      //when transaction is for removing liquidity
    } else if(txIdx===2) {
      totalLiquidityAfter = utils.toUDTData(poolInfo.totalLiquidity - liquidityUDTAmount.actual);

      udt1ReserveAfterBn = poolInfo.udt1Reserve - udt1Amount.actual;
      udt2ReserveAfterBn = poolInfo.udt2Reserve - udt2Amount.actual;
      udt1ReserveAfter = utils.toUDTData(udt1ReserveAfterBn);
      udt2ReserveAfter = utils.toUDTData(udt2ReserveAfterBn);

      rawTransaction.outputs[5].capacity =
          udt1IsCKB
              ? utils.bnToHexNoLeadingZero(udt1Amount.actual)
              : rawTransaction.outputs[5].capacity;
      rawTransaction.outputs[6].capacity =
          udt2IsCKB
              ? utils.bnToHexNoLeadingZero(udt2Amount.actual)
              : rawTransaction.outputs[6].capacity;

      rawTransaction.outputsData.push(
          udt1IsCKB
              ? "0x"
              : utils.toUDTData(udt1Amount.actual)
              + udt1Info.dataWithoutAmount);
      rawTransaction.outputsData.push(
          udt2IsCKB
              ? "0x"
              : utils.toUDTData(udt2Amount.actual)
              + udt2Info.dataWithoutAmount);
      rawTransaction.outputsData.push(
          utils.toUDTData(liquidityUDTAmount.input - liquidityUDTAmount.actual)
      );

      rawTransaction.outputs[1].capacity =
          udt1IsCKB
              ? utils.bnToHexNoLeadingZero(udt1ReserveAfterBn)
              : rawTransaction.outputs[1].capacity;
      rawTransaction.outputs[2].capacity =
          udt2IsCKB
              ? utils.bnToHexNoLeadingZero(udt2ReserveAfterBn)
              : rawTransaction.outputs[2].capacity;

      //when transaction is for creating pool
    } else if(txIdx===3) {
      totalLiquidityAfter = "0x00000000000000000000000000000000";

      udt1ReserveAfter = utils.toUDTData(udt1Amount.actual);
      udt2ReserveAfter = utils.toUDTData(udt2Amount.actual);

      rawTransaction.outputs[5].capacity =
          udt1IsCKB
              ? utils.bnToHexNoLeadingZero(udt1Change)
              : rawTransaction.outputs[5].capacity;
      rawTransaction.outputs[6].capacity =
          udt2IsCKB
              ? utils.bnToHexNoLeadingZero(udt2Change)
              : rawTransaction.outputs[6].capacity;

      rawTransaction.outputsData.push(
          udt1IsCKB
              ? "0x"
              : utils.toUDTData(udt1Change) + udt1Info.dataWithoutAmount);
      rawTransaction.outputsData.push(
          udt2IsCKB
              ? "0x"
              : utils.toUDTData(udt2Change) + udt2Info.dataWithoutAmount);
    }
    rawTransaction.outputsData[0] =
        udt1ReserveAfter
        + udt2ReserveAfter.substr(2)
        + totalLiquidityAfter.substr(2);
    rawTransaction.outputsData[1] =
        udt1IsCKB
            ? "0x"
            : udt1ReserveAfter;
    rawTransaction.outputsData[2] =
        udt2IsCKB
            ? "0x"
            : udt2ReserveAfter;

    return rawTransaction;
  },

  /**
   * @dev set cell deps for raw transaction of UDTswap
   *
   * @param rawTransaction raw transaction of UDTswap
   * @param txIdx identifier of UDTswap transaction
   * @param udt1Info first UDT data
   * @param udt2Info second UDT data
   * @return raw transaction with cell deps of first, second UDT
   **/
  setDeps: function (
    rawTransaction,
    txIdx,
    udt1Info,
    udt2Info
  ) {
    if(
        !utils.sameCellDeps(rawTransaction.cellDeps, consts.UDTSwapTypeDeps)
    ) {
      rawTransaction.cellDeps.push(
        {
          outPoint: consts.UDTSwapTypeDeps,
          depType: "code"
        }
      );
    }

    if(
        !utils.sameCellDeps(rawTransaction.cellDeps, consts.UDTSwapLockDeps)
    ) {
      rawTransaction.cellDeps.push(
        {
          outPoint: consts.UDTSwapLockDeps,
          depType: "code"
        }
      );
    }

    //when adding or removing liquidity, add cell deps of liquidity UDT
    if(
        !utils.sameCellDeps(rawTransaction.cellDeps, consts.UDTSwapLiquidityUDTDeps)
        && (txIdx===1 || txIdx===2)
    ) {
      rawTransaction.cellDeps.push(
        {
          outPoint: consts.UDTSwapLiquidityUDTDeps,
          depType: "code"
        }
      );
    }

    let udt1Deps = {
      txHash: udt1Info.udtDepsTxHash,
      index: udt1Info.udtDepsTxIndex
    };
    if(
        !utils.sameCellDeps(rawTransaction.cellDeps, udt1Deps)
        && udt1Info.udtDepsTxIndex !== null
    ) {
      rawTransaction.cellDeps.push(
        {
          outPoint: udt1Deps,
          depType: udt1Info.udtDepsDepType
        }
      );
    }

    let udt2Deps = {
      txHash: udt2Info.udtDepsTxHash,
      index: udt2Info.udtDepsTxIndex
    };
    if(
        !utils.sameCellDeps(rawTransaction.cellDeps, udt2Deps)
        && udt2Info.udtDepsTxIndex !== null
    ) {
      rawTransaction.cellDeps.push(
        {
          outPoint: udt2Deps,
          depType: udt2Info.udtDepsDepType
        }
      );
    }
    return rawTransaction;
  },

  /**
   * @dev sign Transaction of UDTswap
   *
   * @param rawTransaction raw transaction of UDTswap
   * @param txIdx identifier of UDTswap transaction
   * @param sk secret key of testing account
   * @param poolCnt UDTswap pool count of swapping
   * @return signed transaction
   **/
  signWitnesses: function(
      rawTransaction,
      txIdx,
      sk,
      poolCnt
  ) {
    rawTransaction.witnesses = rawTransaction.inputs.map(() => ({
      lock: '',
      inputType: '',
      outputType: ''
    }));
    //when creating pool, all inputs are from testing account
    if(txIdx===3) {
      return consts.ckb.signTransaction(sk)(rawTransaction);
    }

    //when swapping, adding liquidity, removing liquidity, sign only inputs from testing account
    let pkh = `0x${consts.ckb.utils.blake160(
        consts.ckb.utils.privateKeyToPublicKey(sk), 
        'hex'
    )}`;
    let key = new Map([
            [consts.ckb.generateLockHash(pkh), sk]
        ]);

    let inputCells = [];
    let i = 0;
    while(i < rawTransaction.inputs.length - poolCnt*3) {
      inputCells.push({
        lock: {
          hashType: 'type',
          codeHash: consts.nervosDefaultLockCodeHash,
          args: pkh,
        }
      });
      i+=1;
    }

    let transactionHash = consts.ckb.utils.rawTransactionToHash(rawTransaction);
    let signedWitnesses = consts.ckb.signWitnesses(key)({
      transactionHash: transactionHash,
      witnesses: rawTransaction.witnesses.slice(poolCnt*3),
      inputCells: inputCells
    });
    signedWitnesses = signedWitnesses.map((witness) => {
      return typeof witness === 'string'
          ? witness
          : consts.CKBUtils.serializeWitnessArgs(witness)
    })[0];
    i = 0;
    while(i<rawTransaction.witnesses.length) {
      rawTransaction.witnesses[i] = '0x10000000100000001000000010000000';
      if(i===poolCnt*3) {
        rawTransaction.witnesses[i] = signedWitnesses;
      }
      i+=1;
    }
    return rawTransaction;
  },

  /**
   * @dev set transaction fee and sign Transaction of UDTswap
   *
   * fee is calculated with pool cell's difference, rest cell's capacity
   *
   * @param rawTransaction raw transaction of UDTswap
   * @param txIdx identifier of UDTswap transaction
   * @param udt1Info first UDT data
   * @param udt2Info second UDT data
   * @param poolInfo UDTswap pool data
   * @param poolCnt UDTswap pool count of swapping
   * @param sk secret key of testing account
   * @return signed transaction with transaction fee set
   **/
  setTxFeeAndSign: async function(
    rawTransaction,
    txIdx,
    udt1Info,
    udt2Info,
    poolInfo,
    poolCnt,
    sk,
  ) {
    //when creating pool, erase protection fee cell
    if(txIdx===3) {
      rawTransaction.outputs.splice(3, 1);
      rawTransaction.outputsData.splice(3, 1);
    }

    //calculate fee
    let fee = BigInt(
        (consts.CKBUtils.serializeTransaction(rawTransaction).length
        + 42 * (rawTransaction.inputs.length - 1)
        + 172 )
        / 2
        + 1000
    );

    //change the capacity of change cell
    let ckbChanged = BigInt(0);
    if(txIdx!==3) {
      ckbChanged = (
              BigInt(udt1Info[0].udtTypeHash)===BigInt(0)
                  ? (poolInfo[0].udt1Reserve - BigInt(rawTransaction.outputs[1].capacity))
                  : BigInt(0)
          ) + (
              BigInt(udt2Info[0].udtTypeHash)===BigInt(0)
                  ? (poolInfo[0].udt2Reserve - BigInt(rawTransaction.outputs[2].capacity))
                  : BigInt(0)
          );
    }
    //when swapping
    if(txIdx===0) {
      let i = 0;
      let ckbFeeCellIndex = poolCnt * 3 + 1;
      //for multiple swap, calculate changed CKB amount for all pools
      while(i<poolCnt) {
        ckbChanged = (
                BigInt(udt1Info[i].udtTypeHash)===BigInt(0)
                    ? (
                        poolInfo[i].udt1Reserve
                        - BigInt(rawTransaction.outputs[(poolCnt - 1 - i) * 3 + 1].capacity)
                    ) : BigInt(0)
            ) + (
                BigInt(udt2Info[i].udtTypeHash)===BigInt(0)
                    ? (
                        poolInfo[i].udt2Reserve
                        - BigInt(rawTransaction.outputs[(poolCnt - 1 - i) * 3 + 2].capacity)
                    ) : BigInt(0)
            );
        rawTransaction.outputs[ckbFeeCellIndex].capacity = utils.bnToHexNoLeadingZero(
          BigInt(rawTransaction.outputs[ckbFeeCellIndex].capacity)
          - BigInt(rawTransaction.outputs[poolCnt*3+i*2+2].capacity)
          - BigInt(rawTransaction.outputs[poolCnt*3+i*2+3].capacity)
          + ckbChanged
        );
        i+=1;
      }
      rawTransaction.outputs[ckbFeeCellIndex].capacity = utils.bnToHexNoLeadingZero(
        BigInt(rawTransaction.outputs[ckbFeeCellIndex].capacity)
        + consts.txFeeMax
        - fee
      );
      //when adding liquidity
    } else if(txIdx===1) {
      rawTransaction.outputs[7].capacity = utils.bnToHexNoLeadingZero(
        BigInt(rawTransaction.outputs[7].capacity)
        - BigInt(rawTransaction.outputs[5].capacity)
        - BigInt(rawTransaction.outputs[6].capacity)
        - BigInt(rawTransaction.outputs[4].capacity)
        + ckbChanged
        + consts.txFeeMax
        - fee
      );
      //when removing liquidity
    } else if(txIdx===2) {
      rawTransaction.outputs[4].capacity = utils.bnToHexNoLeadingZero(
        BigInt(rawTransaction.outputs[4].capacity)
        - BigInt(rawTransaction.outputs[5].capacity)
        - BigInt(rawTransaction.outputs[6].capacity)
        - BigInt(rawTransaction.outputs[7].capacity)
        + ckbChanged
        + consts.txFeeMax
        - fee
      );
      //when creating pool
    } else if(txIdx===3) {
      rawTransaction.outputs[3].capacity = utils.bnToHexNoLeadingZero(
        BigInt(rawTransaction.outputs[3].capacity)
        + consts.feeAmount
        - BigInt(rawTransaction.outputs[4].capacity)
        - BigInt(rawTransaction.outputs[5].capacity)
        - BigInt(rawTransaction.outputs[0].capacity)
        - BigInt(rawTransaction.outputs[1].capacity)
        - BigInt(rawTransaction.outputs[2].capacity)
        + consts.txFeeMax
        - fee
      );
    }

    rawTransaction = cellBuilder.signWitnesses(
        rawTransaction,
        txIdx,
        sk,
        poolCnt
    );

    return await consts.ckb.rpc.sendTransaction(
        rawTransaction,
        "passthrough"
    );
  },
}

module.exports = cellBuilder;
